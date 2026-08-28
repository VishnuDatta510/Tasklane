"""Validation, filtering, the activity log, background email and query counts."""

from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from tasks.models import ActivityLog, Task, TaskPriority, TaskStatus

from .factories import (
    LabelFactory,
    OrganizationFactory,
    ProjectFactory,
    TaskFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


# --- validation ------------------------------------------------------------


def test_due_date_in_the_past_is_rejected_on_create(project, owner_client):
    response = owner_client.post(
        "/api/tasks/",
        {
            "project": project.id,
            "title": "Backdated",
            "due_date": str(timezone.localdate() - timedelta(days=1)),
        },
        format="json",
    )
    assert response.status_code == 400
    assert "due_date" in response.data["errors"]


def test_an_existing_task_may_keep_a_due_date_that_has_passed(task, owner_client):
    Task.objects.filter(pk=task.pk).update(due_date=timezone.localdate() - timedelta(days=5))
    response = owner_client.patch(
        f"/api/tasks/{task.id}/", {"title": "Renamed but still late"}, format="json"
    )
    assert response.status_code == 200


def test_assignee_must_belong_to_the_organization(project, owner_client):
    stranger = UserFactory()
    response = owner_client.post(
        "/api/tasks/",
        {"project": project.id, "title": "Assigned to nobody we know", "assignee_id": stranger.id},
        format="json",
    )
    assert response.status_code == 400
    assert "assignee_id" in response.data["errors"]


def test_labels_must_belong_to_the_same_organization(project, owner_client):
    foreign_label = LabelFactory(organization=OrganizationFactory())
    response = owner_client.post(
        "/api/tasks/",
        {"project": project.id, "title": "Foreign label", "label_ids": [foreign_label.id]},
        format="json",
    )
    assert response.status_code == 400
    assert "label_ids" in response.data["errors"]


def test_a_short_title_is_rejected(project, owner_client):
    response = owner_client.post(
        "/api/tasks/", {"project": project.id, "title": "ab"}, format="json"
    )
    assert response.status_code == 400
    assert "title" in response.data["errors"]


def test_an_invalid_status_names_the_valid_choices(project, owner_client):
    response = owner_client.post(
        "/api/tasks/",
        {"project": project.id, "title": "Bad status", "status": "banana"},
        format="json",
    )
    assert response.status_code == 400
    assert "status" in response.data["errors"]


def test_an_empty_comment_is_rejected(task, member_client):
    response = member_client.post(f"/api/tasks/{task.id}/comments/", {"body": "   "}, format="json")
    assert response.status_code == 400


# --- references ------------------------------------------------------------


def test_task_numbers_increment_per_project(project):
    first = TaskFactory(project=project)
    second = TaskFactory(project=project)
    other_project = ProjectFactory(organization=project.organization)
    third = TaskFactory(project=other_project)

    assert first.number == 1
    assert second.number == 2
    assert third.number == 1, "numbering restarts in each project"
    assert second.reference == f"{project.key}-2"


# --- filtering, search, ordering, pagination -------------------------------


@pytest.fixture
def task_spread(project, member):
    today = timezone.localdate()
    TaskFactory(
        project=project,
        title="Fix the login redirect",
        status=TaskStatus.TODO,
        priority=TaskPriority.URGENT,
        assignee=member,
        due_date=today - timedelta(days=3),
    )
    TaskFactory(
        project=project,
        title="Cache the dashboard",
        status=TaskStatus.IN_PROGRESS,
        priority=TaskPriority.HIGH,
        due_date=today + timedelta(days=5),
    )
    TaskFactory(
        project=project,
        title="Write the runbook",
        status=TaskStatus.DONE,
        priority=TaskPriority.LOW,
    )
    return project


def test_filter_by_status(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?status=todo")
    assert response.data["count"] == 1


def test_filter_by_priority(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?priority=urgent")
    assert response.data["count"] == 1


def test_filter_by_assignee(task_spread, owner_client, member):
    response = owner_client.get(f"/api/tasks/?assignee={member.id}")
    assert response.data["count"] == 1


def test_filter_unassigned(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?unassigned=true")
    assert response.data["count"] == 2


def test_filter_overdue(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?overdue=true")
    assert response.data["count"] == 1
    assert response.data["results"][0]["title"] == "Fix the login redirect"


def test_filter_by_due_date_range(task_spread, owner_client):
    today = timezone.localdate()
    response = owner_client.get(
        f"/api/tasks/?due_after={today}&due_before={today + timedelta(days=10)}"
    )
    assert response.data["count"] == 1


def test_search_matches_title(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?search=runbook")
    assert response.data["count"] == 1


def test_ordering_by_due_date(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?ordering=due_date")
    dues = [t["due_date"] for t in response.data["results"] if t["due_date"]]
    assert dues == sorted(dues)


def test_an_unlisted_ordering_field_is_ignored_not_fatal(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?ordering=password")
    assert response.status_code == 200


def test_pagination_envelope(task_spread, owner_client):
    response = owner_client.get("/api/tasks/?page_size=2")
    assert response.status_code == 200
    assert set(["count", "next", "previous", "results"]) <= set(response.data)
    assert len(response.data["results"]) == 2
    assert response.data["next"] is not None


# --- activity log ----------------------------------------------------------


def test_creating_a_task_writes_one_activity_row(project, owner_client):
    response = owner_client.post(
        "/api/tasks/", {"project": project.id, "title": "Fresh task"}, format="json"
    )
    entries = ActivityLog.objects.filter(task_id=response.data["id"])
    assert entries.count() == 1
    assert entries.first().verb == ActivityLog.Verb.CREATED


def test_a_status_change_records_old_and_new(task, owner_client, owner):
    owner_client.patch(f"/api/tasks/{task.id}/", {"status": "in_progress"}, format="json")
    entry = ActivityLog.objects.get(task=task, verb=ActivityLog.Verb.STATUS_CHANGED)
    assert entry.old_value == "todo"
    assert entry.new_value == "in_progress"
    assert entry.actor_id == owner.id


def test_an_unrelated_edit_writes_no_activity_row(task, owner_client):
    before = ActivityLog.objects.filter(task=task).count()
    owner_client.patch(f"/api/tasks/{task.id}/", {"description": "just prose"}, format="json")
    assert ActivityLog.objects.filter(task=task).count() == before


def test_reassignment_is_recorded(task, owner_client, member):
    owner_client.patch(f"/api/tasks/{task.id}/", {"assignee_id": member.id}, format="json")
    assert ActivityLog.objects.filter(task=task, verb=ActivityLog.Verb.REASSIGNED).exists()


def test_the_move_action_changes_column_and_logs_it(task, owner_client):
    response = owner_client.post(
        f"/api/tasks/{task.id}/move/",
        {"status": "in_review", "position": 3},
        format="json",
    )
    assert response.status_code == 200
    task.refresh_from_db()
    assert task.status == TaskStatus.IN_REVIEW
    assert ActivityLog.objects.filter(task=task, verb=ActivityLog.Verb.STATUS_CHANGED).exists()


# --- background work -------------------------------------------------------


def test_assigning_a_task_sends_an_email(
    task, owner_client, member, django_capture_on_commit_callbacks
):
    """The email is queued with transaction.on_commit.

    A plain test never commits -- pytest-django rolls the transaction back --
    so the callback would silently never run. Capturing and executing the
    callbacks is also the assertion that it was registered on commit rather
    than fired inline, which is the behaviour that prevents the worker racing
    an uncommitted row.
    """
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        owner_client.patch(f"/api/tasks/{task.id}/", {"assignee_id": member.id}, format="json")

    assert len(callbacks) == 1, "the email must be queued on commit, not inline"
    assert len(mail.outbox) == 1
    assert member.email in mail.outbox[0].to
    assert task.reference in mail.outbox[0].subject


def test_assigning_a_task_to_yourself_sends_nothing(
    task, owner_client, owner, django_capture_on_commit_callbacks
):
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        owner_client.patch(f"/api/tasks/{task.id}/", {"assignee_id": owner.id}, format="json")
    assert mail.outbox == []


def test_flag_overdue_tasks_is_idempotent(project, member):
    from tasks.celery_tasks import flag_overdue_tasks

    overdue = TaskFactory(
        project=project,
        status=TaskStatus.TODO,
        due_date=timezone.localdate() - timedelta(days=2),
    )
    TaskFactory(
        project=project,
        status=TaskStatus.DONE,
        due_date=timezone.localdate() - timedelta(days=2),
    )

    first = flag_overdue_tasks()
    assert first["flagged"] == 1
    overdue.refresh_from_db()
    assert overdue.is_overdue is True

    second = flag_overdue_tasks()
    assert second["flagged"] == 0, "running twice must be a no-op"


def test_flag_overdue_clears_the_flag_once_a_task_is_done(project):
    from tasks.celery_tasks import flag_overdue_tasks

    task = TaskFactory(
        project=project,
        status=TaskStatus.TODO,
        due_date=timezone.localdate() - timedelta(days=2),
    )
    flag_overdue_tasks()
    Task.objects.filter(pk=task.pk).update(status=TaskStatus.DONE)
    flag_overdue_tasks()
    task.refresh_from_db()
    assert task.is_overdue is False


def test_the_assignment_email_task_is_safe_when_the_task_is_gone(member):
    from tasks.celery_tasks import send_assignment_email_task

    assert send_assignment_email_task(999999, member.id, None) == "skipped"


# --- query counts ----------------------------------------------------------


def test_task_list_query_count_does_not_grow_with_row_count(
    django_assert_num_queries, project, member, owner_client
):
    """Regression guard against N+1.

    If someone removes select_related/prefetch_related from
    TaskViewSet.get_queryset, this fails immediately.
    """
    label = LabelFactory(organization=project.organization)
    for i in range(20):
        t = TaskFactory(project=project, assignee=member, title=f"Task {i} of twenty")
        t.labels.add(label)

    with django_assert_num_queries(4):
        response = owner_client.get("/api/tasks/?page_size=20")
    assert response.status_code == 200
    assert len(response.data["results"]) == 20
