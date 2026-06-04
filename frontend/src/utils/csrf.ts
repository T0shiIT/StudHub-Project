// Убран хардкод localhost:8080 — все запросы идут через nginx на относительный путь.
// nginx проксирует /api/ → backend:8080

export function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfToken(): Promise<void> {
  if (getCsrfToken()) return;
  try {
    // Относительный путь — работает и локально и в Docker
    await fetch('/api/user', { method: 'GET', credentials: 'include' });
  } catch {
    // Игнорируем ошибки сети — попробуем позже
  }
}

export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const headers = new Headers(options.headers || {});

  if (needsCsrf) {
    let token = getCsrfToken();
    if (!token) {
      await ensureCsrfToken();
      token = getCsrfToken();
    }
    if (token) headers.set('X-XSRF-TOKEN', token);
  }

  return fetch(url, { ...options, method, headers, credentials: 'include' });
}