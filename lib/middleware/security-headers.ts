import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware для установки security headers
 * 
 * Требования: 21.7, 24.6
 * 
 * Устанавливает следующие заголовки безопасности:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Content-Security-Policy
 * - Strict-Transport-Security (только для HTTPS)
 * - Referrer-Policy
 * - Permissions-Policy
 */

/**
 * Применяет security headers к response
 * 
 * @param response - NextResponse для модификации
 * @param request - NextRequest для проверки протокола
 * @returns NextResponse с установленными security headers
 */
export function applySecurityHeaders(
  response: NextResponse,
  request?: NextRequest
): NextResponse {
  const headers = response.headers;
  
  // X-Content-Type-Options: предотвращает MIME type sniffing
  // Требования: 21.7
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options: предотвращает clickjacking атаки
  // Требования: 21.7
  headers.set('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection: включает встроенную защиту от XSS в браузере
  // Требования: 21.7
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // Content-Security-Policy: контролирует источники контента
  // Требования: 21.7, 24.6
  // Внешние интеграции: Яндекс.Метрика (mc.yandex.ru) и виджет Involveo.
  const csp = [
    "default-src 'self'",
    // Next.js требует unsafe-inline и unsafe-eval; плюс внешние скрипты
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://involveo.ru",
    // Google Fonts (стили + файлы шрифтов) подгружает виджет Involveo
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com https://involveo.ru",
    "frame-src 'self' https://mc.yandex.ru https://involveo.ru",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  headers.set('Content-Security-Policy', csp);

  // Strict-Transport-Security: принудительное использование HTTPS
  // Требования: 24.6
  // За реверс-прокси (Timeweb) реальный протокол приходит в x-forwarded-proto.
  const isHttps =
    request?.headers.get('x-forwarded-proto') === 'https' ||
    request?.nextUrl.protocol === 'https:';
  if (isHttps) {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Referrer-Policy: контролирует передачу referrer информации
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy: контролирует доступ к browser features
  const permissionsPolicy = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', ');
  
  headers.set('Permissions-Policy', permissionsPolicy);
  
  return response;
}

/**
 * Middleware функция для Next.js
 * Автоматически применяет security headers ко всем ответам
 * 
 * @param request - NextRequest
 * @returns NextResponse с security headers
 */
export function securityHeadersMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  return applySecurityHeaders(response, request);
}

/**
 * Конфигурация для Next.js middleware
 * Применяется ко всем API routes и страницам
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
