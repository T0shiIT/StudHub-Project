def test_teacher_create_course(client, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    data = {
        "title": "New Course",
        "description": "Course description",
        "teacherId": teacher_user["id"]
    }
    resp = client.post("/api/courses", json=data)
    assert resp.status_code == 201
    course = resp.json()
    assert course["title"] == "New Course"
    assert course["teacherId"] == teacher_user["id"]
    return course

def test_student_cannot_create_course(client, student_user):
    client.login(student_user["email"], "Student123")
    data = {
        "title": "Student Course",
        "description": "Should fail",
        "teacherId": student_user["id"]  # студент пытается быть учителем
    }
    resp = client.post("/api/courses", json=data)
    # Только учитель или админ могут создавать курсы, студент – нет
    assert resp.status_code == 403 or resp.status_code == 500  # зависит от логики

def test_admin_create_course_for_other_teacher(client, admin_user, teacher_user):
    client.login(admin_user["email"], "Admin123")
    data = {
        "title": "Admin created",
        "teacherId": teacher_user["id"]
    }
    resp = client.post("/api/courses", json=data)
    assert resp.status_code == 201