from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class Workspace(TimeStampedModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_workspaces",
    )

    class Meta:
        indexes = [
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return self.name


class WorkspaceMember(TimeStampedModel):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"
        VIEWER = "viewer", "Viewer"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER,
    )

    class Meta:
        unique_together = ("workspace", "user")
        indexes = [
            models.Index(fields=["workspace"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user.email} in {self.workspace.name} ({self.role})"
