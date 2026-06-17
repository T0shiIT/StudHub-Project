"""
*Пояснение к тесту - проверка обьявлений
(/api/announcements):
  - любой авторизованный может получить список
  - любой авторизованный может создать объявление
  - только владелец или admin может удалить
  - чужое объявление удалить нельзя (403)
  - несуществующее → 404
  - без авторизации → 401
"""


import requests
import pytest
import uuid
 
from conftest import BASE_URL, register_and_login
 
 
def _csrf(session):
    session.get(f"{BASE_URL}/api/user", timeout=10)
    return session.cookies.get("XSRF-TOKEN")
 
 
def create_announcement(session, content=None) -> dict:
    csrf = _csrf(session)
    r = session.post(
        f"{BASE_URL}/api/announcements",
        json={"content": content or f"Объявление {uuid.uuid4().hex[:8]}"},
        headers={"X-XSRF-TOKEN": csrf} if csrf else {},
        timeout=10,
    )
    assert r.status_code == 200, f"Объявление не создано: {r.text}"
    return r.json()

class TestGetAnnouncements:
 
    def test_authenticated_user_can_get_announcements(self, student):
        r = student["session"].get(f"{BASE_URL}/api/announcements", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
 
    def test_unauthenticated_gets_401(self):
        r = requests.get(
            f"{BASE_URL}/api/announcements",
            allow_redirects=False,
            timeout=10,
        )
        assert r.status_code in (401, 302)
 
    def test_announcements_sorted_newest_first(self, student):
        """Объявления идут от новых к старым."""
        create_announcement(student["session"], "Первое")
        create_announcement(student["session"], "Второе")
 
        r = student["session"].get(f"{BASE_URL}/api/announcements", timeout=10)
        items = r.json()
        assert len(items) >= 2
        # createdAt первого >= второго
        assert items[0]["createdAt"] >= items[1]["createdAt"]
 
 
class TestCreateAnnouncement:
 
    def test_student_can_create_announcement(self, student):
        content = f"Тест {uuid.uuid4().hex[:8]}"
        body = create_announcement(student["session"], content)
        assert body["content"] == content
        assert "id" in body
        assert body["userId"] == str(student["id"])
        assert body["role"] == "STUDENT"
 
    def test_teacher_can_create_announcement(self, teacher):
        body = create_announcement(teacher["session"])
        assert body["role"] == "TEACHER"
 
    def test_admin_can_create_announcement(self, admin):
        body = create_announcement(admin["session"])
        assert body["role"] == "ADMIN"
 
    def test_created_announcement_appears_in_list(self, student):
        content = f"Видимое {uuid.uuid4().hex[:8]}"
        created = create_announcement(student["session"], content)
 
        r = student["session"].get(f"{BASE_URL}/api/announcements", timeout=10)
        ids = [a["id"] for a in r.json()]
        assert created["id"] in ids
 
    def test_unauthenticated_cannot_create(self):
        r = requests.post(
            f"{BASE_URL}/api/announcements",
            json={"content": "!!!"},
            allow_redirects=False,
            timeout=10,
        )
        assert r.status_code in (401, 302)
 
    def test_announcement_contains_user_info(self, student):
        body = create_announcement(student["session"])
        assert body["userId"] == str(student["id"])
        assert "userName" in body
        assert "createdAt" in body
 
 
class TestDeleteAnnouncement:
 
    def test_owner_can_delete_own_announcement(self, student):
        ann = create_announcement(student["session"])
        ann_id = ann["id"]
 
        csrf = _csrf(student["session"])
        r = student["session"].delete(
            f"{BASE_URL}/api/announcements/{ann_id}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
 
        # Проверяем что объявление исчезло из списка
        items = student["session"].get(f"{BASE_URL}/api/announcements", timeout=10).json()
        assert all(a["id"] != ann_id for a in items)
 
    def test_admin_can_delete_any_announcement(self, student, admin):
        ann = create_announcement(student["session"])
 
        csrf = _csrf(admin["session"])
        r = admin["session"].delete(
            f"{BASE_URL}/api/announcements/{ann['id']}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
 
    def test_other_user_cannot_delete_announcement(self, student):
        """Другой студент не может удалить чужое объявление."""
        other = register_and_login()
        ann = create_announcement(other["session"])
 
        csrf = _csrf(student["session"])
        r = student["session"].delete(
            f"{BASE_URL}/api/announcements/{ann['id']}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 403
 
    def test_delete_nonexistent_returns_404(self, student):
        csrf = _csrf(student["session"])
        r = student["session"].delete(
            f"{BASE_URL}/api/announcements/nonexistent-id-{uuid.uuid4().hex}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 404
 
    def test_unauthenticated_cannot_delete(self, student):
        ann = create_announcement(student["session"])
        r = requests.delete(
            f"{BASE_URL}/api/announcements/{ann['id']}",
            allow_redirects=False,
            timeout=10,
        )
        assert r.status_code in (401, 302)
 
    def test_teacher_cannot_delete_student_announcement(self, student, teacher):
        ann = create_announcement(student["session"])
 
        csrf = _csrf(teacher["session"])
        r = teacher["session"].delete(
            f"{BASE_URL}/api/announcements/{ann['id']}",
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 403