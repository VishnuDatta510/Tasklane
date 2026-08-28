from django.contrib import admin

from .models import ActivityLog, Attachment, Comment, Label, Task


class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["__str__", "project", "status", "priority", "assignee", "due_date"]
    list_filter = ["status", "priority", "project__organization"]
    search_fields = ["title", "description"]
    autocomplete_fields = ["assignee", "created_by"]
    filter_horizontal = ["labels"]
    inlines = [CommentInline, AttachmentInline]


@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "color"]
    list_filter = ["organization"]
    search_fields = ["name"]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["task", "author", "created_at"]
    search_fields = ["body"]


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "verb", "task", "old_value", "new_value"]
    list_filter = ["verb", "organization"]
    readonly_fields = [f.name for f in ActivityLog._meta.fields]
