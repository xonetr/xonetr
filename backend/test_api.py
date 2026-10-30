import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

import backend.app as api


def build_client():
    temp_dir = Path(tempfile.mkdtemp())
    db_path = temp_dir / "test.sqlite3"
    api.DATABASE_PATH = db_path
    api.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    api.initialize_database()
    return TestClient(api.app)


def test_register_and_login_user():
    client = build_client()
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Ana",
            "email": "ana@example.com",
            "password": "secret123",
            "role": "developer",
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["email"] == "ana@example.com"

    login = client.post(
        "/api/auth/login",
        json={"email": "ana@example.com", "password": "secret123"},
    )
    assert login.status_code == 200, login.text
    assert login.json()["email"] == "ana@example.com"


def test_create_project_and_task():
    client = build_client()
    client.post(
        "/api/auth/register",
        json={
            "name": "Luis",
            "email": "luis@example.com",
            "password": "secret123",
            "role": "admin",
        },
    )

    login = client.post(
        "/api/auth/login",
        json={"email": "luis@example.com", "password": "secret123"},
    )
    assert login.status_code == 200
    cookie = login.cookies.get("admin_session")
    assert cookie

    project = client.post(
        "/api/projects",
        json={"name": "Landing nueva", "description": "Diseño y release"},
        cookies={"admin_session": cookie},
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["id"]

    task = client.post(
        "/api/tasks",
        json={
            "project_id": project_id,
            "title": "Crear hero",
            "description": "Diseño del hero",
            "status": "todo",
            "priority": "high",
        },
        cookies={"admin_session": cookie},
    )
    assert task.status_code == 200, task.text
    assert task.json()["title"] == "Crear hero"


def test_register_ignores_requested_role():
    client = build_client()
    for index, requested in enumerate(["admin", "developer", "viewer", "owner", None]):
        body = {
            "name": f"User {index}",
            "email": f"user{index}@example.com",
            "password": "secret123",
        }
        if requested is not None:
            body["role"] = requested
        response = client.post("/api/auth/register", json=body)
        assert response.status_code == 200, response.text
        assert response.json()["role"] == "viewer"
