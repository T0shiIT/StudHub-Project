import requests
import pytest
import uuid
 
BASE_URL = "http://localhost:8080"
 
 
@pytest.fixture
def session():
    return requests.Session()
 
 
def test_unique_user(session):
    uid = str(uuid.uuid4())[:8]
 
    # 1. Регистрация
    user_data = {
        "email":     f"test_{uid}@gmail.com",
        "firstName": "User1",
        "lastName":  "LastName1",
        "login":     f"user_{uid}",
        "group":     "ПИ-2025",
        "password":  "1234567890",
        "code":      "admin"          # bypass-код
    }
 
    print(f"\n[1] Регистрация: {user_data['email']}")
    reg_res = session.post(f"{BASE_URL}/api/auth/register", json=user_data, timeout=30)
    print(f"    status : {reg_res.status_code}")
    print(f"    body   : {reg_res.text}")
    assert reg_res.status_code == 201, f"Регистрация упала: {reg_res.text}"
 
    reg_json = reg_res.json()
    user_id  = reg_json["id"]
    role     = reg_json.get("role")
    print(f"    user_id={user_id}  role={role}")
 
    # bypass-код должен дать ADMIN сразу
    assert role == "ADMIN", f"Ожидали ADMIN, получили {role}"
 
    # 2. Логин
    print(f"\n[2] Логин: {user_data['email']}")
    login_res = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": user_data["email"], "password": user_data["password"]},
        timeout=10
    )
    print(f"    status : {login_res.status_code}")
    print(f"    body   : {login_res.text}")
    assert login_res.status_code == 200, f"Логин упал: {login_res.text}"
 
    # 3. Профиль текущего пользователя
    print(f"\n[3] Профиль /api/user")
    profile_res = session.get(f"{BASE_URL}/api/user", timeout=10)
    print(f"    status : {profile_res.status_code}")
    print(f"    body   : {profile_res.text}")
    assert profile_res.status_code == 200, f"/api/user вернул {profile_res.status_code}: {profile_res.text}"

    profile = profile_res.json()
    print(f"    profile: {profile}")
    assert profile.get("email") == user_data["email"]
    assert profile.get("role")  == "ADMIN"

    # CSRF токен из куки (Spring кладёт его после первого GET)
    csrf_token = session.cookies.get("XSRF-TOKEN")
    print(f"\n    CSRF token: {csrf_token}")

    # 4. Смена роли (сам себе, раз уже ADMIN)
    print(f"\n[4] Смена роли → STUDENT")
    role_res = session.post(
        f"{BASE_URL}/api/user/change-role",
        json={"target_user_id": str(user_id), "role": "STUDENT"},
        headers={"X-XSRF-TOKEN": csrf_token},   #csrf токен
        timeout=10
    )
    print(f"    status : {role_res.status_code}")
    print(f"    body   : {role_res.text}")
    assert role_res.status_code == 200, f"change-role упал: {role_res.text}"

    # 5. Проверяем что роль обновилась
    print(f"\n[5] Проверка роли после смены")
    profile2_res = session.get(f"{BASE_URL}/api/user", timeout=10)
    print(f"    status : {profile2_res.status_code}")
    print(f"    body   : {profile2_res.text}")
    assert profile2_res.status_code == 200
 
    profile2 = profile2_res.json()
    print(f"    profile: {profile2}")
    assert profile2.get("role") == "STUDENT", \
        f"Роль не изменилась: {profile2.get('role')}"
 
    print("\n[OK] Все шаги прошли успешно")

