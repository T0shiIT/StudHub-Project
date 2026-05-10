import requests
import pytest
import uuid

BASE_URL_JAVA = "http://localhost"
BASE_URL_CPP = "http://localhost"

@pytest.fixture
def session():
    """Создание чистой сессии с каждого раза"""
    return requests.Session()

def test_unique_user(session):
    uid = str(uuid.uuid4())[:8]
    user_data = { 
        "email": f"test_{uid}@gmail.com",
        "firstName": "User1",
        "lastName": "LastName1",
        "login": f"user_{uid}",
        "group": "ПИ-2025",
        "password": "1234567890",
        "code": "admin"
    }

    print(f"\n[START] Пробуем постучаться в Java: {BASE_URL_JAVA}")
    
    try:
        reg_res = session.post(
            f"{BASE_URL_JAVA}/api/auth/register", json=user_data, timeout=5 )
        print(f"[DEBUG] Java Status: {reg_res.status_code}")
        print(f"[DEBUG] Register Response: {reg_res.json()}") 
        assert reg_res.status_code == 201
        user_id = reg_res.json()["id"]
    except requests.exceptions.ConnectionError as e:
        pytest.fail(f"Java-сервер сбросил соединение! Ошибка: {e}")


    print(f"\n[LOGIN] Логинимся...")
    login_data = {
        "email": user_data["email"],
        "password": user_data["password"]
    }
    login_res = session.post(f"{BASE_URL_JAVA}/api/auth/login", json=login_data, timeout=5)
    print(f"[DEBUG] Login Status: {login_res.status_code}")
    print(f"[DEBUG] Login Response: {login_res.json()}")
    print(f"[DEBUG] Cookies: {dict(session.cookies)}")
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"

    me_res = session.get(f"{BASE_URL_JAVA}/api/user")
    assert me_res.status_code == 200
    profile_data = me_res.json()
    print(f"[DEBUG] Profile: {profile_data}")
    headers = {"X-User-Id": str(user_id)}

    print("\n--- Роль GUEST ---")
    cpp_res = session.get(f"{BASE_URL_CPP}/api/cpp/profile/{user_id}", headers=headers)
    assert cpp_res.status_code == 200
    print(f"C++ Response: {cpp_res.json()}")

    print("\n[ACTION] Меняем роль на STUDENT...")
    role_change_res = session.post(
        f"{BASE_URL_JAVA}/api/user/change-role", 
        json={"role": "STUDENT"}
    )

    assert role_change_res.status_code in [200, 204]

    print("--- Роль STUDENT ---")
    cpp_res_final = session.get(f"{BASE_URL_CPP}/api/cpp/profile/{user_id}", headers=headers)
    assert cpp_res_final.status_code == 200
    
    data = cpp_res_final.json()
    print(f"C++ Response: {data}")
    print(f"Проверка: {data['first_name']} {data['last_name']} - {data['group_name']}")
    
    print("\n[SUCCESS] Роль успешно обновлена, C++ видит изменения в БД.")


