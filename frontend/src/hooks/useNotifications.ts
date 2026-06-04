// src/hooks/useNotifications.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export interface NotificationEvent {
  kind: 'notification';
  eventType: 'new_announcement' | 'schedule_updated' | 'grade_updated';
  title: string;
  body: string;
  link: string;
  timestamp: number;
}

export interface AppNotification extends NotificationEvent {
  id: number;
  read: boolean;
}

// Тот же токен, что использует useChat — "userId:login"
async function getChatToken(): Promise<string> {
  const res = await fetch('/api/user', { credentials: 'include' });
  if (!res.ok) throw new Error('Not authenticated');
  const data = await res.json();
  if (data.error) throw new Error('Not authenticated');
  return `${data.id}:${data.login}`;
}

/**
 * Подключается к WebSocket мессенджера в отдельной «личной» комнате
 * notifications:{userId} и слушает сообщения с kind === "notification".
 *
 * Возвращает список уведомлений, количество непрочитанных и
 * функцию markRead для их сброса.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const counterRef = useRef(0);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      if (!tokenRef.current) {
        tokenRef.current = await getChatToken();
      }
      // Личная комната для уведомлений: notifications:{userId}
      const userId = tokenRef.current.split(':')[0];
      const ws = new WebSocket(`/ws/notifications:${userId}?token=${tokenRef.current}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.kind !== 'notification') return; // чат-сообщения игнорируем

          const event = msg as NotificationEvent;
          counterRef.current += 1;
          const notification: AppNotification = {
            ...event,
            id: counterRef.current,
            read: false,
          };

          setNotifications((prev) => [notification, ...prev].slice(0, 50));

          // Звуковой сигнал (опционально — не блокирует, если нет разрешения)
          playNotificationSound();
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 3000);
      };
    } catch {
      setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      tokenRef.current = null;
    };
  }, [connect]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  return { notifications, unreadCount, markRead, markAllRead };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext может быть заблокирован до первого жеста пользователя
  }
}
