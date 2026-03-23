/**
 * Unit тесты для Club API Routes
 *
 * Тестируемые эндпоинты:
 * - POST /api/clubs — создание клуба
 * - GET /api/clubs/[id] — получение клуба
 * - PATCH /api/clubs/[id] — обновление клуба
 * - POST /api/clubs/join — вступление по инвайту
 * - POST /api/clubs/[id]/leave — выход из клуба
 * - POST /api/clubs/[id]/invite — создание инвайта
 * - GET /api/clubs/[id]/members — список участников
 * - PATCH/DELETE /api/clubs/[id]/members/[userId] — роли, удаление
 * - GET /api/clubs/[id]/leaderboard — лидерборды
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Мок auth
vi.mock('@/lib/auth/middleware', () => ({
  authenticateRequest: vi.fn(),
}));

// Мок rate limiter
vi.mock('@/lib/auth/rate-limiter', () => ({
  rateLimit: vi.fn().mockResolvedValue(false),
  RATE_LIMIT_CONFIGS: { api: { limit: 100, windowMs: 60000 } },
}));

// Мок ClubService
const mockClubService = {
  createClub: vi.fn(),
  getClubById: vi.fn(),
  updateClub: vi.fn(),
  joinByInvite: vi.fn(),
  leaveClub: vi.fn(),
  createInvite: vi.fn(),
  getMembers: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  getWodLeaderboard: vi.fn(),
  getGeneralLeaderboard: vi.fn(),
  getSkillLeaderboard: vi.fn(),
  updateLeaderboardVisibility: vi.fn(),
};

vi.mock('@/lib/services/club.service', () => ({
  ClubService: class MockClubService {
    createClub = mockClubService.createClub;
    getClubById = mockClubService.getClubById;
    updateClub = mockClubService.updateClub;
    joinByInvite = mockClubService.joinByInvite;
    leaveClub = mockClubService.leaveClub;
    createInvite = mockClubService.createInvite;
    getMembers = mockClubService.getMembers;
    updateMemberRole = mockClubService.updateMemberRole;
    removeMember = mockClubService.removeMember;
    getWodLeaderboard = mockClubService.getWodLeaderboard;
    getGeneralLeaderboard = mockClubService.getGeneralLeaderboard;
    getSkillLeaderboard = mockClubService.getSkillLeaderboard;
    updateLeaderboardVisibility = mockClubService.updateLeaderboardVisibility;
  },
}));

import { authenticateRequest } from '@/lib/auth/middleware';
import { rateLimit } from '@/lib/auth/rate-limiter';

const mockAuth = authenticateRequest as any;
const mockRateLimit = rateLimit as any;

function makeRequest(url: string, method: string, body?: any): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
  return req;
}

const mockUser = { id: 'user-1', email: 'test@test.com' };
const mockClub = { id: 'club-1', name: 'Test Club', slug: 'test-club', memberCount: 1, myRole: 'OWNER' };

describe('Club API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: mockUser });
    mockRateLimit.mockResolvedValue(false);
  });

  // === POST /api/clubs ===
  describe('POST /api/clubs', () => {
    let POST: any;

    beforeEach(async () => {
      ({ POST } = await import('../../clubs/route'));
    });

    it('должен создать клуб (201)', async () => {
      mockClubService.createClub.mockResolvedValue(mockClub);

      const req = makeRequest('/api/clubs', 'POST', { name: 'Test Club' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.club.name).toBe('Test Club');
    });

    it('должен вернуть 401 без аутентификации', async () => {
      mockAuth.mockResolvedValue({ error: 'No token' });

      const req = makeRequest('/api/clubs', 'POST', { name: 'Test' });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it('должен вернуть 400 при коротком имени', async () => {
      const req = makeRequest('/api/clubs', 'POST', { name: 'X' });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('должен вернуть 429 при rate limit', async () => {
      mockRateLimit.mockResolvedValue(true);

      const req = makeRequest('/api/clubs', 'POST', { name: 'Test Club' });
      const res = await POST(req);

      expect(res.status).toBe(429);
    });
  });

  // === POST /api/clubs/join ===
  describe('POST /api/clubs/join', () => {
    let POST: any;

    beforeEach(async () => {
      ({ POST } = await import('../../clubs/join/route'));
    });

    it('должен вступить в клуб по коду', async () => {
      mockClubService.joinByInvite.mockResolvedValue(mockClub);

      const req = makeRequest('/api/clubs/join', 'POST', { code: 'ABCD1234' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.club).toBeDefined();
    });

    it('должен вернуть 404 для невалидного кода', async () => {
      mockClubService.joinByInvite.mockRejectedValue(new Error('INVALID_INVITE'));

      const req = makeRequest('/api/clubs/join', 'POST', { code: 'BADCODE' });
      const res = await POST(req);

      expect(res.status).toBe(404);
    });

    it('должен вернуть 410 для истёкшего кода', async () => {
      mockClubService.joinByInvite.mockRejectedValue(new Error('INVITE_EXPIRED'));

      const req = makeRequest('/api/clubs/join', 'POST', { code: 'EXPIRED' });
      const res = await POST(req);

      expect(res.status).toBe(410);
    });

    it('должен вернуть 410 для исчерпанного кода', async () => {
      mockClubService.joinByInvite.mockRejectedValue(new Error('INVITE_EXHAUSTED'));

      const req = makeRequest('/api/clubs/join', 'POST', { code: 'MAXED' });
      const res = await POST(req);

      expect(res.status).toBe(410);
    });

    it('должен вернуть 409 для повторного вступления', async () => {
      mockClubService.joinByInvite.mockRejectedValue(new Error('ALREADY_MEMBER'));

      const req = makeRequest('/api/clubs/join', 'POST', { code: 'DUP' });
      const res = await POST(req);

      expect(res.status).toBe(409);
    });
  });

  // === GET /api/clubs/[id] ===
  describe('GET /api/clubs/[id]', () => {
    let GET: any;

    beforeEach(async () => {
      ({ GET } = await import('../../clubs/[id]/route'));
    });

    it('должен вернуть клуб', async () => {
      mockClubService.getClubById.mockResolvedValue(mockClub);

      const req = makeRequest('/api/clubs/club-1', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'club-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.club.name).toBe('Test Club');
    });

    it('должен вернуть 404 если клуб не найден', async () => {
      mockClubService.getClubById.mockResolvedValue(null);

      const req = makeRequest('/api/clubs/nonexistent', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });
  });

  // === PATCH /api/clubs/[id] ===
  describe('PATCH /api/clubs/[id]', () => {
    let PATCH: any;

    beforeEach(async () => {
      ({ PATCH } = await import('../../clubs/[id]/route'));
    });

    it('должен обновить клуб', async () => {
      mockClubService.updateClub.mockResolvedValue({ ...mockClub, name: 'Updated' });

      const req = makeRequest('/api/clubs/club-1', 'PATCH', { name: 'Updated' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(200);
    });

    it('должен вернуть 403 для ATHLETE', async () => {
      mockClubService.updateClub.mockRejectedValue(new Error('INSUFFICIENT_ROLE'));

      const req = makeRequest('/api/clubs/club-1', 'PATCH', { name: 'Valid Name' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(403);
    });

    it('должен вернуть 403 для не-участника', async () => {
      mockClubService.updateClub.mockRejectedValue(new Error('NOT_MEMBER'));

      const req = makeRequest('/api/clubs/club-1', 'PATCH', { name: 'Valid Name' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(403);
    });
  });

  // === POST /api/clubs/[id]/leave ===
  describe('POST /api/clubs/[id]/leave', () => {
    let POST: any;

    beforeEach(async () => {
      ({ POST } = await import('../../clubs/[id]/leave/route'));
    });

    it('должен выйти из клуба', async () => {
      mockClubService.leaveClub.mockResolvedValue(undefined);

      const req = makeRequest('/api/clubs/club-1/leave', 'POST');
      const res = await POST(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(200);
    });

    it('должен вернуть 409 для последнего OWNER', async () => {
      mockClubService.leaveClub.mockRejectedValue(new Error('LAST_OWNER'));

      const req = makeRequest('/api/clubs/club-1/leave', 'POST');
      const res = await POST(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(409);
    });

    it('должен вернуть 404 для не-участника', async () => {
      mockClubService.leaveClub.mockRejectedValue(new Error('NOT_MEMBER'));

      const req = makeRequest('/api/clubs/club-1/leave', 'POST');
      const res = await POST(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(404);
    });
  });

  // === POST /api/clubs/[id]/invite ===
  describe('POST /api/clubs/[id]/invite', () => {
    let POST: any;

    beforeEach(async () => {
      ({ POST } = await import('../../clubs/[id]/invite/route'));
    });

    it('должен создать инвайт (201)', async () => {
      mockClubService.createInvite.mockResolvedValue({ code: 'ABCD1234', expiresAt: null });

      const req = makeRequest('/api/clubs/club-1/invite', 'POST', {});
      const res = await POST(req, { params: Promise.resolve({ id: 'club-1' }) });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.invite.code).toBe('ABCD1234');
    });

    it('должен вернуть 403 для недостаточных прав', async () => {
      mockClubService.createInvite.mockRejectedValue(new Error('INSUFFICIENT_ROLE'));

      const req = makeRequest('/api/clubs/club-1/invite', 'POST', {});
      const res = await POST(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(403);
    });
  });

  // === GET /api/clubs/[id]/members ===
  describe('GET /api/clubs/[id]/members', () => {
    let GET: any;

    beforeEach(async () => {
      ({ GET } = await import('../../clubs/[id]/members/route'));
    });

    it('должен вернуть список участников', async () => {
      mockClubService.getMembers.mockResolvedValue([
        { userId: 'u1', email: 'a@b.c', firstName: 'Ivan', lastName: null, role: 'OWNER', showInLeaderboard: true, joinedAt: '2024-01-01' },
      ]);

      const req = makeRequest('/api/clubs/club-1/members', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'club-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.members).toHaveLength(1);
    });
  });

  // === PATCH /api/clubs/[id]/members/[userId] ===
  describe('PATCH /api/clubs/[id]/members/[userId]', () => {
    let PATCH: any;

    beforeEach(async () => {
      ({ PATCH } = await import('../../clubs/[id]/members/[userId]/route'));
    });

    it('должен обновить роль участника', async () => {
      mockClubService.updateMemberRole.mockResolvedValue(undefined);

      const req = makeRequest('/api/clubs/club-1/members/user-2', 'PATCH', { role: 'COACH' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'club-1', userId: 'user-2' }) });

      expect(res.status).toBe(200);
    });

    it('должен вернуть 403 при смене собственной роли', async () => {
      mockClubService.updateMemberRole.mockRejectedValue(new Error('CANNOT_CHANGE_OWN_ROLE'));

      const req = makeRequest('/api/clubs/club-1/members/user-1', 'PATCH', { role: 'ATHLETE' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'club-1', userId: 'user-1' }) });

      expect(res.status).toBe(403);
    });

    it('должен вернуть 400 для невалидной роли', async () => {
      const req = makeRequest('/api/clubs/club-1/members/user-2', 'PATCH', { role: 'SUPERADMIN' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'club-1', userId: 'user-2' }) });

      expect(res.status).toBe(400);
    });
  });

  // === DELETE /api/clubs/[id]/members/[userId] ===
  describe('DELETE /api/clubs/[id]/members/[userId]', () => {
    let DELETE: any;

    beforeEach(async () => {
      ({ DELETE } = await import('../../clubs/[id]/members/[userId]/route'));
    });

    it('должен удалить участника', async () => {
      mockClubService.removeMember.mockResolvedValue(undefined);

      const req = makeRequest('/api/clubs/club-1/members/user-2', 'DELETE');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'club-1', userId: 'user-2' }) });

      expect(res.status).toBe(200);
    });

    it('должен вернуть 403 при удалении себя', async () => {
      mockClubService.removeMember.mockRejectedValue(new Error('CANNOT_REMOVE_SELF'));

      const req = makeRequest('/api/clubs/club-1/members/user-1', 'DELETE');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'club-1', userId: 'user-1' }) });

      expect(res.status).toBe(403);
    });
  });

  // === GET /api/clubs/[id]/leaderboard ===
  describe('GET /api/clubs/[id]/leaderboard', () => {
    let GET: any;

    beforeEach(async () => {
      ({ GET } = await import('../../clubs/[id]/leaderboard/route'));
    });

    it('должен вернуть monthly лидерборд по умолчанию', async () => {
      mockClubService.getGeneralLeaderboard.mockResolvedValue([]);

      const req = makeRequest('/api/clubs/club-1/leaderboard', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'club-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.type).toBe('monthly');
    });

    it('должен вернуть WOD лидерборд', async () => {
      mockClubService.getWodLeaderboard.mockResolvedValue([]);

      const req = makeRequest('/api/clubs/club-1/leaderboard?type=wod&date=2024-03-01', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'club-1' }) });
      const data = await res.json();

      expect(data.type).toBe('wod');
      expect(data.date).toBe('2024-03-01');
    });

    it('должен вернуть skill лидерборд', async () => {
      mockClubService.getSkillLeaderboard.mockResolvedValue([]);

      const req = makeRequest('/api/clubs/club-1/leaderboard?type=skill', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'club-1' }) });
      const data = await res.json();

      expect(data.type).toBe('skill');
    });

    it('должен вернуть all-time лидерборд', async () => {
      mockClubService.getGeneralLeaderboard.mockResolvedValue([]);

      const req = makeRequest('/api/clubs/club-1/leaderboard?type=all', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'club-1' }) });
      const data = await res.json();

      expect(data.type).toBe('all');
    });

    it('должен вернуть 401 без аутентификации', async () => {
      mockAuth.mockResolvedValue({ error: 'No token' });

      const req = makeRequest('/api/clubs/club-1/leaderboard', 'GET');
      const res = await GET(req, { params: Promise.resolve({ id: 'club-1' }) });

      expect(res.status).toBe(401);
    });
  });
});
