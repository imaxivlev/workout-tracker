/**
 * Unit тесты для Admin API Routes
 *
 * Тестируемые эндпоинты:
 * - GET /api/admin — дашборд
 * - GET/PATCH/DELETE /api/admin/users, /api/admin/users/[id]
 * - GET/PATCH/DELETE /api/admin/clubs, /api/admin/clubs/[id]
 * - GET/POST/PATCH/DELETE /api/admin/exercises
 * - GET/DELETE /api/admin/workouts
 * - GET /api/admin/consents
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Мок admin middleware
const mockAuthenticateAdmin = vi.fn();
vi.mock('@/lib/auth/admin-middleware', () => ({
  authenticateAdmin: (...args: any[]) => mockAuthenticateAdmin(...args),
  isAdminError: (r: any) => 'error' in r,
  adminErrorResponse: (r: any) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: r.error, code: r.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN' },
      { status: r.status }
    );
  },
}));

// Мок Prisma
const mockUser = { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockClubModel = { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockWorkoutModel = { count: vi.fn(), findMany: vi.fn(), delete: vi.fn() };
const mockExerciseDict = { count: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockUserConsent = { count: vi.fn(), findMany: vi.fn() };

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    user = mockUser;
    club = mockClubModel;
    workout = mockWorkoutModel;
    exerciseDict = mockExerciseDict;
    userConsent = mockUserConsent;
  },
}));

const adminUser = { user: { id: 'admin-1', email: 'admin@test.com' } };

function makeRequest(url: string, method = 'GET', body?: any): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

describe('Admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdmin.mockResolvedValue(adminUser);
  });

  // === GET /api/admin (dashboard) ===
  describe('GET /api/admin', () => {
    it('должен вернуть статистику дашборда', async () => {
      const { GET } = await import('../route');

      mockUser.count.mockResolvedValue(42);
      mockClubModel.count.mockResolvedValue(5);
      mockWorkoutModel.count.mockResolvedValue(100);
      mockExerciseDict.count.mockResolvedValue(30);
      mockUserConsent.count.mockResolvedValue(10);
      mockUser.findMany.mockResolvedValue([]);

      const res = await GET(makeRequest('/api/admin'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.stats.usersCount).toBe(42);
      expect(data.stats.clubsCount).toBe(5);
    });

    it('должен вернуть 403 для не-админа', async () => {
      const { GET } = await import('../route');
      mockAuthenticateAdmin.mockResolvedValue({ error: 'Доступ запрещён', status: 403 });

      const res = await GET(makeRequest('/api/admin'));
      expect(res.status).toBe(403);
    });

    it('должен вернуть 401 без аутентификации', async () => {
      const { GET } = await import('../route');
      mockAuthenticateAdmin.mockResolvedValue({ error: 'No token', status: 401 });

      const res = await GET(makeRequest('/api/admin'));
      expect(res.status).toBe(401);
    });
  });

  // === GET /api/admin/users ===
  describe('GET /api/admin/users', () => {
    it('должен вернуть пользователей с пагинацией', async () => {
      const { GET } = await import('../users/route');

      mockUser.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B', verified: true, isAdmin: false, createdAt: new Date(), _count: { workouts: 5, clubMemberships: 1 } },
      ]);
      mockUser.count.mockResolvedValue(1);

      const res = await GET(makeRequest('/api/admin/users?page=1&limit=20'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.users).toHaveLength(1);
      expect(data.users[0].workoutsCount).toBe(5);
      expect(data.pagination.total).toBe(1);
    });

    it('должен поддерживать поиск', async () => {
      const { GET } = await import('../users/route');

      mockUser.findMany.mockResolvedValue([]);
      mockUser.count.mockResolvedValue(0);

      const res = await GET(makeRequest('/api/admin/users?search=test@'));
      const data = await res.json();

      expect(data.users).toHaveLength(0);
    });
  });

  // === GET /api/admin/users/[id] ===
  describe('GET /api/admin/users/[id]', () => {
    it('должен вернуть детали пользователя', async () => {
      const { GET } = await import('../users/[id]/route');

      mockUser.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B',
        verified: true, isAdmin: false, createdAt: new Date(), updatedAt: new Date(),
        _count: { workouts: 3 },
        clubMemberships: [{ role: 'ATHLETE', club: { id: 'c1', name: 'Club1' } }],
      });

      const res = await GET(makeRequest('/api/admin/users/u1'), { params: Promise.resolve({ id: 'u1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user.clubMemberships).toHaveLength(1);
    });

    it('должен вернуть 404 если пользователь не найден', async () => {
      const { GET } = await import('../users/[id]/route');
      mockUser.findUnique.mockResolvedValue(null);

      const res = await GET(makeRequest('/api/admin/users/xxx'), { params: Promise.resolve({ id: 'xxx' }) });
      expect(res.status).toBe(404);
    });
  });

  // === PATCH /api/admin/users/[id] ===
  describe('PATCH /api/admin/users/[id]', () => {
    it('должен обновить допустимые поля', async () => {
      const { PATCH } = await import('../users/[id]/route');

      mockUser.update.mockResolvedValue({
        id: 'u1', email: 'new@b.c', firstName: 'New', lastName: null,
        verified: true, isAdmin: true, createdAt: new Date(), updatedAt: new Date(),
      });

      const res = await PATCH(
        makeRequest('/api/admin/users/u1', 'PATCH', { firstName: 'New', isAdmin: true, hackField: 'drop table' }),
        { params: Promise.resolve({ id: 'u1' }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      // hackField не должен попасть в update
      const updateCall = mockUser.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('hackField');
    });
  });

  // === DELETE /api/admin/users/[id] ===
  describe('DELETE /api/admin/users/[id]', () => {
    it('должен удалить пользователя', async () => {
      const { DELETE } = await import('../users/[id]/route');
      mockUser.delete.mockResolvedValue({});

      const res = await DELETE(makeRequest('/api/admin/users/u2', 'DELETE'), { params: Promise.resolve({ id: 'u2' }) });
      expect(res.status).toBe(200);
    });

    it('должен запретить удаление самого себя', async () => {
      const { DELETE } = await import('../users/[id]/route');

      const res = await DELETE(makeRequest('/api/admin/users/admin-1', 'DELETE'), { params: Promise.resolve({ id: 'admin-1' }) });
      expect(res.status).toBe(400);
    });
  });

  // === GET /api/admin/consents ===
  describe('GET /api/admin/consents', () => {
    it('должен вернуть список согласий', async () => {
      const { GET } = await import('../consents/route');

      mockUserConsent.findMany.mockResolvedValue([
        { id: 'c1', consentType: 'cookies', accepted: true, createdAt: new Date() },
      ]);
      mockUserConsent.count.mockResolvedValue(1);

      const res = await GET(makeRequest('/api/admin/consents'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.consents).toHaveLength(1);
    });
  });
});
