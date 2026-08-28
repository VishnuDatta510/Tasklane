from django.db import transaction
from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from common.permissions import (
    IsAuthorOrOrgManagerOrReadOnly,
    IsOrgMember,
    IsOrgMemberWriteManager,
    has_role_at_least,
    membership_for,
)
from dashboard.views import invalidate_dashboard
from orgs.models import Role

from . import services
from .emails import send_assignment_email
from .filters import TaskFilterSet
from .models import ActivityLog, Attachment, Comment, Label, Task
from .serializers import (
    ActivityLogSerializer,
    AttachmentSerializer,
    CommentSerializer,
    LabelSerializer,
    TaskListSerializer,
    TaskMoveSerializer,
    TaskSerializer,
)


@extend_schema(tags=["tasks"])
class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.none()
    permission_classes = [IsOrgMember]
    filterset_class = TaskFilterSet
    search_fields = ["title", "description", "project__key"]
    ordering_fields = [
        "due_date",
        "priority",
        "status",
        "created_at",
        "updated_at",
        "position",
    ]
    ordering = ["position", "-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return TaskListSerializer
        return TaskSerializer

    def get_queryset(self):
        """Scoped to organizations the requester belongs to.

        select_related covers the forward foreign keys (one join each);
        prefetch_related covers labels, which is a many-to-many and cannot be
        joined without duplicating rows. Together these keep the list endpoint
        at a constant query count regardless of how many tasks come back.
        """
        return (
            Task.objects.filter(project__organization__memberships__user=self.request.user)
            .distinct()
            .select_related("project", "project__organization", "assignee", "created_by")
            .prefetch_related("labels")
            .annotate(
                comment_count=Count("comments", distinct=True),
                attachment_count=Count("attachments", distinct=True),
            )
        )

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        task = serializer.save(created_by=self.request.user)
        services.log_simple(task, self.request.user, ActivityLog.Verb.CREATED, task.title)
        invalidate_dashboard(project.organization_id)
        if task.assignee_id and task.assignee_id != self.request.user.id:
            self._queue_assignment_email(task, task.assignee_id)

    def perform_update(self, serializer):
        before = services.snapshot(serializer.instance)
        previous_assignee = serializer.instance.assignee_id
        task = serializer.save()
        services.log_changes(task, before, self.request.user)
        invalidate_dashboard(task.project.organization_id)

        if task.assignee_id and task.assignee_id != previous_assignee:
            if task.assignee_id != self.request.user.id:
                self._queue_assignment_email(task, task.assignee_id)

    def perform_destroy(self, instance):
        org_id = instance.project.organization_id
        is_creator = instance.created_by_id == self.request.user.id
        if not is_creator and not has_role_at_least(self.request.user, org_id, Role.MANAGER):
            raise PermissionDenied("Only the task's creator or a manager can delete it.")
        instance.delete()
        invalidate_dashboard(org_id)

    def _queue_assignment_email(self, task, assignee_id):
        actor_id = self.request.user.id
        task_id = task.id
        transaction.on_commit(lambda: send_assignment_email(task_id, assignee_id, actor_id))

    # --- board actions ----------------------------------------------------

    @extend_schema(
        summary="Move a task between board columns",
        request=TaskMoveSerializer,
        responses=TaskSerializer,
    )
    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        task = self.get_object()
        serializer = TaskMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        before = services.snapshot(task)
        for field, value in serializer.validated_data.items():
            setattr(task, field, value)
        task.save()
        services.log_changes(task, before, request.user)
        invalidate_dashboard(task.project.organization_id)

        return Response(TaskSerializer(task, context={"request": request}).data)

    @extend_schema(summary="Activity for one task", responses=ActivityLogSerializer(many=True))
    @action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        task = self.get_object()
        qs = task.activity.select_related("actor").all()[:100]
        return Response(ActivityLogSerializer(qs, many=True, context={"request": request}).data)


@extend_schema(tags=["tasks"])
class CommentViewSet(viewsets.ModelViewSet):
    """Nested under /api/tasks/{task_pk}/comments/.

    The parent task id comes from the URL, so `task` is read-only on the
    serializer and cannot be forged through the request body.
    """

    queryset = Comment.objects.none()
    serializer_class = CommentSerializer
    permission_classes = [IsAuthorOrOrgManagerOrReadOnly]

    def get_task(self):
        task = (
            Task.objects.select_related("project")
            .filter(
                pk=self.kwargs["task_pk"],
                project__organization__memberships__user=self.request.user,
            )
            .first()
        )
        if task is None:
            raise NotFound("No such task.")
        return task

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Comment.objects.none()
        return Comment.objects.filter(task=self.get_task()).select_related(
            "author", "task", "task__project"
        )

    def perform_create(self, serializer):
        task = self.get_task()
        comment = serializer.save(task=task, author=self.request.user)
        services.log_simple(task, self.request.user, ActivityLog.Verb.COMMENTED, comment.body[:80])


@extend_schema(tags=["tasks"])
class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.none()
    serializer_class = AttachmentSerializer
    permission_classes = [IsOrgMember]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_task(self):
        task = (
            Task.objects.select_related("project")
            .filter(
                pk=self.kwargs["task_pk"],
                project__organization__memberships__user=self.request.user,
            )
            .first()
        )
        if task is None:
            raise NotFound("No such task.")
        return task

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Attachment.objects.none()
        return Attachment.objects.filter(task=self.get_task()).select_related(
            "uploaded_by", "task", "task__project"
        )

    def perform_create(self, serializer):
        task = self.get_task()
        uploaded = serializer.validated_data["file"]
        attachment = serializer.save(
            task=task,
            uploaded_by=self.request.user,
            original_name=uploaded.name[:255],
            content_type=getattr(uploaded, "content_type", "") or "",
            size=uploaded.size,
        )
        services.log_simple(
            task,
            self.request.user,
            ActivityLog.Verb.ATTACHED,
            attachment.original_name,
        )

    def perform_destroy(self, instance):
        is_uploader = instance.uploaded_by_id == self.request.user.id
        org_id = instance.task.project.organization_id
        if not is_uploader and not has_role_at_least(self.request.user, org_id, Role.MANAGER):
            raise PermissionDenied("Only the uploader or a manager can delete this.")
        instance.file.delete(save=False)
        instance.delete()


@extend_schema(tags=["tasks"])
class LabelViewSet(viewsets.ModelViewSet):
    queryset = Label.objects.none()
    serializer_class = LabelSerializer
    permission_classes = [IsOrgMemberWriteManager]
    filterset_fields = ["organization"]
    search_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        return (
            Label.objects.filter(organization__memberships__user=self.request.user)
            .distinct()
            .annotate(task_count=Count("tasks", distinct=True))
        )

    def perform_create(self, serializer):
        organization = serializer.validated_data["organization"]
        if membership_for(self.request.user, organization.id) is None:
            raise PermissionDenied("You are not a member of that organization.")
        serializer.save()


@extend_schema(
    tags=["tasks"],
    parameters=[
        OpenApiParameter(
            "organization",
            int,
            description="Restrict the feed to one organization.",
        )
    ],
)
class ActivityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.none()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsOrgMember]
    filterset_fields = ["organization", "task", "verb", "actor"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            ActivityLog.objects.filter(organization__memberships__user=self.request.user)
            .distinct()
            .select_related("actor", "task", "task__project")
        )
