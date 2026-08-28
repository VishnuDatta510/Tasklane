import pytest
from rest_framework.test import APIClient

from orgs.models import Role

from .factories import (
    LabelFactory,
    MembershipFactory,
    OrganizationFactory,
    ProjectFactory,
    TaskFactory,
    UserFactory,
)


@pytest.fixture(autouse=True)
def _test_settings(settings):
    """Isolate tests from Redis and the broker.

    locmem gives each test a clean cache; eager Celery runs tasks inline so a
    test can assert on their effects without a worker.
    """
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test",
        }
    }
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {"auth": "10000/min"},
    }


@pytest.fixture
def api():
    return APIClient()


def _authed(user):
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def organization(db):
    return OrganizationFactory()


@pytest.fixture
def owner(organization):
    user = UserFactory()
    MembershipFactory(organization=organization, user=user, role=Role.OWNER)
    return user


@pytest.fixture
def manager(organization):
    user = UserFactory()
    MembershipFactory(organization=organization, user=user, role=Role.MANAGER)
    return user


@pytest.fixture
def member(organization):
    user = UserFactory()
    MembershipFactory(organization=organization, user=user, role=Role.MEMBER)
    return user


@pytest.fixture
def outsider(db):
    """A real user who belongs to a *different* organization."""
    other_org = OrganizationFactory()
    user = UserFactory()
    MembershipFactory(organization=other_org, user=user, role=Role.OWNER)
    return user


@pytest.fixture
def owner_client(owner):
    return _authed(owner)


@pytest.fixture
def manager_client(manager):
    return _authed(manager)


@pytest.fixture
def member_client(member):
    return _authed(member)


@pytest.fixture
def outsider_client(outsider):
    return _authed(outsider)


@pytest.fixture
def client_for():
    """Build an authenticated client for an arbitrary user."""
    return _authed


@pytest.fixture
def project(organization, owner):
    return ProjectFactory(organization=organization, created_by=owner)


@pytest.fixture
def task(project, owner):
    return TaskFactory(project=project, created_by=owner)


@pytest.fixture
def label(organization):
    return LabelFactory(organization=organization)
