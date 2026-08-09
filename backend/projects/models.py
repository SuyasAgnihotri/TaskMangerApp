from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from workspaces.models import Workspace


class Project(TimeStampedModel):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_projects",
    )

    class Meta:
        indexes = [
            models.Index(fields=["workspace"]),
            models.Index(fields=["created_by"]),
        ]

    def __str__(self):
        return self.name


class Board(TimeStampedModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="boards",
    )
    name = models.CharField(max_length=255)

    class Meta:
        indexes = [
            models.Index(fields=["project"]),
        ]

    def __str__(self):
        return self.name


class Column(TimeStampedModel):
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name="columns",
    )
    name = models.CharField(max_length=255)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        indexes = [
            models.Index(fields=["board"]),
        ]

    def __str__(self):
        return f"{self.board.name} — {self.name}"
