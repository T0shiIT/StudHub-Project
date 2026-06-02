import pytest

def test_register_success(client):
    email = "newuser@test.com"
    login = "newuser"
    data = {
        "email": email,
        "login": login,
        "password": "Pass1234",
        "firstName": "New",
        "lastName": "User",
        "group": "TEST"
    }
    resp = client.post("/api/auth/register", json=data)
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == email
    assert body["login"] == login
    assert "verificationSent" in body

def test_register_duplicate_email(client, student_user):
    data = {
        "email": student_user["email"],
        "login": "anotherlogin",
        "password": "Pass123",
        "firstName": "Dupe",
        "lastName": "User",
        "group": "TEST"
    }
    resp = client.post("/api/auth/register", json=data)
    assert resp.status_code == 409
    assert "уже существует" in resp.json()["error"]