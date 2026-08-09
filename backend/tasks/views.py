from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.exceptions import api_response
from core.permissions import user_can_access_project, user_can_access_task
from tasks.models import ActivityLog, Comment, Notification, Task, TaskAssignee
from tasks.serializers import (
    ActivityLogSerializer,
    CommentSerializer,
    NotificationSerializer,
    TaskSerializer,
)

User = get_user_model()


def broadcast_board_update(task):
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        board_id = task.board.id
        async_to_sync(channel_layer.group_send)(
            f"board_{board_id}",
            {
                "type": "board.update",
                "data": {"task_id": task.id, "column_id": task.column_id},
            },
        )
    except Exception:
        pass


class TaskListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TaskSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        column = serializer.validated_data["column"]
        if not user_can_access_project(request.user, column.board.project):
            return api_response(error={"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        task = serializer.save(created_by=request.user)
        ActivityLog.objects.create(
            task=task,
            user=request.user,
            action=ActivityLog.Action.TASK_CREATED,
            details={"title": task.title},
        )
        broadcast_board_update(task)
        return api_response(data=TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_task(self, request, pk):
        try:
            task = Task.objects.prefetch_related("assignees__user").select_related(
                "column__board__project__workspace"
            ).get(pk=pk)
        except Task.DoesNotExist:
            return None
        if not user_can_access_task(request.user, task):
            return None
        return task

    def get(self, request, pk):
        task = self.get_task(request, pk)
        if not task:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return api_response(data=TaskSerializer(task).data)

    def patch(self, request, pk):
        task = self.get_task(request, pk)
        if not task:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        old_column_id = task.column_id
        serializer = TaskSerializer(task, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        task = serializer.save()
        action = ActivityLog.Action.TASK_UPDATED
        details = dict(request.data)
        if old_column_id != task.column_id:
            action = ActivityLog.Action.STATUS_CHANGED
            details["from_column"] = old_column_id
            details["to_column"] = task.column_id

        ActivityLog.objects.create(
            task=task,
            user=request.user,
            action=action,
            details=details,
        )
        broadcast_board_update(task)
        return api_response(data=TaskSerializer(task).data)

    def delete(self, request, pk):
        task = self.get_task(request, pk)
        if not task:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        task.delete()
        return api_response(data=None, status=status.HTTP_204_NO_CONTENT)


class TaskAssigneeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            task = Task.objects.select_related("column__board__project").get(pk=pk)
        except Task.DoesNotExist:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_task(request.user, task):
            return api_response(error={"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get("user_id")
        if not user_id:
            return api_response(
                error={"user_id": "This field is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            assignee_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return api_response(error={"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        assignment, created = TaskAssignee.objects.get_or_create(task=task, user=assignee_user)
        if created:
            ActivityLog.objects.create(
                task=task,
                user=request.user,
                action=ActivityLog.Action.ASSIGNED,
                details={"assigned_user_id": assignee_user.id},
            )
            Notification.objects.create(
                user=assignee_user,
                notification_type=Notification.Type.ASSIGNED,
                message=f"You were assigned to '{task.title}'",
                task=task,
            )
            broadcast_board_update(task)

        from tasks.serializers import TaskAssigneeSerializer

        return api_response(
            data=TaskAssigneeSerializer(assignment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        try:
            task = Task.objects.select_related("column__board__project").get(pk=pk)
        except Task.DoesNotExist:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not user_can_access_task(request.user, task):
            return api_response(error={"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get("user_id")
        deleted, _ = TaskAssignee.objects.filter(task=task, user_id=user_id).delete()
        if deleted:
            ActivityLog.objects.create(
                task=task,
                user=request.user,
                action=ActivityLog.Action.UNASSIGNED,
                details={"unassigned_user_id": user_id},
            )
            broadcast_board_update(task)
        return api_response(data=None, status=status.HTTP_204_NO_CONTENT)


class TaskCommentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_task(self, request, pk):
        try:
            task = Task.objects.select_related("column__board__project").get(pk=pk)
        except Task.DoesNotExist:
            return None
        if not user_can_access_task(request.user, task):
            return None
        return task

    def get(self, request, pk):
        task = self.get_task(request, pk)
        if not task:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        comments = task.comments.select_related("author").all()
        return api_response(data=CommentSerializer(comments, many=True).data)

    def post(self, request, pk):
        task = self.get_task(request, pk)
        if not task:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CommentSerializer(data={**request.data, "task": task.id})
        if not serializer.is_valid():
            return api_response(error=serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        comment = Comment.objects.create(
            task=task,
            author=request.user,
            content=serializer.validated_data["content"],
        )
        return api_response(
            data=CommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        unread_count = notifications.filter(is_read=False).count()
        return api_response(
            data={
                "unread_count": unread_count,
                "notifications": NotificationSerializer(notifications[:50], many=True).data,
            }
        )


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return api_response(error={"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.save()
        return api_response(data=NotificationSerializer(notification).data)


class TaskSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.permissions import user_workspace_ids

        q = request.query_params.get("q", "")
        workspace_id = request.query_params.get("workspace_id")

        tasks = Task.objects.filter(
            column__board__project__workspace_id__in=user_workspace_ids(request.user)
        ).select_related("column__board__project")

        if workspace_id:
            tasks = tasks.filter(column__board__project__workspace_id=workspace_id)

        if q:
            tasks = tasks.filter(title__icontains=q) | tasks.filter(description__icontains=q)

        assignee = request.query_params.get("assignee")
        if assignee:
            tasks = tasks.filter(assignees__user_id=assignee)

        priority = request.query_params.get("priority")
        if priority:
            tasks = tasks.filter(priority=priority)

        due_before = request.query_params.get("due_before")
        if due_before:
            tasks = tasks.filter(due_date__lte=due_before)

        label = request.query_params.get("label")
        if label:
            tasks = tasks.filter(labels__contains=[label])

        tasks = tasks.distinct()[:50]
        return api_response(data=TaskSerializer(tasks, many=True).data)
