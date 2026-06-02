import pytest

def test_teacher_can_update_own_course(client, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    # Создаём курс
    course = client.post("/api/courses", json={"title": "Update Me", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    update = {"title": "Updated Title"}
    resp = client.put(f"/api/courses/{course_id}", json=update)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"

def test_student_cannot_update_course(client, student_user, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    course = client.post("/api/courses", json={"title": "ReadOnly", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    client.logout()
    client.login(student_user["email"], "Student123")
    resp = client.put(f"/api/courses/{course_id}", json={"title": "Hack"})
    assert resp.status_code == 403

def test_admin_can_update_any_course(client, admin_user, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    course = client.post("/api/courses", json={"title": "Admin Edit", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    client.logout()
    client.login(admin_user["email"], "Admin123")
    resp = client.put(f"/api/courses/{course_id}", json={"title": "Admin Updated"})
    assert resp.status_code == 200