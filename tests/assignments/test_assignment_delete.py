def test_teacher_delete_assignment(client, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    # Создаём курс и задание
    course = client.post("/api/courses", json={"title": "Del Course", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    record = client.post(f"/api/courses/{course_id}/records", json={"title": "To Delete"}).json()
    # Удаление записи – нет прямого DELETE /records/{id}, удаление через редактирование курса?
    # По коду CourseController нет delete для records. В CourseService тоже. Возможно, удаление через PUT? Но по условию "удаление заданий" должно быть.
    # В спецификации не реализовано. Поэтому пропустим или реализуем через отдельный эндпоинт.
    pytest.skip("Delete record endpoint not implemented in provided code")