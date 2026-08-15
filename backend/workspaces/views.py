from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.exceptions import api_response
from core.permissions import IsWorkspaceAdmin, user_workspace_ids
from workspaces.models import Workspace, WorkspaceMember
from workspaces.serializers import (
    InviteMemberSerializer,
    WorkspaceCreateSerializer,
    WorkspaceMemberSerializer,
    WorkspaceSerializer,
)

User = get_user_model()


class WorkspaceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspaces = Workspace.objects.filter(
            id__in=user_workspace_ids(request.user)
        ).select_related("owner")
        serializer = WorkspaceSerializer(workspaces, many=True)
        return api_response(data=serializer.data)

    def post(self, request):
        serializer = WorkspaceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        workspace = Workspace.objects.create(
            owner=request.user,
            **serializer.validated_data,
        )
        WorkspaceMember.objects.create(
            workspace=workspace,
            user=request.user,
            role=WorkspaceMember.Role.ADMIN,
        )
        return api_response(
            data=WorkspaceSerializer(workspace).data,
            status=status.HTTP_201_CREATED,
        )


class WorkspaceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        try:
            workspace = Workspace.objects.get(
                pk=pk, id__in=user_workspace_ids(request.user)
            )
        except Workspace.DoesNotExist:
            return None
        return workspace

    def get(self, request, pk):
        workspace = self.get_object(request, pk)
        if not workspace:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return api_response(data=WorkspaceSerializer(workspace).data)


class WorkspaceInviteView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceAdmin]

    def post(self, request, pk):
        try:
            workspace = Workspace.objects.get(pk=pk)
        except Workspace.DoesNotExist:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not WorkspaceMember.objects.filter(
            workspace=workspace,
            user=request.user,
            role=WorkspaceMember.Role.ADMIN,
        ).exists():
            return api_response(error={"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = InviteMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=serializer.validated_data["email"])
        except User.DoesNotExist:
            return api_response(
                error={"detail": "User with this email does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )

        membership, created = WorkspaceMember.objects.get_or_create(
            workspace=workspace,
            user=user,
            defaults={"role": serializer.validated_data["role"]},
        )
        if not created:
            membership.role = serializer.validated_data["role"]
            membership.save()

        return api_response(
            data=WorkspaceMemberSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )



class WorkspaceMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            workspace = Workspace.objects.get(
                pk=pk, id__in=user_workspace_ids(request.user)
            )
        except Workspace.DoesNotExist:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        members = WorkspaceMember.objects.filter(workspace=workspace).select_related("user")
        return api_response(data=WorkspaceMemberSerializer(members, many=True).data)