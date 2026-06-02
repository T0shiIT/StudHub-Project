import pytest
import requests
from typing import Dict, Any

BASE_URL = "http://localhost:8080"


class StudHubClient:
    """Клиент с поддержкой сессий и CSRF."""
    def __init__(self, base_url: str = BASE_URL):
        self.session = requests.Session()
        self.base_url = base_url

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        url = f"{self.base_url}{path}"
        resp = self.session.request(method, url, **kwargs)
        return resp

    def get_csrf_token(self) -> str:
        """Получить CSRF токен из cookie XSRF-TOKEN."""
        csrf_cookie = self.session.cookies.get("XSRF-TOKEN")
        if csrf_cookie:
            return csrf_cookie
        # Если нет, делаем GET на любой endpoint, который устанавливает cookie
        self._request("GET", "/api/test")
        return self.session.cookies.get("XSRF-TOKEN", "")

    def login(self, email: str, password: str) -> requests.Response:
        data = {"email": email, "password": password}
        resp = self._request("POST", "/api/auth/login", json=data)
        if resp.status_code == 200:
            # Убеждаемся, что CSRF токен есть
            self.get_csrf_token()
        return resp

    def logout(self) -> requests.Response:
        return self._request("POST", "/logout")

    def get(self, path: str, **kwargs) -> requests.Response:
        return self._request("GET", path, **kwargs)

    def post(self, path: str, json: Dict = None, **kwargs) -> requests.Response:
        headers = kwargs.pop("headers", {})
        csrf = self.get_csrf_token()
        if csrf:
            headers.setdefault("X-XSRF-TOKEN", csrf)
        return self._request("POST", path, json=json, headers=headers, **kwargs)

    def put(self, path: str, json: Dict = None, **kwargs) -> requests.Response:
        headers = kwargs.pop("headers", {})
        csrf = self.get_csrf_token()
        if csrf:
            headers.setdefault("X-XSRF-TOKEN", csrf)
        return self._request("PUT", path, json=json, headers=headers, **kwargs)

    def patch(self, path: str, json: Dict = None, **kwargs) -> requests.Response:
        headers = kwargs.pop("headers", {})
        csrf = self.get_csrf_token()
        if csrf:
            headers.setdefault("X-XSRF-TOKEN", csrf)
        return self._request("PATCH", path, json=json, headers=headers, **kwargs)

    def delete(self, path: str, **kwargs) -> requests.Response:
        headers = kwargs.pop("headers", {})
        csrf = self.get_csrf_token()
        if csrf:
            headers.setdefault("X-XSRF-TOKEN", csrf)
        return self._request("DELETE", path, headers=headers, **kwargs)


@pytest.fixture(scope="session")
def client() -> StudHubClient:
    return StudHubClient()


def create_user(email: str, login: str, password: str, first_name: str, last_name: str, group: str, code: str = "") -> Dict:
    """Регистрация пользователя через API (прямой вызов, без сессии)."""
    data = {
        "email": email,
        "login": login,
        "password": password,
        "firstName": first_name,
        "lastName": last_name,
        "group": group,
        "code": code
    }
    resp = requests.post(f"{BASE_URL}/api/auth/register", json=data)
    assert resp.status_code in (200, 201), f"Failed to create user {email}: {resp.text}"
    return resp.json()


@pytest.fixture(scope="session")
def admin_user():
    """Создать администратора через bypass‑код (если он задан в проперти)."""
    # bypass‑код должен быть установлен в конфиге (app.register.bypass-code)
    # Для тестов используем фиксированный код "test_admin_code"
    # Если bypass‑код не задан, тесты, требующие админа, могут падать.
    # В реальном окружении его можно задать через переменную окружения.
    resp = create_user(
        email="admin@test.com",
        login="admin",
        password="Admin123",
        first_name="Admin",
        last_name="User",
        group="ADMINS",
        code="test_admin_code"   # должен совпадать с bypassCode в приложении
    )
    return resp


@pytest.fixture(scope="session")
def teacher_user():
    return create_user(
        email="teacher@test.com",
        login="teacher",
        password="Teacher123",
        first_name="Teacher",
        last_name="User",
        group="TEACHERS"
    )


@pytest.fixture(scope="session")
def student_user():
    return create_user(
        email="student@test.com",
        login="student",
        password="Student123",
        first_name="Student",
        last_name="User",
        group="GROUP-A"
    )