/**
 * Тесты для GET /api/clubs/[id]/workouts/dates
 * Возвращает даты клубных шаблонов с типами (skill/wod) для пометки в календаре
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/middleware', () => ({
  authenticateRequest: vi.fn(),
}));

const mockWorkout = { findMany: vi.fn() };

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    workout = mockWorkout;
  },
}));

import { authenticateRequest } from '@/lib/auth/middleware';
const mockAuth = authenticateRequest as ReturnType<typeof vi.fn>;

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method: 'GET' });
}

const mockUser = { id: 'user-1', email: 'test@test.com' };

describe('GET /api/clubs/[id]/workouts/dates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: mockUser });
  });

  it('должен вернуть 401 без аутентификации', async () => {
    const { GET } = await import('../route');
    mockAuth.mockResolvedValue({ error: 'No token' });

    const res = await GET(makeRequest('/api/clubs/club-1/workouts/dates'), { params: Promise.resolve({ id: 'club-1' }) });

    expect(res.status).toBe(401);
  });

  it('должен вернуть пустой объект если нет шаблонов', async () => {
    const { GET } = await import('../route');
    mockWorkout.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest('/api/clubs/club-1/workouts/dates'), { params: Promise.resolve({ id: 'club-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dates).toEqual({});
  });

  it('должен агрегировать даты с типами skill/wod', async () => {
    const { GET } = await import('../route');

    // Первый findMany — шаблоны текущего пользователя
    mockWorkout.findMany
      .mockResolvedValueOnce([
        { date: '2024-03-01', skillBlocks: [{ id: 's1' }], wodBlocks: [] },
        { date: '2024-03-05', skillBlocks: [], wodBlocks: [{ id: 'w1' }] },
      ])
      // Второй findMany — шаблоны других участников клуба
      .mockResolvedValueOnce([
        { date: '2024-03-01', skillBlocks: [], wodBlocks: [{ id: 'w2' }] },
      ]);

    const res = await GET(makeRequest('/api/clubs/club-1/workouts/dates'), { params: Promise.resolve({ id: 'club-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    // 2024-03-01 должна иметь и skill и wod (объединение из двух запросов)
    expect(data.dates['2024-03-01']).toEqual({ hasSkill: true, hasWod: true });
    // 2024-03-05 только wod
    expect(data.dates['2024-03-05']).toEqual({ hasSkill: false, hasWod: true });
  });

  it('должен корректно помечать только skill', async () => {
    const { GET } = await import('../route');

    mockWorkout.findMany
      .mockResolvedValueOnce([
        { date: '2024-04-10', skillBlocks: [{ id: 's1' }], wodBlocks: [] },
      ])
      .mockResolvedValueOnce([]);

    const res = await GET(makeRequest('/api/clubs/club-1/workouts/dates'), { params: Promise.resolve({ id: 'club-1' }) });
    const data = await res.json();

    expect(data.dates['2024-04-10']).toEqual({ hasSkill: true, hasWod: false });
  });

  it('должен вернуть 500 при ошибке БД', async () => {
    const { GET } = await import('../route');
    mockWorkout.findMany.mockRejectedValue(new Error('DB connection failed'));

    const res = await GET(makeRequest('/api/clubs/club-1/workouts/dates'), { params: Promise.resolve({ id: 'club-1' }) });

    expect(res.status).toBe(500);
  });
});
