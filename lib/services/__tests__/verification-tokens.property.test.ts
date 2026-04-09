import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { UserService } from '../user.service';

const prisma = new PrismaClient();

/**
 * Property-based тесты для токенов верификации
 * 
 * Валидирует:
 * - Свойство 23: Срок действия токенов верификации (Требование 4.5)
 * - Свойство 24: Одноразовость токенов сброса пароля (Требование 4.4)
 */
describe('Verification Tokens - Property-Based Tests', () => {
  const userService = new UserService();
  
  // Очистка тестовых данных после каждого теста
  afterEach(async () => {
    await prisma.passwordResetToken.deleteMany({});
    await prisma.verificationToken.deleteMany({});
    await prisma.user.deleteMany({});
  });
  
  /**
   * Свойство 23: Срок действия токенов верификации
   * 
   * Для любого токена верификации или сброса пароля, если прошло более 1 часа 
   * с момента создания, то токен должен быть признан истекшим.
   * 
   * Валидирует: Требование 4.5
   */
  describe('Свойство 23: Срок действия токенов верификации', () => {
    it('токены верификации истекают через 1 час', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            const result = await userService.register({
              email,
              password
            });
            
            const token = result.verificationToken;
            
            // Получаем токен из БД
            const verificationToken = await prisma.verificationToken.findUnique({
              where: { token }
            });
            
            expect(verificationToken).not.toBeNull();
            
            if (verificationToken) {
              // Проверяем, что срок действия установлен на 1 час от создания
              const createdAt = verificationToken.createdAt;
              const expiresAt = verificationToken.expiresAt;
              
              const diffInMs = expiresAt.getTime() - createdAt.getTime();
              const diffInHours = diffInMs / (1000 * 60 * 60);
              
              // Срок действия должен быть примерно 1 час (допускаем погрешность 1 минута)
              expect(diffInHours).toBeGreaterThanOrEqual(0.98); // 59 минут
              expect(diffInHours).toBeLessThanOrEqual(1.02); // 61 минута
            }
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('истекшие токены верификации не проходят валидацию', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            const result = await userService.register({
              email,
              password
            });
            
            const token = result.verificationToken;
            
            // Искусственно делаем токен истекшим (устанавливаем expiresAt в прошлое)
            await prisma.verificationToken.update({
              where: { token },
              data: {
                expiresAt: new Date(Date.now() - 1000) // 1 секунда назад
              }
            });
            
            // Попытка верификации должна вернуть false
            const isVerified = await userService.verifyEmail(token);
            expect(isVerified).toBe(false);
            
            // Токен должен быть удален из БД
            const deletedToken = await prisma.verificationToken.findUnique({
              where: { token }
            });
            expect(deletedToken).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('токены сброса пароля истекают через 1 час', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            await userService.register({
              email,
              password
            });
            
            // Запрашиваем сброс пароля
            const resetToken = await userService.requestPasswordReset(email);
            
            // Получаем токен из БД
            const passwordResetToken = await prisma.passwordResetToken.findUnique({
              where: { token: resetToken }
            });
            
            expect(passwordResetToken).not.toBeNull();
            
            if (passwordResetToken) {
              // Проверяем, что срок действия установлен на 1 час от создания
              const createdAt = passwordResetToken.createdAt;
              const expiresAt = passwordResetToken.expiresAt;
              
              const diffInMs = expiresAt.getTime() - createdAt.getTime();
              const diffInHours = diffInMs / (1000 * 60 * 60);
              
              // Срок действия должен быть примерно 1 час (допускаем погрешность 1 минута)
              expect(diffInHours).toBeGreaterThanOrEqual(0.98); // 59 минут
              expect(diffInHours).toBeLessThanOrEqual(1.02); // 61 минута
            }
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('истекшие токены сброса пароля не проходят валидацию', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password, newPassword) => {
            // Регистрируем пользователя
            await userService.register({
              email,
              password
            });
            
            // Запрашиваем сброс пароля
            const resetToken = await userService.requestPasswordReset(email);
            
            // Искусственно делаем токен истекшим
            await prisma.passwordResetToken.update({
              where: { token: resetToken },
              data: {
                expiresAt: new Date(Date.now() - 1000) // 1 секунда назад
              }
            });
            
            // Попытка сброса пароля должна вернуть false
            const isReset = await userService.resetPassword(resetToken, newPassword);
            expect(isReset).toBe(false);
            
            // Токен должен быть удален из БД
            const deletedToken = await prisma.passwordResetToken.findUnique({
              where: { token: resetToken }
            });
            expect(deletedToken).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('валидные токены верификации работают до истечения срока', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            const result = await userService.register({
              email,
              password
            });
            
            const token = result.verificationToken;
            
            // Проверяем, что токен валиден сразу после создания
            const isVerified = await userService.verifyEmail(token);
            expect(isVerified).toBe(true);
            
            // Проверяем, что пользователь теперь верифицирован
            const user = await prisma.user.findUnique({
              where: { email }
            });
            expect(user?.verified).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
  
  /**
   * Свойство 24: Одноразовость токенов сброса пароля
   * 
   * Для любого токена сброса пароля, после успешного использования токен 
   * должен быть удален из базы данных и не может быть использован повторно.
   * 
   * Валидирует: Требование 4.4
   */
  describe('Свойство 24: Одноразовость токенов сброса пароля', () => {
    it('токен сброса пароля удаляется после успешного использования', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password, newPassword) => {
            // Регистрируем пользователя
            await userService.register({
              email,
              password
            });
            
            // Запрашиваем сброс пароля
            const resetToken = await userService.requestPasswordReset(email);
            
            // Проверяем, что токен существует в БД
            let tokenInDb = await prisma.passwordResetToken.findUnique({
              where: { token: resetToken }
            });
            expect(tokenInDb).not.toBeNull();
            
            // Используем токен для сброса пароля
            const isReset = await userService.resetPassword(resetToken, newPassword);
            expect(isReset).toBe(true);
            
            // Проверяем, что токен удален из БД
            tokenInDb = await prisma.passwordResetToken.findUnique({
              where: { token: resetToken }
            });
            expect(tokenInDb).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('токен сброса пароля нельзя использовать повторно', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password, newPassword1, newPassword2) => {
            try {
              // Регистрируем пользователя и верифицируем email
              const regResult = await userService.register({ email, password });
              await userService.verifyEmail(regResult.verificationToken);

              // Запрашиваем сброс пароля
              const resetToken = await userService.requestPasswordReset(email);

              // Первое использование токена успешно
              const isReset1 = await userService.resetPassword(resetToken, newPassword1);
              expect(isReset1).toBe(true);

              // Попытка повторного использования того же токена должна вернуть false
              const isReset2 = await userService.resetPassword(resetToken, newPassword2);
              expect(isReset2).toBe(false);

              // Проверяем, что пароль не изменился на newPassword2
              const loginResult = await userService.login(email, newPassword1);
              expect(loginResult.user.email).toBe(email);
            } finally {
              // Очистка между запусками property (в т.ч. при shrinking)
              await prisma.passwordResetToken.deleteMany({ where: { user: { email } } });
              await prisma.user.deleteMany({ where: { email } });
            }
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('токен верификации удаляется после успешного использования', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            const result = await userService.register({
              email,
              password
            });
            
            const token = result.verificationToken;
            
            // Проверяем, что токен существует в БД
            let tokenInDb = await prisma.verificationToken.findUnique({
              where: { token }
            });
            expect(tokenInDb).not.toBeNull();
            
            // Используем токен для верификации
            const isVerified = await userService.verifyEmail(token);
            expect(isVerified).toBe(true);
            
            // Проверяем, что токен удален из БД
            tokenInDb = await prisma.verificationToken.findUnique({
              where: { token }
            });
            expect(tokenInDb).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('токен верификации нельзя использовать повторно', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            const result = await userService.register({
              email,
              password
            });
            
            const token = result.verificationToken;
            
            // Первое использование токена успешно
            const isVerified1 = await userService.verifyEmail(token);
            expect(isVerified1).toBe(true);
            
            // Попытка повторного использования того же токена должна вернуть false
            const isVerified2 = await userService.verifyEmail(token);
            expect(isVerified2).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('новый токен сброса пароля заменяет старый', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password, newPassword) => {
            // Регистрируем пользователя
            await userService.register({
              email,
              password
            });
            
            // Запрашиваем первый токен сброса
            const resetToken1 = await userService.requestPasswordReset(email);
            
            // Запрашиваем второй токен сброса
            const resetToken2 = await userService.requestPasswordReset(email);
            
            // Токены должны различаться
            expect(resetToken1).not.toBe(resetToken2);
            
            // Первый токен должен быть удален из БД
            const oldToken = await prisma.passwordResetToken.findUnique({
              where: { token: resetToken1 }
            });
            expect(oldToken).toBeNull();
            
            // Второй токен должен существовать
            const newToken = await prisma.passwordResetToken.findUnique({
              where: { token: resetToken2 }
            });
            expect(newToken).not.toBeNull();
            
            // Попытка использовать старый токен должна вернуть false
            const isReset1 = await userService.resetPassword(resetToken1, newPassword);
            expect(isReset1).toBe(false);
            
            // Новый токен должен работать
            const isReset2 = await userService.resetPassword(resetToken2, newPassword);
            expect(isReset2).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
  
  /**
   * Дополнительные свойства безопасности
   */
  describe('Дополнительные свойства безопасности', () => {
    it('токены имеют достаточную энтропию (64 hex символа)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            const result = await userService.register({
              email,
              password
            });
            
            const token = result.verificationToken;
            
            // Токен должен быть 64 символа hex (32 байта случайных данных)
            expect(token).toMatch(/^[a-f0-9]{64}$/i);
            expect(token.length).toBe(64);
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('разные пользователи получают разные токены', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.emailAddress(),
            fc.emailAddress()
          ).filter(([email1, email2]) => email1 !== email2),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async ([email1, email2], password) => {
            // Регистрируем двух пользователей
            const result1 = await userService.register({
              email: email1,
              password
            });
            
            const result2 = await userService.register({
              email: email2,
              password
            });
            
            // Токены должны различаться
            expect(result1.verificationToken).not.toBe(result2.verificationToken);
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('токен сброса пароля не влияет на токен верификации', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (email, password) => {
            // Регистрируем пользователя
            const result = await userService.register({
              email,
              password
            });
            
            const verificationToken = result.verificationToken;
            
            // Запрашиваем сброс пароля
            const resetToken = await userService.requestPasswordReset(email);
            
            // Токены должны различаться
            expect(verificationToken).not.toBe(resetToken);
            
            // Оба токена должны существовать в БД
            const verToken = await prisma.verificationToken.findUnique({
              where: { token: verificationToken }
            });
            const resToken = await prisma.passwordResetToken.findUnique({
              where: { token: resetToken }
            });
            
            expect(verToken).not.toBeNull();
            expect(resToken).not.toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
