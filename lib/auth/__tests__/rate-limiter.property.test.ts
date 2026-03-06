import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  rateLimit,
  getRateLimitInfo,
  clearRateLimit,
  clearAllRateLimits,
  RATE_LIMIT_CONFIGS
} from '../rate-limiter';

/**
 * Property-based тесты для Rate Limiter
 * 
 * Валидирует:
 * - Свойство 25: Rate Limiting для auth endpoints (Требования 1.7, 17.1)
 */
describe('Rate Limiter - Property-Based Tests', () => {
  beforeEach(() => {
    // Очищаем все лимиты перед каждым тестом
    clearAllRateLimits();
  });
  
  afterEach(() => {
    // Очищаем все лимиты после каждого теста
    clearAllRateLimits();
  });
  
  /**
   * Свойство 25: Rate Limiting для auth endpoints
   * 
   * Для любого IP адреса или пользователя, если количество запросов 
   * к auth endpoints превышает 5 за 15 минут, то последующие запросы 
   * должны возвращать ошибку 429.
   * 
   * Валидирует: Требования 1.7, 17.1
   */
  describe('Свойство 25: Rate Limiting для auth endpoints', () => {
    it('первые N запросов разрешены, последующие блокируются', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }), // IP адрес или userId
          fc.integer({ min: 1, max: 10 }), // maxRequests
          fc.integer({ min: 1000, max: 10000 }), // windowMs
          async (identifier, maxRequests, windowMs) => {
            const config = { windowMs, maxRequests };
            
            // Первые maxRequests запросов должны быть разрешены
            for (let i = 0; i < maxRequests; i++) {
              const isBlocked = await rateLimit(identifier, config);
              expect(isBlocked).toBe(false);
            }
            
            // Следующий запрос должен быть заблокирован
            const isBlocked = await rateLimit(identifier, config);
            expect(isBlocked).toBe(true);
            
            // Очищаем для следующей итерации
            clearRateLimit(identifier);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('лимит сбрасывается после истечения временного окна', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }),
          async (identifier) => {
            const config = {
              windowMs: 100, // 100ms для быстрого теста
              maxRequests: 2
            };
            
            // Исчерпываем лимит
            await rateLimit(identifier, config);
            await rateLimit(identifier, config);
            
            // Следующий запрос заблокирован
            let isBlocked = await rateLimit(identifier, config);
            expect(isBlocked).toBe(true);
            
            // Ждем истечения окна
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // После истечения окна лимит должен сброситься
            isBlocked = await rateLimit(identifier, config);
            expect(isBlocked).toBe(false);
            
            clearRateLimit(identifier);
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('разные идентификаторы имеют независимые лимиты', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.string({ minLength: 7, maxLength: 15 }),
            fc.string({ minLength: 7, maxLength: 15 })
          ).filter(([id1, id2]) => id1 !== id2),
          async ([identifier1, identifier2]) => {
            const config = {
              windowMs: 60000,
              maxRequests: 3
            };
            
            // Исчерпываем лимит для первого идентификатора
            await rateLimit(identifier1, config);
            await rateLimit(identifier1, config);
            await rateLimit(identifier1, config);
            
            // Первый идентификатор заблокирован
            const isBlocked1 = await rateLimit(identifier1, config);
            expect(isBlocked1).toBe(true);
            
            // Второй идентификатор все еще может делать запросы
            const isBlocked2 = await rateLimit(identifier2, config);
            expect(isBlocked2).toBe(false);
            
            clearRateLimit(identifier1);
            clearRateLimit(identifier2);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('getRateLimitInfo возвращает корректную информацию', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }),
          fc.integer({ min: 2, max: 10 }),
          async (identifier, maxRequests) => {
            const config = {
              windowMs: 60000,
              maxRequests
            };
            
            // Делаем несколько запросов
            const requestCount = Math.floor(maxRequests / 2);
            for (let i = 0; i < requestCount; i++) {
              await rateLimit(identifier, config);
            }
            
            // Получаем информацию о лимите
            const info = getRateLimitInfo(identifier);
            
            expect(info).not.toBeNull();
            if (info) {
              // Проверяем, что счетчик правильный
              expect(info.remaining).toBe(requestCount);
              
              // Проверяем, что resetTime в будущем
              expect(info.resetTime).toBeGreaterThan(Date.now());
              
              // Проверяем, что retryAfter положительный
              expect(info.retryAfter).toBeGreaterThan(0);
            }
            
            clearRateLimit(identifier);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
  
  /**
   * Тесты для предустановленных конфигураций
   */
  describe('Предустановленные конфигурации', () => {
    it('auth endpoints: 5 запросов за 15 минут', async () => {
      const identifier = 'test-user-auth';
      const config = RATE_LIMIT_CONFIGS.auth;
      
      // Первые 5 запросов разрешены
      for (let i = 0; i < 5; i++) {
        const isBlocked = await rateLimit(identifier, config);
        expect(isBlocked).toBe(false);
      }
      
      // 6-й запрос заблокирован
      const isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(true);
      
      clearRateLimit(identifier);
    });
    
    it('api endpoints: 100 запросов за минуту', async () => {
      const identifier = 'test-user-api';
      const config = RATE_LIMIT_CONFIGS.api;
      
      // Первые 100 запросов разрешены
      for (let i = 0; i < 100; i++) {
        const isBlocked = await rateLimit(identifier, config);
        expect(isBlocked).toBe(false);
      }
      
      // 101-й запрос заблокирован
      const isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(true);
      
      clearRateLimit(identifier);
    });
    
    it('migration endpoint: 1 запрос за 5 минут', async () => {
      const identifier = 'test-user-migration';
      const config = RATE_LIMIT_CONFIGS.migration;
      
      // Первый запрос разрешен
      let isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(false);
      
      // Второй запрос заблокирован
      isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(true);
      
      clearRateLimit(identifier);
    });
  });
  
  /**
   * Дополнительные свойства
   */
  describe('Дополнительные свойства', () => {
    it('счетчик увеличивается монотонно до достижения лимита', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }),
          fc.integer({ min: 3, max: 10 }),
          async (identifier, maxRequests) => {
            const config = {
              windowMs: 60000,
              maxRequests
            };
            
            let previousCount = 0;
            
            // Делаем запросы и проверяем монотонность счетчика
            for (let i = 0; i < maxRequests; i++) {
              await rateLimit(identifier, config);
              const info = getRateLimitInfo(identifier);
              
              if (info) {
                expect(info.remaining).toBeGreaterThan(previousCount);
                previousCount = info.remaining;
              }
            }
            
            clearRateLimit(identifier);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('clearRateLimit удаляет лимит для конкретного идентификатора', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }),
          async (identifier) => {
            const config = {
              windowMs: 60000,
              maxRequests: 2
            };
            
            // Исчерпываем лимит
            await rateLimit(identifier, config);
            await rateLimit(identifier, config);
            
            // Проверяем, что лимит есть
            let info = getRateLimitInfo(identifier);
            expect(info).not.toBeNull();
            
            // Очищаем лимит
            clearRateLimit(identifier);
            
            // Проверяем, что лимит удален
            info = getRateLimitInfo(identifier);
            expect(info).toBeNull();
            
            // Можем снова делать запросы
            const isBlocked = await rateLimit(identifier, config);
            expect(isBlocked).toBe(false);
            
            clearRateLimit(identifier);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('retryAfter уменьшается со временем', async () => {
      const identifier = 'test-retry-after';
      const config = {
        windowMs: 5000, // 5 секунд
        maxRequests: 1
      };
      
      // Исчерпываем лимит
      await rateLimit(identifier, config);
      
      // Получаем первое значение retryAfter
      const info1 = getRateLimitInfo(identifier);
      expect(info1).not.toBeNull();
      const retryAfter1 = info1!.retryAfter;
      
      // Ждем 1 секунду
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Получаем второе значение retryAfter
      const info2 = getRateLimitInfo(identifier);
      expect(info2).not.toBeNull();
      const retryAfter2 = info2!.retryAfter;
      
      // retryAfter должен уменьшиться
      expect(retryAfter2).toBeLessThan(retryAfter1);
      
      clearRateLimit(identifier);
    });
    
    it('одновременные запросы от одного идентификатора учитываются корректно', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 7, maxLength: 15 }),
          fc.integer({ min: 5, max: 20 }),
          async (identifier, concurrentRequests) => {
            const config = {
              windowMs: 60000,
              maxRequests: concurrentRequests + 5 // Достаточно для всех запросов
            };
            
            // Делаем несколько одновременных запросов
            const promises = Array(concurrentRequests)
              .fill(null)
              .map(() => rateLimit(identifier, config));
            
            const results = await Promise.all(promises);
            
            // Все запросы должны быть разрешены
            expect(results.every(r => r === false)).toBe(true);
            
            // Счетчик должен быть равен количеству запросов
            const info = getRateLimitInfo(identifier);
            expect(info).not.toBeNull();
            if (info) {
              expect(info.remaining).toBe(concurrentRequests);
            }
            
            clearRateLimit(identifier);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
  
  /**
   * Граничные случаи
   */
  describe('Граничные случаи', () => {
    it('maxRequests = 1 работает корректно', async () => {
      const identifier = 'test-max-1';
      const config = {
        windowMs: 60000,
        maxRequests: 1
      };
      
      // Первый запрос разрешен
      let isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(false);
      
      // Второй запрос заблокирован
      isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(true);
      
      clearRateLimit(identifier);
    });
    
    it('очень короткое временное окно работает корректно', async () => {
      const identifier = 'test-short-window';
      const config = {
        windowMs: 50, // 50ms
        maxRequests: 2
      };
      
      // Исчерпываем лимит
      await rateLimit(identifier, config);
      await rateLimit(identifier, config);
      
      // Заблокирован
      let isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(true);
      
      // Ждем истечения окна
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Лимит сброшен
      isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(false);
      
      clearRateLimit(identifier);
    });
    
    it('пустой идентификатор обрабатывается корректно', async () => {
      const identifier = '';
      const config = {
        windowMs: 60000,
        maxRequests: 3
      };
      
      // Должно работать даже с пустым идентификатором
      const isBlocked = await rateLimit(identifier, config);
      expect(isBlocked).toBe(false);
      
      clearRateLimit(identifier);
    });
  });
});
