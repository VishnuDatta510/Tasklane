from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def api_exception_handler(exc, context):
    """Give every error the same envelope so the frontend has one code path.

    DRF's default handler returns a bare dict of field errors, which means the
    client has to guess whether it is looking at {"detail": ...} or
    {"title": ["..."]}. We normalise to:

        {"detail": "...", "errors": {"field": ["..."]}}
    """
    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "That conflicts with something that already exists.", "errors": {}},
            status=status.HTTP_409_CONFLICT,
        )

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        response.data = {"detail": str(data["detail"]), "errors": {}}
    elif isinstance(data, dict):
        non_field = data.get("non_field_errors")
        detail = (
            str(non_field[0])
            if isinstance(non_field, list) and non_field
            else "Please correct the errors below."
        )
        response.data = {"detail": detail, "errors": data}
    elif isinstance(data, list):
        response.data = {"detail": str(data[0]) if data else "Error", "errors": {}}

    return response
