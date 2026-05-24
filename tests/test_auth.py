# import requests
# import pytest
# import uuid

# BASE_URL_JAVA = "http://localhost:8082"

# @pytest.fixture
# def session():
#     """Создание чистой сессии для каждого теста"""
#     return requests.Session()

# def test_unique_user(session):
#     #данные для регистрации
#     uid = str(uuid.uuid4())[:8]
#     user_data = { 
#         "email": f"test_{uid}@gmail.com",
#         "firstName": "User1",
#         "lastName": "LastName1",
#         "login": f"user_{uid}",
#         "group": "ПИ-2025",
#         "password": "1234567890",
#         "code": "admin"
#     }

#     print(f"\n[START] Регистрируем пользователя в Java: {BASE_URL_JAVA}")
#     try:
#         reg_res = session.post(f"{BASE_URL_JAVA}/api/auth/register", json=user_data, timeout=15)
#         print(f"[DEBUG] Java Status: {reg_res.status_code}")
#         assert reg_res.status_code == 201
#         user_id = reg_res.json()["id"]
#     except requests.exceptions.ConnectionError as e:
#         pytest.fail(f"Java-сервер недоступен! Ошибка: {e}")

#     print(f"\n[LOGIN] Логинимся под созданным пользователем")
#     login_data = {
#         "email": user_data["email"],
#         "password": user_data["password"]
#     }
#     login_res = session.post(f"{BASE_URL_JAVA}/api/auth/login", json=login_data, timeout=5)
#     assert login_res.status_code == 200, f"Login failed: {login_res.text}"

#     # Передаем X-User-Id
#     headers = {
#         "X-User-Id": str(user_id),
#         "Content-Type": "application/json"
#     }

#     print("\n[CHECK] Проверяем исходный профиль")
#     cpp_profile_res = session.get(f"{BASE_URL_JAVA}/api/cpp-profile", headers=headers)
#     print(f"cpp profile response: {cpp_profile_res.text}")
#     assert cpp_profile_res.status_code == 200
#     print(f"Текущий профиль: {cpp_profile_res.json()}")

#     print("\n[ACTION] Меняем роль через Java-бэкенд...")
#     role_payload = {
#         "target_user_id": str(user_id),
#         "role": "ADMIN"
#     }

#     role_change_res = session.post(
#         f"{BASE_URL_JAVA}/api/user/change-role",
#         json=role_payload
#     )

#     print(f"[DEBUG] Java Change Role Status: {role_change_res.status_code}")
#     print(f"[DEBUG] Java Change Role Response: {role_change_res.text}")
    
#     assert role_change_res.status_code == 200

#     print("\n[VERIFY] Проверяем, изменилась ли роль в БД")
#     cpp_res_final = session.get(f"{BASE_URL_JAVA}/api/cpp-profile", headers=headers)
#     assert cpp_res_final.status_code == 200
    
#     data = cpp_res_final.json()
#     print(f"Финальный профиль: {data}")
    
#     print("\n[SUCCESS] Роль успешно обновлена")