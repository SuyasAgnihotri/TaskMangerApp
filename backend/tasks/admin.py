from django.contrib import admin

from .models import ActivityLog, Comment, Notification, Task, TaskAssignee


class TaskAssigneeInline(admin.TabularInline):
    model = TaskAssignee
    extra = 1


class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "column", "priority", "due_date", "position", "created_at")
    list_filter = ("priority",)
    search_fields = ("title", "description")
    inlines = [TaskAssigneeInline, CommentInline]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "created_at")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("task", "user", "action", "created_at")
    list_filter = ("action",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "notification_type", "is_read", "created_at")
    list_filter = ("notification_type", "is_read")
