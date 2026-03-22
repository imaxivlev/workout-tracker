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
      showInLeaderboard: m.showInLeaderboard,
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

    const workoutInclude = {
      user: { select: { id: true, firstName: true, lastName: true } },
      skillBlocks: {
        include: {
          exercise: true,
          sets: { orderBy: { setNumber: 'asc' as const } }
        }
      },
      wodBlocks: {
        include: {
          exercises: {
            include: { exercise: true },
            orderBy: { orderIndex: 'asc' as const }
          }
        }
      }
    };

    // Шаг 1: Загружаем только тренировки-шаблоны (isClubTemplate: true)
    const templateWorkouts = await prisma.workout.findMany({
      where: {
        userId: { in: userIds },
        date,
        isClubTemplate: true,
      },
      include: workoutInclude,
      orderBy: { createdAt: 'asc' }
    });

    if (templateWorkouts.length === 0) return [];

    // Шаг 2: Создаём шаблоны из тренировок с isClubTemplate
    const templates: ClubWorkoutTemplate[] = [];
    const signatureSet = new Set<string>();

    for (const w of templateWorkouts) {
      const signature = this.workoutSignature(w);
      if (signatureSet.has(signature)) {
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

      signatureSet.add(signature);

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
          ladderRounds: wb.ladderRounds ?? null,
          exercises: wb.exercises.map(e => ({
            exerciseName: e.exercise.name,
            reps: e.reps,
            weight: e.weight ? Number(e.weight) : null,
          }))
        })),
      });
    }

    // Шаг 3: Загружаем остальные тренировки (без isClubTemplate) и добавляем атлетов к подходящим шаблонам
    const allWorkouts = await prisma.workout.findMany({
      where: {
        userId: { in: userIds },
        date,
        isClubTemplate: false,
        isTemplateOnly: false,
      },
      include: workoutInclude,
      orderBy: { createdAt: 'asc' }
    });

    for (const w of allWorkouts) {
      // Ищем шаблон, чьи WOD-блоки покрывают все блоки атлета
      const tmpl = templates.find(t => this.workoutMatchesTemplate(w, t));
      if (tmpl) {
        if (!tmpl.athletes.some(a => a.userId === w.user.id)) {
          tmpl.athleteCount++;
          tmpl.athletes.push({
            userId: w.user.id,
            name: this.displayName(w.user),
            workoutId: w.id,
          });
        }
      }
      // Тренировки без совпадения с шаблоном НЕ создают новый шаблон
    }

    // Сортируем: больше атлетов = выше
    templates.sort((a, b) => b.athleteCount - a.athleteCount);

    return templates;
  }

  /**
   * Обновление настройки видимости в лидерборде
   */
  async updateLeaderboardVisibility(clubId: string, userId: string, show: boolean): Promise<void> {
    const member = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } }
    });
    if (!member) throw new Error('NOT_MEMBER');

    await prisma.clubMember.update({
      where: { id: member.id },
      data: { showInLeaderboard: show }
    });
  }

  /**
   * Получение leaderboard-видимых userId клуба
   */
  private async getVisibleUserIds(clubId: string): Promise<string[]> {
    const members = await prisma.clubMember.findMany({
      where: { clubId, showInLeaderboard: true },
      select: { userId: true }
    });
    return members.map(m => m.userId);
  }

  /**
   * WOD лидерборд (тренировки с одинаковой структурой на дату)
   */
  async getWodLeaderboard(clubId: string, date: string, wodType?: string): Promise<WodLeaderboardEntry[]> {
    const userIds = await this.getVisibleUserIds(clubId);

    const workouts = await prisma.workout.findMany({
      where: {
        userId: { in: userIds },
        date,
        isTemplateOnly: false,
        showInLeaderboard: true,
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

    const entries: WodLeaderboardEntry[] = [];

    for (const w of workouts) {
      for (const wb of w.wodBlocks) {
        // Фильтрация по типу WOD (FOR_TIME, AMRAP и т.д.)
        if (wodType && wb.wodType !== wodType) continue;
        // Пропускаем блоки без результата (шаблоны)
        if (!wb.resultDisplay && !wb.resultSeconds && !wb.resultTotalReps) continue;
        // Собираем краткое описание весов для прозрачности
        const weightsInfo = wb.exercises
          .filter(e => e.weight && Number(e.weight) > 0)
          .map(e => `${e.exercise.name} ${Number(e.weight)}кг`)
          .join(', ');

        entries.push({
          userId: w.user.id,
          name: this.displayName(w.user),
          workoutId: w.id,
          wodType: wb.wodType,
          level: wb.level,
          resultDisplay: wb.resultDisplay,
          resultSeconds: wb.resultSeconds,
          resultTotalReps: wb.resultTotalReps,
          weightsUsed: weightsInfo || null,
        });
      }
    }

    // Сортировка: RX перед Scaled, затем по результату
    entries.sort((a, b) => {
      if (a.level !== b.level) return a.level === 'RX' ? -1 : 1;
      if (a.wodType === 'FOR_TIME' && a.resultSeconds != null && b.resultSeconds != null) {
        return a.resultSeconds - b.resultSeconds;
      }
      if (a.wodType === 'AMRAP' && a.resultTotalReps != null && b.resultTotalReps != null) {
        return b.resultTotalReps - a.resultTotalReps;
      }
      return 0;
    });

    let rank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].level !== entries[i - 1].level) {
        rank = i + 1;
      }
      entries[i].rank = rank;
      rank++;
    }

    return entries;
  }

  /**
   * Общий лидерборд клуба за период
   * period: 'month' | 'all'
   */
  async getGeneralLeaderboard(clubId: string, period: 'month' | 'all', year?: number, month?: number): Promise<MonthlyLeaderboardEntry[]> {
    const userIds = await this.getVisibleUserIds(clubId);

    const where: any = { userId: { in: userIds }, isTemplateOnly: false, showInLeaderboard: true };

    if (period === 'month' && year && month) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
      where.date = { gte: startDate, lte: endDate };
    }

    const workouts = await prisma.workout.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        skillBlocks: { include: { sets: true } },
        wodBlocks: {
          include: {
            exercises: { select: { reps: true, weight: true } }
          }
        }
      }
    });

    const userMap = new Map<string, {
      userId: string;
      name: string;
      workoutCount: number;
      rxCount: number;
      tonnage: number;
      uniqueDays: Set<string>;
    }>();

    for (const w of workouts) {
      if (!userMap.has(w.userId)) {
        userMap.set(w.userId, {
          userId: w.userId,
          name: this.displayName(w.user),
          workoutCount: 0,
          rxCount: 0,
          tonnage: 0,
          uniqueDays: new Set(),
        });
      }
      const entry = userMap.get(w.userId)!;
      entry.workoutCount++;
      entry.uniqueDays.add(w.date);

      for (const wb of w.wodBlocks) {
        if (wb.level === 'RX') entry.rxCount++;
        for (const ex of wb.exercises) {
          if (ex.weight) entry.tonnage += ex.reps * Number(ex.weight);
        }
      }

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
      rxCount: e.rxCount,
      tonnage: Math.round(e.tonnage * 100) / 100,
      activeDays: e.uniqueDays.size,
    }));

    result.sort((a, b) =>
      b.workoutCount - a.workoutCount
      || b.rxCount - a.rxCount
      || b.activeDays - a.activeDays
      || b.tonnage - a.tonnage
      || a.name.localeCompare(b.name)
    );

    return result;
  }

  /**
   * SKILL лидерборд — доска рекордов по упражнениям
   * Для каждого упражнения: кто поднял максимальный вес / лучший 1RM
   */
  async getSkillLeaderboard(clubId: string): Promise<SkillLeaderboardEntry[]> {
    const userIds = await this.getVisibleUserIds(clubId);

    // Все skill sets всех участников (исключая шаблоны без результата)
    const skillSets = await prisma.skillSet.findMany({
      where: {
        skillBlock: {
          workout: { userId: { in: userIds }, isTemplateOnly: false, showInLeaderboard: true }
        },
        weight: { gt: 0 }
      },
      include: {
        skillBlock: {
          include: {
            exercise: true,
            workout: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } }
              }
            }
          }
        }
      }
    });

    // Группируем по упражнению → пользователю → лучший результат
    const exerciseMap = new Map<string, Map<string, {
      userId: string;
      name: string;
      maxWeight: number;
      best1RM: number;
      bestReps: number;
      bestWeightForReps: number;
      date: string;
    }>>();

    for (const ss of skillSets) {
      const exerciseName = ss.skillBlock.exercise.name;
      const userId = ss.skillBlock.workout.userId;
      const weight = Number(ss.weight);
      const reps = ss.reps;
      const date = ss.skillBlock.workout.date;
      // Формула Эпли: 1RM = weight × (1 + reps / 30)
      const estimated1RM = reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 2) / 2;

      if (!exerciseMap.has(exerciseName)) {
        exerciseMap.set(exerciseName, new Map());
      }

      const userMap = exerciseMap.get(exerciseName)!;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          name: this.displayName(ss.skillBlock.workout.user),
          maxWeight: 0,
          best1RM: 0,
          bestReps: 0,
          bestWeightForReps: 0,
          date: '',
        });
      }

      const entry = userMap.get(userId)!;
      if (weight > entry.maxWeight) {
        entry.maxWeight = weight;
      }
      if (estimated1RM > entry.best1RM) {
        entry.best1RM = estimated1RM;
        entry.bestReps = reps;
        entry.bestWeightForReps = weight;
        entry.date = date;
      }
    }

    // Собираем результат
    const result: SkillLeaderboardEntry[] = [];

    for (const [exerciseName, userMap] of exerciseMap) {
      const athletes = Array.from(userMap.values());
      // Сортируем по best1RM
      athletes.sort((a, b) => b.best1RM - a.best1RM);

      result.push({
        exerciseName,
        athletes: athletes.map((a, i) => ({
          rank: i + 1,
          userId: a.userId,
          name: a.name,
          maxWeight: a.maxWeight,
          best1RM: a.best1RM,
          bestReps: a.bestReps,
          bestWeightForReps: a.bestWeightForReps,
          date: a.date,
        })),
      });
    }

    // Сортируем упражнения по количеству атлетов (популярные первыми)
    result.sort((a, b) => b.athletes.length - a.athletes.length);

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
      .map(wb => this.wodBlockSignature(wb))
      .sort()
      .join('|');

    return `S{${skills}}W{${wods}}`;
  }

  /**
   * Подпись одного WOD-блока (без level/веса — только тип + упражнения + повторения)
   */
  private wodBlockSignature(wb: {
    wodType: string;
    exercises: Array<{ exercise: { name: string }; reps: number }>;
  }): string {
    const exs = wb.exercises
      .map(e => `${e.exercise.name}:${e.reps}`)
      .sort()
      .join('+');
    return `${wb.wodType}[${exs}]`;
  }

  /**
   * Проверяет, что тренировка атлета соответствует шаблону.
   * Каждый WOD/SKILL блок атлета должен совпадать с одним из блоков шаблона.
   * Шаблон может содержать больше блоков (RX + SC), атлет — только один из них.
   */
  private workoutMatchesTemplate(
    workout: {
      skillBlocks: Array<{ exercise: { name: string } }>;
      wodBlocks: Array<{
        wodType: string;
        exercises: Array<{ exercise: { name: string }; reps: number }>;
      }>;
    },
    template: ClubWorkoutTemplate
  ): boolean {
    // Skill блоки: имена упражнений атлета должны быть подмножеством шаблона
    const templateSkillNames = new Set(template.skillBlocks.map(sb => sb.exerciseName));
    const workoutSkillNames = workout.skillBlocks.map(sb => sb.exercise.name);
    if (workoutSkillNames.length > 0 && !workoutSkillNames.every(n => templateSkillNames.has(n))) {
      return false;
    }

    // WOD блоки: каждый блок атлета должен совпадать с одним из блоков шаблона
    const templateWodSigs = template.wodBlocks.map(wb => {
      const exs = wb.exercises
        .map(e => `${e.exerciseName}:${e.reps}`)
        .sort()
        .join('+');
      return `${wb.wodType}[${exs}]`;
    });

    for (const wb of workout.wodBlocks) {
      const sig = this.wodBlockSignature(wb);
      if (!templateWodSigs.includes(sig)) {
        return false;
      }
    }

    // Хотя бы один блок должен совпасть
    return workout.wodBlocks.length > 0 || workout.skillBlocks.length > 0;
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
  showInLeaderboard: boolean;
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
  weightsUsed: string | null;
  rank?: number;
}

export interface MonthlyLeaderboardEntry {
  userId: string;
  name: string;
  workoutCount: number;
  rxCount: number;
  tonnage: number;
  activeDays: number;
}

export interface SkillLeaderboardEntry {
  exerciseName: string;
  athletes: Array<{
    rank: number;
    userId: string;
    name: string;
    maxWeight: number;
    best1RM: number;
    bestReps: number;
    bestWeightForReps: number;
    date: string;
  }>;
}
