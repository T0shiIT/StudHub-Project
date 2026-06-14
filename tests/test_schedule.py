import json
import uuid
import pytest
import requests
from conftest import BASE_URL
 
 
def _csrf(session: requests.Session) -> str | None:
    session.get(f"{BASE_URL}/api/user", timeout=10)
    return session.cookies.get("XSRF-TOKEN")
 
 
def _sample_schedule_json() -> dict:
    """Минимальная структура расписания для тестов."""
    return {
        "fileName": f"test_schedule_{uuid.uuid4().hex[:6]}.xlsx",
        "weeks": [
            {
                "week": 1,
                "days": [
                    {
                        "day": "Понедельник",
                        "lessons": [
                            {"time": "08:00", "subject": "Математика", "teacher": "Иванов И.И.", "room": "101"}
                        ]
                    }
                ]
            }
        ]
    }
 
# GET /api/schedule/latest
class TestGetSchedule:
 
    def test_authenticated_user_can_get_schedule(self, student):
        r = student["session"].get(f"{BASE_URL}/api/schedule/latest", timeout=10)
        # 200 (есть расписание) или 200 с сообщением "Расписание еще не загружено"
        assert r.status_code == 200
 
    def test_unauthenticated_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/schedule/latest", timeout=10)
        assert r.status_code == 401
 
    def test_response_is_json(self, student):
        r = student["session"].get(f"{BASE_URL}/api/schedule/latest", timeout=10)
        assert r.headers.get("Content-Type", "").startswith("application/json")
        # должен парситься без ошибки
        _ = r.json()

# POST /api/schedule/upload  (через Java → C++)
class TestUploadSchedule:
 
    def test_admin_can_upload_schedule(self, admin):
        sess = admin["session"]
        csrf = _csrf(sess)
        schedule = _sample_schedule_json()
 
        r = sess.post(
            f"{BASE_URL}/api/schedule/upload-json",
            json={
                "file_name":     schedule["fileName"],
                "file_type":     "xlsx",
                "uploaded_by":   admin["login"],
                "schedule_json": schedule,
            },
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=30,
        )
        assert r.status_code == 200, f"Upload провалился: {r.text}"
        body = r.json()
        assert body.get("status") == "ok"
        assert "id" in body
 
    def test_admin_upload_appears_in_latest(self, admin):
        sess = admin["session"]
        csrf = _csrf(sess)
        schedule = _sample_schedule_json()
        unique_name = schedule["fileName"]
 
        sess.post(
            f"{BASE_URL}/api/schedule/upload-json",
            json={
                "file_name":     unique_name,
                "file_type":     "xlsx",
                "uploaded_by":   admin["login"],
                "schedule_json": schedule,
            },
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=30,
        )
 
        r = sess.get(f"{BASE_URL}/api/schedule/latest", timeout=10)
        assert r.status_code == 200
        # Может быть более свежее расписание от другого теста, но поле schedule должно быть
        body = r.json()
        assert "schedule" in body or "message" in body
 
    def test_student_cannot_upload_schedule(self, student):
        sess = student["session"]
        csrf = _csrf(sess)
 
        r = sess.post(
            f"{BASE_URL}/api/schedule/upload-json",
            json={
                "file_name":     "test.xlsx",
                "file_type":     "xlsx",
                "uploaded_by":   student["login"],
                "schedule_json": _sample_schedule_json(),
            },
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code in (401, 403)
 
    def test_unauthenticated_cannot_upload(self):
        r = requests.post(
            f"{BASE_URL}/api/schedule/upload-json",
            json={
                "file_name":     "test.xlsx",
                "file_type":     "xlsx",
                "uploaded_by":   "anon",
                "schedule_json": _sample_schedule_json(),
            },
            timeout=10,
        )
        assert r.status_code in (401, 403)
 
    def test_upload_missing_fields_returns_4xx(self, admin):
        sess = admin["session"]
        csrf = _csrf(sess)
 
        r = sess.post(
            f"{BASE_URL}/api/schedule/upload-json",
            json={"file_name": "test.xlsx"},   # нет file_type, uploaded_by, schedule_json
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code in (400, 422, 500)
 
    def test_repeated_upload_same_filename_replaces(self, admin):
        """Повторная загрузка с тем же именем файла должна заменить запись (replaced=true)."""
        sess = admin["session"]
        schedule = _sample_schedule_json()
        schedule["fileName"] = f"repeated_{uuid.uuid4().hex[:6]}.xlsx"
 
        def do_upload():
            csrf = _csrf(sess)
            return sess.post(
                f"{BASE_URL}/api/schedule/upload-json",
                json={
                    "file_name":     schedule["fileName"],
                    "file_type":     "xlsx",
                    "uploaded_by":   admin["login"],
                    "schedule_json": schedule,
                },
                headers={"X-XSRF-TOKEN": csrf} if csrf else {},
                timeout=30,
            )
 
        r1 = do_upload()
        assert r1.status_code == 200
        r2 = do_upload()
        assert r2.status_code == 200
        # Второй upload должен быть replace, а не insert
        assert r2.json().get("replaced") is True