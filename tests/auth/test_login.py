def test_login_success(client, student_user):
    resp = client.login(student_user["email"], "Student123")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == student_user["id"]
    assert data["email"] == student_user["email"]

def test_login_wrong_password(client, student_user):
    resp = client.login(student_user["email"], "wrong")
    assert resp.status_code == 401
    assert "Неверный" in resp.json()["error"]

def test_logout(client):
    # Сначала логинимся
    client.login("student@test.com", "Student123")
    resp = client.logout()
    assert resp.status_code in (200, 302)
    # Проверяем, что после логаута доступ к защищённому ресурсу невозможен
    user_info = client.get("/api/user")
    # Должен быть редирект на логин или 401
    assert user_info.status_code in (401, 302)