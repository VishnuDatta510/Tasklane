import django_filters as filters

from .models import Label, Task, TaskPriority, TaskStatus


class TaskFilterSet(filters.FilterSet):
    """Query parameters for /api/tasks/.

    Note that this composes with, and never replaces, the queryset scoping in
    the viewset: filters narrow an already-safe queryset.
    """

    organization = filters.NumberFilter(field_name="project__organization_id")
    project = filters.NumberFilter(field_name="project_id")
    status = filters.MultipleChoiceFilter(choices=TaskStatus.choices)
    priority = filters.MultipleChoiceFilter(choices=TaskPriority.choices)
    assignee = filters.NumberFilter(field_name="assignee_id")
    unassigned = filters.BooleanFilter(field_name="assignee_id", lookup_expr="isnull")
    label = filters.ModelMultipleChoiceFilter(
        field_name="labels", queryset=Label.objects.all(), conjoined=False
    )
    due_after = filters.DateFilter(field_name="due_date", lookup_expr="gte")
    due_before = filters.DateFilter(field_name="due_date", lookup_expr="lte")
    has_due_date = filters.BooleanFilter(method="filter_has_due_date")
    overdue = filters.BooleanFilter(method="filter_overdue")
    created_after = filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")

    class Meta:
        model = Task
        fields = [
            "organization",
            "project",
            "status",
            "priority",
            "assignee",
            "label",
        ]

    def filter_has_due_date(self, queryset, name, value):
        return queryset.filter(due_date__isnull=not value)

    def filter_overdue(self, queryset, name, value):
        from django.utils import timezone

        today = timezone.localdate()
        if value:
            return queryset.filter(due_date__lt=today).exclude(status=TaskStatus.DONE)
        return queryset.exclude(
            due_date__lt=today,
            status__in=[TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW],
        )
