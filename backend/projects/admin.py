from django.contrib import admin

from .models import Board, Column, Project


class ColumnInline(admin.TabularInline):
    model = Column
    extra = 1


class BoardInline(admin.TabularInline):
    model = Board
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "created_by", "created_at")
    search_fields = ("name",)
    inlines = [BoardInline]


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "created_at")
    inlines = [ColumnInline]


@admin.register(Column)
class ColumnAdmin(admin.ModelAdmin):
    list_display = ("name", "board", "position", "created_at")
