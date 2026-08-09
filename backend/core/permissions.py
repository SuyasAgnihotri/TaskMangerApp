from rest_framework.permissions import BasePermission

from workspaces.models import WorkspaceMember


class IsWorkspaceMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, "workspace", obj)
        return WorkspaceMember.objects.filter(
            workspace=workspace, user=request.user
        ).exists()


class IsWorkspaceAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, "workspace", obj)
        return WorkspaceMember.objects.filter(
            workspace=workspace,
            user=request.user,
            role=WorkspaceMember.Role.ADMIN,
        ).exists()


def user_workspace_ids(user):
    return WorkspaceMember.objects.filter(user=user).values_list("workspace_id", flat=True)


def user_can_access_project(user, project):
    return WorkspaceMember.objects.filter(
        workspace=project.workspace, user=user
    ).exists()


def user_can_access_board(user, board):
    return user_can_access_project(user, board.project)


def user_can_access_task(user, task):
    return user_can_access_project(user, task.project)
