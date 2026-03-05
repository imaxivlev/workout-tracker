/**
 * Примеры использования rate limiting middleware
 * 
 * Этот файл содержит примеры интеграции rate limiter в Next.js API Routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from './middleware'
import {
  applyAuthRateLimit,
  applyApiRateLimit,
  applyMigrationRateLimit
} from './rate-limit-middleware'

// ============================================================================
// Пример 1: Auth endpoint (Login) с rate limiting
// ============================================================================

/**
 * POST /api/auth/login
 * 
 * Применяет rate limiting: 5 попыток за 15 минут
 * Защищает от brute-force атак на пароли
 */
export async function loginHandler(request: NextRequest) {
  // Шаг 1: Применяем rate limiting для auth endpoints
  const rateLimitResponse = await applyAuthRateLimit(request)
  if (rateLimitResponse) {
    // Лимит превышен - возвращаем 429 Too Many Requests
    return rateLimitResponse
  }

  // Шаг 2: Продолжаем логику входа
  const { email, password } = await request.json()

  // Валидация и проверка пароля
  // ...

  return NextResponse.json({
    message: 'Вход выполнен успешно',
    user: { id: 'user-id', email }
  })
}

// ============================================================================
// Пример 2: API endpoint с аутентификацией и rate limiting
// ============================================================================

/**
 * GET /api/workouts
 * 
 * Применяет rate limiting: 100 запросов за минуту
 * Использует userId для отслеживания лимита
 */
export async function getWorkoutsHandler(request: NextRequest) {
  // Шаг 1: Аутентификация запроса
  const authResult = await authenticateRequest(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  const { user } = authResult

  // Шаг 2: Применяем rate limiting с userId
  const rateLimitResponse = await applyApiRateLimit(request, user.id)
  if (rateLimitResponse) {
    // Лимит превышен - возвращаем 429 Too Many Requests
    return rateLimitResponse
  }

  // Шаг 3: Продолжаем логику API
  // Получение тренировок из БД
  // ...

  return NextResponse.json({
    workouts: [],
    total: 0
  })
}

// ============================================================================
// Пример 3: Migration endpoint с строгим rate limiting
// ============================================================================

/**
 * POST /api/migration
 * 
 * Применяет строгий rate limiting: 1 запрос за 5 минут
 * Предотвращает повторные миграции и нагрузку на сервер
 */
export async function migrationHandler(request: NextRequest) {
  // Шаг 1: Аутентификация запроса
  const authResult = await authenticateRequest(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  const { user } = authResult

  // Шаг 2: Применяем строгий rate limiting для миграции
  const rateLimitResponse = await applyMigrationRateLimit(request, user.id)
  if (rateLimitResponse) {
    // Лимит превышен - возвращаем 429 Too Many Requests
    // Пользователь должен подождать 5 минут перед повторной попыткой
    return rateLimitResponse
  }

  // Шаг 3: Продолжаем логику миграции
  const { workouts } = await request.json()

  // Миграция данных из localStorage
  // ...

  return NextResponse.json({
    imported: 0,
    failed: 0,
    errors: []
  })
}

// ============================================================================
// Пример 4: Комбинированная защита (Auth + Rate Limiting)
// ============================================================================

/**
 * DELETE /api/user/delete-account
 * 
 * Критичная операция с двойной защитой:
 * - Аутентификация пользователя
 * - Rate limiting для предотвращения злоупотреблений
 */
export async function deleteAccountHandler(request: NextRequest) {
  // Шаг 1: Аутентификация
  const authResult = await authenticateRequest(request)
  
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  const { user } = authResult

  // Шаг 2: Rate limiting
  const rateLimitResponse = await applyApiRateLimit(request, user.id)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Шаг 3: Дополнительная проверка пароля
  const { password } = await request.json()

  // Проверка пароля
  // ...

  // Шаг 4: Удаление аккаунта
  // Каскадное удаление всех данных пользователя
  // ...

  return NextResponse.json({
    message: 'Аккаунт успешно удален'
  })
}

// ============================================================================
// Пример 5: Обработка ответа 429 на клиенте
// ============================================================================

/**
 * Клиентский код для обработки rate limiting
 */
export async function clientExample() {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password' })
    })

    if (response.status === 429) {
      // Лимит превышен
      const data = await response.json()
      const retryAfter = response.headers.get('Retry-After')

      console.error(`Rate limit exceeded. Retry after ${retryAfter} seconds`)
      console.error(data.message)

      // Показываем пользователю сообщение
      alert(`Слишком много попыток входа. Попробуйте снова через ${retryAfter} секунд.`)
      
      return
    }

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = await response.json()
    console.log('Login successful:', data)

  } catch (error) {
    console.error('Error:', error)
  }
}

// ============================================================================
// Пример 6: Тестирование rate limiter
// ============================================================================

/**
 * Пример unit теста для rate limiter
 */
export async function testRateLimiter() {
  const { rateLimit, clearRateLimit, RATE_LIMIT_CONFIGS } = await import('./rate-limiter')

  // Тест 1: Первый запрос разрешен
  const identifier = 'test-user'
  const config = RATE_LIMIT_CONFIGS.auth

  const isLimited1 = await rateLimit(identifier, config)
  console.assert(isLimited1 === false, 'Первый запрос должен быть разрешен')

  // Тест 2: 5 запросов разрешены
  clearRateLimit(identifier)
  for (let i = 0; i < 5; i++) {
    const isLimited = await rateLimit(identifier, config)
    console.assert(isLimited === false, `Запрос ${i + 1} должен быть разрешен`)
  }

  // Тест 3: 6-й запрос заблокирован
  const isLimited6 = await rateLimit(identifier, config)
  console.assert(isLimited6 === true, '6-й запрос должен быть заблокирован')

  console.log('Все тесты пройдены!')
}
