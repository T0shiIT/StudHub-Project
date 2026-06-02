import pytest

def test_role_after_register(client):
    # Обычная регистрация даёт роль STUDENT
    email = "rolestudent@test.com"
    data = {
        "email": email,
        "login": "rolestudent",
        "password": "Pass1234",
        "firstName": "Role",
        "lastName": "Student",
        "group": "TEST"
    }
    resp = client.post("/api/auth/register", json=data)
    assert resp.status_code == 201
    assert resp.json()["role"] == "STUDENT"

def test_admin_bypass_code(client):
    # Регистрация с правильным bypass‑кодом даёт роль ADMIN
    email = "adminbypass@test.com"
    data = {
        "email": email,
        "login": "adminbypass",
        "password": "Admin123",
        "firstName": "Admin",
        "lastName": "Bypass",
        "group": "ADMINS",
        "code": "test_admin_code"
    }
    resp = client.post("/api/auth/register", json=data)
    assert resp.status_code == 201
    assert resp.json()["role"] == "ADMIN"