const API_BASE = '';

export function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfToken(): Promise<void> {
  if (getCsrfToken()) return;
  try {
    await fetch(`${API_BASE}/api/user`, {
      method: 'GET',
      credentials: 'include',
    });
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
    if (token) {
      headers.set('X-XSRF-TOKEN', token);
    }
  }

  // ВАЖНО: если тело — FormData, браузер сам выставит Content-Type с boundary.
  // Если мы его установим вручную — boundary потеряется и сервер не распознает файл.
  if (options.body instanceof FormData) {
    headers.delete('Content-Type');
  }

  return fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });
}