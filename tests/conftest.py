# import uuid
# import pytest
# import requests

# BASE_URL = "http://localhost:8080"
# CHAT_URL = "ws://localhost:9000"
# BYPASS   = "admin"

# @pytest.fixture(scope="function")
# def admin_once():
#     """Admin только для тестов которые меняют его роль."""
#     return register_and_login(role_code=BYPASS)

# def make_user_payload(role_code: str = "") -> dict:
#     uid = uuid.uuid4().hex[:8]
#     payload = {
#         "email":     f"test_{uid}@gmail.com",
#         "firstName": "Test",
#         "lastName":  "User",
#         "login":     f"user_{uid}",
#         "group":     "ПИ-2025",
#         "password":  "Passw0rd!",
#     }
#     if role_code:
#         payload["code"] = role_code
#     return payload


# def register_and_login(role_code: str = "") -> dict:
#     """Регистрирует пользователя, логинится, возвращает dict с session."""
#     session = requests.Session()
#     data = make_user_payload(role_code)

#     reg = session.post(f"{BASE_URL}/api/auth/register", json=data, timeout=30)
#     assert reg.status_code == 201, f"Регистрация провалилась: {reg.text}"
#     body = reg.json()

#     #Явный логин (сессия после регистрации может не сохраняться)
#     login = session.post(
#         f"{BASE_URL}/api/auth/login",
#         json={"email": data["email"], "password": data["password"]},
#         timeout=10,
#     )
#     assert login.status_code == 200, f"Логин провалился: {login.text}"

#     return {
#         "id":       body["id"],
#         "email":    data["email"],
#         "login":    data["login"],
#         "password": data["password"],
#         "role":     body.get("role", "STUDENT"),
#         "session":  session,
#     }

# @pytest.fixture(scope="session")
# def student():
#     return register_and_login()


# @pytest.fixture(scope="session")
# def admin():
#     user = register_and_login(role_code=BYPASS)
#     return user


# @pytest.fixture(scope="session")
# def teacher():
#     """Создаём как ADMIN, потом меняем роль на TEACHER."""
#     user = register_and_login(role_code=BYPASS)
#     sess = user["session"]

#     # Получаем CSRF
#     sess.get(f"{BASE_URL}/api/user", timeout=10)
#     csrf = sess.cookies.get("XSRF-TOKEN")

#     r = sess.post(
#         f"{BASE_URL}/api/user/change-role",
#         json={"target_user_id": str(user["id"]), "role": "TEACHER"},
#         headers={"X-XSRF-TOKEN": csrf} if csrf else {},
#         timeout=10,
#     )
#     assert r.status_code == 200, f"Смена роли на TEACHER провалилась: {r.text}"
#     user["role"] = "TEACHER"
#     return user

import uuid
import pytest
import requests

BASE_URL = "http://localhost:8080"
CHAT_URL = "ws://localhost:9000"
BYPASS = "admin"


def make_user_payload(role_code: str = "") -> dict:
    uid = uuid.uuid4().hex[:10]

    payload = {
        "email": f"test_{uid}@studhub.test",
        "firstName": "Test",
        "lastName": "User",
        "login": f"user_{uid}",
        "group": "ПИ-2025",
        "password": "Passw0rd123!",
    }

    if role_code:
        payload["code"] = role_code

    return payload


def register_and_login(role_code: str = "") -> dict:
    session = requests.Session()
    data = make_user_payload(role_code)

    reg = session.post(
        f"{BASE_URL}/api/auth/register",
        json=data,
        timeout=30
    )
    assert reg.status_code == 201, f"Register failed: {reg.text}"
    body = reg.json()

    login = session.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": data["email"],
            "password": data["password"]
        },
        timeout=10
    )
    assert login.status_code == 200, f"Login failed: {login.text}"

    return {
        "id": body["id"],
        "email": data["email"],
        "login": data["login"],
        "password": data["password"],
        "role": body.get("role", "STUDENT"),
        "session": session,
    }


def _csrf(session: requests.Session) -> str | None:
    session.get(f"{BASE_URL}/api/user", timeout=10)
    return session.cookies.get("XSRF-TOKEN")

@pytest.fixture
def student():
    return register_and_login()


@pytest.fixture
def admin():
    return register_and_login(BYPASS)


@pytest.fixture
def teacher():
    user = register_and_login(BYPASS)
    sess = user["session"]

    sess.get(f"{BASE_URL}/api/user", timeout=10)
    csrf = sess.cookies.get("XSRF-TOKEN")

    r = sess.post(
        f"{BASE_URL}/api/user/change-role",
        json={
            "target_user_id": str(user["id"]),
            "role": "TEACHER"
        },
        headers={"X-XSRF-TOKEN": csrf} if csrf else {},
        timeout=10,
    )

    assert r.status_code == 200, f"Teacher role change failed: {r.text}"

    user["role"] = "TEACHER"
    return user


@pytest.fixture
def admin_once():
    return register_and_login(BYPASS)