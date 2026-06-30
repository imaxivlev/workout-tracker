import { NextRequest } from 'next/server';

/**
 * Защита от CSRF на основе проверки Origin.
 *
 * Подход (рекомендация OWASP, аналогично Server Actions Next.js): для
 * мутирующих запросов сравниваем заголовок Origin с хостом приложения.
 * Браузер всегда отправляет Origin при кросс-доменных POST/PUT/PATCH/DELETE,
 * поэтому подделанный сайт не сможет выполнить запрос от имени пользователя.
 *
 * Дополняется флагом cookie sameSite=lax (см. auth-token).
 *
 * Требования: 21.6, 23.5
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Проверяет, что запрос исходит с доверенного origin (тот же хост, что и
 * приложение). Запросы без заголовка Origin (не-браузерные клиенты, прямые
 * server-to-server вызовы) пропускаются — они не несут ambient cookies и
 * не являются CSRF-вектором.
 */
export function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const allowedHosts = new Set<string>();

  const host = request.headers.get('host');
  if (host) {
    allowedHosts.add(host);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      allowedHosts.add(new URL(appUrl).host);
    } catch {
      // Некорректный NEXT_PUBLIC_APP_URL — игнорируем.
    }
  }

  return allowedHosts.has(originHost);
}

/**
 * Нужна ли CSRF-проверка для данного метода.
 */
export function requiresCsrfCheck(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}
