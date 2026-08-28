from rest_framework import serializers

from accounts.serializers import UserMiniSerializer
from common.permissions import membership_for
from orgs.models import Organization

from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    lead = UserMiniSerializer(read_only=True)
    lead_id = serializers.PrimaryKeyRelatedField(
        source="lead",
        queryset=Project._meta.get_field("lead").related_model.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    created_by = UserMiniSerializer(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    task_count = serializers.IntegerField(read_only=True)
    open_task_count = serializers.IntegerField(read_only=True)
    done_task_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "organization",
            "organization_name",
            "name",
            "slug",
            "key",
            "description",
            "color",
            "status",
            "lead",
            "lead_id",
            "created_by",
            "task_count",
            "open_task_count",
            "done_task_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_by", "created_at", "updated_at"]

    def validate_organization(self, value: Organization):
        """You may only create a project inside an org you belong to.

        Without this check a member of org A could POST organization=B and
        write into an organization they cannot even read.
        """
        request = self.context["request"]
        if membership_for(request.user, value.id) is None:
            raise serializers.ValidationError("You are not a member of that organization.")
        return value

    def validate(self, attrs):
        organization = attrs.get("organization") or getattr(self.instance, "organization", None)
        lead = attrs.get("lead")
        if lead and organization and membership_for(lead, organization.id) is None:
            raise serializers.ValidationError(
                {"lead_id": "The project lead must be a member of the organization."}
            )

        key = attrs.get("key")
        if key:
            clash = Project.objects.filter(organization=organization, key=key.upper()).exclude(
                pk=getattr(self.instance, "pk", None)
            )
            if clash.exists():
                raise serializers.ValidationError(
                    {"key": "Another project in this organization uses that key."}
                )
        return attrs
