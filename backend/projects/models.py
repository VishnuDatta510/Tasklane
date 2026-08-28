from django.conf import settings
from django.db import models
from django.utils.text import slugify

from orgs.models import Organization


class ProjectStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class Project(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, blank=True)
    key = models.CharField(max_length=10)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default="#4F46E5")
    status = models.CharField(
        max_length=20, choices=ProjectStatus.choices, default=ProjectStatus.ACTIVE
    )
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects_led",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="projects_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="unique_project_slug_per_org"
            ),
            models.UniqueConstraint(
                fields=["organization", "key"], name="unique_project_key_per_org"
            ),
        ]
        indexes = [models.Index(fields=["organization", "status"])]

    def __str__(self):
        return f"{self.key} — {self.name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "project"
            slug = base
            n = 1
            while (
                Project.objects.filter(organization=self.organization, slug=slug)
                .exclude(pk=self.pk)
                .exists()
            ):
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        if not self.key:
            self.key = (slugify(self.name).replace("-", "")[:4] or "PROJ").upper()
        self.key = self.key.upper()
        super().save(*args, **kwargs)
