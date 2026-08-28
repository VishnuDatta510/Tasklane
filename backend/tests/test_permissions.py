"""The role x action matrix, plus the tenancy boundary.

These are the tests that must fail loudly if a permission class or a
get_queryset() scope is ever loosened.
"""

import pytest

from orgs.models import Membership, Role
from tasks.models import Task

from .factories import OrganizationFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db

# --- tenancy ---------------------------------------------------------------


def test_outsider_sees_no_projects_from_another_org(outsider_client, project):
    response = outsider_client.get("/api/projects/")
    assert response.status_code == 200
    assert response.data["count"] == 0


def test_outsider_gets_404_not_403_for_a_foreign_project(outsider_client, project):
    """404, not 403: a 403 would confirm the row exists."""
    response = outsider_client.get(f"/api/projects/{project.id}/")
    assert response.status_code == 404


def test_outsider_gets_404_for_a_foreign_task(outsider_client, task):
    assert outsider_client.get(f"/api/tasks/{task.id}/").status_code == 404


def test_filters_cannot_widen_the_queryset(outsider_client, task):
    """Filtering composes with scoping; it can never bypass it."""
    org_id = task.project.organization_id
    response = outsider_client.get(f"/api/tasks/?organization={org_id}")
    assert response.status_code == 200
    assert response.data["count"] == 0


def test_member_cannot_create_a_project_in_a_foreign_org(member_client):
    foreign = OrganizationFactory()
    response = member_client.post(
        "/api/projects/",
        {"organization": foreign.id, "name": "Sneaky", "key": "SNK"},
        format="json",
    )
    assert response.status_code == 400
    assert "organization" in response.data["errors"]


# --- role x action matrix --------------------------------------------------


@pytest.mark.parametrize(
    "role,expected",
    [(Role.MEMBER, 403), (Role.MANAGER, 201), (Role.OWNER, 201)],
)
def test_who_can_create_a_project(organization, client_for, role, expected):
    user = UserFactory()
    Membership.objects.create(organization=organization, user=user, role=role)
    response = client_for(user).post(
        "/api/projects/",
        {"organization": organization.id, "name": "New Project", "key": "NEW"},
        format="json",
    )
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role,expected",
    [(Role.MEMBER, 403), (Role.MANAGER, 204), (Role.OWNER, 204)],
)
def test_who_can_delete_a_project(organization, client_for, role, expected):
    user = UserFactory()
    Membership.objects.create(organization=organization, user=user, role=role)
    project = ProjectFactory(organization=organization)
    response = client_for(user).delete(f"/api/projects/{project.id}/")
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role,expected",
    [(Role.MEMBER, 403), (Role.MANAGER, 403), (Role.OWNER, 204)],
)
def test_only_an_owner_can_delete_the_organization(organization, client_for, role, expected):
    user = UserFactory()
    Membership.objects.create(organization=organization, user=user, role=role)
    if role != Role.OWNER:
        Membership.objects.create(organization=organization, user=UserFactory(), role=Role.OWNER)
    response = client_for(user).delete(f"/api/organizations/{organization.id}/")
    assert response.status_code == expected


@pytest.mark.parametrize(
    "role,expected",
    [(Role.MEMBER, 403), (Role.MANAGER, 201), (Role.OWNER, 201)],
)
def test_who_can_invite_members(organization, client_for, role, expected):
    user = UserFactory()
    Membership.objects.create(organization=organization, user=user, role=role)
    response = client_for(user).post(
        f"/api/organizations/{organization.id}/invitations/",
        {"email": "invitee@example.com", "role": "member"},
        format="json",
    )
    assert response.status_code == expected


@pytest.mark.parametrize("role", [Role.MEMBER, Role.MANAGER, Role.OWNER])
def test_every_role_can_create_a_task(organization, project, client_for, role):
    user = UserFactory()
    Membership.objects.create(organization=organization, user=user, role=role)
    response = client_for(user).post(
        "/api/tasks/",
        {"project": project.id, "title": "Anyone can open this"},
        format="json",
    )
    assert response.status_code == 201


def test_manager_cannot_grant_ownership(organization, manager, manager_client):
    victim = UserFactory()
    membership = Membership.objects.create(organization=organization, user=victim, role=Role.MEMBER)
    response = manager_client.patch(
        f"/api/organizations/{organization.id}/members/{membership.id}/",
        {"role": "owner"},
        format="json",
    )
    assert response.status_code == 400


def test_owner_can_grant_ownership(organization, owner, owner_client):
    victim = UserFactory()
    membership = Membership.objects.create(organization=organization, user=victim, role=Role.MEMBER)
    response = owner_client.patch(
        f"/api/organizations/{organization.id}/members/{membership.id}/",
        {"role": "owner"},
        format="json",
    )
    assert response.status_code == 200
    membership.refresh_from_db()
    assert membership.role == Role.OWNER


def test_the_last_owner_cannot_be_demoted(organization, owner, owner_client):
    membership = Membership.objects.get(organization=organization, user=owner)
    response = owner_client.patch(
        f"/api/organizations/{organization.id}/members/{membership.id}/",
        {"role": "member"},
        format="json",
    )
    assert response.status_code == 400


# --- comment ownership -----------------------------------------------------


def test_a_member_cannot_edit_someone_elses_comment(task, member, member_client, owner, client_for):
    created = client_for(owner).post(
        f"/api/tasks/{task.id}/comments/", {"body": "Owner's comment"}, format="json"
    )
    assert created.status_code == 201
    response = member_client.patch(
        f"/api/tasks/{task.id}/comments/{created.data['id']}/",
        {"body": "hijacked"},
        format="json",
    )
    assert response.status_code == 403


def test_an_author_can_edit_their_own_comment(task, member_client):
    created = member_client.post(f"/api/tasks/{task.id}/comments/", {"body": "Mine"}, format="json")
    response = member_client.patch(
        f"/api/tasks/{task.id}/comments/{created.data['id']}/",
        {"body": "Mine, edited"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["body"] == "Mine, edited"


def test_a_manager_can_delete_anyones_comment(task, member, manager_client, client_for):
    created = client_for(member).post(
        f"/api/tasks/{task.id}/comments/", {"body": "Member's comment"}, format="json"
    )
    response = manager_client.delete(f"/api/tasks/{task.id}/comments/{created.data['id']}/")
    assert response.status_code == 204


def test_comments_on_a_foreign_task_are_404(outsider_client, task):
    response = outsider_client.get(f"/api/tasks/{task.id}/comments/")
    assert response.status_code == 404


# --- server-controlled fields ---------------------------------------------


def test_created_by_cannot_be_forged(project, member, member_client):
    victim = UserFactory()
    response = member_client.post(
        "/api/tasks/",
        {"project": project.id, "title": "Whose task is this", "created_by": victim.id},
        format="json",
    )
    assert response.status_code == 201
    task = Task.objects.get(pk=response.data["id"])
    assert task.created_by_id == member.id
