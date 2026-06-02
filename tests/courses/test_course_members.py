def test_add_member_by_teacher(client, teacher_user, student_user):
    client.login(teacher_user["email"], "Teacher123")
    # Создаём курс
    course = client.post("/api/courses", json={"title": "Members Course", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    # Добавляем студента
    resp = client.post(f"/api/courses/{course_id}/members", json={"userId": student_user["id"]})
    assert resp.status_code == 200
    # Проверяем, что студент отображается в списке участников
    course_data = client.get(f"/api/courses/{course_id}").json()
    enrollments = course_data["enrollments"]
    assert any(e["userId"] == student_user["id"] for e in enrollments)

def test_remove_member_by_teacher(client, teacher_user, student_user):
    client.login(teacher_user["email"], "Teacher123")
    # Тот же курс, удаляем участника
    course_id = client.get("/api/courses").json()[0]["id"]  # используем существующий
    resp = client.delete(f"/api/courses/{course_id}/members/{student_user['id']}")
    assert resp.status_code == 204
    # Проверяем, что студент удалён
    course_data = client.get(f"/api/courses/{course_id}").json()
    assert not any(e["userId"] == student_user["id"] for e in course_data["enrollments"])

def test_student_cannot_add_member(client, student_user, teacher_user):
    client.login(student_user["email"], "Student123")
    # Пытаемся добавить другого студента в любой курс (у студента нет прав)
    # Для теста возьмём любой существующий курс
    courses = client.get("/api/courses").json()
    if not courses:
        pytest.skip("No courses available")
    course_id = courses[0]["id"]
    resp = client.post(f"/api/courses/{course_id}/members", json={"userId": teacher_user["id"]})
    assert resp.status_code == 403