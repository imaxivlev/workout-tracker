import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

/**
 * CSRF защита для критичных операций
 * 
 * Требования: 21.6, 23.5
 * 
 * Реализует защиту от Cross-Site Request Forgery атак:
 * - Генерация CSRF токенов
 * - Валидация CSRF токенов для мутирующих запросов
 * - Установка CSRF токена в cookie
 */

/**
 * Генерирует случайный CSRF токен
 * 
 * @returns Случайная строка из 32 байт в hex формате
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Устанавливает CSRF токен в cookie
 * 
 * @param response - NextResponse для установки cookie
 * @param token - CSRF токен для установки
 * @returns NextResponse с установленным CSRF cookie
 */
export function setCsrfTokenCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 часа
    path: '/'
  });
  
  return response;
}

/**
 * Получает CSRF токен из cookie
 * 
 * @param request - NextRequest для чтения cookie
 * @returns CSRF токен или undefined если не найден
 */
export function getCsrfTokenFromCookie(request: NextRequest): string | undefined {
  return request.cookies.get('csrf-token')?.value;
}

/**
 * Валидирует CSRF токен из запроса
 * 
 * @param request - NextRequest с CSRF токеном в теле или заголовке
 * @returns true если токен валиден, false иначе
 */
export function validateCsrfToken(request: NextRequest): boolean {
  // Получаем токен из cookie
  const cookieToken = getCsrfTokenFromCookie(request);
  
  if (!cookieToken) {
    console.error('[CSRF] CSRF токен не найден в cookie');
    return false;
  }
  
  // Получаем токен из заголовка X-CSRF-Token
  const headerToken = request.headers.get('X-CSRF-Token');
  
  if (headerToken) {
    return headerToken === cookieToken;
  }
  
  // Если токен не в заголовке, проверяем в теле запроса
  // (для этого нужно будет прочитать тело в route handler)
  return false;
}

/**
 * Валидирует CSRF токен из тела запроса
 * 
 * @param cookieToken - Токен из cookie
 * @param bodyToken - Токен из тела запроса
 * @returns true если токены совпадают, false иначе
 */
export function validateCsrfTokenFromBody(
  cookieToken: string | undefined,
  bodyToken: string | undefined
): boolean {
  if (!cookieToken || !bodyToken) {
    console.error('[CSRF] CSRF токен отсутствует');
    return false;
  }
  
  // Используем constant-time comparison для защиты от timing attacks
  if (cookieToken.length !== bodyToken.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ bodyToken.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Middleware для проверки CSRF токена
 * Используется для защиты критичных операций (DELETE, POST для важных действий)
 * 
 * @param request - NextRequest
 * @returns NextResponse с ошибкой 403 если токен невалиден, или undefined для продолжения
 */
export function csrfProtectionMiddleware(request: NextRequest): NextResponse | undefined {
  // Проверяем только мутирующие методы
  const method = request.method;
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return undefined; // Пропускаем GET, HEAD, OPTIONS
  }
  
  // Проверяем CSRF токен
  const isValid = validateCsrfToken(request);
  
  if (!isValid) {
    console.error('[CSRF] Невалидный CSRF токен для запроса:', request.url);
    
    return NextResponse.json(
      { error: 'Невалидный CSRF токен' },
      { status: 403 }
    );
  }
  
  return undefined; // Токен валиден, продолжаем обработку
}

/**
 * Wrapper для API route handlers с CSRF защитой
 * 
 * @param handler - Асинхронная функция-обработчик API route
 * @param requireCsrf - Требовать ли CSRF токен (по умолчанию true)
 * @returns Обернутая функция с CSRF защитой
 * 
 * @example
 * export const DELETE = withCsrfProtection(async (request) => {
 *   // Ваш код здесь - CSRF токен уже проверен
 *   return NextResponse.json({ success: true });
 * });
 */
export function withCsrfProtection<T extends (request: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T,
  requireCsrf: boolean = true
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    if (requireCsrf) {
      const csrfError = csrfProtectionMiddleware(request);
      if (csrfError) {
        return csrfError;
      }
    }
    
    return await handler(request, ...args);
  }) as T;
}

/**
 * API endpoint для получения CSRF токена
 * Клиент должен вызвать этот endpoint перед выполнением критичных операций
 * 
 * @example
 * GET /api/csrf-token
 * Response: { csrfToken: "..." }
 */
export async function getCsrfTokenHandler(request: NextRequest): Promise<NextResponse> {
  // Генерируем новый токен
  const token = generateCsrfToken();
  
  // Создаем response с токеном
  const response = NextResponse.json({
    csrfToken: token
  });
  
  // Устанавливаем токен в cookie
  setCsrfTokenCookie(response, token);
  
  return response;
}
