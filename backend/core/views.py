from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import api_response
from core.serializers import LoginSerializer, SignupSerializer, UserSerializer

User = get_user_model()


def set_jwt_cookies(response, refresh_token):
    access = refresh_token.access_token
    response.set_cookie(
        key=settings.JWT_ACCESS_COOKIE,
        value=str(access),
        httponly=settings.JWT_COOKIE_HTTPONLY,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
    )
    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE,
        value=str(refresh_token),
        httponly=settings.JWT_COOKIE_HTTPONLY,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )
    return response


def clear_jwt_cookies(response):
    response.delete_cookie(settings.JWT_ACCESS_COOKIE)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE)
    return response


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        response = api_response(
            data={"user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
        return set_jwt_cookies(response, refresh)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate(request, email=email, password=password)

        if user is None:
            return api_response(
                error={"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        response = api_response(data={"user": UserSerializer(user).data})
        return set_jwt_cookies(response, refresh)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = api_response(data={"detail": "Logged out"})
        return clear_jwt_cookies(response)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return api_response(data={"user": UserSerializer(request.user).data})


class RootView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return api_response(
            data={
                "name": "TaskFlow API",
                "frontend": "http://localhost:5173",
                "docs": "See README.md for endpoint list",
                "endpoints": {
                    "auth": "/api/auth/signup, /api/auth/login, /api/auth/me",
                    "workspaces": "/api/workspaces",
                    "projects": "/api/workspaces/:id/projects",
                    "board": "/api/projects/:id/board",
                    "tasks": "/api/tasks",
                },
            }
        )
