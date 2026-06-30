import { prisma } from '@/lib/prisma';


export class StatisticsService {
  /**
   * Расчет 1RM (одноповторного максимума) по формуле Эпли
   * 1RM = weight × (1 + reps / 30)
   * 
   * @param weight - Вес в кг
   * @param reps - Количество повторений
   * @returns Расчетный 1RM, округленный до 0.5 кг
   */
  calculate1RM(weight: number, reps: number): number {
    // Если 1 повторение, возвращаем исходный вес
    if (reps === 1) {
      return weight;
    }

    // Формула Эпли: 1RM = weight × (1 + reps / 30)
    const oneRM = weight * (1 + reps / 30);

    // Округление до 0.5 кг
    return Math.round(oneRM * 2) / 2;
  }

  /**
   * Расчет тоннажа за период
   * Тоннаж = Σ(weight × reps) для всех skill_sets
   * 
   * @param userId - ID пользователя
   * @param startDate - Начальная дата (YYYY-MM-DD)
   * @param endDate - Конечная дата (YYYY-MM-DD)
   * @returns Суммарный тоннаж в кг
   */
  async calculateTonnage(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const sets = await prisma.skillSet.findMany({
      where: {
        skillBlock: {
          workout: {
            userId,
            isTemplateOnly: false,
            date: { gte: startDate, lte: endDate },
          },
        },
      },
      select: { weight: true, reps: true },
    });

    return sets.reduce((sum, set) => sum + Number(set.weight) * set.reps, 0);
  }

  /**
   * Расчет стрика (последовательных дней и недель с тренировками)
   * 
   * @param userId - ID пользователя
   * @returns Объект с количеством дней и недель стрика
   */
  async calculateStreak(userId: string): Promise<{ days: number; weeks: number }> {
    const workouts = await prisma.workout.findMany({
      where: { userId, isTemplateOnly: false },
      select: { date: true },
      orderBy: { date: 'desc' },
    });

    if (workouts.length === 0) {
      return { days: 0, weeks: 0 };
    }

    const today = new Date();
    const formatLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = formatLocal(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatLocal(yesterday);

    const lastWorkoutDate = workouts[0].date;

    // Если последняя тренировка не сегодня и не вчера, стрик = 0
    if (lastWorkoutDate !== todayStr && lastWorkoutDate !== yesterdayStr) {
      return { days: 0, weeks: 0 };
    }

    // Подсчет стрика по дням
    const uniqueDates = [...new Set(workouts.map(w => w.date))].sort().reverse();
    let dayStreak = 0;
    let currentDate = new Date(uniqueDates[0]);

    for (const dateStr of uniqueDates) {
      const workoutDate = new Date(dateStr);
      const diffDays = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === dayStreak) {
        dayStreak++;
      } else {
        break;
      }
    }

    // Подсчет стрика по неделям
    const getWeekKey = (dateStr: string) => {
      const date = new Date(dateStr);
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      return startOfWeek.toISOString().split('T')[0];
    };

    const weekKeys = uniqueDates.map(getWeekKey);
    const uniqueWeeks = [...new Set(weekKeys)].sort().reverse();

    let weekStreak = 0;
    const currentWeekKey = getWeekKey(todayStr);
    const lastWeekKey = getWeekKey(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    for (let i = 0; i < uniqueWeeks.length; i++) {
      const expectedWeek = new Date(currentWeekKey);
      expectedWeek.setDate(expectedWeek.getDate() - i * 7);
      const expectedWeekKey = getWeekKey(expectedWeek.toISOString().split('T')[0]);

      if (uniqueWeeks[i] === expectedWeekKey) {
        weekStreak++;
      } else {
        break;
      }
    }

    return { days: dayStreak, weeks: weekStreak };
  }

  /**
   * Получение личных рекордов по упражнению
   * 
   * @param userId - ID пользователя
   * @param exerciseId - ID упражнения
   * @returns Объект с максимальными значениями
   */
  async getPersonalRecords(
    userId: string,
    exerciseId: string
  ): Promise<{
    maxWeight: number;
    maxReps: number;
    best1RM: number;
  }> {
    const skillBlocks = await prisma.skillBlock.findMany({
      where: {
        exerciseDictId: exerciseId,
        workout: {
          userId,
        },
      },
      include: {
        sets: true,
      },
    });

    if (skillBlocks.length === 0) {
      return { maxWeight: 0, maxReps: 0, best1RM: 0 };
    }

    let maxWeight = 0;
    let maxReps = 0;
    let best1RM = 0;

    for (const block of skillBlocks) {
      for (const set of block.sets) {
        const weight = Number(set.weight);
        const reps = set.reps;

        if (weight > maxWeight) {
          maxWeight = weight;
        }

        if (reps > maxReps) {
          maxReps = reps;
        }

        const oneRM = this.calculate1RM(weight, reps);
        if (oneRM > best1RM) {
          best1RM = oneRM;
        }
      }
    }

    return { maxWeight, maxReps, best1RM };
  }

  /**
   * Получение истории прогресса по упражнению
   * 
   * @param userId - ID пользователя
   * @param exerciseId - ID упражнения
   * @param startDate - Начальная дата (опционально)
   * @param endDate - Конечная дата (опционально)
   * @returns Массив записей с датой, весом, повторениями и расчетным 1RM
   */
  async getProgressHistory(
    userId: string,
    exerciseId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    date: string;
    weight: number;
    reps: number;
    estimated1RM: number;
  }[]> {
    const whereClause: any = {
      exerciseDictId: exerciseId,
      workout: {
        userId,
      },
    };

    if (startDate || endDate) {
      whereClause.workout.date = {};
      if (startDate) whereClause.workout.date.gte = startDate;
      if (endDate) whereClause.workout.date.lte = endDate;
    }

    const skillBlocks = await prisma.skillBlock.findMany({
      where: whereClause,
      include: {
        sets: true,
        workout: {
          select: {
            date: true,
          },
        },
      },
      orderBy: {
        workout: {
          date: 'asc',
        },
      },
    });

    const history: {
      date: string;
      weight: number;
      reps: number;
      estimated1RM: number;
    }[] = [];

    for (const block of skillBlocks) {
      for (const set of block.sets) {
        const weight = Number(set.weight);
        const reps = set.reps;
        const estimated1RM = this.calculate1RM(weight, reps);

        history.push({
          date: block.workout.date,
          weight,
          reps,
          estimated1RM,
        });
      }
    }

    return history;
  }

  /**
   * Нахождение лучшего веса среди всех упражнений пользователя
   *
   * @param userId - ID пользователя
   * @returns Объект с именем упражнения, весом и датой или null
   */
  async getBestWeight(userId: string): Promise<{ exerciseName: string; weight: number; date: string } | null> {
    const set = await prisma.skillSet.findFirst({
      where: {
        skillBlock: {
          workout: { userId, isTemplateOnly: false },
        },
      },
      orderBy: { weight: 'desc' },
      select: {
        weight: true,
        skillBlock: {
          select: {
            exercise: { select: { name: true } },
            workout: { select: { date: true } },
          },
        },
      },
    });

    if (!set) return null;

    return {
      exerciseName: set.skillBlock.exercise.name,
      weight: Number(set.weight),
      date: set.skillBlock.workout.date,
    };
  }

  /**
   * Получение метрик для Dashboard
   *
   * @param userId - ID пользователя
   * @returns Объект с метриками
   */
  async getDashboard(userId: string): Promise<{
    workoutsThisMonth: number;
    tonnageThisMonth: number;
    bestWeight: { exerciseName: string; weight: number; date: string } | null;
    streak: { days: number; weeks: number };
    recentWorkouts: any[];
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

    const [workoutsThisMonth, tonnageThisMonth, bestWeight, streak, recentWorkouts] = await Promise.all([
      // Количество тренировок за текущий месяц
      prisma.workout.count({
        where: {
          userId,
          isTemplateOnly: false,
          date: { gte: startOfMonthStr, lte: endOfMonthStr },
        },
      }),

      // Тоннаж за текущий месяц
      this.calculateTonnage(userId, startOfMonthStr, endOfMonthStr),

      // Лучший вес за всё время
      this.getBestWeight(userId),

      // Текущий стрик
      this.calculateStreak(userId),

      // Последние 10 тренировок
      prisma.workout.findMany({
        where: { userId, isTemplateOnly: false },
        include: {
          skillBlocks: {
            include: {
              exercise: true,
              sets: true,
            },
          },
          wodBlocks: {
            include: {
              exercises: {
                include: {
                  exercise: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    return {
      workoutsThisMonth,
      tonnageThisMonth,
      bestWeight,
      streak,
      recentWorkouts,
    };
  }
}
