import { useEffect, useRef, useState, useCallback } from 'react';

const API_BASE = '';
const WS_BASE = '';

export interface ChatMessage {
  room_id: string;
  sender_id: number;
  login: string;
  text: string;
  sent_at: number; // unix ms
}

// Получает chat-token от Java (использует существующую сессию JSESSIONID)
async function getChatToken(): Promise<string> {
  const res = await fetch(`/api/user`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Not authenticated');
  const data = await res.json();
  if (data.error) throw new Error('Not authenticated');
  return `${data.id}:${data.login}`;
}

export function useChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return; // не подключаться если уже подключён
    try {
      if (!tokenRef.current) {
        tokenRef.current = await getChatToken();
      }

      const ws = new WebSocket(`${WS_BASE}/ws/${roomId}?token=${tokenRef.current}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (e) => {
      try {
        const msg: ChatMessage = JSON.parse(e.data);
        setMessages((prev) => {
          // Избегаем дублей по sent_at + sender_id
          const isDuplicate = prev.some(
            (m) => m.sent_at === msg.sent_at && m.sender_id === msg.sender_id
          );
          if (isDuplicate) return prev;
          return [...prev, msg];
        });
      } catch {}
    };

      ws.onclose = () => {
        setConnected(false);
        // Реконнект через 3 сек
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setError('Ошибка соединения');
        ws.close();
      };
    } catch (e) {
      setError('Не удалось получить токен');
    }
  }, [roomId]);

  // useEffect(() => {
  //   connect();
  //   return () => {
  //     wsRef.current?.close();
  //   };
  // }, [connect]);

  useEffect(() => {
    const controller = new AbortController();
    connect();
    return () => {
      controller.abort();
      wsRef.current?.close();
      wsRef.current = null;
      tokenRef.current = null;
    };
  }, [roomId]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text }));
    }
  }, []);

  return { messages, connected, error, sendMessage };
}
