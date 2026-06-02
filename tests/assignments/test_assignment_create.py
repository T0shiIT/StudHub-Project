def test_teacher_create_assignment(client, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    # Создаём курс
    course = client.post("/api/courses", json={"title": "Course for Assignments", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    assignment_data = {
        "title": "Homework 1",
        "content": "Solve problems 1-5",
        "recordType": "HOMEWORK",
        "dueDate": "2025-12-31T23:59:59"
    }
    resp = client.post(f"/api/courses/{course_id}/records", json=assignment_data)
    assert resp.status_code == 201
    record = resp.json()
    assert record["title"] == "Homework 1"
    assert record["recordType"] == "HOMEWORK"
    return record, course_id

def test_student_cannot_create_assignment(client, student_user, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    course = client.post("/api/courses", json={"title": "Student NoCreate", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    client.logout()
    client.login(student_user["email"], "Student123")
    resp = client.post(f"/api/courses/{course_id}/records", json={"title": "Illegal"})
    assert resp.status_code == 403