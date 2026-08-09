from rest_framework import serializers

from core.serializers import UserSerializer
from projects.models import Board, Column
from tasks.models import ActivityLog, Comment, Notification, Task, TaskAssignee


class TaskAssigneeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = TaskAssignee
        fields = ("id", "user", "created_at")


class TaskSerializer(serializers.ModelSerializer):
    assignees = TaskAssigneeSerializer(many=True, read_only=True)
    column_id = serializers.PrimaryKeyRelatedField(
        source="column", queryset=Column.objects.all()
    )

    class Meta:
        model = Task
        fields = (
            "id",
            "column_id",
            "title",
            "description",
            "priority",
            "due_date",
            "position",
            "labels",
            "created_by",
            "assignees",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")


class TaskBoardTaskSerializer(serializers.ModelSerializer):
    assignees = TaskAssigneeSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = (
            "id",
            "title",
            "description",
            "priority",
            "due_date",
            "position",
            "labels",
            "assignees",
            "created_at",
            "updated_at",
        )


class TaskBoardColumnSerializer(serializers.ModelSerializer):
    tasks = TaskBoardTaskSerializer(many=True, read_only=True)

    class Meta:
        model = Column
        fields = ("id", "name", "position", "tasks")


class TaskBoardSerializer(serializers.ModelSerializer):
    columns = TaskBoardColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Board
        fields = ("id", "name", "project", "columns")


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "task", "author", "content", "created_at", "updated_at")
        read_only_fields = ("id", "author", "created_at", "updated_at")


class ActivityLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = ("id", "task", "user", "action", "details", "created_at")


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "message",
            "task",
            "is_read",
            "created_at",
        )
