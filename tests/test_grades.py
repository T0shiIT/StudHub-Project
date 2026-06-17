import requests
import pytest
import uuid
from datetime import date
 
from conftest import BASE_URL, register_and_login
 
 
def _csrf(session):
    session.get(f"{BASE_URL}/api/user", timeout=10)
    return session.cookies.get("XSRF-TOKEN")
 
 
def create_course(teacher_session) -> int:
    """Создаёт курс от имени учителя, возвращает course_id."""
    csrf = _csrf(teacher_session)
    r = teacher_session.post(
        f"{BASE_URL}/api/courses",
        json={"title": f"Course-{uuid.uuid4().hex[:8]}", "description": "test"},
        headers={"X-XSRF-TOKEN": csrf} if csrf else {},
        timeout=10
    )
    assert r.status_code == 200, f"Курс не создан: {r.text}"
    return r.json()["id"]
 
 
class TestCreateGrade:
 
    def test_teacher_can_create_grade(self, teacher, student):
        course_id = create_course(teacher["session"])
 
        # Записываем студента на курс
        enroll_r = student["session"].post(
            f"{BASE_URL}/api/courses/{course_id}/enroll",
            timeout=10
        )
        assert enroll_r.status_code == 200, f"Запись не удалась: {enroll_r.text}"
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].post(
            f"{BASE_URL}/api/grades",
            json={
                "studentId": student["id"],
                "courseId": course_id,
                "subject": f"Math-{uuid.uuid4().hex[:8]}",
                "grade": "5",
                "date": date.today().isoformat()
            },
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert r.status_code in (200, 201), f"Got {r.status_code}: {r.text}"
 
    def test_student_cannot_create_grade(self, student):
        """Студент не может создавать оценки — 403."""
        csrf = _csrf(student["session"])
        r = student["session"].post(
            f"{BASE_URL}/api/grades",
            json={
                "studentId": student["id"],
                "courseId": 1,
                "subject": "Math",
                "grade": "5",
                "date": date.today().isoformat()
            },
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert r.status_code == 403
 
    def test_unauthenticated_cannot_create_grade(self):
        """Без авторизации — 401."""
        r = requests.post(
            f"{BASE_URL}/api/grades",
            json={"studentId": 1, "courseId": 1, "subject": "X", "grade": "5", "date": date.today().isoformat()},
            allow_redirects=False,
            timeout=10
        )
        assert r.status_code in (401, 302)
 
 
class TestCourseGrades:
 
    def test_teacher_can_get_course_grades_with_group(self, teacher, student):
        """Teacher с параметром group получает 200."""
        course_id = create_course(teacher["session"])
 
        r = teacher["session"].get(
            f"{BASE_URL}/api/grades/course/{course_id}",
            params={"group": student["session"].get(f"{BASE_URL}/api/user", timeout=10).json().get("group", "ПИ-2025")},
            timeout=10
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
 
    def test_teacher_without_group_gets_400(self, teacher):
        """Teacher без group → 400."""
        course_id = create_course(teacher["session"])
 
        r = teacher["session"].get(
            f"{BASE_URL}/api/grades/course/{course_id}",
            timeout=10
        )
        assert r.status_code == 400
 
    def test_student_gets_own_group_grades(self, teacher, student):
        """Студент не передаёт group — сервер сам берёт его группу."""
        course_id = create_course(teacher["session"])
 
        # Записываем студента
        student["session"].post(f"{BASE_URL}/api/courses/{course_id}/enroll", timeout=10)
 
        r = student["session"].get(
            f"{BASE_URL}/api/grades/course/{course_id}",
            timeout=10
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
 
    def test_nonexistent_course_returns_404(self, teacher):
        r = teacher["session"].get(
            f"{BASE_URL}/api/grades/course/999999999",
            params={"group": "ПИ-2025"},
            timeout=10
        )
        assert r.status_code == 404
 
    def test_unauthenticated_gets_401(self):
        r = requests.get(
            f"{BASE_URL}/api/grades/course/1",
            allow_redirects=False,
            timeout=10
        )
        assert r.status_code in (401, 302)
 
    def test_teacher_can_get_course_groups(self, teacher):
        course_id = create_course(teacher["session"])
 
        r = teacher["session"].get(
            f"{BASE_URL}/api/grades/course/{course_id}/groups",
            timeout=10
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
 
    def test_student_cannot_get_course_groups(self, student, teacher):
        """Студент не имеет доступа к списку групп — 403."""
        course_id = create_course(teacher["session"])
 
        r = student["session"].get(
            f"{BASE_URL}/api/grades/course/{course_id}/groups",
            timeout=10
        )
        assert r.status_code == 403
 
 
class TestUpdateGrade:
 
    def test_teacher_can_update_grade(self, teacher, student):
        """Полный цикл: создать курс → записать → выставить оценку → обновить."""
        course_id = create_course(teacher["session"])
        student["session"].post(f"{BASE_URL}/api/courses/{course_id}/enroll", timeout=10)
 
        subject = f"Phys-{uuid.uuid4().hex[:8]}"
        csrf = _csrf(teacher["session"])
        create_r = teacher["session"].post(
            f"{BASE_URL}/api/grades",
            json={"studentId": student["id"], "courseId": course_id,
                  "subject": subject, "grade": "3", "date": date.today().isoformat()},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert create_r.status_code in (200, 201), f"Создание: {create_r.text}"
        grade_id = create_r.json()["id"]
 
        csrf = _csrf(teacher["session"])
        patch_r = teacher["session"].patch(
            f"{BASE_URL}/api/grades/{grade_id}",
            json={"grade": "5"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert patch_r.status_code == 200
        assert patch_r.json()["grade"] == "5"
 
    def test_patch_nonexistent_grade(self, teacher):
        csrf = _csrf(teacher["session"])
        r = teacher["session"].patch(
            f"{BASE_URL}/api/grades/999999999",
            json={"grade": "5"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert r.status_code == 404
 
    def test_student_cannot_patch_grade(self, student):
        csrf = _csrf(student["session"])
        r = student["session"].patch(
            f"{BASE_URL}/api/grades/1",
            json={"grade": "5"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert r.status_code == 403
 
    def test_unauthenticated_patch(self):
        r = requests.patch(
            f"{BASE_URL}/api/grades/1",
            json={"grade": "5"},
            allow_redirects=False,
            timeout=10
        )
        assert r.status_code in (401, 302)
 
    def test_patch_grade_date(self, teacher, student):
        """Обновление даты оценки."""
        course_id = create_course(teacher["session"])
        student["session"].post(f"{BASE_URL}/api/courses/{course_id}/enroll", timeout=10)
 
        subject = f"Chem-{uuid.uuid4().hex[:8]}"
        csrf = _csrf(teacher["session"])
        create_r = teacher["session"].post(
            f"{BASE_URL}/api/grades",
            json={"studentId": student["id"], "courseId": course_id,
                  "subject": subject, "grade": "4", "date": "2025-01-10"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert create_r.status_code in (200, 201)
        grade_id = create_r.json()["id"]
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].patch(
            f"{BASE_URL}/api/grades/{grade_id}/date",
            json={"date": "2025-02-15"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10
        )
        assert r.status_code == 200
 
    def test_patch_grade_date_requires_auth(self):
        r = requests.patch(
            f"{BASE_URL}/api/grades/1/date",
            json={"date": "2026-06-17"},
            allow_redirects=False,
            timeout=10
        )
        assert r.status_code in (401, 302)