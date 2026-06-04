/**
 * Получает chat-токен от Java-бэкенда через существующую сессию (JSESSIONID).
 * Токен имеет формат "{userId}:{login}" и используется Go-мессенджером.
 *
 * Вынесен в отдельный модуль, чтобы не дублировать логику в useChat и useDialogs.
 */
export async function getChatToken(): Promise<string> {
  const res = await fetch('/api/user', { credentials: 'include' });
  if (!res.ok) throw new Error('Not authenticated');
  const data = await res.json();
  if (data.error) throw new Error('Not authenticated');
  return `${data.id}:${data.login}`;
}

/** Возвращает канонический ID DM-комнаты: меньший ID всегда первый. */
export function dmRoomId(myId: number, otherId: number): string {
  const [a, b] = myId < otherId ? [myId, otherId] : [otherId, myId];
  return `dm-${a}-${b}`;
}
