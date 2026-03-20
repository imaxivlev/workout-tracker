/**
 * Rate Limiter для защиты API от злоупотреблений
 * 
 * Реализует три типа ограничений:
 * - Auth endpoints: 5 попыток за 15 минут
 * - API endpoints: 100 запросов за минуту
 * - Migration endpoint: 1 запрос за 5 минут
 * 
 * Использует in-memory хранилище для отслеживания запросов.
 * Идентификатор клиента: IP адрес или userId для аутентифицированных запросов.
 */

interface RateLimitConfig {
  windowMs: number // Временное окно в миллисекундах
  maxRequests: number // Максимальное количество запросов в окне
}

interface RateLimitRecord {
  count: number // Количество запросов
  resetTime: number // Время сброса счетчика (timestamp)
}

// In-memory хранилище для отслеживания запросов
// В production можно заменить на Redis для масштабируемости
const rateLimitStore = new Map<string, RateLimitRecord>()

// Предустановленные конфигурации для разных типов endpoints
export const RATE_LIMIT_CONFIGS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 минут
    maxRequests: 5
  },
  api: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 100
  },
  migration: {
    windowMs: 5 * 60 * 1000, // 5 минут
    maxRequests: 1
  }
} as const

/**
 * Проверяет, превышен ли лимит запросов для данного идентификатора
 * 
 * @param identifier - Уникальный идентификатор клиента (IP или userId)
 * @param config - Конфигурация rate limit
 * @returns true если лимит превышен, false если запрос разрешен
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<boolean> {
  const now = Date.now()
  const record = rateLimitStore.get(identifier)

  // Если записи нет или окно истекло - создаем новую запись
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return false // Запрос разрешен
  }

  // Если лимит превышен
  if (record.count >= config.maxRequests) {
    return true // Запрос заблокирован
  }

  // Увеличиваем счетчик
  record.count++
  return false // Запрос разрешен
}

/**
 * Получает информацию о текущем состоянии rate limit для идентификатора
 * 
 * @param identifier - Уникальный идентификатор клиента
 * @returns Информация о лимите или null если записи нет
 */
export function getRateLimitInfo(identifier: string): {
  remaining: number
  resetTime: number
  retryAfter: number
} | null {
  const record = rateLimitStore.get(identifier)
  
  if (!record) {
    return null
  }

  const now = Date.now()
  
  // Если окно истекло, возвращаем null
  if (now > record.resetTime) {
    rateLimitStore.delete(identifier)
    return null
  }

  return {
    remaining: Math.max(0, record.count),
    resetTime: record.resetTime,
    retryAfter: Math.ceil((record.resetTime - now) / 1000) // В секундах
  }
}

/**
 * Очищает запись о rate limit для идентификатора
 * Полезно для тестирования или административных операций
 * 
 * @param identifier - Уникальный идентификатор клиента
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier)
}

/**
 * Очищает все записи rate limit
 * Полезно для тестирования
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear()
}

/**
 * Периодическая очистка истекших записей для предотвращения утечки памяти
 * Рекомендуется запускать каждые 5-10 минут
 */
export function cleanupExpiredRecords(): void {
  const now = Date.now()
  
  for (const [identifier, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(identifier)
    }
  }
}

// Автоматическая очистка каждые 10 минут
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRecords, 10 * 60 * 1000)
}
