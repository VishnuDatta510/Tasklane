from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Manager for a user model that logs in with email instead of username.

    Django's stock BaseUserManager.create_user has `username` as its first
    positional argument. Ours does not have a username at all, so the whole
    manager has to be replaced -- createsuperuser and the auth backends both
    call these methods.
    """

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Project user.

    Subclasses AbstractUser to keep the permissions machinery, is_staff,
    is_active and the password handling, but drops `username` entirely so that
    email is the single login credential.
    """

    username = None

    email = models.EmailField(_("email address"), unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    avatar_url = models.URLField(blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email

    def get_short_name(self):
        return self.full_name.split(" ")[0] if self.full_name else self.email

    def get_full_name(self):
        return self.full_name or self.email

    @property
    def initials(self):
        if self.full_name:
            parts = [p for p in self.full_name.split(" ") if p]
            return "".join(p[0] for p in parts[:2]).upper()
        return self.email[:2].upper()
