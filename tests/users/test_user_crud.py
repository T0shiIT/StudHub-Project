import pytest
from conftest import create_user

def test_get_current_user(client, student_user):
    client.login(student_user["email"], "Student123")
    resp = client.get("/api/user")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == student_user["email"]

def test_change_role_as_admin(client, admin_user, student_user):
    # Админ логинится
    client.login(admin_user["email"], "Admin123")
    payload = {
        "target_user_id": str(student_user["id"]),
        "role": "TEACHER"
    }
    resp = client.post("/api/user/change-role", json=payload)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Role updated"

    # Проверяем, что роль изменилась в БД через получение пользователя
    # (есть эндпоинт /api/internal/user?email=... – он открыт, но требует аутентификации)
    # Для простоты проверим через логин (роль не влияет на логин)
    # Или сделаем отдельный запрос к /api/user (там роль не отдаётся, только в /api/user/change-role)
    # Поэтому проверим через /api/user после повторного логина студентом.
    client.logout()
    client.login(student_user["email"], "Student123")
    user_data = client.get("/api/user").json()
    # В /api/user роль не возвращается, но мы можем сделать отдельный эндпоинт, если он есть.
    # Вместо этого проверим, что студент может создавать курс (теперь он учитель)
    # Создадим курс – должно быть разрешено
    course_data = {
        "title": "Teacher course",
        "description": "After role change",
        "teacherId": student_user["id"]
    }
    resp = client.post("/api/courses", json=course_data)
    assert resp.status_code == 201