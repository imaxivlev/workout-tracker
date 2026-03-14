/**
 * Middleware для применения rate limiting в Next.js API Routes
 * 
 * Использует IP адрес клиента или userId для идентификации
 * Возвращает 429 Too Many Requests при превышении лимита
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getRateLimitInfo, RATE_LIMIT_CONFIGS } from './rate-limiter'

/**
 * Извлекает IP адрес клиента из запроса
 * Учитывает заголовки прокси (X-Forwarded-For, X-Real-IP)
 */
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  // Если есть userId, используем его для аутентифицированных запросов
  if (userId) {
    return `user:${userId}`
  }

  // Извлекаем IP адрес
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwardedFor) {
    // X-Forwarded-For может содержать несколько IP через запятую
    return `ip:${forwardedFor.split(',')[0].trim()}`
  }

  if (realIp) {
    return `ip:${realIp}`
  }

  // Fallback если заголовков нет
  return `ip:unknown`
}

/**
 * Применяет rate limiting к запросу
 * 
 * @param request - Next.js request объект
 * @param limitType - Тип лимита ('auth' | 'api' | 'migration')
 * @param userId - Опциональный userId для аутентифицированных запросов
 * @returns NextResponse с ошибкой 429 если лимит превышен, null если запрос разрешен
 */
export async function applyRateLimit(
  request: NextRequest,
  limitType: keyof typeof RATE_LIMIT_CONFIGS,
  userId?: string
): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request, userId)
  const config = RATE_LIMIT_CONFIGS[limitType]

  const isLimited = await rateLimit(identifier, config)

  if (isLimited) {
    const info = getRateLimitInfo(identifier)

    const response = NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Превышен лимит запросов. Попробуйте снова через ${info?.retryAfter || 60} секунд.`,
        retryAfter: info?.retryAfter || 60
      },
      { status: 429 }
    )

    // Добавляем заголовок Retry-After
    if (info) {
      response.headers.set('Retry-After', info.retryAfter.toString())
      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
      response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', info.resetTime.toString())
    }

    return response
  }

  // Запрос разрешен
  return null
}

/**
 * Wrapper функция для auth endpoints
 */
export async function applyAuthRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  return applyRateLimit(request, 'auth')
}

/**
 * Wrapper функция для API endpoints
 */
export async function applyApiRateLimit(
  request: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  return applyRateLimit(request, 'api', userId)
}

/**
 * Wrapper функция для migration endpoint
 */
export async function applyMigrationRateLimit(
  request: NextRequest,
  userId: string
): Promise<NextResponse | null> {
  return applyRateLimit(request, 'migration', userId)
}
