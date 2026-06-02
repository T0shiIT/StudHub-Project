def test_teacher_archive_course(client, teacher_user):
    # Создаём курс
    client.login(teacher_user["email"], "Teacher123")
    create_resp = client.post("/api/courses", json={
        "title": "To Archive",
        "teacherId": teacher_user["id"]
    })
    course_id = create_resp.json()["id"]
    # Архивация
    resp = client.post(f"/api/courses/{course_id}/archive")
    assert resp.status_code == 200
    # Проверяем, что курс теперь archived
    get_resp = client.get(f"/api/courses/{course_id}")
    assert get_resp.json()["archived"] == True

def test_student_cannot_archive_course(client, student_user, teacher_user):
    # Создаём курс учителем
    client.login(teacher_user["email"], "Teacher123")
    course = client.post("/api/courses", json={"title": "NoArchive", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    # Пытаемся заархивировать студентом
    client.logout()
    client.login(student_user["email"], "Student123")
    resp = client.post(f"/api/courses/{course_id}/archive")
    assert resp.status_code == 403

def test_admin_archive_any_course(client, admin_user, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    course = client.post("/api/courses", json={"title": "AdminArchive", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    client.logout()
    client.login(admin_user["email"], "Admin123")
    resp = client.post(f"/api/courses/{course_id}/archive")
    assert resp.status_code == 200