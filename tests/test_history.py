import json
import time
import requests
import websocket
from conftest import BASE_URL, CHAT_URL, register_and_login

CHAT_HTTP = CHAT_URL.replace("ws://", "http://").replace("wss://", "https://")


def test_history():
    user = register_and_login()
    room_id = f"history-room-{user['id']}"
    token = f"{user['id']}:{user['login']}"

    ws = websocket.create_connection(
        f"{CHAT_URL}/ws/{room_id}?token={token}",
        timeout=5,
    )

    #проверка истории
    ws.settimeout(2)
    while True:
        try:
            ws.recv()
        except websocket.WebSocketTimeoutException:
            break

    ws.settimeout(5)
    ws.send(json.dumps({"text": "history_test_message"}))

    try:
        ws.recv()
    except Exception:
        pass

    time.sleep(0.3)
    ws.close()

    response = requests.get(
        f"{CHAT_HTTP}/history/{room_id}",
        params={"token": token},
        timeout=5,
    )
    assert response.status_code == 200
    history = response.json()
    assert any(msg["text"] == "history_test_message" for msg in history)