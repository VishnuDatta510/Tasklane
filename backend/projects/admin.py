from django.contrib import admin

from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["key", "name", "organization", "status", "lead", "created_at"]
    list_filter = ["status", "organization"]
    search_fields = ["name", "key"]
