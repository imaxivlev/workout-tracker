/**
 * Unit тесты для ClubService
 *
 * Тестируемые модули:
 * - Создание/обновление клубов
 * - Генерация инвайт-кодов, вступление/выход
 * - Роли (OWNER, COACH, ATHLETE), ограничения
 * - Лидерборды (WOD, monthly/all, skill)
 * - Приватные методы (slug, invite code, displayName, signature)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClubRole } from '@prisma/client';

// --- Мок Prisma ---

const { mockClub, mockClubMember, mockClubInvite, mockWorkout, mockSkillSet, mockTransaction } = vi.hoisted(() => ({
  mockClub: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockClubMember: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  mockClubInvite: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockWorkout: { findMany: vi.fn() },
  mockSkillSet: { findMany: vi.fn() },
  mockTransaction: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    club = mockClub;
    clubMember = mockClubMember;
    clubInvite = mockClubInvite;
    workout = mockWorkout;
    skillSet = mockSkillSet;
    $transaction = mockTransaction;
  },
  ClubRole: { OWNER: 'OWNER', COACH: 'COACH', ATHLETE: 'ATHLETE' },
}));

import { ClubService } from '../club.service';

describe('ClubService', () => {
  let service: ClubService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClubService();
  });

  // === Создание клуба ===

  describe('createClub', () => {
    it('должен создать клуб и назначить создателя OWNER', async () => {
      const clubData = { id: 'club-1', name: 'Test Club', slug: 'test-club', description: null, city: null, logo: null, createdAt: new Date() };

      mockClub.findUnique.mockResolvedValueOnce(null); // slug свободен
      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          club: { create: vi.fn().mockResolvedValue(clubData) },
          clubMember: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      // Mock loadClubResponse (getClubById внутри)
      mockClub.findUnique.mockResolvedValueOnce({
        ...clubData,
        members: [{ userId: 'user-1', role: 'OWNER', user: { id: 'user-1', email: 'a@b.c', firstName: 'Test', lastName: null } }],
        _count: { members: 1 },
      });

      const result = await service.createClub('user-1', { name: 'Test Club' });

      expect(result.name).toBe('Test Club');
      expect(result.myRole).toBe('OWNER');
      expect(result.memberCount).toBe(1);
    });

    it('должен добавить hex-суффикс к slug при коллизии', async () => {
      // Первый findUnique — slug уже занят
      mockClub.findUnique.mockResolvedValueOnce({ id: 'existing' });

      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          club: { create: vi.fn().mockImplementation((args: any) => {
            expect(args.data.slug).toMatch(/^test-club-[0-9a-f]{6}$/);
            return { id: 'club-2', ...args.data, createdAt: new Date() };
          })},
          clubMember: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      // loadClubResponse
      mockClub.findUnique.mockResolvedValueOnce({
        id: 'club-2', name: 'Test Club', slug: 'test-club-414141', description: null, city: null, logo: null,
        members: [{ userId: 'user-1', role: 'OWNER', user: { id: 'user-1', email: 'a@b.c', firstName: null, lastName: null } }],
        _count: { members: 1 }, createdAt: new Date(),
      });

      const result = await service.createClub('user-1', { name: 'Test Club' });
      expect(result).toBeDefined();
    });
  });

  // === Получение клуба ===

  describe('getClubById', () => {
    it('должен вернуть null если клуб не найден', async () => {
      mockClub.findUnique.mockResolvedValue(null);
      const result = await service.getClubById('nonexistent');
      expect(result).toBeNull();
    });

    it('должен вернуть клуб с ролью текущего пользователя', async () => {
      mockClub.findUnique.mockResolvedValue({
        id: 'club-1', name: 'My Club', slug: 'my-club', description: 'desc', city: 'Москва', logo: null,
        members: [
          { userId: 'user-1', role: 'OWNER', user: { id: 'user-1', email: 'a@b.c', firstName: 'A', lastName: 'B' } },
          { userId: 'user-2', role: 'ATHLETE', user: { id: 'user-2', email: 'c@d.e', firstName: 'C', lastName: 'D' } },
        ],
        _count: { members: 2 },
        createdAt: new Date(),
      });

      const result = await service.getClubById('club-1', 'user-2');

      expect(result!.myRole).toBe('ATHLETE');
      expect(result!.memberCount).toBe(2);
      expect(result!.city).toBe('Москва');
    });

    it('должен вернуть myRole null для не-участника', async () => {
      mockClub.findUnique.mockResolvedValue({
        id: 'club-1', name: 'Club', slug: 'club', description: null, city: null, logo: null,
        members: [{ userId: 'user-1', role: 'OWNER', user: { id: 'user-1', email: 'a@b.c', firstName: null, lastName: null } }],
        _count: { members: 1 },
        createdAt: new Date(),
      });

      const result = await service.getClubById('club-1', 'outsider');
      expect(result!.myRole).toBeNull();
    });
  });

  // === Обновление клуба ===

  describe('updateClub', () => {
    it('должен обновить клуб для OWNER', async () => {
      // requireRole
      mockClubMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockClub.update.mockResolvedValue({});

      // loadClubResponse
      mockClub.findUnique.mockResolvedValue({
        id: 'club-1', name: 'Updated', slug: 'club', description: 'new desc', city: null, logo: null,
        members: [{ userId: 'user-1', role: 'OWNER', user: { id: 'user-1', email: 'a@b.c', firstName: null, lastName: null } }],
        _count: { members: 1 }, createdAt: new Date(),
      });

      const result = await service.updateClub('club-1', 'user-1', { name: 'Updated', description: 'new desc' });
      expect(result.name).toBe('Updated');
    });

    it('должен обновить клуб для COACH', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'COACH' });
      mockClub.update.mockResolvedValue({});
      mockClub.findUnique.mockResolvedValue({
        id: 'club-1', name: 'C', slug: 'c', description: null, city: 'Спб', logo: null,
        members: [], _count: { members: 0 }, createdAt: new Date(),
      });

      const result = await service.updateClub('club-1', 'coach-1', { city: 'Спб' });
      expect(result.city).toBe('Спб');
    });

    it('должен отклонить обновление для ATHLETE', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'ATHLETE' });

      await expect(service.updateClub('club-1', 'athlete-1', { name: 'X' }))
        .rejects.toThrow('INSUFFICIENT_ROLE');
    });

    it('должен отклонить обновление для не-участника', async () => {
      mockClubMember.findUnique.mockResolvedValue(null);

      await expect(service.updateClub('club-1', 'stranger', { name: 'X' }))
        .rejects.toThrow('NOT_MEMBER');
    });
  });

  // === Инвайт-коды ===

  describe('createInvite', () => {
    it('должен создать инвайт-код для OWNER', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockClubInvite.create.mockResolvedValue({});

      const result = await service.createInvite('club-1', 'owner-1');

      expect(result.code).toHaveLength(8);
      expect(result.expiresAt).toBeNull();
    });

    it('должен создать инвайт с ограничениями', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'COACH' });
      mockClubInvite.create.mockResolvedValue({});

      const result = await service.createInvite('club-1', 'coach-1', { maxUses: 5, expiresInDays: 7 });

      expect(result.code).toHaveLength(8);
      expect(result.expiresAt).not.toBeNull();
    });

    it('должен отклонить для ATHLETE', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'ATHLETE' });

      await expect(service.createInvite('club-1', 'athlete-1'))
        .rejects.toThrow('INSUFFICIENT_ROLE');
    });
  });

  // === Вступление по инвайту ===

  describe('joinByInvite', () => {
    it('должен вступить в клуб по валидному коду', async () => {
      mockClubInvite.findUnique.mockResolvedValue({
        id: 'inv-1', code: 'ABCD1234', clubId: 'club-1', expiresAt: null, maxUses: null, usedCount: 0,
        club: { id: 'club-1', name: 'Club' },
      });
      mockClubMember.findUnique.mockResolvedValue(null); // не участник
      mockTransaction.mockResolvedValue([]);

      // loadClubResponse
      mockClub.findUnique.mockResolvedValue({
        id: 'club-1', name: 'Club', slug: 'club', description: null, city: null, logo: null,
        members: [{ userId: 'new-user', role: 'ATHLETE', user: { id: 'new-user', email: 'x@y.z', firstName: null, lastName: null } }],
        _count: { members: 2 }, createdAt: new Date(),
      });

      const result = await service.joinByInvite('new-user', 'ABCD1234');
      expect(result.memberCount).toBe(2);
    });

    it('должен отклонить невалидный код', async () => {
      mockClubInvite.findUnique.mockResolvedValue(null);

      await expect(service.joinByInvite('user-1', 'BADCODE'))
        .rejects.toThrow('INVALID_INVITE');
    });

    it('должен отклонить истёкший инвайт', async () => {
      mockClubInvite.findUnique.mockResolvedValue({
        id: 'inv-1', clubId: 'club-1', expiresAt: new Date('2020-01-01'), maxUses: null, usedCount: 0,
        club: {},
      });

      await expect(service.joinByInvite('user-1', 'EXPIRED'))
        .rejects.toThrow('INVITE_EXPIRED');
    });

    it('должен отклонить исчерпанный инвайт', async () => {
      mockClubInvite.findUnique.mockResolvedValue({
        id: 'inv-1', clubId: 'club-1', expiresAt: null, maxUses: 3, usedCount: 3,
        club: {},
      });

      await expect(service.joinByInvite('user-1', 'MAXED'))
        .rejects.toThrow('INVITE_EXHAUSTED');
    });

    it('должен отклонить повторное вступление', async () => {
      mockClubInvite.findUnique.mockResolvedValue({
        id: 'inv-1', clubId: 'club-1', expiresAt: null, maxUses: null, usedCount: 0,
        club: {},
      });
      mockClubMember.findUnique.mockResolvedValue({ id: 'existing-member' });

      await expect(service.joinByInvite('user-1', 'VALID'))
        .rejects.toThrow('ALREADY_MEMBER');
    });
  });

  // === Выход из клуба ===

  describe('leaveClub', () => {
    it('должен позволить ATHLETE выйти', async () => {
      mockClubMember.findUnique.mockResolvedValue({ id: 'mem-1', role: 'ATHLETE' });
      mockClubMember.delete.mockResolvedValue({});

      await service.leaveClub('club-1', 'athlete-1');
      expect(mockClubMember.delete).toHaveBeenCalledWith({ where: { id: 'mem-1' } });
    });

    it('должен позволить OWNER выйти если есть другой OWNER', async () => {
      mockClubMember.findUnique.mockResolvedValue({ id: 'mem-1', role: 'OWNER' });
      mockClubMember.count.mockResolvedValue(1); // ещё один OWNER
      mockClubMember.delete.mockResolvedValue({});

      await service.leaveClub('club-1', 'owner-1');
      expect(mockClubMember.delete).toHaveBeenCalled();
    });

    it('должен запретить последнему OWNER выйти', async () => {
      mockClubMember.findUnique.mockResolvedValue({ id: 'mem-1', role: 'OWNER' });
      mockClubMember.count.mockResolvedValue(0); // нет других owners

      await expect(service.leaveClub('club-1', 'only-owner'))
        .rejects.toThrow('LAST_OWNER');
    });

    it('должен отклонить выход не-участника', async () => {
      mockClubMember.findUnique.mockResolvedValue(null);

      await expect(service.leaveClub('club-1', 'stranger'))
        .rejects.toThrow('NOT_MEMBER');
    });
  });

  // === Управление ролями ===

  describe('updateMemberRole', () => {
    it('должен позволить OWNER менять роль другого участника', async () => {
      // requireRole
      mockClubMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' });
      // target member
      mockClubMember.findUnique.mockResolvedValueOnce({ id: 'mem-2', role: 'ATHLETE' });
      mockClubMember.update.mockResolvedValue({});

      await service.updateMemberRole('club-1', 'owner-1', 'user-2', ClubRole.COACH);
      expect(mockClubMember.update).toHaveBeenCalledWith({
        where: { id: 'mem-2' },
        data: { role: 'COACH' },
      });
    });

    it('должен запретить OWNER менять свою роль', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'OWNER' });

      await expect(service.updateMemberRole('club-1', 'owner-1', 'owner-1', ClubRole.ATHLETE))
        .rejects.toThrow('CANNOT_CHANGE_OWN_ROLE');
    });

    it('должен запретить COACH менять роли', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'COACH' });

      await expect(service.updateMemberRole('club-1', 'coach-1', 'user-2', ClubRole.ATHLETE))
        .rejects.toThrow('INSUFFICIENT_ROLE');
    });

    it('должен отклонить если target не участник', async () => {
      mockClubMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' }); // requireRole
      mockClubMember.findUnique.mockResolvedValueOnce(null); // target not found

      await expect(service.updateMemberRole('club-1', 'owner-1', 'stranger', ClubRole.COACH))
        .rejects.toThrow('NOT_MEMBER');
    });
  });

  // === Удаление участника ===

  describe('removeMember', () => {
    it('должен позволить OWNER удалить участника', async () => {
      mockClubMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' }); // requireRole
      mockClubMember.findUnique.mockResolvedValueOnce({ id: 'mem-2' }); // target
      mockClubMember.delete.mockResolvedValue({});

      await service.removeMember('club-1', 'owner-1', 'user-2');
      expect(mockClubMember.delete).toHaveBeenCalledWith({ where: { id: 'mem-2' } });
    });

    it('должен запретить OWNER удалять самого себя', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'OWNER' });

      await expect(service.removeMember('club-1', 'owner-1', 'owner-1'))
        .rejects.toThrow('CANNOT_REMOVE_SELF');
    });

    it('должен запретить COACH удалять участников', async () => {
      mockClubMember.findUnique.mockResolvedValue({ role: 'COACH' });

      await expect(service.removeMember('club-1', 'coach-1', 'user-2'))
        .rejects.toThrow('INSUFFICIENT_ROLE');
    });
  });

  // === Получение участников ===

  describe('getMembers', () => {
    it('должен вернуть участников с данными', async () => {
      mockClubMember.findMany.mockResolvedValue([
        {
          role: 'OWNER', showInLeaderboard: true, joinedAt: new Date('2024-01-01'),
          user: { id: 'u1', email: 'a@b.c', firstName: 'Ivan', lastName: 'Petrov' },
        },
        {
          role: 'ATHLETE', showInLeaderboard: false, joinedAt: new Date('2024-02-01'),
          user: { id: 'u2', email: 'c@d.e', firstName: null, lastName: null },
        },
      ]);

      const result = await service.getMembers('club-1');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('OWNER');
      expect(result[0].firstName).toBe('Ivan');
      expect(result[1].showInLeaderboard).toBe(false);
    });
  });

  // === Видимость в лидерборде ===

  describe('updateLeaderboardVisibility', () => {
    it('должен обновить флаг видимости', async () => {
      mockClubMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      mockClubMember.update.mockResolvedValue({});

      await service.updateLeaderboardVisibility('club-1', 'user-1', false);

      expect(mockClubMember.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { showInLeaderboard: false },
      });
    });

    it('должен отклонить для не-участника', async () => {
      mockClubMember.findUnique.mockResolvedValue(null);

      await expect(service.updateLeaderboardVisibility('club-1', 'stranger', true))
        .rejects.toThrow('NOT_MEMBER');
    });
  });

  // === WOD Лидерборд ===

  describe('getWodLeaderboard', () => {
    it('должен сортировать RX перед Scaled', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      mockWorkout.findMany.mockResolvedValue([
        {
          userId: 'u1',
          user: { id: 'u1', firstName: 'Scaled', lastName: 'Guy' },
          wodBlocks: [{
            wodType: 'FOR_TIME', level: 'SCALED', resultDisplay: '10:00', resultSeconds: 600, resultTotalReps: null,
            exercises: [{ exercise: { name: 'Thruster' }, reps: 21, weight: 40 }],
          }],
          skillBlocks: [],
        },
        {
          userId: 'u2',
          user: { id: 'u2', firstName: 'RX', lastName: 'Guy' },
          wodBlocks: [{
            wodType: 'FOR_TIME', level: 'RX', resultDisplay: '12:00', resultSeconds: 720, resultTotalReps: null,
            exercises: [{ exercise: { name: 'Thruster' }, reps: 21, weight: 60 }],
          }],
          skillBlocks: [],
        },
      ]);

      const result = await service.getWodLeaderboard('club-1', '2024-03-01');

      expect(result[0].level).toBe('RX');
      expect(result[1].level).toBe('SCALED');
    });

    it('должен сортировать FOR_TIME по возрастанию времени', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      mockWorkout.findMany.mockResolvedValue([
        {
          userId: 'u1',
          user: { id: 'u1', firstName: 'Slow', lastName: null },
          wodBlocks: [{
            wodType: 'FOR_TIME', level: 'RX', resultDisplay: '15:00', resultSeconds: 900, resultTotalReps: null,
            exercises: [],
          }],
          skillBlocks: [],
        },
        {
          userId: 'u2',
          user: { id: 'u2', firstName: 'Fast', lastName: null },
          wodBlocks: [{
            wodType: 'FOR_TIME', level: 'RX', resultDisplay: '10:00', resultSeconds: 600, resultTotalReps: null,
            exercises: [],
          }],
          skillBlocks: [],
        },
      ]);

      const result = await service.getWodLeaderboard('club-1', '2024-03-01');

      expect(result[0].name).toBe('Fast');
      expect(result[1].name).toBe('Slow');
    });

    it('должен сортировать AMRAP по убыванию повторений', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      mockWorkout.findMany.mockResolvedValue([
        {
          userId: 'u1',
          user: { id: 'u1', firstName: 'Less', lastName: null },
          wodBlocks: [{
            wodType: 'AMRAP', level: 'RX', resultDisplay: '100', resultSeconds: null, resultTotalReps: 100,
            exercises: [],
          }],
          skillBlocks: [],
        },
        {
          userId: 'u2',
          user: { id: 'u2', firstName: 'More', lastName: null },
          wodBlocks: [{
            wodType: 'AMRAP', level: 'RX', resultDisplay: '150', resultSeconds: null, resultTotalReps: 150,
            exercises: [],
          }],
          skillBlocks: [],
        },
      ]);

      const result = await service.getWodLeaderboard('club-1', '2024-03-01');

      expect(result[0].name).toBe('More');
      expect(result[1].name).toBe('Less');
    });

    it('должен фильтровать по wodType', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }]);
      mockWorkout.findMany.mockResolvedValue([
        {
          userId: 'u1',
          user: { id: 'u1', firstName: 'A', lastName: null },
          wodBlocks: [
            { wodType: 'FOR_TIME', level: 'RX', resultDisplay: '10:00', resultSeconds: 600, resultTotalReps: null, exercises: [] },
            { wodType: 'AMRAP', level: 'RX', resultDisplay: '100', resultSeconds: null, resultTotalReps: 100, exercises: [] },
          ],
          skillBlocks: [],
        },
      ]);

      const result = await service.getWodLeaderboard('club-1', '2024-03-01', 'AMRAP');
      expect(result).toHaveLength(1);
      expect(result[0].wodType).toBe('AMRAP');
    });

    it('должен пропускать блоки без результата', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }]);
      mockWorkout.findMany.mockResolvedValue([
        {
          userId: 'u1',
          user: { id: 'u1', firstName: 'A', lastName: null },
          wodBlocks: [{
            wodType: 'FOR_TIME', level: 'RX', resultDisplay: null, resultSeconds: null, resultTotalReps: null,
            exercises: [],
          }],
          skillBlocks: [],
        },
      ]);

      const result = await service.getWodLeaderboard('club-1', '2024-03-01');
      expect(result).toHaveLength(0);
    });

    it('должен присвоить ранги', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      mockWorkout.findMany.mockResolvedValue([
        {
          userId: 'u1', user: { id: 'u1', firstName: 'A', lastName: null },
          wodBlocks: [{ wodType: 'FOR_TIME', level: 'RX', resultDisplay: '10:00', resultSeconds: 600, resultTotalReps: null, exercises: [] }],
          skillBlocks: [],
        },
        {
          userId: 'u2', user: { id: 'u2', firstName: 'B', lastName: null },
          wodBlocks: [{ wodType: 'FOR_TIME', level: 'RX', resultDisplay: '12:00', resultSeconds: 720, resultTotalReps: null, exercises: [] }],
          skillBlocks: [],
        },
      ]);

      const result = await service.getWodLeaderboard('club-1', '2024-03-01');
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });
  });

  // === Общий лидерборд ===

  describe('getGeneralLeaderboard', () => {
    const makeWorkout = (userId: string, name: string, date: string, opts: {
      rxBlocks?: number; wodWeight?: number; wodReps?: number; skillWeight?: number; skillReps?: number;
    } = {}) => ({
      userId,
      date,
      user: { id: userId, firstName: name, lastName: null },
      wodBlocks: opts.rxBlocks ? Array.from({ length: opts.rxBlocks }, () => ({
        level: 'RX',
        exercises: [{ reps: opts.wodReps || 10, weight: opts.wodWeight || 50 }],
      })) : [],
      skillBlocks: opts.skillWeight ? [{
        sets: [{ reps: opts.skillReps || 5, weight: opts.skillWeight }],
      }] : [],
    });

    it('должен посчитать тоннаж, RX, activeDays', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }]);
      mockWorkout.findMany.mockResolvedValue([
        makeWorkout('u1', 'Ivan', '2024-03-01', { rxBlocks: 1, wodWeight: 60, wodReps: 21, skillWeight: 100, skillReps: 3 }),
        makeWorkout('u1', 'Ivan', '2024-03-02', { rxBlocks: 1, wodWeight: 40, wodReps: 15 }),
      ]);

      const result = await service.getGeneralLeaderboard('club-1', 'all');

      expect(result).toHaveLength(1);
      expect(result[0].workoutCount).toBe(2);
      expect(result[0].rxCount).toBe(2);
      expect(result[0].activeDays).toBe(2);
      // тоннаж: (21*60) + (3*100) + (15*40) = 1260 + 300 + 600 = 2160
      expect(result[0].tonnage).toBe(2160);
    });

    it('должен сортировать по workoutCount, затем rxCount', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      mockWorkout.findMany.mockResolvedValue([
        makeWorkout('u1', 'A', '2024-03-01', { rxBlocks: 1 }),
        makeWorkout('u2', 'B', '2024-03-01', { rxBlocks: 1 }),
        makeWorkout('u2', 'B', '2024-03-02', { rxBlocks: 1 }),
      ]);

      const result = await service.getGeneralLeaderboard('club-1', 'all');
      expect(result[0].name).toBe('B'); // 2 тренировки vs 1
    });
  });

  // === Skill лидерборд ===

  describe('getSkillLeaderboard', () => {
    it('должен рассчитать 1RM по формуле Эпли', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }]);
      mockSkillSet.findMany.mockResolvedValue([
        {
          reps: 5, weight: 100,
          skillBlock: {
            exercise: { name: 'Deadlift' },
            workout: { userId: 'u1', date: '2024-03-01', user: { id: 'u1', firstName: 'Ivan', lastName: null } },
          },
        },
      ]);

      const result = await service.getSkillLeaderboard('club-1');

      expect(result).toHaveLength(1);
      expect(result[0].exerciseName).toBe('Deadlift');
      expect(result[0].athletes[0].maxWeight).toBe(100);
      // 1RM = 100 * (1 + 5/30) = 100 * 1.1667 = 116.67 → округление до 0.5 → 116.5
      expect(result[0].athletes[0].best1RM).toBe(116.5);
    });

    it('должен вернуть maxWeight для синглов (1 rep)', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }]);
      mockSkillSet.findMany.mockResolvedValue([
        {
          reps: 1, weight: 150,
          skillBlock: {
            exercise: { name: 'Back Squat' },
            workout: { userId: 'u1', date: '2024-03-01', user: { id: 'u1', firstName: 'A', lastName: null } },
          },
        },
      ]);

      const result = await service.getSkillLeaderboard('club-1');
      // Для 1 rep: 1RM = weight (не формула Эпли)
      expect(result[0].athletes[0].best1RM).toBe(150);
    });

    it('должен сортировать атлетов по best1RM', async () => {
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      mockSkillSet.findMany.mockResolvedValue([
        {
          reps: 1, weight: 120,
          skillBlock: {
            exercise: { name: 'Clean' },
            workout: { userId: 'u1', date: '2024-03-01', user: { id: 'u1', firstName: 'Weaker', lastName: null } },
          },
        },
        {
          reps: 1, weight: 150,
          skillBlock: {
            exercise: { name: 'Clean' },
            workout: { userId: 'u2', date: '2024-03-01', user: { id: 'u2', firstName: 'Stronger', lastName: null } },
          },
        },
      ]);

      const result = await service.getSkillLeaderboard('club-1');
      expect(result[0].athletes[0].name).toBe('Stronger');
      expect(result[0].athletes[0].rank).toBe(1);
      expect(result[0].athletes[1].name).toBe('Weaker');
      expect(result[0].athletes[1].rank).toBe(2);
    });
  });

  // === Приватные методы (через поведение) ===

  describe('generateSlug (через createClub)', () => {
    it('должен транслитерировать кириллицу', async () => {
      mockClub.findUnique.mockResolvedValueOnce(null); // slug свободен

      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          club: { create: vi.fn().mockImplementation((args: any) => {
            // "Мой Клуб" → "moy-klub"
            expect(args.data.slug).toBe('moy-klub');
            return { id: 'c1', ...args.data, createdAt: new Date() };
          })},
          clubMember: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      mockClub.findUnique.mockResolvedValueOnce({
        id: 'c1', name: 'Мой Клуб', slug: 'moy-klub', description: null, city: null, logo: null,
        members: [], _count: { members: 1 }, createdAt: new Date(),
      });

      await service.createClub('u1', { name: 'Мой Клуб' });
    });
  });

  describe('displayName (через getMembers)', () => {
    it('должен вернуть "Атлет" если нет имени', async () => {
      mockClubMember.findMany.mockResolvedValue([
        {
          role: 'ATHLETE', showInLeaderboard: true, joinedAt: new Date(),
          user: { id: 'u1', email: 'a@b.c', firstName: null, lastName: null },
        },
      ]);

      const result = await service.getMembers('club-1');
      // displayName используется в лидербордах, а getMembers возвращает firstName/lastName напрямую
      // Проверяем через лидерборд
      mockClubMember.findMany.mockResolvedValue([{ userId: 'u1' }]);
      mockWorkout.findMany.mockResolvedValue([{
        userId: 'u1',
        user: { id: 'u1', firstName: null, lastName: null },
        wodBlocks: [{ wodType: 'FOR_TIME', level: 'RX', resultDisplay: '10:00', resultSeconds: 600, resultTotalReps: null, exercises: [] }],
        skillBlocks: [],
      }]);

      const leaderboard = await service.getWodLeaderboard('club-1', '2024-03-01');
      expect(leaderboard[0].name).toBe('Атлет');
    });
  });
});
