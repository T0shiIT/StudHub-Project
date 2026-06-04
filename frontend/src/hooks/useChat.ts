import { useEffect, useRef, useState, useCallback } from 'react';
import { getChatToken } from '../utils/token';

export interface ChatMessage {
  room_id: string;
  sender_id: number;
  login: string;
  text: string;
  sent_at: number; // unix ms
}

export function useChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      if (!tokenRef.current) {
        tokenRef.current = await getChatToken();
      }

      const ws = new WebSocket(`/ws/${roomId}?token=${tokenRef.current}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (e) => {
        try {
          const msg: ChatMessage = JSON.parse(e.data);
          setMessages((prev) => {
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
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setError('Ошибка соединения');
        ws.close();
      };
    } catch {
      setError('Не удалось получить токен');
    }
  }, [roomId]);

  useEffect(() => {
    connect();
    return () => {
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
