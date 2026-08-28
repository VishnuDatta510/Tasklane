from django.db import transaction
from django.db.models import Count, Prefetch
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from common.permissions import (
    IsOrgMember,
    IsOrgMemberWriteManager,
    role_for,
)
from tasks.emails import send_invitation_email

from .models import Invitation, Membership, Organization, Role
from .serializers import (
    AcceptInvitationSerializer,
    InvitationSerializer,
    MembershipSerializer,
    OrganizationSerializer,
)


@extend_schema(tags=["organizations"])
class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.none()
    serializer_class = OrganizationSerializer
    permission_classes = [IsOrgMemberWriteManager]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        """Scope to organizations the requester belongs to.

        This is the security boundary for the list endpoint --
        has_object_permission is never consulted for a list.
        """
        return (
            Organization.objects.filter(memberships__user=self.request.user)
            .distinct()
            .select_related("created_by")
            .prefetch_related(
                Prefetch(
                    "memberships",
                    queryset=Membership.objects.select_related("user"),
                )
            )
            .annotate(
                member_count=Count("memberships", distinct=True),
                project_count=Count("projects", distinct=True),
            )
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            organization = serializer.save(created_by=self.request.user)
            Membership.objects.create(
                organization=organization, user=self.request.user, role=Role.OWNER
            )

    def perform_destroy(self, instance):
        if role_for(self.request.user, instance.id) != Role.OWNER:
            raise PermissionDenied("Only an owner can delete an organization.")
        instance.delete()

    # --- members ----------------------------------------------------------

    @extend_schema(summary="List members", responses=MembershipSerializer(many=True))
    @action(detail=True, methods=["get"], permission_classes=[IsOrgMember])
    def members(self, request, pk=None):
        organization = self.get_object()
        memberships = organization.memberships.select_related("user").all()
        return Response(MembershipSerializer(memberships, many=True).data)

    @extend_schema(
        summary="Change a member's role",
        request=MembershipSerializer,
        parameters=[
            OpenApiParameter(
                "membership_id",
                int,
                OpenApiParameter.PATH,
                description="Membership row id, not the user id.",
            )
        ],
    )
    @action(
        detail=True,
        methods=["patch"],
        url_path="members/(?P<membership_id>[^/.]+)",
        permission_classes=[IsOrgMemberWriteManager],
    )
    def update_member(self, request, pk=None, membership_id=None):
        organization = self.get_object()
        membership = organization.memberships.filter(pk=membership_id).first()
        if membership is None:
            return Response(
                {"detail": "Not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MembershipSerializer(
            membership,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(
        summary="Remove a member",
        parameters=[
            OpenApiParameter(
                "membership_id",
                int,
                OpenApiParameter.PATH,
                description="Membership row id, not the user id.",
            )
        ],
    )
    @action(
        detail=True,
        methods=["delete"],
        url_path="members/(?P<membership_id>[^/.]+)/remove",
        permission_classes=[IsOrgMemberWriteManager],
    )
    def remove_member(self, request, pk=None, membership_id=None):
        organization = self.get_object()
        membership = organization.memberships.filter(pk=membership_id).first()
        if membership is None:
            return Response(
                {"detail": "Not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if membership.role == Role.OWNER:
            owners = organization.memberships.filter(role=Role.OWNER).count()
            if owners <= 1:
                raise ValidationError({"detail": "An organization must keep at least one owner."})
            if role_for(request.user, organization.id) != Role.OWNER:
                raise PermissionDenied("Only an owner can remove another owner.")
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- invitations ------------------------------------------------------

    @extend_schema(
        summary="List or create invitations",
        request=InvitationSerializer,
        responses={200: InvitationSerializer(many=True), 201: InvitationSerializer},
    )
    @action(
        detail=True,
        methods=["get", "post"],
        permission_classes=[IsOrgMemberWriteManager],
    )
    def invitations(self, request, pk=None):
        organization = self.get_object()

        if request.method == "GET":
            qs = organization.invitations.select_related("invited_by").all()
            return Response(InvitationSerializer(qs, many=True).data)

        serializer = InvitationSerializer(
            data=request.data,
            context={"request": request, "organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save(organization=organization, invited_by=request.user)
        transaction.on_commit(lambda: send_invitation_email(invitation.id))
        return Response(InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Revoke an invitation",
        responses={204: OpenApiResponse(description="Revoked")},
        parameters=[OpenApiParameter("invitation_id", int, OpenApiParameter.PATH)],
    )
    @action(
        detail=True,
        methods=["delete"],
        url_path="invitations/(?P<invitation_id>[^/.]+)",
        permission_classes=[IsOrgMemberWriteManager],
    )
    def revoke_invitation(self, request, pk=None, invitation_id=None):
        organization = self.get_object()
        deleted, _ = organization.invitations.filter(
            pk=invitation_id, accepted_at__isnull=True
        ).delete()
        if not deleted:
            return Response(
                {"detail": "Not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(summary="Leave this organization")
    @action(detail=True, methods=["post"], permission_classes=[IsOrgMember])
    def leave(self, request, pk=None):
        organization = self.get_object()
        membership = organization.memberships.filter(user=request.user).first()
        if membership is None:
            raise ValidationError({"detail": "You are not a member."})
        if membership.role == Role.OWNER:
            owners = organization.memberships.filter(role=Role.OWNER).count()
            if owners <= 1:
                raise ValidationError({"detail": "Transfer ownership before leaving."})
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["organizations"],
    summary="Accept an invitation by token",
    request=AcceptInvitationSerializer,
    responses={200: OpenApiResponse(description="Joined the organization")},
)
class AcceptInvitationViewSet(viewsets.ViewSet):
    serializer_class = AcceptInvitationSerializer

    def create(self, request):
        serializer = AcceptInvitationSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        invitation = serializer.context["invitation"]

        with transaction.atomic():
            Membership.objects.get_or_create(
                organization=invitation.organization,
                user=request.user,
                defaults={"role": invitation.role},
            )
            invitation.accepted_at = timezone.now()
            invitation.save(update_fields=["accepted_at"])

        return Response(
            {
                "detail": f"You joined {invitation.organization.name}.",
                "organization_id": invitation.organization_id,
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["organizations"], summary="Invitations addressed to me")
class MyInvitationsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Invitation.objects.none()
    serializer_class = InvitationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Invitation.objects.none()
        return Invitation.objects.filter(
            email__iexact=self.request.user.email,
            accepted_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).select_related("organization", "invited_by")
