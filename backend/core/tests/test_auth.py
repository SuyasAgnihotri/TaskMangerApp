import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="test@example.com",
        username="testuser",
        password="testpass123",
    )


@pytest.mark.django_db
def test_signup_and_login(api_client):
    signup = api_client.post(
        "/api/auth/signup",
        {
            "email": "new@example.com",
            "username": "newuser",
            "password": "securepass1",
        },
        format="json",
    )
    assert signup.status_code == 201
    assert signup.data["data"]["user"]["email"] == "new@example.com"
    assert "access_token" in signup.cookies

    api_client.cookies.clear()
    login = api_client.post(
        "/api/auth/login",
        {"email": "new@example.com", "password": "securepass1"},
        format="json",
    )
    assert login.status_code == 200
    assert "access_token" in login.cookies


@pytest.mark.django_db
def test_create_workspace_and_task(api_client, user):
    api_client.force_authenticate(user=user)

    ws = api_client.post("/api/workspaces", {"name": "Acme"}, format="json")
    assert ws.status_code == 201
    workspace_id = ws.data["data"]["id"]

    project = api_client.post(
        f"/api/workspaces/{workspace_id}/projects",
        {"name": "Sprint 1"},
        format="json",
    )
    assert project.status_code == 201
    project_id = project.data["data"]["id"]

    board = api_client.get(f"/api/projects/{project_id}/board")
    assert board.status_code == 200
    column_id = board.data["data"]["columns"][0]["id"]

    task = api_client.post(
        "/api/tasks",
        {"column_id": column_id, "title": "First task", "priority": "high"},
        format="json",
    )
    assert task.status_code == 201
    assert task.data["data"]["title"] == "First task"
