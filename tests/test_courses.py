import requests
import pytest
import uuid
 
from conftest import BASE_URL, register_and_login
 
 
def _csrf(session):
    session.get(f"{BASE_URL}/api/user", timeout=10)
    return session.cookies.get("XSRF-TOKEN")
 
# Вспомогательные функции — создают нужные сущности и возвращают id
def create_course(teacher_session) -> int:
    csrf = _csrf(teacher_session)
    r = teacher_session.post(
        f"{BASE_URL}/api/courses",
        json={"title": f"Course-{uuid.uuid4().hex[:8]}", "description": "test course"},
        headers={"X-XSRF-TOKEN": csrf} if csrf else {},
        timeout=10,
    )
    assert r.status_code == 200, f"Курс не создан: {r.text}"
    return r.json()["id"]
 
 
def create_section(teacher_session, course_id) -> int:
    csrf = _csrf(teacher_session)
    r = teacher_session.post(
        f"{BASE_URL}/api/materials/sections",
        json={"courseId": course_id, "title": f"Section-{uuid.uuid4().hex[:6]}", "position": 0},
        headers={"X-XSRF-TOKEN": csrf} if csrf else {},
        timeout=10,
    )
    assert r.status_code == 200, f"Секция не создана: {r.text}"
    return r.json()["id"]
 
 
def create_test_material(teacher_session, section_id) -> int:
    csrf = _csrf(teacher_session)
    r = teacher_session.post(
        f"{BASE_URL}/api/materials/material",
        json={
            "sectionId": section_id,
            "title": f"Test-{uuid.uuid4().hex[:6]}",
            "description": "Проверочный тест",
            "materialType": "TEST",
            "position": 0,
        },
        headers={"X-XSRF-TOKEN": csrf} if csrf else {},
        timeout=10,
    )
    assert r.status_code == 200, f"Материал не создан: {r.text}"
    return r.json()["id"]
 
 
def add_question(teacher_session, material_id, text, options, correct_index) -> int:
    csrf = _csrf(teacher_session)
    r = teacher_session.post(
        f"{BASE_URL}/api/materials/{material_id}/questions",
        json={"text": text, "options": options, "correctOptionIndex": correct_index},
        headers={"X-XSRF-TOKEN": csrf} if csrf else {},
        timeout=10,
    )
    assert r.status_code == 200, f"Вопрос не добавлен: {r.text}"
    return r.json()["id"]
 
 
def enroll_student(student_session, course_id):
    r = student_session.post(
        f"{BASE_URL}/api/courses/{course_id}/enroll",
        timeout=10,
    )
    assert r.status_code == 200, f"Запись не удалась: {r.text}"

# Тесты создания курса и структуры
class TestCourseSetup:
 
    def test_teacher_can_create_course(self, teacher):
        csrf = _csrf(teacher["session"])
        r = teacher["session"].post(
            f"{BASE_URL}/api/courses",
            json={"title": f"NewCourse-{uuid.uuid4().hex[:8]}", "description": "desc"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert "id" in body
        assert body["title"].startswith("NewCourse-")
 
    def test_student_cannot_create_course(self, student):
        csrf = _csrf(student["session"])
        r = student["session"].post(
            f"{BASE_URL}/api/courses",
            json={"title": "HackCourse", "description": "nope"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 403
 
    def test_teacher_can_create_section(self, teacher):
        course_id = create_course(teacher["session"])
        csrf = _csrf(teacher["session"])
        r = teacher["session"].post(
            f"{BASE_URL}/api/materials/sections",
            json={"courseId": course_id, "title": "Раздел 1", "position": 0},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["title"] == "Раздел 1"
 
    def test_get_sections_for_course(self, teacher):
        course_id = create_course(teacher["session"])
        create_section(teacher["session"], course_id)
 
        r = teacher["session"].get(
            f"{BASE_URL}/api/materials/course/{course_id}/sections",
            timeout=10,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1
 
    def test_teacher_can_delete_section(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].delete(
            f"{BASE_URL}/api/materials/sections/{section_id}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
 
# Тесты создания материала типа TEST
class TestMaterialCreation:
 
    def test_teacher_can_create_test_material(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].post(
            f"{BASE_URL}/api/materials/material",
            json={
                "sectionId": section_id,
                "title": "Тест по Python",
                "materialType": "TEST",
                "position": 0,
            },
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["materialType"] == "TEST"
        assert "id" in body
 
    def test_get_material_by_id(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
        material_id = create_test_material(teacher["session"], section_id)
 
        r = teacher["session"].get(
            f"{BASE_URL}/api/materials/{material_id}",
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["id"] == material_id
 
    def test_get_materials_for_section(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
        create_test_material(teacher["session"], section_id)
 
        r = teacher["session"].get(
            f"{BASE_URL}/api/materials/section/{section_id}",
            timeout=10,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1
 
    def test_teacher_can_delete_material(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
        material_id = create_test_material(teacher["session"], section_id)
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].delete(
            f"{BASE_URL}/api/materials/{material_id}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
 
        # Проверяем что материал удалён
        r2 = teacher["session"].get(f"{BASE_URL}/api/materials/{material_id}", timeout=10)
        assert r2.status_code == 404
 
    def test_other_teacher_cannot_delete_material(self):
        """Другой учитель не может удалить чужой материал."""
        teacher1 = register_and_login("admin")
        teacher2 = register_and_login("admin")
 
        # teacher1 меняет роль на TEACHER
        for user in [teacher1, teacher2]:
            sess = user["session"]
            csrf = _csrf(sess)
            sess.post(
                f"{BASE_URL}/api/user/change-role",
                json={"target_user_id": str(user["id"]), "role": "TEACHER"},
                headers={"X-XSRF-TOKEN": csrf} if csrf else {},
                timeout=10,
            )
            user["role"] = "TEACHER"
 
        course_id = create_course(teacher1["session"])
        section_id = create_section(teacher1["session"], course_id)
        material_id = create_test_material(teacher1["session"], section_id)
 
        csrf2 = _csrf(teacher2["session"])
        r = teacher2["session"].delete(
            f"{BASE_URL}/api/materials/{material_id}",
            headers={"X-XSRF-TOKEN": csrf2} if csrf2 else {},
            timeout=10,
        )
        assert r.status_code == 403
 
# Тесты добавления вопросов
class TestQuestions:
 
    def test_teacher_can_add_question(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
        material_id = create_test_material(teacher["session"], section_id)
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].post(
            f"{BASE_URL}/api/materials/{material_id}/questions",
            json={
                "text": "Что такое Python?",
                "options": ["2+2", "5", "0", "4"],
                "correctOptionIndex": 1,
            },
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        assert "id" in r.json()
 
    def test_get_questions_for_test(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
        material_id = create_test_material(teacher["session"], section_id)
        add_question(teacher["session"], material_id,
                     "Вопрос 1", ["A", "B", "C", "D"], 0)
 
        r = teacher["session"].get(
            f"{BASE_URL}/api/materials/{material_id}/questions",
            timeout=10,
        )
        assert r.status_code == 200
        questions = r.json()
        assert isinstance(questions, list)
        assert len(questions) >= 1
        q = questions[0]
        assert "id" in q
        assert "text" in q
        assert "options" in q
        assert "correctOptionId" in q
 
    def test_teacher_can_update_questions(self, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
        material_id = create_test_material(teacher["session"], section_id)
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].put(
            f"{BASE_URL}/api/materials/{material_id}/questions",
            json=[
                {"text": "Вопрос A", "options": ["Да", "Нет"], "correctOptionIndex": 0},
                {"text": "Вопрос B", "options": ["1", "2", "3"], "correctOptionIndex": 2},
            ],
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
 
        # Проверяем что вопросов теперь 2
        questions = teacher["session"].get(
            f"{BASE_URL}/api/materials/{material_id}/questions", timeout=10
        ).json()
        assert len(questions) == 2
 
    def test_student_cannot_add_question(self, student, teacher):
        course_id = create_course(teacher["session"])
        section_id = create_section(teacher["session"], course_id)
        material_id = create_test_material(teacher["session"], section_id)
 
        csrf = _csrf(student["session"])
        r = student["session"].post(
            f"{BASE_URL}/api/materials/{material_id}/questions",
            json={"text": "Хак", "options": ["A", "B"], "correctOptionIndex": 0},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 403
 
# Тесты прохождения теста студентом
class TestPassingTest:
 
    def _setup_test(self, teacher_session, student_session=None):
        """Создаёт курс → секцию → тест → 2 вопроса. Возвращает (course_id, material_id, questions)."""
        course_id = create_course(teacher_session)
        section_id = create_section(teacher_session, course_id)
        material_id = create_test_material(teacher_session, section_id)
 
        add_question(teacher_session, material_id,
                     "2 + 2 = ?", ["3", "4", "5", "6"], correct_index=1)
        add_question(teacher_session, material_id,
                     "Столица России?", ["Киев", "Минск", "Москва", "Варшава"], correct_index=2)
 
        if student_session:
            enroll_student(student_session, course_id)
 
        questions = teacher_session.get(
            f"{BASE_URL}/api/materials/{material_id}/questions", timeout=10
        ).json()
 
        return course_id, material_id, questions
 
    def test_student_can_submit_test_all_correct(self, teacher, student):
        _, material_id, questions = self._setup_test(teacher["session"], student["session"])
 
        # Отвечаем правильно на все вопросы
        answers = {}
        for q in questions:
            correct_id = q["correctOptionId"]
            answers[str(q["id"])] = correct_id
 
        csrf = _csrf(student["session"])
        r = student["session"].post(
            f"{BASE_URL}/api/materials/{material_id}/submit-test",
            json=answers,
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert "scorePercent" in body
        assert body["scorePercent"] == 100
 
    def test_student_can_submit_test_all_wrong(self, teacher, student):
        _, material_id, questions = self._setup_test(teacher["session"], student["session"])
 
        # Отвечаем неправильно — берём первый вариант (не правильный)
        answers = {}
        for q in questions:
            wrong_option = next(
                opt for opt in q["options"]
                if opt["id"] != q["correctOptionId"]
            )
            answers[str(q["id"])] = wrong_option["id"]
 
        csrf = _csrf(student["session"])
        r = student["session"].post(
            f"{BASE_URL}/api/materials/{material_id}/submit-test",
            json=answers,
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["scorePercent"] == 0
 
    def test_student_cannot_submit_test_twice(self, teacher, student):
        """Повторная попытка → 400."""
        _, material_id, questions = self._setup_test(teacher["session"], student["session"])
 
        answers = {str(q["id"]): q["correctOptionId"] for q in questions}
        csrf = _csrf(student["session"])
        headers = {"X-XSRF-TOKEN": csrf} if csrf else {}
 
        r1 = student["session"].post(
            f"{BASE_URL}/api/materials/{material_id}/submit-test",
            json=answers, headers=headers, timeout=10,
        )
        assert r1.status_code == 200
 
        # Второй раз
        csrf = _csrf(student["session"])
        headers = {"X-XSRF-TOKEN": csrf} if csrf else {}
        r2 = student["session"].post(
            f"{BASE_URL}/api/materials/{material_id}/submit-test",
            json=answers, headers=headers, timeout=10,
        )
        assert r2.status_code == 400
        assert "уже прошли" in r2.json().get("error", "").lower() or \
               "already" in r2.json().get("error", "").lower()
 
    def test_student_can_get_test_result(self, teacher, student):
        _, material_id, questions = self._setup_test(teacher["session"], student["session"])
 
        answers = {str(q["id"]): q["correctOptionId"] for q in questions}
        csrf = _csrf(student["session"])
        student["session"].post(
            f"{BASE_URL}/api/materials/{material_id}/submit-test",
            json=answers,
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
 
        r = student["session"].get(
            f"{BASE_URL}/api/materials/{material_id}/test-result",
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["completed"] is True
        assert "scorePercent" in body
        assert body["scorePercent"] == 100
 
    def test_result_before_attempt_is_not_completed(self, teacher, student):
        """Результат до прохождения теста — completed: false."""
        _, material_id, _ = self._setup_test(teacher["session"], student["session"])
 
        r = student["session"].get(
            f"{BASE_URL}/api/materials/{material_id}/test-result",
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["completed"] is False
 
    def test_unauthenticated_cannot_submit_test(self, teacher):
        _, material_id, questions = self._setup_test(teacher["session"])
        answers = {str(q["id"]): q["correctOptionId"] for q in questions}
 
        r = requests.post(
            f"{BASE_URL}/api/materials/{material_id}/submit-test",
            json=answers,
            allow_redirects=False,
            timeout=10,
        )
        assert r.status_code in (401, 302)
 
# Тесты CRUD курса
class TestCourseCRUD:
 
    def test_teacher_can_update_course(self, teacher):
        course_id = create_course(teacher["session"])
        csrf = _csrf(teacher["session"])
 
        r = teacher["session"].put(
            f"{BASE_URL}/api/courses/{course_id}",
            json={"title": "Обновлённый курс", "description": "новое описание"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["title"] == "Обновлённый курс"
 
    def test_teacher_can_delete_own_course(self, teacher):
        course_id = create_course(teacher["session"])
        csrf = _csrf(teacher["session"])
 
        r = teacher["session"].delete(
            f"{BASE_URL}/api/courses/{course_id}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
 
        r2 = teacher["session"].get(f"{BASE_URL}/api/courses/{course_id}", timeout=10)
        assert r2.status_code == 404
 
    def test_student_cannot_delete_course(self, student, teacher):
        course_id = create_course(teacher["session"])
        csrf = _csrf(student["session"])
 
        r = student["session"].delete(
            f"{BASE_URL}/api/courses/{course_id}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 403
 
    def test_student_can_enroll_and_unenroll(self, teacher, student):
        course_id = create_course(teacher["session"])
 
        enroll_r = student["session"].post(
            f"{BASE_URL}/api/courses/{course_id}/enroll",
            timeout=10,
        )
        assert enroll_r.status_code == 200
 
        # Проверяем статус записи
        status_r = student["session"].get(
            f"{BASE_URL}/api/courses/{course_id}/enrollment-status",
            timeout=10,
        )
        assert status_r.status_code == 200
        assert status_r.json()["enrolled"] is True
 
        # Отписываемся
        csrf = _csrf(student["session"])
        unenroll_r = student["session"].post(
            f"{BASE_URL}/api/courses/{course_id}/unenroll",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert unenroll_r.status_code == 200
 
        status_r2 = student["session"].get(
            f"{BASE_URL}/api/courses/{course_id}/enrollment-status",
            timeout=10,
        )
        assert status_r2.json()["enrolled"] is False
 
    def test_double_enroll_returns_400(self, teacher, student):
        course_id = create_course(teacher["session"])
        student["session"].post(f"{BASE_URL}/api/courses/{course_id}/enroll", timeout=10)
 
        r2 = student["session"].post(f"{BASE_URL}/api/courses/{course_id}/enroll", timeout=10)
        assert r2.status_code == 400
 
    def test_course_status_inactive_hidden_from_student(self, teacher, student):
        """Неактивный курс не виден студентам через GET /api/courses/{id}."""
        course_id = create_course(teacher["session"])
 
        # Делаем курс неактивным
        csrf = _csrf(teacher["session"])
        teacher["session"].put(
            f"{BASE_URL}/api/courses/{course_id}",
            json={"status": "INACTIVE"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
 
        r = student["session"].get(f"{BASE_URL}/api/courses/{course_id}", timeout=10)
        assert r.status_code == 403