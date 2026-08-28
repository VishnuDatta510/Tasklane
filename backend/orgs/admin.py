from django.contrib import admin

from .models import Invitation, Membership, Organization


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ["user"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "created_by", "created_at"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [MembershipInline]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "joined_at"]
    list_filter = ["role"]
    search_fields = ["user__email", "organization__name"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["email", "organization", "role", "accepted_at", "expires_at"]
    list_filter = ["role"]
    search_fields = ["email"]
