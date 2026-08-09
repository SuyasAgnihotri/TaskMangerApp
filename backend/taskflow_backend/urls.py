from django.urls import path

from core.views import LoginView, LogoutView, MeView, RootView, SignupView
from projects.views import (
    BoardDetailView,
    ColumnDetailView,
    ColumnListCreateView,
    ProjectBoardView,
    ProjectDetailView,
    ProjectListCreateView,
)
from tasks.views import (
    NotificationListView,
    NotificationMarkReadView,
    TaskAssigneeView,
    TaskCommentListCreateView,
    TaskDetailView,
    TaskListCreateView,
    TaskSearchView,
)
from workspaces.views import WorkspaceDetailView, WorkspaceInviteView, WorkspaceListCreateView

urlpatterns = [
    path("", RootView.as_view()),
    path("api/auth/signup", SignupView.as_view()),
    path("api/auth/login", LoginView.as_view()),
    path("api/auth/logout", LogoutView.as_view()),
    path("api/auth/me", MeView.as_view()),
    path("api/workspaces", WorkspaceListCreateView.as_view()),
    path("api/workspaces/<int:pk>", WorkspaceDetailView.as_view()),
    path("api/workspaces/<int:pk>/invite", WorkspaceInviteView.as_view()),
    path("api/workspaces/<int:workspace_id>/projects", ProjectListCreateView.as_view()),
    path("api/projects/<int:pk>", ProjectDetailView.as_view()),
    path("api/projects/<int:pk>/board", ProjectBoardView.as_view()),
    path("api/boards/<int:pk>", BoardDetailView.as_view()),
    path("api/boards/<int:board_id>/columns", ColumnListCreateView.as_view()),
    path("api/columns/<int:pk>", ColumnDetailView.as_view()),
    path("api/tasks", TaskListCreateView.as_view()),
    path("api/tasks/search", TaskSearchView.as_view()),
    path("api/tasks/<int:pk>", TaskDetailView.as_view()),
    path("api/tasks/<int:pk>/assignees", TaskAssigneeView.as_view()),
    path("api/tasks/<int:pk>/comments", TaskCommentListCreateView.as_view()),
    path("api/notifications", NotificationListView.as_view()),
    path("api/notifications/<int:pk>/read", NotificationMarkReadView.as_view()),
]
