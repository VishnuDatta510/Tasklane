import mimetypes

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from accounts.serializers import UserMiniSerializer
from common.permissions import membership_for
from projects.models import Project

from .models import ActivityLog, Attachment, Comment, Label, Task, TaskStatus

User = get_user_model()


class LabelSerializer(serializers.ModelSerializer):
    task_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Label
        fields = ["id", "organization", "name", "color", "task_count"]

    def validate_organization(self, value):
        if membership_for(self.context["request"].user, value.id) is None:
            raise serializers.ValidationError("You are not a member of that organization.")
        return value


class CommentSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "task", "author", "body", "created_at", "updated_at"]
        read_only_fields = ["id", "task", "author", "created_at", "updated_at"]

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("A comment cannot be empty.")
        if len(value) > 5000:
            raise serializers.ValidationError("Comments are limited to 5000 characters.")
        return value


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserMiniSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            "id",
            "task",
            "file",
            "file_url",
            "original_name",
            "content_type",
            "size",
            "uploaded_by",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "task",
            "original_name",
            "content_type",
            "size",
            "uploaded_by",
            "created_at",
        ]
        extra_kwargs = {"file": {"write_only": True}}

    def get_file_url(self, obj) -> str | None:
        if not obj.file:
            return None
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def validate_file(self, value):
        if value.size > settings.MAX_ATTACHMENT_SIZE:
            limit_mb = settings.MAX_ATTACHMENT_SIZE // (1024 * 1024)
            raise serializers.ValidationError(
                f"That file is too large. The limit is {limit_mb} MB."
            )
        claimed = getattr(value, "content_type", "") or ""
        guessed, _ = mimetypes.guess_type(value.name)
        if claimed not in settings.ALLOWED_ATTACHMENT_TYPES and (
            guessed not in settings.ALLOWED_ATTACHMENT_TYPES
        ):
            raise serializers.ValidationError("That file type is not allowed.")
        return value


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = UserMiniSerializer(read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)
    task_reference = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "task",
            "task_title",
            "task_reference",
            "actor",
            "verb",
            "field",
            "old_value",
            "new_value",
            "created_at",
        ]

    def get_task_reference(self, obj) -> str | None:
        return obj.task.reference if obj.task else None


class TaskSerializer(serializers.ModelSerializer):
    assignee = UserMiniSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source="assignee",
        queryset=User.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    created_by = UserMiniSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    label_ids = serializers.PrimaryKeyRelatedField(
        source="labels",
        queryset=Label.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )
    project_name = serializers.CharField(source="project.name", read_only=True)
    project_key = serializers.CharField(source="project.key", read_only=True)
    organization_id = serializers.IntegerField(source="project.organization_id", read_only=True)
    reference = serializers.CharField(read_only=True)
    overdue = serializers.BooleanField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    attachment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "project_name",
            "project_key",
            "organization_id",
            "number",
            "reference",
            "title",
            "description",
            "status",
            "priority",
            "assignee",
            "assignee_id",
            "created_by",
            "labels",
            "label_ids",
            "due_date",
            "position",
            "overdue",
            "comment_count",
            "attachment_count",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "created_by",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    # --- validation -------------------------------------------------------

    def validate_project(self, value: Project):
        if membership_for(self.context["request"].user, value.organization_id) is None:
            raise serializers.ValidationError(
                "You are not a member of that project's organization."
            )
        return value

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Give the task a title of at least 3 characters.")
        return value

    def validate_due_date(self, value):
        if value and self.instance is None and value < timezone.localdate():
            raise serializers.ValidationError("The due date cannot be in the past.")
        return value

    def validate(self, attrs):
        project = attrs.get("project") or getattr(self.instance, "project", None)
        if project is None:
            return attrs
        org_id = project.organization_id

        assignee = attrs.get("assignee", serializers.empty)
        if assignee not in (serializers.empty, None):
            if membership_for(assignee, org_id) is None:
                raise serializers.ValidationError(
                    {"assignee_id": "The assignee must be a member of the organization."}
                )

        labels = attrs.get("labels")
        if labels:
            if len(labels) > 8:
                raise serializers.ValidationError(
                    {"label_ids": "A task can carry at most 8 labels."}
                )
            foreign = [lab for lab in labels if lab.organization_id != org_id]
            if foreign:
                raise serializers.ValidationError(
                    {"label_ids": "Labels must belong to the same organization."}
                )
        return attrs


class TaskListSerializer(TaskSerializer):
    """Lighter payload for board and list views -- drops the description."""

    class Meta(TaskSerializer.Meta):
        fields = [f for f in TaskSerializer.Meta.fields if f != "description"]


class TaskMoveSerializer(serializers.Serializer):
    """Board drag-and-drop: change column and/or ordering in one call."""

    status = serializers.ChoiceField(choices=TaskStatus.choices, required=False)
    position = serializers.FloatField(required=False)
