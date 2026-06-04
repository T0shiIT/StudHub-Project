import { useCallback, useEffect, useState } from 'react';
import { getChatToken } from '../utils/token';
import { useAuth } from '../context/AuthContext';

export interface Dialog {
  roomId: string;
  companionId: number;
  companionLogin: string;
  companionFullName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
}

export interface UserSearchResult {
  id: number;
  login: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export function useDialogs() {
  const { user } = useAuth()
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Не делаем запрос если пользователь не залогинен
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getChatToken();
      const res = await fetch(`/messenger/api/dialogs?token=${token}`);
      if (!res.ok) throw new Error('Failed to load dialogs');
      const data: Dialog[] = await res.json();
      data.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setDialogs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return; // Не запускаем интервал если не залогинен
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [user, refresh]);

  const markRead = useCallback(async (roomId: string) => {
    if (!user) return;
    try {
      const token = await getChatToken();
      await fetch(`/messenger/api/dialogs/${roomId}/read?token=${token}`, {
        method: 'POST',
      });
      setDialogs((prev) =>
        prev.map((d) => (d.roomId === roomId ? { ...d, unreadCount: 0 } : d))
      );
    } catch {/* ignore */}
  }, [user]);

  return { dialogs, loading, error, refresh, markRead };
}

/**
 * Поиск пользователей через Java-бэкенд.
 * Возвращает пустой массив при ошибке — UI просто не покажет результаты.
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `/api/internal/users/search?q=${encodeURIComponent(query.trim())}&limit=10`,
      { credentials: 'include' }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}