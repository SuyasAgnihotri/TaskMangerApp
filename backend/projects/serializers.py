from rest_framework import serializers

from projects.models import Board, Column, Project


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = (
            "id",
            "workspace",
            "name",
            "description",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")


class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = ("id", "project", "name", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = Column
        fields = ("id", "board", "name", "position", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
