from django.db.models import Prefetch
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.exceptions import api_response
from core.permissions import user_can_access_project, user_workspace_ids
from projects.models import Board, Column, Project
from projects.serializers import BoardSerializer, ColumnSerializer, ProjectSerializer
from tasks.serializers import TaskBoardSerializer


class ProjectListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, workspace_id):
        if int(workspace_id) not in list(user_workspace_ids(request.user)):
            return api_response(error={"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        projects = Project.objects.filter(workspace_id=workspace_id).select_related(
            "workspace", "created_by"
        )
        return api_response(data=ProjectSerializer(projects, many=True).data)

    def post(self, request, workspace_id):
        if int(workspace_id) not in list(user_workspace_ids(request.user)):
            return api_response(error={"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ProjectSerializer(data={**request.data, "workspace": workspace_id})
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project = serializer.save(created_by=request.user)
        board = Board.objects.create(project=project, name="Main Board")
        default_columns = ["To Do", "In Progress", "Done"]
        for idx, name in enumerate(default_columns):
            Column.objects.create(board=board, name=name, position=idx)

        return api_response(
            data=ProjectSerializer(project).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_project(self, request, pk):
        try:
            project = Project.objects.select_related("workspace").get(pk=pk)
        except Project.DoesNotExist:
            return None
        if not user_can_access_project(request.user, project):
            return None
        return project

    def get(self, request, pk):
        project = self.get_project(request, pk)
        if not project:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return api_response(data=ProjectSerializer(project).data)

    def patch(self, request, pk):
        project = self.get_project(request, pk)
        if not project:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectSerializer(project, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return api_response(data=serializer.data)

    def delete(self, request, pk):
        project = self.get_project(request, pk)
        if not project:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        project.delete()
        return api_response(data=None, status=status.HTTP_204_NO_CONTENT)


class ProjectBoardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_project(request.user, project):
            return api_response(error={"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        from tasks.models import Task

        board = (
            project.boards.prefetch_related(
                Prefetch(
                    "columns",
                    queryset=Column.objects.prefetch_related(
                        Prefetch(
                            "tasks",
                            queryset=Task.objects.prefetch_related(
                                "assignees__user"
                            ).order_by("position", "id"),
                        )
                    ).order_by("position", "id"),
                )
            )
            .first()
        )
        if not board:
            return api_response(error={"detail": "No board found"}, status=status.HTTP_404_NOT_FOUND)

        return api_response(data=TaskBoardSerializer(board).data)


class BoardDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_board(self, request, pk):
        try:
            board = Board.objects.select_related("project__workspace").get(pk=pk)
        except Board.DoesNotExist:
            return None
        if not user_can_access_project(request.user, board.project):
            return None
        return board

    def patch(self, request, pk):
        board = self.get_board(request, pk)
        if not board:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = BoardSerializer(board, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return api_response(data=serializer.data)


class ColumnListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_board(self, request, board_id):
        try:
            board = Board.objects.select_related("project__workspace").get(pk=board_id)
        except Board.DoesNotExist:
            return None
        if not user_can_access_project(request.user, board.project):
            return None
        return board

    def post(self, request, board_id):
        board = self.get_board(request, board_id)
        if not board:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ColumnSerializer(data={**request.data, "board": board_id})
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        column = serializer.save()
        return api_response(data=ColumnSerializer(column).data, status=status.HTTP_201_CREATED)


class ColumnDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_column(self, request, pk):
        try:
            column = Column.objects.select_related("board__project__workspace").get(pk=pk)
        except Column.DoesNotExist:
            return None
        if not user_can_access_project(request.user, column.board.project):
            return None
        return column

    def patch(self, request, pk):
        column = self.get_column(request, pk)
        if not column:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ColumnSerializer(column, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return api_response(data=serializer.data)

    def delete(self, request, pk):
        column = self.get_column(request, pk)
        if not column:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        column.delete()
        return api_response(data=None, status=status.HTTP_204_NO_CONTENT)
