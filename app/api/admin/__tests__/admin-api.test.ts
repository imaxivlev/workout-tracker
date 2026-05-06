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
const mockClubMember = { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() };

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    user = mockUser;
    club = mockClubModel;
    workout = mockWorkoutModel;
    exerciseDict = mockExerciseDict;
    userConsent = mockUserConsent;
    clubMember = mockClubMember;
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

    it('должен добавить пользователя в клуб (addToClub)', async () => {
      const { PATCH } = await import('../users/[id]/route');
      mockClubMember.findFirst.mockResolvedValue(null);
      mockClubMember.create.mockResolvedValue({});

      const res = await PATCH(
        makeRequest('/api/admin/users/u1', 'PATCH', { addToClub: { clubId: 'c1', role: 'ATHLETE' } }),
        { params: Promise.resolve({ id: 'u1' }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe('Пользователь добавлен в клуб');
    });

    it('должен вернуть 409 если пользователь уже в клубе', async () => {
      const { PATCH } = await import('../users/[id]/route');
      mockClubMember.findFirst.mockResolvedValue({ id: 'cm1' });

      const res = await PATCH(
        makeRequest('/api/admin/users/u1', 'PATCH', { addToClub: { clubId: 'c1', role: 'ATHLETE' } }),
        { params: Promise.resolve({ id: 'u1' }) }
      );

      expect(res.status).toBe(409);
    });

    it('должен вернуть 400 для addToClub с невалидной ролью', async () => {
      const { PATCH } = await import('../users/[id]/route');

      const res = await PATCH(
        makeRequest('/api/admin/users/u1', 'PATCH', { addToClub: { clubId: 'c1', role: 'SUPERUSER' } }),
        { params: Promise.resolve({ id: 'u1' }) }
      );

      expect(res.status).toBe(400);
    });

    it('должен обновить роль пользователя в клубе (updateRoleInClub)', async () => {
      const { PATCH } = await import('../users/[id]/route');
      mockClubMember.updateMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(
        makeRequest('/api/admin/users/u1', 'PATCH', { updateRoleInClub: { clubId: 'c1', role: 'COACH' } }),
        { params: Promise.resolve({ id: 'u1' }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe('Роль обновлена');
      expect(mockClubMember.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', clubId: 'c1' },
        data: { role: 'COACH' },
      });
    });

    it('должен вернуть 400 для updateRoleInClub с невалидной ролью', async () => {
      const { PATCH } = await import('../users/[id]/route');

      const res = await PATCH(
        makeRequest('/api/admin/users/u1', 'PATCH', { updateRoleInClub: { clubId: 'c1', role: 'INVALID' } }),
        { params: Promise.resolve({ id: 'u1' }) }
      );

      expect(res.status).toBe(400);
    });

    it('должен удалить пользователя из клуба (removeFromClub)', async () => {
      const { PATCH } = await import('../users/[id]/route');
      mockClubMember.deleteMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(
        makeRequest('/api/admin/users/u1', 'PATCH', { removeFromClub: { clubId: 'c1' } }),
        { params: Promise.resolve({ id: 'u1' }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe('Пользователь удалён из клуба');
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

  // === GET /api/admin/exercises ===
  describe('GET /api/admin/exercises', () => {
    it('должен вернуть список упражнений с полями hasWeight и measureUnit', async () => {
      const { GET } = await import('../exercises/route');

      mockExerciseDict.findMany.mockResolvedValue([
        { id: 'e1', name: 'Приседания', isGlobal: true, hasWeight: true, measureUnit: 'reps', createdAt: new Date(), user: null },
        { id: 'e2', name: 'Бег', isGlobal: true, hasWeight: false, measureUnit: 'meters', createdAt: new Date(), user: null },
      ]);
      mockExerciseDict.count.mockResolvedValue(2);

      const res = await GET(makeRequest('/api/admin/exercises'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.exercises).toHaveLength(2);
      expect(data.exercises[0].hasWeight).toBe(true);
      expect(data.exercises[1].measureUnit).toBe('meters');
      expect(data.pagination.total).toBe(2);
    });

    it('должен поддерживать фильтр по global', async () => {
      const { GET } = await import('../exercises/route');

      mockExerciseDict.findMany.mockResolvedValue([]);
      mockExerciseDict.count.mockResolvedValue(0);

      const res = await GET(makeRequest('/api/admin/exercises?filter=global&search=бег'));
      expect(res.status).toBe(200);

      const findCall = mockExerciseDict.findMany.mock.calls[0][0];
      expect(findCall.where.isGlobal).toBe(true);
      expect(findCall.where.name).toEqual({ contains: 'бег' });
    });

    it('должен вернуть 403 для не-админа', async () => {
      const { GET } = await import('../exercises/route');
      mockAuthenticateAdmin.mockResolvedValue({ error: 'Доступ запрещён', status: 403 });

      const res = await GET(makeRequest('/api/admin/exercises'));
      expect(res.status).toBe(403);
    });
  });

  // === POST /api/admin/exercises ===
  describe('POST /api/admin/exercises', () => {
    it('должен создать упражнение с дефолтными hasWeight=true, measureUnit=reps', async () => {
      const { POST } = await import('../exercises/route');

      mockExerciseDict.create.mockResolvedValue({
        id: 'e1', name: 'Новое', isGlobal: true, hasWeight: true, measureUnit: 'reps', createdAt: new Date(),
      });

      const res = await POST(makeRequest('/api/admin/exercises', 'POST', { name: 'Новое' }));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.exercise.name).toBe('Новое');
      const createCall = mockExerciseDict.create.mock.calls[0][0];
      expect(createCall.data.hasWeight).toBe(true);
      expect(createCall.data.measureUnit).toBe('reps');
    });

    it('должен создать упражнение с явными hasWeight и measureUnit', async () => {
      const { POST } = await import('../exercises/route');

      mockExerciseDict.create.mockResolvedValue({
        id: 'e2', name: 'Бег', isGlobal: true, hasWeight: false, measureUnit: 'meters', createdAt: new Date(),
      });

      const res = await POST(makeRequest('/api/admin/exercises', 'POST', { name: 'Бег', hasWeight: false, measureUnit: 'meters' }));
      const data = await res.json();

      expect(res.status).toBe(201);
      const createCall = mockExerciseDict.create.mock.calls[0][0];
      expect(createCall.data.hasWeight).toBe(false);
      expect(createCall.data.measureUnit).toBe('meters');
    });

    it('должен вернуть 400 при пустом названии', async () => {
      const { POST } = await import('../exercises/route');

      const res = await POST(makeRequest('/api/admin/exercises', 'POST', { name: '  ' }));
      expect(res.status).toBe(400);
    });

    it('должен вернуть 400 при отсутствии названия', async () => {
      const { POST } = await import('../exercises/route');

      const res = await POST(makeRequest('/api/admin/exercises', 'POST', {}));
      expect(res.status).toBe(400);
    });
  });

  // === PATCH /api/admin/exercises/[id] ===
  describe('PATCH /api/admin/exercises/[id]', () => {
    it('должен обновить название упражнения', async () => {
      const { PATCH } = await import('../exercises/[id]/route');

      mockExerciseDict.update.mockResolvedValue({
        id: 'e1', name: 'Обновлённое', isGlobal: true, hasWeight: true, measureUnit: 'reps',
      });

      const res = await PATCH(
        makeRequest('/api/admin/exercises/e1', 'PATCH', { name: 'Обновлённое' }),
        { params: Promise.resolve({ id: 'e1' }) }
      );

      expect(res.status).toBe(200);
      const updateCall = mockExerciseDict.update.mock.calls[0][0];
      expect(updateCall.data.name).toBe('Обновлённое');
    });

    it('должен обновить hasWeight и measureUnit', async () => {
      const { PATCH } = await import('../exercises/[id]/route');

      mockExerciseDict.update.mockResolvedValue({
        id: 'e1', name: 'Бег', isGlobal: true, hasWeight: false, measureUnit: 'meters',
      });

      const res = await PATCH(
        makeRequest('/api/admin/exercises/e1', 'PATCH', { hasWeight: false, measureUnit: 'meters' }),
        { params: Promise.resolve({ id: 'e1' }) }
      );

      expect(res.status).toBe(200);
      const updateCall = mockExerciseDict.update.mock.calls[0][0];
      expect(updateCall.data.hasWeight).toBe(false);
      expect(updateCall.data.measureUnit).toBe('meters');
    });

    it('должен игнорировать undefined поля', async () => {
      const { PATCH } = await import('../exercises/[id]/route');

      mockExerciseDict.update.mockResolvedValue({ id: 'e1', name: 'Бег' });

      await PATCH(
        makeRequest('/api/admin/exercises/e1', 'PATCH', { isGlobal: false }),
        { params: Promise.resolve({ id: 'e1' }) }
      );

      const updateCall = mockExerciseDict.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('name');
      expect(updateCall.data).not.toHaveProperty('hasWeight');
      expect(updateCall.data.isGlobal).toBe(false);
    });
  });

  // === DELETE /api/admin/exercises/[id] ===
  describe('DELETE /api/admin/exercises/[id]', () => {
    it('должен удалить упражнение', async () => {
      const { DELETE } = await import('../exercises/[id]/route');
      mockExerciseDict.delete.mockResolvedValue({});

      const res = await DELETE(
        makeRequest('/api/admin/exercises/e1', 'DELETE'),
        { params: Promise.resolve({ id: 'e1' }) }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe('Упражнение удалено');
    });

    it('должен вернуть 403 для не-админа', async () => {
      const { DELETE } = await import('../exercises/[id]/route');
      mockAuthenticateAdmin.mockResolvedValue({ error: 'Доступ запрещён', status: 403 });

      const res = await DELETE(
        makeRequest('/api/admin/exercises/e1', 'DELETE'),
        { params: Promise.resolve({ id: 'e1' }) }
      );

      expect(res.status).toBe(403);
    });
  });
});
