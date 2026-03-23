/**
 * Unit тесты для Admin Middleware
 *
 * Тестируемые модули:
 * - authenticateAdmin — проверка JWT + isAdmin
 * - isAdminError — type guard
 * - adminErrorResponse — формирование JSON ошибок
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockAuthenticateRequest, mockUserFindUnique } = vi.hoisted(() => ({
  mockAuthenticateRequest: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  authenticateRequest: (...args: any[]) => mockAuthenticateRequest(...args),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    user = { findUnique: mockUserFindUnique };
  },
}));

import { authenticateAdmin, isAdminError, adminErrorResponse } from '../admin-middleware';

function makeRequest(url = 'http://localhost:3000/api/admin'): NextRequest {
  return new NextRequest(url);
}

describe('Admin Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateAdmin', () => {
    it('должен вернуть 401 если JWT невалиден', async () => {
      mockAuthenticateRequest.mockResolvedValue({ error: 'Invalid token' });

      const result = await authenticateAdmin(makeRequest());

      expect(isAdminError(result)).toBe(true);
      if (isAdminError(result)) {
        expect(result.status).toBe(401);
      }
    });

    it('должен вернуть 403 если пользователь не админ', async () => {
      mockAuthenticateRequest.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.c' } });
      mockUserFindUnique.mockResolvedValue({ isAdmin: false });

      const result = await authenticateAdmin(makeRequest());

      expect(isAdminError(result)).toBe(true);
      if (isAdminError(result)) {
        expect(result.status).toBe(403);
        expect(result.error).toBe('Доступ запрещён');
      }
    });

    it('должен вернуть 403 если пользователь не найден в БД', async () => {
      mockAuthenticateRequest.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.c' } });
      mockUserFindUnique.mockResolvedValue(null);

      const result = await authenticateAdmin(makeRequest());

      expect(isAdminError(result)).toBe(true);
      if (isAdminError(result)) {
        expect(result.status).toBe(403);
      }
    });

    it('должен вернуть user если JWT валиден и isAdmin=true', async () => {
      mockAuthenticateRequest.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@test.com' } });
      mockUserFindUnique.mockResolvedValue({ isAdmin: true });

      const result = await authenticateAdmin(makeRequest());

      expect(isAdminError(result)).toBe(false);
      if (!isAdminError(result)) {
        expect(result.user.id).toBe('admin-1');
        expect(result.user.email).toBe('admin@test.com');
      }
    });
  });

  describe('isAdminError', () => {
    it('должен вернуть true для ошибки', () => {
      expect(isAdminError({ error: 'test', status: 401 })).toBe(true);
    });

    it('должен вернуть false для успеха', () => {
      expect(isAdminError({ user: { id: '1', email: 'a@b.c' } })).toBe(false);
    });
  });

  describe('adminErrorResponse', () => {
    it('должен вернуть UNAUTHORIZED для 401', () => {
      const response = adminErrorResponse({ error: 'No token', status: 401 });
      expect(response.status).toBe(401);
    });

    it('должен вернуть FORBIDDEN для 403', () => {
      const response = adminErrorResponse({ error: 'Not admin', status: 403 });
      expect(response.status).toBe(403);
    });
  });
});
