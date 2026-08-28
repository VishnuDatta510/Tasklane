import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Role(models.TextChoices):
    """Role a user holds inside one organization.

    Ordered most- to least-privileged. `Role.rank()` turns a role into an
    integer so permission checks can ask "at least manager?" instead of
    enumerating every role.
    """

    OWNER = "owner", "Owner"
    MANAGER = "manager", "Manager"
    MEMBER = "member", "Member"

    @staticmethod
    def rank(role: str) -> int:
        return {Role.OWNER: 3, Role.MANAGER: 2, Role.MEMBER: 1}.get(role, 0)


class Organization(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="organizations_created",
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="Membership",
        related_name="organizations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["slug"])]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "org"
            slug = base
            n = 1
            while Organization.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        super().save(*args, **kwargs)

    def role_of(self, user) -> str | None:
        """Role string for `user`, or None if they are not a member."""
        if not user or not user.is_authenticated:
            return None
        membership = next((m for m in self.memberships.all() if m.user_id == user.id), None)
        return membership.role if membership else None


class Membership(models.Model):
    """The through model that carries a role.

    A plain ManyToManyField between Organization and User could record that a
    link exists but has nowhere to put `role`, so the relationship needs an
    explicit model.
    """

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["role", "user__email"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"], name="unique_membership_per_org"
            )
        ]
        indexes = [models.Index(fields=["organization", "role"])]

    def __str__(self):
        return f"{self.user} @ {self.organization} ({self.role})"

    @property
    def is_owner(self):
        return self.role == Role.OWNER

    def at_least(self, role: str) -> bool:
        return Role.rank(self.role) >= Role.rank(role)


def _default_expiry():
    return timezone.now() + timedelta(days=7)


class Invitation(models.Model):
    """A pending invite to join an organization at a given role."""

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    token = models.CharField(max_length=64, unique=True, blank=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="invitations_sent",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(default=_default_expiry)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "email"],
                condition=models.Q(accepted_at__isnull=True),
                name="unique_pending_invite_per_org_email",
            )
        ]

    def __str__(self):
        return f"invite {self.email} -> {self.organization}"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_pending(self):
        return self.accepted_at is None and not self.is_expired
