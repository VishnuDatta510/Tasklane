from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter

from common.views import HealthView
from dashboard.views import DashboardView
from orgs.views import (
    AcceptInvitationViewSet,
    MyInvitationsViewSet,
    OrganizationViewSet,
)
from projects.views import ProjectViewSet
from tasks.views import (
    ActivityViewSet,
    AttachmentViewSet,
    CommentViewSet,
    LabelViewSet,
    TaskViewSet,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("projects", ProjectViewSet, basename="project")
router.register("tasks", TaskViewSet, basename="task")
router.register("labels", LabelViewSet, basename="label")
router.register("activity", ActivityViewSet, basename="activity")
router.register("my-invitations", MyInvitationsViewSet, basename="my-invitation")
router.register("invitations/accept", AcceptInvitationViewSet, basename="accept-invitation")

tasks_router = NestedDefaultRouter(router, "tasks", lookup="task")
tasks_router.register("comments", CommentViewSet, basename="task-comments")
tasks_router.register("attachments", AttachmentViewSet, basename="task-attachments")

api_patterns = [
    path("auth/", include("accounts.urls")),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("health/", HealthView.as_view(), name="health"),
    path("", include(router.urls)),
    path("", include(tasks_router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_patterns)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    if "debug_toolbar" in settings.INSTALLED_APPS:
        urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]
