from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import UserMiniSerializer

from .models import Invitation, Membership, Organization, Role

User = get_user_model()


class MembershipSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "role", "joined_at"]
        read_only_fields = ["id", "user", "joined_at"]

    def validate_role(self, value):
        """Owners are the only ones who may hand out the owner role, and the
        last owner may not demote themselves out of existence."""
        request = self.context["request"]
        instance = self.instance

        if instance is None:
            return value

        actor_role = (
            instance.organization.memberships.filter(user=request.user)
            .values_list("role", flat=True)
            .first()
        )

        if value == Role.OWNER and actor_role != Role.OWNER:
            raise serializers.ValidationError("Only an owner can grant the owner role.")

        if instance.role == Role.OWNER and value != Role.OWNER:
            remaining_owners = (
                instance.organization.memberships.filter(role=Role.OWNER)
                .exclude(pk=instance.pk)
                .count()
            )
            if remaining_owners == 0:
                raise serializers.ValidationError("An organization must keep at least one owner.")
        return value


class OrganizationSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    member_count = serializers.IntegerField(read_only=True)
    project_count = serializers.IntegerField(read_only=True)
    created_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "created_by",
            "my_role",
            "member_count",
            "project_count",
            "created_at",
        ]
        read_only_fields = ["id", "slug", "created_by", "created_at"]

    def get_my_role(self, obj) -> str | None:
        user = self.context["request"].user
        for m in obj.memberships.all():
            if m.user_id == user.id:
                return m.role
        return None


class InvitationSerializer(serializers.ModelSerializer):
    invited_by = UserMiniSerializer(read_only=True)
    is_pending = serializers.BooleanField(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = Invitation
        fields = [
            "id",
            "organization",
            "organization_name",
            "email",
            "role",
            "invited_by",
            "accepted_at",
            "expires_at",
            "is_pending",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "invited_by",
            "accepted_at",
            "expires_at",
            "created_at",
        ]

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        organization = self.context["organization"]
        email = attrs.get("email")

        if organization.memberships.filter(user__email__iexact=email).exists():
            raise serializers.ValidationError({"email": "That person is already a member."})
        if organization.invitations.filter(email__iexact=email, accepted_at__isnull=True).exists():
            raise serializers.ValidationError(
                {"email": "There is already a pending invite for that email."}
            )
        if attrs.get("role") == Role.OWNER:
            raise serializers.ValidationError(
                {"role": "Invite as manager or member, then promote to owner."}
            )
        return attrs


class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField()

    def validate_token(self, value):
        invitation = Invitation.objects.filter(token=value).select_related("organization").first()
        if invitation is None:
            raise serializers.ValidationError("That invitation link is not valid.")
        if invitation.accepted_at is not None:
            raise serializers.ValidationError("That invitation was already used.")
        if invitation.is_expired:
            raise serializers.ValidationError("That invitation has expired.")

        request = self.context["request"]
        if invitation.email.lower() != request.user.email.lower():
            raise serializers.ValidationError(
                "That invitation was sent to a different email address."
            )
        self.context["invitation"] = invitation
        return value
