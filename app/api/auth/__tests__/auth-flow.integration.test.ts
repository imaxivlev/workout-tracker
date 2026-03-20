/**
 * Integration тесты для Auth Flow
 *
 * Задача 18.1: Тестирование полного цикла аутентификации
 * - Регистрация → верификация → вход → выход
 * - Неверные учетные данные
 * - Rate limiting
 */
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST as registerPOST } from '../../auth/register/route';
import { POST as loginPOST } from '../../auth/login/route';
import { POST as logoutPOST } from '../../auth/logout/route';
import { GET as verifyGET } from '../../auth/verify/route';
import { POST as resetPasswordPOST } from '../../auth/reset-password/route';
import { POST as resetPasswordConfirmPOST } from '../../auth/reset-password/confirm/route';
import * as RateLimiter from '@/lib/auth/rate-limiter';

// Мокаем rate limiter чтобы не мешал тестам
vi.mock('@/lib/auth/rate-limiter');

// Мокаем UserService для изоляции от БД
vi.mock('@/lib/services/user.service', () => {
  // Хранилище пользователей в памяти
  const users = new Map<string, {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string | null;
    lastName: string | null;
    verified: boolean;
  }>();
  const verificationTokens = new Map<string, { userId: string; expiresAt: Date }>();
  const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

  return {
    UserService: class MockUserService {
      async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
        // Проверка дублирования email
        for (const user of users.values()) {
          if (user.email === data.email) {
            throw new Error('Пользователь с таким email уже существует');
          }
        }

        // Валидация пароля
        if (data.password.length < 8) throw new Error('Пароль должен содержать минимум 8 символов');
        if (!/\d/.test(data.password)) throw new Error('Пароль должен содержать хотя бы 1 цифру');
        if (!/[a-zA-Z]/.test(data.password)) throw new Error('Пароль должен содержать хотя бы 1 букву');

        const id = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const user = {
          id,
          email: data.email,
          passwordHash: `hashed-${data.password}`,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          verified: false,
        };
        users.set(id, user);

        // Генерация токена верификации
        const token = 'a'.repeat(64);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        verificationTokens.set(token, { userId: id, expiresAt });

        return {
          user: { id, email: data.email, firstName: user.firstName, lastName: user.lastName, verified: false },
          verificationToken: token,
        };
      }

      async login(email: string, password: string) {
        let foundUser = null;
        for (const user of users.values()) {
          if (user.email === email) { foundUser = user; break; }
        }
        if (!foundUser || foundUser.passwordHash !== `hashed-${password}`) {
          throw new Error('Неверный email или пароль');
        }
        return {
          user: { id: foundUser.id, email: foundUser.email, firstName: foundUser.firstName, lastName: foundUser.lastName },
          token: `jwt-token-${foundUser.id}`,
        };
      }

      async verifyEmail(token: string) {
        const record = verificationTokens.get(token);
        if (!record) return false;
        if (record.expiresAt < new Date()) {
          verificationTokens.delete(token);
          return false;
        }
        const user = users.get(record.userId);
        if (user) user.verified = true;
        verificationTokens.delete(token);
        return true;
      }

      async requestPasswordReset(email: string) {
        let foundUser = null;
        for (const user of users.values()) {
          if (user.email === email) { foundUser = user; break; }
        }
        if (!foundUser) throw new Error('Пользователь с таким email не найден');
        const token = 'b'.repeat(64);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        resetTokens.set(token, { userId: foundUser.id, expiresAt });
        return token;
      }

      async resetPassword(token: string, newPassword: string) {
        if (newPassword.length < 8) throw new Error('Пароль должен содержать минимум 8 символов');
        const record = resetTokens.get(token);
        if (!record) return false;
        if (record.expiresAt < new Date()) {
          resetTokens.delete(token);
          return false;
        }
        const user = users.get(record.userId);
        if (user) user.passwordHash = `hashed-${newPassword}`;
        resetTokens.delete(token);
        return true;
      }

      // Вспомогательные методы для тестов
      static _clear() {
        users.clear();
        verificationTokens.clear();
        resetTokens.clear();
      }
    }
  };
});

// Получаем ссылку на мок для очистки
import { UserService } from '@/lib/services/user.service';

describe('Auth Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(RateLimiter.rateLimit).mockResolvedValue(false);
    (UserService as any)._clear();
  });

  describe('18.1.1 Полный цикл: регистрация → верификация → вход → выход', () => {
    it('должен пройти весь цикл аутентификации успешно', async () => {
      // 1. Регистрация
      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'SecurePass1',
          firstName: 'Иван',
          lastName: 'Петров',
        }),
      });

      const registerResponse = await registerPOST(registerRequest);
      const registerData = await registerResponse.json();

      expect(registerResponse.status).toBe(201);
      expect(registerData.user).toBeDefined();
      expect(registerData.user.email).toBe('newuser@example.com');
      expect(registerData.user.firstName).toBe('Иван');
      expect(registerData.user.verified).toBe(false);
      expect(registerData.message).toContain('Регистрация успешна');

      // 2. Верификация email
      const verifyRequest = new NextRequest(
        `http://localhost:3000/api/auth/verify?token=${'a'.repeat(64)}`,
        { method: 'GET' }
      );

      const verifyResponse = await verifyGET(verifyRequest);
      const verifyData = await verifyResponse.json();

      expect(verifyResponse.status).toBe(200);
      expect(verifyData.verified).toBe(true);
      expect(verifyData.message).toContain('Email успешно подтвержден');

      // 3. Вход
      const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'SecurePass1',
        }),
      });

      const loginResponse = await loginPOST(loginRequest);
      const loginData = await loginResponse.json();

      expect(loginResponse.status).toBe(200);
      expect(loginData.user).toBeDefined();
      expect(loginData.user.email).toBe('newuser@example.com');
      expect(loginData.message).toContain('Вход выполнен успешно');

      // Проверяем JWT cookie
      const setCookieHeader = loginResponse.headers.get('set-cookie');
      expect(setCookieHeader).toContain('auth-token=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader!.toLowerCase()).toContain('samesite=lax');

      // 4. Выход
      const logoutRequest = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });

      const logoutResponse = await logoutPOST(logoutRequest);
      const logoutData = await logoutResponse.json();

      expect(logoutResponse.status).toBe(200);
      expect(logoutData.message).toContain('Выход выполнен успешно');

      // Проверяем что cookie удалена (maxAge=0)
      const logoutCookie = logoutResponse.headers.get('set-cookie');
      expect(logoutCookie).toContain('auth-token=');
      expect(logoutCookie).toContain('Max-Age=0');
    });
  });

  describe('18.1.2 Неверные учетные данные', () => {
    it('должен вернуть 401 при неверном пароле', async () => {
      // Сначала регистрируем пользователя
      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'CorrectPass1',
        }),
      });
      await registerPOST(registerRequest);

      // Пытаемся войти с неверным паролем
      const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'WrongPass1',
        }),
      });

      const response = await loginPOST(loginRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Неверный email или пароль');
      expect(data.code).toBe('INVALID_CREDENTIALS');
    });

    it('должен вернуть 401 при несуществующем email', async () => {
      const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'SomePass123',
        }),
      });

      const response = await loginPOST(loginRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('INVALID_CREDENTIALS');
    });

    it('должен вернуть 400 при невалидном email', async () => {
      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'SecurePass1',
        }),
      });

      const response = await registerPOST(registerRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('валидации');
    });

    it('должен вернуть 400 при слабом пароле (без цифр)', async () => {
      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'NoDigitsHere',
        }),
      });

      const response = await registerPOST(registerRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('должен вернуть 400 при коротком пароле', async () => {
      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'Ab1',
        }),
      });

      const response = await registerPOST(registerRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('должен вернуть 409 при дублировании email', async () => {
      // Регистрируем первого пользователя
      const request1 = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'duplicate@example.com',
          password: 'SecurePass1',
        }),
      });
      const response1 = await registerPOST(request1);
      expect(response1.status).toBe(201);

      // Пытаемся зарегистрировать с тем же email
      const request2 = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'duplicate@example.com',
          password: 'AnotherPass1',
        }),
      });
      const response2 = await registerPOST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(409);
      expect(data2.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('18.1.3 Rate limiting', () => {
    it('должен вернуть 429 при превышении rate limit на регистрации', async () => {
      vi.mocked(RateLimiter.rateLimit).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rate@example.com',
          password: 'SecurePass1',
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers.get('Retry-After')).toBe('900');
    });

    it('должен вернуть 429 при превышении rate limit на входе', async () => {
      vi.mocked(RateLimiter.rateLimit).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'SecurePass1',
        }),
      });

      const response = await loginPOST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('18.1.4 Верификация email', () => {
    it('должен вернуть 400 при отсутствии токена', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/verify', {
        method: 'GET',
      });

      const response = await verifyGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('TOKEN_MISSING');
    });

    it('должен вернуть 400 при невалидном формате токена', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/auth/verify?token=invalid-short-token',
        { method: 'GET' }
      );

      const response = await verifyGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_TOKEN_FORMAT');
    });

    it('должен вернуть 400 при несуществующем токене', async () => {
      // Валидный формат, но не существует в "базе"
      const fakeToken = 'f'.repeat(64);
      const request = new NextRequest(
        `http://localhost:3000/api/auth/verify?token=${fakeToken}`,
        { method: 'GET' }
      );

      const response = await verifyGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('TOKEN_INVALID_OR_EXPIRED');
    });
  });

  describe('18.1.5 Сброс пароля', () => {
    it('должен запросить сброс и подтвердить новый пароль', async () => {
      // Регистрируем пользователя
      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'reset@example.com',
          password: 'OldPass123',
        }),
      });
      await registerPOST(registerRequest);

      // Запрашиваем сброс пароля
      const resetRequest = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'reset@example.com' }),
      });

      const resetResponse = await resetPasswordPOST(resetRequest);
      expect(resetResponse.status).toBe(200);

      // Подтверждаем сброс с новым паролем
      const confirmRequest = new NextRequest('http://localhost:3000/api/auth/reset-password/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: 'b'.repeat(64),
          newPassword: 'NewPass456',
        }),
      });

      const confirmResponse = await resetPasswordConfirmPOST(confirmRequest);
      const confirmData = await confirmResponse.json();

      expect(confirmResponse.status).toBe(200);

      // Входим с новым паролем
      const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'reset@example.com',
          password: 'NewPass456',
        }),
      });

      const loginResponse = await loginPOST(loginRequest);
      expect(loginResponse.status).toBe(200);

      // Старый пароль не работает
      const oldLoginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'reset@example.com',
          password: 'OldPass123',
        }),
      });

      const oldLoginResponse = await loginPOST(oldLoginRequest);
      expect(oldLoginResponse.status).toBe(401);
    });

    it('должен вернуть 400 при невалидном токене сброса', async () => {
      const confirmRequest = new NextRequest('http://localhost:3000/api/auth/reset-password/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: 'x'.repeat(64),
          newPassword: 'NewPass456',
        }),
      });

      const response = await resetPasswordConfirmPOST(confirmRequest);
      expect(response.status).toBe(400);
    });

    it('должен вернуть 400 при невалидном формате токена сброса', async () => {
      const confirmRequest = new NextRequest('http://localhost:3000/api/auth/reset-password/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: 'short',
          newPassword: 'NewPass456',
        }),
      });

      const response = await resetPasswordConfirmPOST(confirmRequest);
      expect(response.status).toBe(400);
    });
  });

  describe('18.1.6 Logout без аутентификации', () => {
    it('должен вернуть 200 OK даже без токена', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });

      const response = await logoutPOST(request);
      expect(response.status).toBe(200);
    });
  });
});
