from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from common.permissions import IsOrgMemberWriteManager, has_role_at_least
from orgs.models import Role
from tasks.models import TaskStatus

from .models import Project
from .serializers import ProjectSerializer


@extend_schema(tags=["projects"])
class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.none()
    serializer_class = ProjectSerializer
    permission_classes = [IsOrgMemberWriteManager]
    filterset_fields = ["organization", "status", "lead"]
    search_fields = ["name", "key", "description"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        return (
            Project.objects.filter(organization__memberships__user=self.request.user)
            .distinct()
            .select_related("organization", "lead", "created_by")
            .annotate(
                task_count=Count("tasks", distinct=True),
                open_task_count=Count(
                    "tasks",
                    filter=~Q(tasks__status=TaskStatus.DONE),
                    distinct=True,
                ),
                done_task_count=Count(
                    "tasks",
                    filter=Q(tasks__status=TaskStatus.DONE),
                    distinct=True,
                ),
            )
        )

    def perform_create(self, serializer):
        organization = serializer.validated_data["organization"]
        if not has_role_at_least(self.request.user, organization.id, Role.MANAGER):
            raise PermissionDenied("You need manager or owner rights to create a project.")
        serializer.save(created_by=self.request.user)
