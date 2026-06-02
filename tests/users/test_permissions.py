def test_student_cannot_change_role(client, student_user):
    client.login(student_user["email"], "Student123")
    payload = {
        "target_user_id": "999",
        "role": "TEACHER"
    }
    resp = client.post("/api/user/change-role", json=payload)
    # Студент не имеет прав ADMIN
    assert resp.status_code == 403