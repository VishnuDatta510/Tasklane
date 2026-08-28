"""Dashboard aggregation, and the cache-key isolation that protects it."""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone

from tasks.models import TaskPriority, TaskStatus

from .factories import TaskFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def populated(project, member, owner):
    today = timezone.localdate()
    TaskFactory(project=project, status=TaskStatus.TODO, assignee=member)
    TaskFactory(
        project=project,
        status=TaskStatus.IN_PROGRESS,
        assignee=member,
        due_date=today - timedelta(days=2),
    )
    TaskFactory(project=project, status=TaskStatus.DONE, assignee=owner, priority=TaskPriority.HIGH)
    TaskFactory(project=project, status=TaskStatus.DONE)
    return project


def test_dashboard_requires_the_organization_parameter(owner_client):
    response = owner_client.get("/api/dashboard/")
    assert response.status_code == 400


def test_dashboard_totals(populated, owner_client, organization):
    response = owner_client.get(f"/api/dashboard/?organization={organization.id}")
    assert response.status_code == 200

    totals = response.data["totals"]
    assert totals["tasks"] == 4
    assert totals["done"] == 2
    assert totals["open"] == 2
    assert totals["overdue"] == 1
    assert totals["completion_rate"] == 50.0


def test_dashboard_counts_open_tasks_per_member(populated, owner_client, organization, member):
    response = owner_client.get(f"/api/dashboard/?organization={organization.id}")
    rows = {r["user_id"]: r for r in response.data["per_member"]}
    assert rows[member.id]["open_tasks"] == 2
    assert rows[member.id]["overdue_tasks"] == 1


def test_a_non_member_gets_404_not_a_cached_payload(
    populated, owner_client, outsider_client, organization
):
    """The membership check runs before the cache lookup.

    If it did not, the first member's numbers would be served to anyone who
    asked for the same organization id.
    """
    warm = owner_client.get(f"/api/dashboard/?organization={organization.id}")
    assert warm.status_code == 200

    response = outsider_client.get(f"/api/dashboard/?organization={organization.id}")
    assert response.status_code == 404
    assert "totals" not in response.data


def test_the_second_request_is_served_from_cache(populated, owner_client, organization):
    first = owner_client.get(f"/api/dashboard/?organization={organization.id}")
    second = owner_client.get(f"/api/dashboard/?organization={organization.id}")
    assert first.data["cached"] is False
    assert second.data["cached"] is True


def test_cache_keys_are_per_user(populated, owner_client, member_client, organization):
    owner_client.get(f"/api/dashboard/?organization={organization.id}")
    response = member_client.get(f"/api/dashboard/?organization={organization.id}")
    assert response.data["cached"] is False, "a different user must miss the cache"


def test_dashboard_is_a_bounded_number_of_queries(
    django_assert_max_num_queries, populated, owner_client, organization, project
):
    """Counting must happen in SQL, not in a Python loop over members."""
    for i in range(15):
        TaskFactory(project=project, title=f"Extra task {i}")

    with django_assert_max_num_queries(12):
        response = owner_client.get(f"/api/dashboard/?organization={organization.id}")
    assert response.status_code == 200
