"""Aggregate statistics for one organization, cached in Redis.

Two things matter here:

1. All counting happens in SQL. A Python loop over tasks would be one query
   per member and would get slower as the org grows.
2. The cache key is scoped to the organization *and* the requesting user.
   A key of just "dashboard:5" would serve one user's permission-filtered
   numbers to everybody.
"""

from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import membership_for
from orgs.models import Membership, Organization
from projects.models import Project
from tasks.models import ActivityLog, Task, TaskStatus

CACHE_VERSION = "v1"


def dashboard_cache_key(organization_id: int, user_id: int) -> str:
    return f"dashboard:{CACHE_VERSION}:org{organization_id}:user{user_id}"


def invalidate_dashboard(organization_id: int) -> None:
    """Drop every cached dashboard for one organization.

    delete_pattern is a django-redis extension; it is not part of Django's
    cache API. We accept the SCAN cost because dashboards are read far more
    often than tasks are written.
    """
    try:
        cache.delete_pattern(f"*dashboard:{CACHE_VERSION}:org{organization_id}:*")
    except AttributeError:
        pass


class DashboardStatsSerializer(serializers.Serializer):
    """Documentation-only: describes the response shape for the schema."""

    organization = serializers.DictField()
    totals = serializers.DictField()
    by_status = serializers.ListField()
    by_priority = serializers.ListField()
    per_member = serializers.ListField()
    per_project = serializers.ListField()
    recent_activity = serializers.ListField()
    completion_trend = serializers.ListField()


@extend_schema(
    tags=["dashboard"],
    summary="Aggregate statistics for one organization",
    parameters=[
        OpenApiParameter(
            "organization",
            int,
            required=True,
            description="Organization id to report on.",
        )
    ],
    responses={
        200: DashboardStatsSerializer,
        400: OpenApiResponse(description="organization query parameter missing"),
        404: OpenApiResponse(description="Not a member of that organization"),
    },
)
class DashboardView(APIView):
    def get(self, request):
        org_id = request.query_params.get("organization")
        if not org_id:
            return Response(
                {"detail": "The `organization` query parameter is required.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            org_id = int(org_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "`organization` must be an integer.", "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if membership_for(request.user, org_id) is None:
            return Response(
                {"detail": "Not found.", "errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )

        key = dashboard_cache_key(org_id, request.user.id)
        payload = cache.get(key)
        if payload is None:
            payload = self.build(org_id, request)
            cache.set(key, payload, settings.DASHBOARD_CACHE_TTL)
            payload["cached"] = False
        else:
            payload["cached"] = True
        return Response(payload)

    def build(self, org_id: int, request) -> dict:
        today = timezone.localdate()
        organization = Organization.objects.get(pk=org_id)
        tasks = Task.objects.filter(project__organization_id=org_id)
        open_statuses = [
            TaskStatus.TODO,
            TaskStatus.IN_PROGRESS,
            TaskStatus.IN_REVIEW,
        ]

        by_status_rows = tasks.values("status").annotate(count=Count("id")).order_by("status")
        status_counts = {row["status"]: row["count"] for row in by_status_rows}

        by_priority_rows = tasks.values("priority").annotate(count=Count("id")).order_by("priority")

        total = sum(status_counts.values())
        done = status_counts.get(TaskStatus.DONE, 0)
        overdue = tasks.filter(due_date__lt=today, status__in=open_statuses).count()
        due_soon = tasks.filter(
            due_date__gte=today,
            due_date__lte=today + timedelta(days=7),
            status__in=open_statuses,
        ).count()
        unassigned = tasks.filter(assignee__isnull=True, status__in=open_statuses).count()

        per_member = list(
            Membership.objects.filter(organization_id=org_id)
            .select_related("user")
            .annotate(
                open_tasks=Count(
                    "user__tasks_assigned",
                    filter=Q(user__tasks_assigned__project__organization_id=org_id)
                    & ~Q(user__tasks_assigned__status=TaskStatus.DONE),
                    distinct=True,
                ),
                done_tasks=Count(
                    "user__tasks_assigned",
                    filter=Q(user__tasks_assigned__project__organization_id=org_id)
                    & Q(user__tasks_assigned__status=TaskStatus.DONE),
                    distinct=True,
                ),
                overdue_tasks=Count(
                    "user__tasks_assigned",
                    filter=Q(user__tasks_assigned__project__organization_id=org_id)
                    & Q(user__tasks_assigned__due_date__lt=today)
                    & ~Q(user__tasks_assigned__status=TaskStatus.DONE),
                    distinct=True,
                ),
            )
            .values(
                "user_id",
                "role",
                "user__email",
                "user__full_name",
                "open_tasks",
                "done_tasks",
                "overdue_tasks",
            )
        )

        per_project = list(
            Project.objects.filter(organization_id=org_id)
            .annotate(
                total_tasks=Count("tasks", distinct=True),
                open_tasks=Count(
                    "tasks",
                    filter=~Q(tasks__status=TaskStatus.DONE),
                    distinct=True,
                ),
                done_tasks=Count("tasks", filter=Q(tasks__status=TaskStatus.DONE), distinct=True),
                overdue_tasks=Count(
                    "tasks",
                    filter=Q(tasks__due_date__lt=today) & ~Q(tasks__status=TaskStatus.DONE),
                    distinct=True,
                ),
            )
            .values(
                "id",
                "name",
                "key",
                "color",
                "status",
                "total_tasks",
                "open_tasks",
                "done_tasks",
                "overdue_tasks",
            )
        )

        recent_activity = list(
            ActivityLog.objects.filter(organization_id=org_id)
            .select_related("actor", "task", "task__project")
            .order_by("-created_at")[:15]
            .values(
                "id",
                "verb",
                "field",
                "old_value",
                "new_value",
                "created_at",
                "task_id",
                "task__title",
                "actor__full_name",
                "actor__email",
            )
        )

        trend = list(
            tasks.filter(
                completed_at__isnull=False,
                completed_at__gte=timezone.now() - timedelta(days=30),
            )
            .annotate(day=TruncDate("completed_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        return {
            "organization": {
                "id": organization.id,
                "name": organization.name,
                "slug": organization.slug,
            },
            "totals": {
                "tasks": total,
                "open": total - done,
                "done": done,
                "overdue": overdue,
                "due_soon": due_soon,
                "unassigned": unassigned,
                "projects": len(per_project),
                "members": len(per_member),
                "completion_rate": round((done / total) * 100, 1) if total else 0.0,
            },
            "by_status": [
                {"status": s.value, "label": s.label, "count": status_counts.get(s.value, 0)}
                for s in TaskStatus
            ],
            "by_priority": list(by_priority_rows),
            "per_member": per_member,
            "per_project": per_project,
            "recent_activity": [
                {
                    **row,
                    "created_at": row["created_at"].isoformat(),
                }
                for row in recent_activity
            ],
            "completion_trend": [
                {"day": row["day"].isoformat(), "count": row["count"]} for row in trend
            ],
            "generated_at": timezone.now().isoformat(),
        }
