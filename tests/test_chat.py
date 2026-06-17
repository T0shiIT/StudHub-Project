import json
import time
import uuid
import threading
import pytest
import requests
import websocket
from conftest import BASE_URL, CHAT_URL, register_and_login
 
 
CHAT_HTTP = CHAT_URL.replace("ws://", "http://").replace("wss://", "https://")
 
 
def ws_token(user: dict) -> str:
    """Токен формата userID:login."""
    return f"{user['id']}:{user['login']}"
 
 
def connect(room_id: str, token: str, timeout: int = 5) -> websocket.WebSocket:
    ws = websocket.create_connection(
        f"{CHAT_URL}/ws/{room_id}?token={token}",
        timeout=timeout,
    )
    return ws
 
 
def drain_history(ws: websocket.WebSocket, marker: str | None = None, timeout: float = 2.0) -> list[dict]:
    """
    Читает сообщения из WS до таймаута (история приходит сразу после connect).
    Если marker задан — читает пока не получит сообщение с таким текстом.
    """
    messages = []
    ws.settimeout(timeout)
    while True:
        try:
            raw = ws.recv()
            msg = json.loads(raw)
            messages.append(msg)
            if marker and msg.get("text") == marker:
                break
        except websocket.WebSocketTimeoutException:
            break
    ws.settimeout(5)
    return messages
 
#жив ли чат
class TestHealth:
 
    def test_health_endpoint_ok(self):
        r = requests.get(f"{CHAT_HTTP}/health", timeout=5)
        assert r.status_code == 200
 
#можно ли отправить сообщения
class TestMessageDelivery:
 
    def test_message_delivered_to_second_user(self):
        u1 = register_and_login()
        u2 = register_and_login()
        room_id = f"delivery-{uuid.uuid4().hex[:8]}"
 
        ws1 = connect(room_id, ws_token(u1))
        ws2 = connect(room_id, ws_token(u2))
 
        # Пропускаем историю у обоих
        drain_history(ws1)
        drain_history(ws2)
 
        text = f"hello-{uuid.uuid4().hex[:6]}"
        ws1.send(json.dumps({"text": text}))
 
        # u2 должен получить сообщение
        ws2.settimeout(5)
        raw = ws2.recv()
        msg = json.loads(raw)
 
        assert msg["text"] == text
        assert msg["sender_id"] == u1["id"]
        assert msg["login"] == u1["login"]
        assert "sent_at" in msg
 
        ws1.close(); ws2.close()
 
    def test_sender_also_receives_own_message(self):
        """Отправитель получает своё сообщение обратно (broadcast всем в комнате)."""
        u1 = register_and_login()
        room_id = f"self-{uuid.uuid4().hex[:8]}"
 
        ws = connect(room_id, ws_token(u1))
        drain_history(ws)
 
        text = f"self-{uuid.uuid4().hex[:6]}"
        ws.send(json.dumps({"text": text}))
 
        ws.settimeout(5)
        msg = json.loads(ws.recv())
        assert msg["text"] == text
 
        ws.close()
 
    def test_message_has_correct_room_id(self):
        u1 = register_and_login()
        u2 = register_and_login()
        room_id = f"room-{uuid.uuid4().hex[:8]}"
 
        ws1 = connect(room_id, ws_token(u1))
        ws2 = connect(room_id, ws_token(u2))
        drain_history(ws1); drain_history(ws2)
 
        text = "room-check"
        ws1.send(json.dumps({"text": text}))
 
        ws2.settimeout(5)
        msg = json.loads(ws2.recv())
        assert msg.get("room_id") == room_id
 
        ws1.close(); ws2.close()
 
    def test_messages_isolated_between_rooms(self):
        """Сообщение в одной комнате не попадает в другую."""
        u1 = register_and_login()
        u2 = register_and_login()
 
        room_a = f"roomA-{uuid.uuid4().hex[:8]}"
        room_b = f"roomB-{uuid.uuid4().hex[:8]}"
 
        ws_a = connect(room_a, ws_token(u1))
        ws_b = connect(room_b, ws_token(u2))
        drain_history(ws_a); drain_history(ws_b)
 
        ws_a.send(json.dumps({"text": "secret-for-room-a"}))
 
        # ws_b не должен ничего получить
        msgs = drain_history(ws_b, timeout=2.0)
        texts = [m["text"] for m in msgs]
        assert "secret-for-room-a" not in texts
 
        ws_a.close(); ws_b.close()
 
    def test_empty_text_not_broadcast(self):
        """Пустой текст не должен рассылаться другим пользователям."""
        u1 = register_and_login()
        u2 = register_and_login()
        room_id = f"empty-{uuid.uuid4().hex[:8]}"
 
        ws1 = connect(room_id, ws_token(u1))
        ws2 = connect(room_id, ws_token(u2))
        drain_history(ws1); drain_history(ws2)
 
        ws1.send(json.dumps({"text": ""}))      # пустой текст — игнорируется
        ws1.send(json.dumps({}))                 # нет поля text — игнорируется
 
        # Чтобы убедиться — шлём маркер
        marker = f"marker-{uuid.uuid4().hex[:6]}"
        ws1.send(json.dumps({"text": marker}))
 
        msgs = drain_history(ws2, marker=marker)
        texts = [m["text"] for m in msgs]
        assert "" not in texts
        assert marker in texts
 
        ws1.close(); ws2.close()
 
 
#WebSocket проверка соединения
class TestWSAuth:
 
    def test_invalid_token_closes_connection(self):
        room_id = f"auth-{uuid.uuid4().hex[:8]}"
        with pytest.raises(Exception):
            # Сервер должен вернуть 401 или закрыть соединение
            ws = websocket.create_connection(
                f"{CHAT_URL}/ws/{room_id}?token=invalid_token",
                timeout=5,
            )
            # Если соединение открылось — читаем и ожидаем закрытия
            ws.settimeout(3)
            ws.recv()
 
    def test_missing_token_closes_connection(self):
        room_id = f"noauth-{uuid.uuid4().hex[:8]}"
        with pytest.raises(Exception):
            ws = websocket.create_connection(
                f"{CHAT_URL}/ws/{room_id}",
                timeout=5,
            )
            ws.settimeout(3)
            ws.recv()

#есть ли история чатов
class TestHistory:
 
    def test_message_appears_in_http_history(self):
        u = register_and_login()
        room_id = f"hist-{uuid.uuid4().hex[:8]}"
        token = ws_token(u)
 
        ws = connect(room_id, token)
        drain_history(ws)
 
        text = f"hist-msg-{uuid.uuid4().hex[:6]}"
        ws.send(json.dumps({"text": text}))
 
        # Ждём чтобы Redis успел сохранить
        ws.settimeout(2)
        try: ws.recv()
        except: pass
        ws.close()
 
        time.sleep(0.3)  # небольшая пауза для async-сохранения
 
        r = requests.get(
            f"{CHAT_HTTP}/history/{room_id}",
            params={"token": token},
            timeout=5,
        )
        assert r.status_code == 200
        history = r.json()
        assert isinstance(history, list)
        assert any(m["text"] == text for m in history), \
            f"Сообщение '{text}' не найдено в истории: {history}"
 
    def test_history_endpoint_requires_auth(self):
        r = requests.get(f"{CHAT_HTTP}/history/some-room", timeout=5)
        assert r.status_code == 401
 
    def test_history_returned_on_ws_connect(self):
        """При переподключении к комнате история приходит сразу."""
        u = register_and_login()
        room_id = f"reconnect-{uuid.uuid4().hex[:8]}"
        token = ws_token(u)
 
        # Шаг 1: отправляем сообщение
        ws1 = connect(room_id, token)
        drain_history(ws1)
        text = f"pre-{uuid.uuid4().hex[:6]}"
        ws1.send(json.dumps({"text": text}))
        time.sleep(0.5)
        ws1.close()
 
        # Шаг 2: новое подключение — должны получить историю
        ws2 = connect(room_id, token)
        history = drain_history(ws2, timeout=3.0)
        ws2.close()
 
        texts = [m["text"] for m in history]
        assert text in texts, f"Сообщение '{text}' не пришло в истории при reconnect: {texts}"
 
    def test_history_order_newest_first(self):
        """История через HTTP отдаётся от новых к старым (LPUSH в Redis)."""
        u = register_and_login()
        room_id = f"order-{uuid.uuid4().hex[:8]}"
        token = ws_token(u)
 
        ws = connect(room_id, token)
        drain_history(ws)
 
        for i in range(3):
            ws.send(json.dumps({"text": f"msg-{i}"}))
            time.sleep(0.1)
 
        time.sleep(0.5)
        ws.close()
 
        r = requests.get(
            f"{CHAT_HTTP}/history/{room_id}",
            params={"token": token},
            timeout=5,
        )
        history = r.json()
        assert len(history) >= 3
        # Первый элемент — самый новый (msg-2)
        assert history[0]["text"] == "msg-2"
 
    def test_history_limit_param(self):
        u = register_and_login()
        room_id = f"limit-{uuid.uuid4().hex[:8]}"
        token = ws_token(u)
 
        ws = connect(room_id, token)
        drain_history(ws)
 
        for i in range(5):
            ws.send(json.dumps({"text": f"lim-{i}"}))
            time.sleep(0.05)
 
        time.sleep(0.5)
        ws.close()
 
        r = requests.get(
            f"{CHAT_HTTP}/history/{room_id}",
            params={"token": token, "limit": 2},
            timeout=5,
        )
        assert r.status_code == 200
        assert len(r.json()) <= 2
 
#стресс тест
class TestConcurrency:
 
    def test_multiple_users_same_room(self):
        """5 пользователей в одной комнате — все получают сообщения друг друга."""
        users = [register_and_login() for _ in range(5)]
        room_id = f"multi-{uuid.uuid4().hex[:8]}"
 
        connections = [connect(room_id, ws_token(u)) for u in users]
        for ws in connections: drain_history(ws)
 
        sender_ws = connections[0]
        text = f"broadcast-{uuid.uuid4().hex[:6]}"
        sender_ws.send(json.dumps({"text": text}))
 
        for ws in connections:
            ws.settimeout(5)
            msg = json.loads(ws.recv())
            assert msg["text"] == text
 
        for ws in connections:
            ws.close()
 