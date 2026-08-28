import pytest
from django.contrib.auth import get_user_model

User = get_user_model()
pytestmark = pytest.mark.django_db


def test_register_creates_user_and_never_echoes_the_password(api):
    response = api.post(
        "/api/auth/register/",
        {
            "email": "new@example.com",
            "full_name": "New Person",
            "password": "a-strong-passphrase-42",
            "password_confirm": "a-strong-passphrase-42",
        },
        format="json",
    )

    assert response.status_code == 201
    assert "password" not in response.data
    assert "password_confirm" not in response.data

    user = User.objects.get(email="new@example.com")
    assert user.password.startswith("pbkdf2_"), "password must be hashed"
    assert user.check_password("a-strong-passphrase-42")


def test_register_rejects_mismatched_passwords(api):
    response = api.post(
        "/api/auth/register/",
        {
            "email": "x@example.com",
            "password": "a-strong-passphrase-42",
            "password_confirm": "something-else-entirely",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "password_confirm" in response.data["errors"]


def test_register_rejects_a_weak_password(api):
    response = api.post(
        "/api/auth/register/",
        {"email": "y@example.com", "password": "123", "password_confirm": "123"},
        format="json",
    )
    assert response.status_code == 400
    assert "password" in response.data["errors"]


def test_register_rejects_a_duplicate_email(api, member):
    response = api.post(
        "/api/auth/register/",
        {
            "email": member.email.upper(),
            "password": "a-strong-passphrase-42",
            "password_confirm": "a-strong-passphrase-42",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "email" in response.data["errors"]


def test_login_returns_tokens_and_the_user(api, member):
    response = api.post(
        "/api/auth/token/",
        {"email": member.email, "password": "test-password-9271"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["access"]
    assert response.data["refresh"]
    assert response.data["user"]["email"] == member.email


def test_login_with_a_wrong_password_is_401(api, member):
    response = api.post(
        "/api/auth/token/",
        {"email": member.email, "password": "not-the-password"},
        format="json",
    )
    assert response.status_code == 401


def test_refresh_token_yields_a_new_access_token(api, member):
    login = api.post(
        "/api/auth/token/",
        {"email": member.email, "password": "test-password-9271"},
        format="json",
    )
    response = api.post(
        "/api/auth/token/refresh/",
        {"refresh": login.data["refresh"]},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["access"]


def test_me_requires_authentication(api):
    assert api.get("/api/auth/me/").status_code == 401


def test_me_returns_the_current_user(member_client, member):
    response = member_client.get("/api/auth/me/")
    assert response.status_code == 200
    assert response.data["email"] == member.email


@pytest.mark.parametrize(
    "path",
    [
        "/api/tasks/",
        "/api/projects/",
        "/api/organizations/",
        "/api/labels/",
        "/api/activity/",
    ],
)
def test_every_collection_rejects_anonymous_access_with_401(api, path):
    """Regression guard.

    Setting `permission_classes` on a view replaces DEFAULT_PERMISSION_CLASSES
    instead of extending it. When that happened here, anonymous requests
    reached get_queryset() and crashed with a 500 filtering on AnonymousUser.
    """
    response = api.get(path)
    assert response.status_code == 401, f"{path} returned {response.status_code}"
