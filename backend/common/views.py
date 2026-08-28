from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView


@extend_schema(
    tags=["meta"],
    summary="Liveness and dependency check",
    responses={
        200: inline_serializer(
            "Health",
            {
                "status": serializers.CharField(),
                "checks": serializers.DictField(child=serializers.CharField()),
            },
        )
    },
)
class HealthView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        checks = {"database": "unknown", "cache": "unknown"}
        healthy = True

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            checks["database"] = "ok"
        except Exception as exc:  # noqa: BLE001
            checks["database"] = f"error: {exc.__class__.__name__}"
            healthy = False

        try:
            from django.core.cache import cache

            cache.set("health-probe", "1", 5)
            checks["cache"] = "ok" if cache.get("health-probe") == "1" else "degraded"
        except Exception as exc:  # noqa: BLE001
            checks["cache"] = f"error: {exc.__class__.__name__}"

        return Response(
            {"status": "ok" if healthy else "unhealthy", "checks": checks},
            status=200 if healthy else 503,
        )
