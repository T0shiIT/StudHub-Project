const API_BASE = 'http://localhost:8080';

/**
 * Читает cookie XSRF-TOKEN, которую Spring Security устанавливает
 * при первом GET-запросе через CookieCsrfTokenRepository.
 */
export function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Делает "тихий" GET-запрос, чтобы Spring Security установил cookie XSRF-TOKEN.
 * Вызывается один раз при старте приложения или перед мутирующим запросом.
 */
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

/**
 * Обёртка над fetch, которая автоматически:
 *   1) добавляет credentials: 'include' (для сессионной cookie JSESSIONID);
 *   2) для POST/PUT/PATCH/DELETE добавляет заголовок X-XSRF-TOKEN.
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = new Headers(options.headers || {});

  if (needsCsrf) {
    let token = getCsrfToken();

    // Если токена ещё нет — принудительно запрашиваем его
    if (!token) {
      await ensureCsrfToken();
      token = getCsrfToken();
    }

    if (token) {
      headers.set('X-XSRF-TOKEN', token);
    }
  }

  return fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });
}