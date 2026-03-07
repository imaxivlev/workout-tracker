import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS и Origin проверка для API endpoints
 * 
 * Требования: 21.6
 * 
 * Реализует:
 * - Проверку Origin header для мутирующих запросов
 * - Настройку CORS для production домена
 * - Блокировку запросов с неизвестных доменов
 */

/**
 * Список разрешенных origins для CORS
 * В production должен содержать только доверенные домены
 */
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? [
      process.env.NEXT_PUBLIC_APP_URL || 'https://workout-tracker.ru',
      'https://staging.workout-tracker.ru'
    ]
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];

/**
 * Проверяет, является ли origin разрешенным
 * 
 * @param origin - Origin header из запроса
 * @returns true если origin разрешен, false иначе
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    // Запросы без Origin header (например, same-origin) разрешены
    return true;
  }
  
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Валидирует Origin header для мутирующих запросов
 * 
 * @param request - NextRequest
 * @returns true если Origin валиден, false иначе
 */
export function validateOrigin(request: NextRequest): boolean {
  const method = request.method;
  
  // Проверяем только мутирующие методы
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return true; // GET, HEAD, OPTIONS не требуют проверки Origin
  }
  
  const origin = request.headers.get('origin');
  
  // В production требуем наличие Origin header для мутирующих запросов
  if (process.env.NODE_ENV === 'production' && !origin) {
    console.error('[CORS] Отсутствует Origin header для мутирующего запроса');
    return false;
  }
  
  // Проверяем, что Origin в списке разрешенных
  if (origin && !isOriginAllowed(origin)) {
    console.error('[CORS] Неразрешенный Origin:', origin);
    return false;
  }
  
  return true;
}

/**
 * Устанавливает CORS headers в response
 * 
 * @param response - NextResponse для установки headers
 * @param request - NextRequest для получения Origin
 * @returns NextResponse с CORS headers
 */
export function setCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  
  // Устанавливаем Access-Control-Allow-Origin только для разрешенных origins
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  // Разрешаем credentials (cookies, authorization headers)
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  // Разрешенные методы
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  
  // Разрешенные headers
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token'
  );
  
  // Максимальное время кэширования preflight запроса (24 часа)
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

/**
 * Обрабатывает OPTIONS preflight запросы
 * 
 * @param request - NextRequest
 * @returns NextResponse с CORS headers для preflight
 */
export function handleCorsPreflightRequest(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  
  // Проверяем, что Origin разрешен
  if (!origin || !isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response, request);
}

/**
 * Middleware для проверки Origin и установки CORS headers
 * 
 * @param request - NextRequest
 * @returns NextResponse с ошибкой 403 если Origin невалиден, или undefined для продолжения
 */
export function corsMiddleware(request: NextRequest): NextResponse | undefined {
  // Обрабатываем OPTIONS preflight запросы
  if (request.method === 'OPTIONS') {
    return handleCorsPreflightRequest(request);
  }
  
  // Валидируем Origin для мутирующих запросов
  if (!validateOrigin(request)) {
    console.error('[CORS] Блокировка запроса с невалидным Origin:', request.headers.get('origin'));
    
    return NextResponse.json(
      { error: 'Запрос с неразрешенного домена' },
      { status: 403 }
    );
  }
  
  return undefined; // Origin валиден, продолжаем обработку
}

/**
 * Wrapper для API route handlers с CORS защитой
 * 
 * @param handler - Асинхронная функция-обработчик API route
 * @returns Обернутая функция с CORS защитой
 * 
 * @example
 * export const POST = withCors(async (request) => {
 *   // Ваш код здесь - Origin уже проверен
 *   return NextResponse.json({ success: true });
 * });
 */
export function withCors<T extends (request: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    // Проверяем CORS
    const corsError = corsMiddleware(request);
    if (corsError) {
      return corsError;
    }
    
    // Выполняем handler
    const response = await handler(request, ...args);
    
    // Устанавливаем CORS headers в response
    return setCorsHeaders(response, request);
  }) as T;
}
