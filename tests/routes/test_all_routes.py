import pytest

PUBLIC_ENDPOINTS = [
    ("GET", "/api/test"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/register"),
]

PROTECTED_ENDPOINTS = [
    ("GET", "/api/user"),
    ("GET", "/api/courses"),
    ("POST", "/api/courses"),
    ("GET", "/api/grades"),
    ("GET", "/api/notifications"),
]

def test_public_endpoints_accessible_without_auth(client):
    for method, path in PUBLIC_ENDPOINTS:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, json={})
        # Не должны требовать аутентификации
        assert resp.status_code != 401

def test_protected_endpoints_require_auth(client):
    for method, path in PROTECTED_ENDPOINTS:
        # Выходим из сессии
        client.logout()
        if method == "GET":
            resp = client.get(path)
        elif method == "POST":
            resp = client.post(path, json={})
        elif method == "PUT":
            resp = client.put(path, json={})
        elif method == "DELETE":
            resp = client.delete(path)
        assert resp.status_code == 401 or resp.status_code == 403 or resp.status_code == 302

def test_courses_endpoint_role_access(client, student_user, teacher_user):
    # Студент видит только курсы, где он участник (или все активные – зависит от реализации)
    client.login(student_user["email"], "Student123")
    resp = client.get("/api/courses")
    assert resp.status_code == 200
    # Учитель видит свои курсы и может создавать
    client.logout()
    client.login(teacher_user["email"], "Teacher123")
    resp = client.get("/api/courses")
    assert resp.status_code == 200