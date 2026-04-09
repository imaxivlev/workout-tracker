/**
 * Unit тесты для rate limiter
 */

import {
  rateLimit,
  getRateLimitInfo,
  clearRateLimit,
  clearAllRateLimits,
  RATE_LIMIT_CONFIGS
} from '../rate-limiter'

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Очищаем все лимиты перед каждым тестом
    clearAllRateLimits()
  })

  describe('rateLimit()', () => {
    it('должен разрешить первый запрос', async () => {
      const identifier = 'test-user-1'
      const config = RATE_LIMIT_CONFIGS.auth

      const isLimited = await rateLimit(identifier, config)

      expect(isLimited).toBe(false)
    })

    it('должен разрешить запросы до достижения лимита', async () => {
      const identifier = 'test-user-2'
      const config = { windowMs: 60000, maxRequests: 3 }

      // Первые 3 запроса должны быть разрешены
      expect(await rateLimit(identifier, config)).toBe(false)
      expect(await rateLimit(identifier, config)).toBe(false)
      expect(await rateLimit(identifier, config)).toBe(false)
    })

    it('должен заблокировать запросы после превышения лимита', async () => {
      const identifier = 'test-user-3'
      const config = { windowMs: 60000, maxRequests: 2 }

      // Первые 2 запроса разрешены
      await rateLimit(identifier, config)
      await rateLimit(identifier, config)

      // 3-й запрос должен быть заблокирован
      const isLimited = await rateLimit(identifier, config)
      expect(isLimited).toBe(true)
    })

    it('должен сбросить лимит после истечения окна', async () => {
      const identifier = 'test-user-4'
      const config = { windowMs: 100, maxRequests: 1 } // 100ms окно

      // Первый запрос разрешен
      await rateLimit(identifier, config)

      // Второй запрос заблокирован
      expect(await rateLimit(identifier, config)).toBe(true)

      // Ждем истечения окна
      await new Promise(resolve => setTimeout(resolve, 150))

      // После истечения окна запрос снова разрешен
      const isLimited = await rateLimit(identifier, config)
      expect(isLimited).toBe(false)
    })

    it('должен отслеживать разных пользователей независимо', async () => {
      const user1 = 'user-1'
      const user2 = 'user-2'
      const config = { windowMs: 60000, maxRequests: 1 }

      // Первый запрос от user1 разрешен
      expect(await rateLimit(user1, config)).toBe(false)

      // Второй запрос от user1 заблокирован
      expect(await rateLimit(user1, config)).toBe(true)

      // Первый запрос от user2 разрешен (независимый счетчик)
      expect(await rateLimit(user2, config)).toBe(false)
    })
  })

  describe('getRateLimitInfo()', () => {
    it('должен вернуть null для нового идентификатора', () => {
      const info = getRateLimitInfo('new-user')
      expect(info).toBeNull()
    })

    it('должен вернуть информацию о лимите после запроса', async () => {
      const identifier = 'test-user-5'
      const config = { windowMs: 60000, maxRequests: 5 }

      await rateLimit(identifier, config)

      const info = getRateLimitInfo(identifier)

      expect(info).not.toBeNull()
      expect(info?.remaining).toBe(1)
      expect(info?.retryAfter).toBeGreaterThan(0)
      expect(info?.resetTime).toBeGreaterThan(Date.now())
    })

    it('должен вернуть null после истечения окна', async () => {
      const identifier = 'test-user-6'
      const config = { windowMs: 100, maxRequests: 1 }

      await rateLimit(identifier, config)

      // Ждем истечения окна
      await new Promise(resolve => setTimeout(resolve, 150))

      const info = getRateLimitInfo(identifier)
      expect(info).toBeNull()
    })
  })

  describe('clearRateLimit()', () => {
    it('должен очистить лимит для конкретного идентификатора', async () => {
      const identifier = 'test-user-7'
      const config = { windowMs: 60000, maxRequests: 1 }

      // Достигаем лимита
      await rateLimit(identifier, config)
      expect(await rateLimit(identifier, config)).toBe(true)

      // Очищаем лимит
      clearRateLimit(identifier)

      // Запрос снова разрешен
      expect(await rateLimit(identifier, config)).toBe(false)
    })
  })

  describe('RATE_LIMIT_CONFIGS', () => {
    it('должен иметь правильную конфигурацию для auth endpoints', () => {
      expect(RATE_LIMIT_CONFIGS.auth).toEqual({
        windowMs: 15 * 60 * 1000, // 15 минут
        maxRequests: 20
      })
    })

    it('должен иметь правильную конфигурацию для API endpoints', () => {
      expect(RATE_LIMIT_CONFIGS.api).toEqual({
        windowMs: 60 * 1000, // 1 минута
        maxRequests: 100
      })
    })

    it('должен иметь правильную конфигурацию для migration endpoint', () => {
      expect(RATE_LIMIT_CONFIGS.migration).toEqual({
        windowMs: 5 * 60 * 1000, // 5 минут
        maxRequests: 1
      })
    })
  })

  describe('Требование 17.1: Auth endpoints rate limiting', () => {
    it('должен разрешить 20 попыток входа за 15 минут', async () => {
      const identifier = 'auth-user-1'
      const config = RATE_LIMIT_CONFIGS.auth

      // 20 попыток должны быть разрешены
      for (let i = 0; i < 20; i++) {
        const isLimited = await rateLimit(identifier, config)
        expect(isLimited).toBe(false)
      }
    })

    it('должен заблокировать 21-ю попытку входа', async () => {
      const identifier = 'auth-user-2'
      const config = RATE_LIMIT_CONFIGS.auth

      // 20 попыток разрешены
      for (let i = 0; i < 20; i++) {
        await rateLimit(identifier, config)
      }

      // 21-я попытка заблокирована
      const isLimited = await rateLimit(identifier, config)
      expect(isLimited).toBe(true)
    })
  })

  describe('Требование 17.2: API endpoints rate limiting', () => {
    it('должен разрешить 100 запросов за минуту', async () => {
      const identifier = 'api-user-1'
      const config = RATE_LIMIT_CONFIGS.api

      // 100 запросов должны быть разрешены
      for (let i = 0; i < 100; i++) {
        const isLimited = await rateLimit(identifier, config)
        expect(isLimited).toBe(false)
      }
    })

    it('должен заблокировать 101-й запрос', async () => {
      const identifier = 'api-user-2'
      const config = RATE_LIMIT_CONFIGS.api

      // 100 запросов разрешены
      for (let i = 0; i < 100; i++) {
        await rateLimit(identifier, config)
      }

      // 101-й запрос заблокирован
      const isLimited = await rateLimit(identifier, config)
      expect(isLimited).toBe(true)
    })
  })

  describe('Требование 17.3: Migration endpoint rate limiting', () => {
    it('должен разрешить 1 запрос миграции за 5 минут', async () => {
      const identifier = 'migration-user-1'
      const config = RATE_LIMIT_CONFIGS.migration

      const isLimited = await rateLimit(identifier, config)
      expect(isLimited).toBe(false)
    })

    it('должен заблокировать 2-й запрос миграции', async () => {
      const identifier = 'migration-user-2'
      const config = RATE_LIMIT_CONFIGS.migration

      // Первый запрос разрешен
      await rateLimit(identifier, config)

      // Второй запрос заблокирован
      const isLimited = await rateLimit(identifier, config)
      expect(isLimited).toBe(true)
    })
  })

  describe('Требование 17.4: Retry-After заголовок', () => {
    it('должен предоставить информацию о времени ожидания', async () => {
      const identifier = 'retry-user-1'
      const config = { windowMs: 60000, maxRequests: 1 }

      // Достигаем лимита
      await rateLimit(identifier, config)
      await rateLimit(identifier, config)

      const info = getRateLimitInfo(identifier)

      expect(info).not.toBeNull()
      expect(info?.retryAfter).toBeGreaterThan(0)
      expect(info?.retryAfter).toBeLessThanOrEqual(60) // Максимум 60 секунд
    })
  })
})
