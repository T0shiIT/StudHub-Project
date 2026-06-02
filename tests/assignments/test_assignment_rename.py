def test_teacher_rename_assignment(client, teacher_user):
    client.login(teacher_user["email"], "Teacher123")
    course = client.post("/api/courses", json={"title": "Rename Course", "teacherId": teacher_user["id"]}).json()
    course_id = course["id"]
    record = client.post(f"/api/courses/{course_id}/records", json={"title": "Old Name"}).json()
    # Обновление записи – нет отдельного PUT /records, но можно через обновление всего курса? Нет.
    # В текущем API нет метода обновления отдельной записи.
    pytest.skip("Update record endpoint not implemented")