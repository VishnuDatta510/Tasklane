from django.contrib.auth import get_user_model
from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    ChangePasswordSerializer,
    EmailTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


@extend_schema(
    tags=["auth"],
    summary="Register a new account",
    description="Creates a user. The response never contains the password.",
)
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"


@extend_schema(tags=["auth"], summary="Obtain an access and refresh token")
class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"


@extend_schema_view(
    get=extend_schema(tags=["auth"], summary="Current user"),
    patch=extend_schema(tags=["auth"], summary="Update current user"),
)
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


@extend_schema(
    tags=["auth"],
    summary="Change password",
    request=ChangePasswordSerializer,
    responses={
        200: inline_serializer("ChangePasswordResponse", {"detail": serializers.CharField()}),
        400: OpenApiResponse(description="Current password wrong or new one rejected"),
    },
)
class ChangePasswordView(APIView):
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)
