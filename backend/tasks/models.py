import os

from django.conf import settings
from django.db import models
from django.utils import timezone

from orgs.models import Organization
from projects.models import Project


class TaskStatus(models.TextChoices):
    TODO = "todo", "To do"
    IN_PROGRESS = "in_progress", "In progress"
    IN_REVIEW = "in_review", "In review"
    DONE = "done", "Done"


class TaskPriority(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"

    @staticmethod
    def rank(value: str) -> int:
        return {"low": 1, "medium": 2, "high": 3, "urgent": 4}.get(value, 0)


class Label(models.Model):
    """A tag scoped to an organization, reusable across its projects."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="labels")
    name = models.CharField(max_length=40)
    color = models.CharField(max_length=7, default="#6366F1")

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"], name="unique_label_name_per_org"
            )
        ]

    def __str__(self):
        return self.name


class Task(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks")
    number = models.PositiveIntegerField(editable=False, default=0)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.TODO)
    priority = models.CharField(
        max_length=20, choices=TaskPriority.choices, default=TaskPriority.MEDIUM
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks_assigned",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="tasks_created",
    )
    labels = models.ManyToManyField(Label, blank=True, related_name="tasks")
    due_date = models.DateField(null=True, blank=True)
    position = models.FloatField(default=0)
    is_overdue = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "number"], name="unique_task_number_per_project"
            )
        ]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["assignee", "status"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return f"{self.reference} {self.title}"

    def save(self, *args, **kwargs):
        if not self.number:
            last = (
                Task.objects.filter(project=self.project)
                .order_by("-number")
                .values_list("number", flat=True)
                .first()
            )
            self.number = (last or 0) + 1
        if self.status == TaskStatus.DONE and self.completed_at is None:
            self.completed_at = timezone.now()
        if self.status != TaskStatus.DONE:
            self.completed_at = None
        super().save(*args, **kwargs)

    @property
    def reference(self):
        return f"{self.project.key}-{self.number}"

    @property
    def overdue(self):
        return bool(
            self.due_date
            and self.status != TaskStatus.DONE
            and self.due_date < timezone.localdate()
        )


class Comment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="comments",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["task", "created_at"])]

    def __str__(self):
        return f"comment on {self.task_id} by {self.author_id}"


def attachment_upload_to(instance, filename):
    return os.path.join("attachments", str(instance.task_id), filename)


class Attachment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=attachment_upload_to)
    original_name = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="attachments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.original_name or str(self.file)


class ActivityLog(models.Model):
    """Append-only audit trail.

    Written explicitly from the serializer/view layer rather than from a
    post_save signal: signals fire for every save including fixtures and data
    migrations, and they hide the write from anyone reading the view.
    """

    class Verb(models.TextChoices):
        CREATED = "created", "Created"
        STATUS_CHANGED = "status_changed", "Status changed"
        REASSIGNED = "reassigned", "Reassigned"
        PRIORITY_CHANGED = "priority_changed", "Priority changed"
        DUE_DATE_CHANGED = "due_date_changed", "Due date changed"
        COMMENTED = "commented", "Commented"
        ATTACHED = "attached", "Attached a file"
        OVERDUE_FLAGGED = "overdue_flagged", "Flagged overdue"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="activity"
    )
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="activity", null=True, blank=True
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="activity",
    )
    verb = models.CharField(max_length=32, choices=Verb.choices)
    field = models.CharField(max_length=40, blank=True)
    old_value = models.CharField(max_length=255, blank=True)
    new_value = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "-created_at"]),
            models.Index(fields=["task", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.actor_id} {self.verb} {self.task_id}"
