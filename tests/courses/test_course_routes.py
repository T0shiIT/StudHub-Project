def test_get_active_courses(client, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    # Создаём два курса: один архивный, один нет
    active = client.post("/api/courses", json={"title": "Active", "teacherId": teacher_user["id"]}).json()
    to_archive = client.post("/api/courses", json={"title": "ToArchive", "teacherId": teacher_user["id"]}).json()
    client.post(f"/api/courses/{to_archive['id']}/archive")
    # Получаем список активных
    resp = client.get("/api/courses")
    assert resp.status_code == 200
    courses = resp.json()
    ids = [c["id"] for c in courses]
    assert active["id"] in ids
    assert to_archive["id"] not in ids

def test_get_deleted_course_forbidden_for_student(client, teacher_user, student_user):
    client.login(teacher_user["email"], "Teacher123")
    course = client.post("/api/courses", json={"title": "ToDelete", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    client.delete(f"/api/courses/{course_id}")  # soft delete
    client.logout()
    client.login(student_user["email"], "Student123")
    resp = client.get(f"/api/courses/{course_id}")
    assert resp.status_code == 403 or resp.status_code == 500  # "Course is deleted"