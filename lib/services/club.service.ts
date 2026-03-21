import { PrismaClient, ClubRole } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Сервис для работы с клубами
 *
 * Ответственности:
 * - Создание и управление клубами
 * - Генерация инвайт-кодов
 * - Вступление/выход участников
 * - Назначение ролей (OWNER, COACH, ATHLETE)
 */
export class ClubService {

  /**
   * Создание клуба. Создатель автоматически становится OWNER.
   */
  async createClub(userId: string, data: {
    name: string;
    description?: string;
    city?: string;
  }): Promise<ClubResponse> {
    const slug = this.generateSlug(data.name);

    // Проверяем уникальность slug
    const existing = await prisma.club.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${crypto.randomBytes(3).toString('hex')}` : slug;

    const club = await prisma.$transaction(async (tx) => {
      const created = await tx.club.create({
        data: {
          name: data.name,
          slug: finalSlug,
          description: data.description || null,
          city: data.city || null,
        }
      });

      // Создатель = OWNER
      await tx.clubMember.create({
        data: {
          clubId: created.id,
          userId,
          role: ClubRole.OWNER,
        }
      });

      return created;
    });

    return this.loadClubResponse(club.id, userId);
  }

  /**
   * Получение клуба по ID
   */
  async getClubById(clubId: string, userId?: string): Promise<ClubResponse | null> {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } }
          }
        },
        _count: { select: { members: true } },
      }
    });

    if (!club) return null;

    const currentMember = userId
      ? club.members.find(m => m.userId === userId)
      : undefined;

    return {
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      city: club.city,
      logo: club.logo,
      memberCount: club._count.members,
      myRole: currentMember?.role || null,
      createdAt: club.createdAt.toISOString(),
    };
  }

  /**
   * Получение клуба по slug
   */
  async getClubBySlug(slug: string, userId?: string): Promise<ClubResponse | null> {
    const club = await prisma.club.findUnique({ where: { slug } });
    if (!club) return null;
    return this.getClubById(club.id, userId);
  }

  /**
   * Получение клуба текущего пользователя (первое членство)
   */
  async getMyClub(userId: string): Promise<ClubResponse | null> {
    const membership = await prisma.clubMember.findFirst({
      where: { userId },
      include: { club: true }
    });

    if (!membership) return null;
    return this.getClubById(membership.clubId, userId);
  }

  /**
   * Обновление клуба (только OWNER/COACH)
   */
  async updateClub(clubId: string, userId: string, data: {
    name?: string;
    description?: string;
    city?: string;
    logo?: string;
  }): Promise<ClubResponse> {
    await this.requireRole(clubId, userId, [ClubRole.OWNER, ClubRole.COACH]);

    await prisma.club.update({
      where: { id: clubId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.logo !== undefined && { logo: data.logo }),
      }
    });

    return this.loadClubResponse(clubId, userId);
  }

  /**
   * Генерация инвайт-кода (только OWNER/COACH)
   */
  async createInvite(clubId: string, userId: string, options?: {
    maxUses?: number;
    expiresInDays?: number;
  }): Promise<{ code: string; expiresAt: string | null }> {
    await this.requireRole(clubId, userId, [ClubRole.OWNER, ClubRole.COACH]);

    const code = this.generateInviteCode();
    const expiresAt = options?.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 86400000)
      : null;

    await prisma.clubInvite.create({
      data: {
        clubId,
        code,
        createdBy: userId,
        maxUses: options?.maxUses || null,
        expiresAt,
      }
    });

    return {
      code,
      expiresAt: expiresAt?.toISOString() || null,
    };
  }

  /**
   * Вступление в клуб по инвайт-коду
   */
  async joinByInvite(userId: string, inviteCode: string): Promise<ClubResponse> {
    const invite = await prisma.clubInvite.findUnique({
      where: { code: inviteCode },
      include: { club: true }
    });

    if (!invite) {
      throw new Error('INVALID_INVITE');
    }

    // Проверка срока действия
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new Error('INVITE_EXPIRED');
    }

    // Проверка лимита использований
    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      throw new Error('INVITE_EXHAUSTED');
    }

    // Проверка: уже состоит в этом клубе?
    const existingMembership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: invite.clubId, userId } }
    });

    if (existingMembership) {
      throw new Error('ALREADY_MEMBER');
    }

    // Вступление + инкремент счётчика
    await prisma.$transaction([
      prisma.clubMember.create({
        data: {
          clubId: invite.clubId,
          userId,
          role: ClubRole.ATHLETE,
        }
      }),
      prisma.clubInvite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } }
      })
    ]);

    return this.loadClubResponse(invite.clubId, userId);
  }

  /**
   * Выход из клуба
   */
  async leaveClub(clubId: string, userId: string): Promise<void> {
    const member = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } }
    });

    if (!member) {
      throw new Error('NOT_MEMBER');
    }

    if (member.role === ClubRole.OWNER) {
      // Проверяем, есть ли другие owner
      const otherOwners = await prisma.clubMember.count({
        where: { clubId, role: ClubRole.OWNER, NOT: { userId } }
      });
      if (otherOwners === 0) {
        throw new Error('LAST_OWNER');
      }
    }

    await prisma.clubMember.delete({
      where: { id: member.id }
    });
  }

  /**
   * Изменение роли участника (только OWNER)
   */
  async updateMemberRole(clubId: string, requesterId: string, targetUserId: string, newRole: ClubRole): Promise<void> {
    await this.requireRole(clubId, requesterId, [ClubRole.OWNER]);

    if (requesterId === targetUserId) {
      throw new Error('CANNOT_CHANGE_OWN_ROLE');
    }

    const member = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: targetUserId } }
    });

    if (!member) {
      throw new Error('NOT_MEMBER');
    }

    await prisma.clubMember.update({
      where: { id: member.id },
      data: { role: newRole }
    });
  }

  /**
   * Удаление участника (только OWNER)
   */
  async removeMember(clubId: string, requesterId: string, targetUserId: string): Promise<void> {
    await this.requireRole(clubId, requesterId, [ClubRole.OWNER]);

    if (requesterId === targetUserId) {
      throw new Error('CANNOT_REMOVE_SELF');
    }

    const member = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: targetUserId } }
    });

    if (!member) {
      throw new Error('NOT_MEMBER');
    }

    await prisma.clubMember.delete({ where: { id: member.id } });
  }

  /**
   * Получение участников клуба
   */
  async getMembers(clubId: string): Promise<ClubMemberResponse[]> {
    const members = await prisma.clubMember.findMany({
      where: { clubId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } }
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then COACH, then ATHLETE
        { joinedAt: 'asc' }
      ]
    });

    return members.map(m => ({
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  /**
   * Получение тренировок клуба за дату (для "тренировка дня")
   * Возвращает уникальные шаблоны — группирует по структуре WOD/SKILL блоков
   */
  async getClubWorkoutsForDate(clubId: string, date: string): Promise<ClubWorkoutTemplate[]> {
    // Получаем всех участников клуба
    const memberIds = await prisma.clubMember.findMany({
      where: { clubId },
      select: { userId: true }
    });

    const userIds = memberIds.map(m => m.userId);

    // Получаем тренировки участников за указанную дату
    const workouts = await prisma.workout.findMany({
      where: {
        userId: { in: userIds },
        date,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        skillBlocks: {
          include: {
            exercise: true,
            sets: { orderBy: { setNumber: 'asc' } }
          }
        },
        wodBlocks: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (workouts.length === 0) return [];

    // Группируем по структуре (одинаковые WOD блоки = одна тренировка дня)
    const templates: ClubWorkoutTemplate[] = [];
    const seen = new Set<string>();

    for (const w of workouts) {
      const signature = this.workoutSignature(w);
      if (seen.has(signature)) {
        // Добавляем атлета к существующему шаблону
        const tmpl = templates.find(t => t.signature === signature);
        if (tmpl) {
          tmpl.athleteCount++;
          tmpl.athletes.push({
            userId: w.user.id,
            name: this.displayName(w.user),
            workoutId: w.id,
          });
        }
        continue;
      }

      seen.add(signature);

      templates.push({
        signature,
        firstWorkoutId: w.id,
        date: w.date,
        athleteCount: 1,
        athletes: [{
          userId: w.user.id,
          name: this.displayName(w.user),
          workoutId: w.id,
        }],
        skillBlocks: w.skillBlocks.map(sb => ({
          exerciseName: sb.exercise.name,
          sets: sb.sets.map(s => ({ reps: s.reps, weight: Number(s.weight) }))
        })),
        wodBlocks: w.wodBlocks.map(wb => ({
          wodType: wb.wodType,
          level: wb.level,
          timeCapSeconds: wb.timeCapSeconds,
          isLadder: wb.isLadder,
          exercises: wb.exercises.map(e => ({
            exerciseName: e.exercise.name,
            reps: e.reps,
            weight: e.weight ? Number(e.weight) : null,
          }))
        })),
      });
    }

    // Сортируем: больше атлетов = выше
    templates.sort((a, b) => b.athleteCount - a.athleteCount);

    return templates;
  }

  /**
   * Получение лидерборда по WOD дня (тренировки с одинаковой структурой на дату)
   */
  async getWodLeaderboard(clubId: string, date: string, wodSignature?: string): Promise<WodLeaderboardEntry[]> {
    const memberIds = await prisma.clubMember.findMany({
      where: { clubId },
      select: { userId: true }
    });

    const userIds = memberIds.map(m => m.userId);

    const workouts = await prisma.workout.findMany({
      where: {
        userId: { in: userIds },
        date,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        wodBlocks: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { orderIndex: 'asc' }
            }
          }
        },
        skillBlocks: {
          include: {
            exercise: true,
            sets: { orderBy: { setNumber: 'asc' } }
          }
        },
      }
    });

    // Фильтруем по сигнатуре если указана
    const filtered = wodSignature
      ? workouts.filter(w => this.workoutSignature(w) === wodSignature)
      : workouts;

    // Строим лидерборд для каждого WOD блока
    const entries: WodLeaderboardEntry[] = [];

    for (const w of filtered) {
      for (const wb of w.wodBlocks) {
        entries.push({
          userId: w.user.id,
          name: this.displayName(w.user),
          workoutId: w.id,
          wodType: wb.wodType,
          level: wb.level,
          resultDisplay: wb.resultDisplay,
          resultSeconds: wb.resultSeconds,
          resultTotalReps: wb.resultTotalReps,
        });
      }
    }

    // Сортировка: RX перед Scaled, затем по результату
    entries.sort((a, b) => {
      // RX выше Scaled
      if (a.level !== b.level) return a.level === 'RX' ? -1 : 1;

      // FOR_TIME: меньше = лучше
      if (a.wodType === 'FOR_TIME' && a.resultSeconds != null && b.resultSeconds != null) {
        return a.resultSeconds - b.resultSeconds;
      }

      // AMRAP: больше = лучше
      if (a.wodType === 'AMRAP' && a.resultTotalReps != null && b.resultTotalReps != null) {
        return b.resultTotalReps - a.resultTotalReps;
      }

      return 0;
    });

    // Проставляем ранг
    let rank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].level !== entries[i - 1].level) {
        rank = i + 1; // Сброс ранга при смене уровня
      }
      entries[i].rank = rank;
      rank++;
    }

    return entries;
  }

  /**
   * Общий лидерборд клуба за месяц
   */
  async getMonthlyLeaderboard(clubId: string, year: number, month: number): Promise<MonthlyLeaderboardEntry[]> {
    const memberIds = await prisma.clubMember.findMany({
      where: { clubId },
      select: { userId: true },
    });
    const userIds = memberIds.map(m => m.userId);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    // Получаем все тренировки участников за месяц
    const workouts = await prisma.workout.findMany({
      where: {
        userId: { in: userIds },
        date: { gte: startDate, lte: endDate },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        skillBlocks: {
          include: { sets: true }
        }
      }
    });

    // Агрегируем по пользователю
    const userMap = new Map<string, {
      userId: string;
      name: string;
      workoutCount: number;
      tonnage: number;
      uniqueDays: Set<string>;
    }>();

    for (const w of workouts) {
      if (!userMap.has(w.userId)) {
        userMap.set(w.userId, {
          userId: w.userId,
          name: this.displayName(w.user),
          workoutCount: 0,
          tonnage: 0,
          uniqueDays: new Set(),
        });
      }
      const entry = userMap.get(w.userId)!;
      entry.workoutCount++;
      entry.uniqueDays.add(w.date);

      for (const sb of w.skillBlocks) {
        for (const s of sb.sets) {
          entry.tonnage += s.reps * Number(s.weight);
        }
      }
    }

    const result: MonthlyLeaderboardEntry[] = Array.from(userMap.values()).map(e => ({
      userId: e.userId,
      name: e.name,
      workoutCount: e.workoutCount,
      tonnage: Math.round(e.tonnage * 100) / 100,
      activeDays: e.uniqueDays.size,
    }));

    // Сортировка по количеству тренировок (основной), тоннажу (вторичный)
    result.sort((a, b) => b.workoutCount - a.workoutCount || b.tonnage - a.tonnage);

    return result;
  }

  // --- Приватные методы ---

  private async requireRole(clubId: string, userId: string, roles: ClubRole[]): Promise<void> {
    const member = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } }
    });

    if (!member) throw new Error('NOT_MEMBER');
    if (!roles.includes(member.role)) throw new Error('INSUFFICIENT_ROLE');
  }

  private async loadClubResponse(clubId: string, userId: string): Promise<ClubResponse> {
    const result = await this.getClubById(clubId, userId);
    if (!result) throw new Error('Club not found after creation');
    return result;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[а-яё]/gi, (c) => {
        const map: Record<string, string> = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
          'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        };
        return map[c.toLowerCase()] || c;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  private generateInviteCode(): string {
    // 8 символов, легко вводимый код
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без I/O/1/0 для читаемости
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  private displayName(user: { firstName: string | null; lastName: string | null }): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Атлет';
  }

  /**
   * Генерирует "подпись" тренировки для группировки одинаковых WOD/SKILL
   */
  private workoutSignature(workout: {
    skillBlocks: Array<{ exercise: { name: string } }>;
    wodBlocks: Array<{
      wodType: string;
      exercises: Array<{ exercise: { name: string }; reps: number }>;
    }>;
  }): string {
    const skills = workout.skillBlocks
      .map(sb => sb.exercise.name)
      .sort()
      .join(',');

    const wods = workout.wodBlocks
      .map(wb => {
        const exs = wb.exercises
          .map(e => `${e.exercise.name}:${e.reps}`)
          .join('+');
        return `${wb.wodType}[${exs}]`;
      })
      .join('|');

    return `S{${skills}}W{${wods}}`;
  }
}

// --- Типы ---

export interface ClubResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  logo: string | null;
  memberCount: number;
  myRole: ClubRole | null;
  createdAt: string;
}

export interface ClubMemberResponse {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: ClubRole;
  joinedAt: string;
}

export interface ClubWorkoutTemplate {
  signature: string;
  firstWorkoutId: string;
  date: string;
  athleteCount: number;
  athletes: Array<{ userId: string; name: string; workoutId: string }>;
  skillBlocks: Array<{
    exerciseName: string;
    sets: Array<{ reps: number; weight: number }>;
  }>;
  wodBlocks: Array<{
    wodType: string;
    level: string;
    timeCapSeconds: number | null;
    isLadder: boolean;
    exercises: Array<{
      exerciseName: string;
      reps: number;
      weight: number | null;
    }>;
  }>;
}

export interface WodLeaderboardEntry {
  userId: string;
  name: string;
  workoutId: string;
  wodType: string;
  level: string;
  resultDisplay: string;
  resultSeconds: number | null;
  resultTotalReps: number | null;
  rank?: number;
}

export interface MonthlyLeaderboardEntry {
  userId: string;
  name: string;
  workoutCount: number;
  tonnage: number;
  activeDays: number;
}
