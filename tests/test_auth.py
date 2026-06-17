import uuid
import pytest
import requests
from conftest import BASE_URL, BYPASS, make_user_payload, register_and_login
 
 
#прохождение регистрации
class TestRegistration:
 
    def test_successful_registration_returns_201(self):
        sess = requests.Session()
        data = make_user_payload()
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=30)
        assert r.status_code == 201
        body = r.json()
        assert "id" in body
        assert body["email"] == data["email"]
        assert body["login"] == data["login"]
        assert "passwordHash" not in body  # хэш никогда не должен возвращаться
 
    def test_registration_with_bypass_code_gives_admin_role(self):
        sess = requests.Session()
        data = make_user_payload(role_code=BYPASS)
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=30)
        assert r.status_code == 201
        assert r.json()["role"] == "ADMIN"
 
    def test_registration_without_bypass_code_gives_student_role(self):
        sess = requests.Session()
        data = make_user_payload()
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=30)
        assert r.status_code == 201
        assert r.json().get("role") in ("STUDENT", None)  # STUDENT или поле отсутствует
 
    def test_duplicate_email_returns_409(self):
        sess = requests.Session()
        data = make_user_payload()
        sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=30)
 
        # Второй запрос с тем же email, другим логином
        data2 = {**data, "login": "unique_" + uuid.uuid4().hex[:6]}
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data2, timeout=30)
        assert r.status_code == 409
 
    def test_duplicate_login_returns_409(self):
        sess = requests.Session()
        data = make_user_payload()
        sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=30)
 
        data2 = {**data, "email": f"other_{uuid.uuid4().hex[:6]}@studhub.test"}
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data2, timeout=30)
        assert r.status_code == 409
 
    def test_missing_required_fields_returns_4xx(self):
        sess = requests.Session()
        # Пустое тело
        r = sess.post(f"{BASE_URL}/api/auth/register", json={}, timeout=10)
        assert r.status_code in (400, 422)
 
    def test_invalid_email_format_returns_4xx(self):
        sess = requests.Session()
        data = make_user_payload()
        data["email"] = "not-an-email"
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=10)
        assert r.status_code in (400, 422)
 
    def test_too_short_password_returns_4xx(self):
        """Пароль < 6 символов — нарушение @Size(min=6)."""
        sess = requests.Session()
        data = make_user_payload()
        data["password"] = "123"
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=10)
        assert r.status_code in (400, 422)
 
    def test_too_short_login_returns_4xx(self):
        """Логин < 3 символов — нарушение @Size(min=3)."""
        sess = requests.Session()
        data = make_user_payload()
        data["login"] = "ab"
        r = sess.post(f"{BASE_URL}/api/auth/register", json=data, timeout=10)
        assert r.status_code in (400, 422)
 
 
#логин
class TestLogin:
 
    def test_login_by_email_returns_200(self):
        user = register_and_login()
        # Новая сессия — без куков регистрации
        sess = requests.Session()
        r = sess.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user["email"], "password": user["password"]},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == user["email"]
 
    def test_login_by_login_field_returns_200(self):
        """Логин принимает логин (не только email)."""
        user = register_and_login()
        sess = requests.Session()
        r = sess.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user["login"], "password": user["password"]},
            timeout=10,
        )
        assert r.status_code == 200
 
    def test_wrong_password_returns_401(self):
        user = register_and_login()
        sess = requests.Session()
        r = sess.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user["email"], "password": "wrongpass"},
            timeout=10,
        )
        assert r.status_code == 401
 
    def test_nonexistent_user_returns_401(self):
        sess = requests.Session()
        r = sess.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ghost@studhub.test", "password": "whatever"},
            timeout=10,
        )
        assert r.status_code == 401
 
    def test_empty_credentials_returns_400(self):
        sess = requests.Session()
        r = sess.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "", "password": ""},
            timeout=10,
        )
        assert r.status_code == 400
 
 
#проверка профиля
class TestProfile:
 
    def test_authenticated_user_can_get_profile(self, student):
        r = student["session"].get(f"{BASE_URL}/api/user", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == student["email"]
        assert body["login"] == student["login"]
 
    def test_unauthenticated_request_returns_401(self):
        sess = requests.Session()
        r = sess.get(f"{BASE_URL}/api/user", timeout=10)
        assert r.status_code == 401
 
    def test_profile_does_not_expose_password_hash(self, student):
        r = student["session"].get(f"{BASE_URL}/api/user", timeout=10)
        body = r.json()
        assert "passwordHash" not in body
        assert "password_hash" not in body
        assert "password" not in body
 
    def test_admin_profile_has_correct_role(self, admin):
        r = admin["session"].get(f"{BASE_URL}/api/user", timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "ADMIN"
 
 
#смена ролей
class TestRoleChange:
 
    def test_admin_can_change_own_role_to_student(self, admin_once):
        sess = admin_once["session"]
        sess.get(f"{BASE_URL}/api/user", timeout=10)
        csrf = sess.cookies.get("XSRF-TOKEN")

        r = sess.post(
            f"{BASE_URL}/api/user/change-role",
            json={"target_user_id": str(admin_once["id"]), "role": "STUDENT"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code == 200
        profile = sess.get(f"{BASE_URL}/api/user", timeout=10).json()
        assert profile["role"] == "STUDENT"
 
    def test_student_cannot_change_role(self, student):
        sess = student["session"]
        sess.get(f"{BASE_URL}/api/user", timeout=10)
        csrf = sess.cookies.get("XSRF-TOKEN")
 
        r = sess.post(
            f"{BASE_URL}/api/user/change-role",
            json={"target_user_id": str(student["id"]), "role": "ADMIN"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code in (403, 401)
 
    def test_invalid_role_returns_4xx(self, admin):
        sess = admin["session"]
        sess.get(f"{BASE_URL}/api/user", timeout=10)
        csrf = sess.cookies.get("XSRF-TOKEN")
 
        r = sess.post(
            f"{BASE_URL}/api/user/change-role",
            json={"target_user_id": str(admin["id"]), "role": "SUPERUSER"},
            headers={"X-XSRF-TOKEN": csrf} if csrf else {},
            timeout=10,
        )
        assert r.status_code in (400, 422)