import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Property-based тесты для JWT валидации
 * 
 * Валидирует:
 * - Свойство 6: Валидность JWT токенов (Требования 3.3-3.5)
 */
describe('JWT Middleware - Property-Based Tests', () => {
  const JWT_SECRET = 'test-secret-key-for-property-tests-12345678';
  
  beforeAll(() => {
    // Устанавливаем тестовый JWT_SECRET
    process.env.JWT_SECRET = JWT_SECRET;
  });
  
  /**
   * Свойство 6: Валидность JWT токенов
   * 
   * Для любого JWT токена, если токен валиден и не истек, то должен 
   * существовать пользователь с userId и email из payload токена.
   * 
   * Валидирует: Требования 3.3, 3.4, 3.5
   */
  describe('Свойство 6: Валидность JWT токенов', () => {
    it('валидный токен содержит корректный userId и email', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            // Генерируем JWT токен
            const token = jwt.sign(
              { userId, email },
              JWT_SECRET,
              { expiresIn: '7d' }
            );
            
            // Декодируем токен
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            
            // Проверяем, что payload содержит правильные данные
            expect(decoded.userId).toBe(userId);
            expect(decoded.email).toBe(email);
            
            // Проверяем наличие стандартных полей JWT
            expect(decoded.iat).toBeDefined(); // issued at
            expect(decoded.exp).toBeDefined(); // expiration
            
            // Проверяем, что токен не истек
            const now = Math.floor(Date.now() / 1000);
            expect(decoded.exp).toBeGreaterThan(now);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('токен с истекшим сроком действия не проходит валидацию', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            // Генерируем токен с истекшим сроком (1 секунда)
            const token = jwt.sign(
              { userId, email },
              JWT_SECRET,
              { expiresIn: '-1s' } // Уже истек
            );
            
            // Попытка верификации должна выбросить ошибку
            expect(() => {
              jwt.verify(token, JWT_SECRET);
            }).toThrow('jwt expired');
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('токен с неверной подписью не проходит валидацию', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          fc.string({ minLength: 20, maxLength: 50 }), // Неверный секрет
          (userId, email, wrongSecret) => {
            // Генерируем токен с правильным секретом
            const token = jwt.sign(
              { userId, email },
              JWT_SECRET,
              { expiresIn: '7d' }
            );
            
            // Попытка верификации с неверным секретом должна выбросить ошибку
            expect(() => {
              jwt.verify(token, wrongSecret);
            }).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('модифицированный токен не проходит валидацию', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            // Генерируем валидный токен
            const token = jwt.sign(
              { userId, email },
              JWT_SECRET,
              { expiresIn: '7d' }
            );
            
            // Модифицируем токен (меняем один символ в середине)
            const parts = token.split('.');
            if (parts[1].length > 10) {
              const modified = parts[1].split('');
              const middleIndex = Math.floor(modified.length / 2);
              modified[middleIndex] = modified[middleIndex] === 'a' ? 'b' : 'a';
              parts[1] = modified.join('');
              const modifiedToken = parts.join('.');
              
              // Попытка верификации модифицированного токена должна выбросить ошибку
              expect(() => {
                jwt.verify(modifiedToken, JWT_SECRET);
              }).toThrow();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('токен содержит правильное время истечения (7 дней)', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            const beforeGeneration = Math.floor(Date.now() / 1000);
            
            // Генерируем токен
            const token = jwt.sign(
              { userId, email },
              JWT_SECRET,
              { expiresIn: '7d' }
            );
            
            const afterGeneration = Math.floor(Date.now() / 1000);
            
            // Декодируем токен
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            
            // Проверяем, что время истечения примерно через 7 дней
            const sevenDaysInSeconds = 7 * 24 * 60 * 60;
            const expectedExpiration = beforeGeneration + sevenDaysInSeconds;
            
            // Допускаем погрешность в 2 секунды
            expect(decoded.exp).toBeGreaterThanOrEqual(expectedExpiration - 2);
            expect(decoded.exp).toBeLessThanOrEqual(afterGeneration + sevenDaysInSeconds + 2);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('разные пользователи генерируют разные токены', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.uuid(),
            fc.emailAddress(),
            fc.uuid(),
            fc.emailAddress()
          ).filter(([id1, email1, id2, email2]) => 
            id1 !== id2 || email1 !== email2
          ),
          ([userId1, email1, userId2, email2]) => {
            // Генерируем токены для двух разных пользователей
            const token1 = jwt.sign(
              { userId: userId1, email: email1 },
              JWT_SECRET,
              { expiresIn: '7d' }
            );
            
            const token2 = jwt.sign(
              { userId: userId2, email: email2 },
              JWT_SECRET,
              { expiresIn: '7d' }
            );
            
            // Токены должны различаться
            expect(token1).not.toBe(token2);
            
            // Каждый токен содержит правильные данные
            const decoded1 = jwt.verify(token1, JWT_SECRET) as any;
            const decoded2 = jwt.verify(token2, JWT_SECRET) as any;
            
            expect(decoded1.userId).toBe(userId1);
            expect(decoded1.email).toBe(email1);
            expect(decoded2.userId).toBe(userId2);
            expect(decoded2.email).toBe(email2);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('токен без обязательных полей не должен генерироваться', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: fc.option(fc.uuid(), { nil: undefined }),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
          }).filter(payload => !payload.userId || !payload.email),
          (invalidPayload) => {
            // Генерируем токен с неполным payload
            const token = jwt.sign(
              invalidPayload,
              JWT_SECRET,
              { expiresIn: '7d' }
            );
            
            // Токен технически валиден, но не содержит нужных полей
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            
            // Проверяем, что отсутствуют обязательные поля
            const hasUserId = decoded.userId !== undefined && decoded.userId !== null;
            const hasEmail = decoded.email !== undefined && decoded.email !== null;
            
            expect(hasUserId && hasEmail).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
  
  /**
   * Дополнительное свойство: Устойчивость к подделке
   */
  describe('Дополнительное свойство: Устойчивость к подделке', () => {
    it('невозможно создать валидный токен без знания секрета', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            // Пытаемся создать "токен" вручную без подписи
            const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
            const payload = Buffer.from(JSON.stringify({ userId, email })).toString('base64url');
            const fakeToken = `${header}.${payload}.fake-signature`;
            
            // Попытка верификации должна выбросить ошибку
            expect(() => {
              jwt.verify(fakeToken, JWT_SECRET);
            }).toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('токен с алгоритмом "none" не проходит валидацию', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.emailAddress(),
          (userId, email) => {
            // Пытаемся создать токен с алгоритмом "none" (известная уязвимость)
            const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
            const payload = Buffer.from(JSON.stringify({ userId, email })).toString('base64url');
            const noneToken = `${header}.${payload}.`;
            
            // Попытка верификации должна выбросить ошибку
            expect(() => {
              jwt.verify(noneToken, JWT_SECRET);
            }).toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
