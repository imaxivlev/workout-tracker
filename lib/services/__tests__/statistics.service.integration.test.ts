/**
 * Integration тесты для Statistics Service
 *
 * Задача 18.3: Тестирование расчета метрик
 * - Dashboard метрики
 * - Статистика по упражнению
 * - Корректность 1RM, тоннажа и стрика
 *
 * ВАЖНО: Для запуска необходим доступ к MySQL (workout_tracker_local)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { StatisticsService } from '../statistics.service';
import { WorkoutService } from '../workout.service';

const prisma = new PrismaClient();
const statisticsService = new StatisticsService();
const workoutService = new WorkoutService();

describe('StatisticsService Integration Tests', () => {
  let testUserId: string;
  let testExerciseId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-stats-integration@example.com',
        passwordHash: 'hash',
        verified: true,
      },
    });
    testUserId = user.id;

    const exercise = await prisma.exerciseDict.create({
      data: {
        name: 'Test Stats Back Squat',
        isGlobal: true,
      },
    });
    testExerciseId = exercise.id;
  });

  afterAll(async () => {
    await prisma.workout.deleteMany({ where: { userId: testUserId } });
    await prisma.exerciseDict.deleteMany({ where: { name: { startsWith: 'Test Stats' } } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.workout.deleteMany({ where: { userId: testUserId } });
  });

  describe('18.3.1 Расчет 1RM (формула Эпли)', () => {
    it('должен рассчитать 1RM по формуле: weight × (1 + reps / 30)', () => {
      // 100 кг × (1 + 5/30) = 100 × 1.1667 = 116.67 → округление до 0.5 кг = 116.5
      const result = statisticsService.calculate1RM(100, 5);
      expect(result).toBe(116.5);
    });

    it('должен вернуть исходный вес при reps = 1', () => {
      const result = statisticsService.calculate1RM(150, 1);
      expect(result).toBe(150);
    });

    it('должен округлять до 0.5 кг', () => {
      // Проверяем что результат кратен 0.5
      const result = statisticsService.calculate1RM(85, 3);
      expect(result % 0.5).toBe(0);
    });

    it('1RM должен расти при увеличении веса (монотонность)', () => {
      const rm1 = statisticsService.calculate1RM(100, 5);
      const rm2 = statisticsService.calculate1RM(110, 5);
      expect(rm2).toBeGreaterThan(rm1);
    });

    it('1RM должен расти при увеличении повторений (монотонность)', () => {
      const rm1 = statisticsService.calculate1RM(100, 3);
      const rm2 = statisticsService.calculate1RM(100, 5);
      expect(rm2).toBeGreaterThan(rm1);
    });
  });

  describe('18.3.2 Расчет тоннажа', () => {
    it('должен рассчитать суммарный тоннаж за период', async () => {
      // Тренировка 1: 3 подхода × (5 повторений × 100 кг) = 1500 кг
      await workoutService.createWorkout(testUserId, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [
            { reps: 5, weight: 100 },
            { reps: 5, weight: 100 },
            { reps: 5, weight: 100 },
          ],
        }],
      });

      // Тренировка 2: 2 подхода × (3 × 120) = 720 кг
      await workoutService.createWorkout(testUserId, {
        date: '2024-01-17',
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [
            { reps: 3, weight: 120 },
            { reps: 3, weight: 120 },
          ],
        }],
      });

      const tonnage = await statisticsService.calculateTonnage(
        testUserId,
        '2024-01-01',
        '2024-01-31'
      );

      // 1500 + 720 = 2220
      expect(tonnage).toBe(2220);
    });

    it('должен вернуть 0 при отсутствии тренировок', async () => {
      const tonnage = await statisticsService.calculateTonnage(
        testUserId,
        '2024-01-01',
        '2024-01-31'
      );

      expect(tonnage).toBe(0);
    });

    it('тоннаж учитывает только skill блоки (не WOD)', async () => {
      // Создаем тренировку только с WOD
      await workoutService.createWorkout(testUserId, {
        date: '2024-01-15',
        wodBlocks: [{
          wodType: 'FOR_TIME',
          level: 'RX',
          isLadder: false,
          resultType: 'TIME',
          resultDisplay: '10:00',
          resultSeconds: 600,
          exercises: [{ exerciseName: 'Test Stats Back Squat', reps: 21, weight: 42.5, orderIndex: 1 }],
        }],
      });

      const tonnage = await statisticsService.calculateTonnage(
        testUserId,
        '2024-01-01',
        '2024-01-31'
      );

      expect(tonnage).toBe(0);
    });
  });

  describe('18.3.3 Расчет стрика', () => {
    it('должен рассчитать стрик дней подряд', async () => {
      const today = new Date();
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      // Создаем тренировки за последние 3 дня
      for (let i = 0; i < 3; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await workoutService.createWorkout(testUserId, {
          date: formatDate(date),
          skillBlocks: [{
            exerciseName: 'Test Stats Back Squat',
            sets: [{ reps: 5, weight: 100 }],
          }],
        });
      }

      const streak = await statisticsService.calculateStreak(testUserId);

      expect(streak.days).toBe(3);
    });

    it('должен вернуть 0 при отсутствии недавних тренировок', async () => {
      // Создаем тренировку далеко в прошлом
      await workoutService.createWorkout(testUserId, {
        date: '2023-01-01',
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [{ reps: 5, weight: 100 }],
        }],
      });

      const streak = await statisticsService.calculateStreak(testUserId);

      expect(streak.days).toBe(0);
      expect(streak.weeks).toBe(0);
    });

    it('стрик прерывается при пропуске дня', async () => {
      const today = new Date();
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      // Тренировка сегодня
      await workoutService.createWorkout(testUserId, {
        date: formatDate(today),
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [{ reps: 5, weight: 100 }],
        }],
      });

      // Тренировка 3 дня назад (пропуск вчера и позавчера)
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      await workoutService.createWorkout(testUserId, {
        date: formatDate(threeDaysAgo),
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [{ reps: 5, weight: 100 }],
        }],
      });

      const streak = await statisticsService.calculateStreak(testUserId);

      // Стрик = 1 (только сегодня), т.к. вчера пропуск
      expect(streak.days).toBe(1);
    });
  });

  describe('18.3.4 Персональные рекорды', () => {
    beforeEach(async () => {
      // Создаем несколько тренировок с разными весами
      await workoutService.createWorkout(testUserId, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [
            { reps: 5, weight: 100 },
            { reps: 3, weight: 120 },
          ],
        }],
      });

      await workoutService.createWorkout(testUserId, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [
            { reps: 1, weight: 150 },
            { reps: 10, weight: 80 },
          ],
        }],
      });
    });

    it('должен найти максимальный вес', async () => {
      const records = await statisticsService.getPersonalRecords(testUserId, testExerciseId);

      expect(records.maxWeight).toBe(150);
    });

    it('должен найти максимальное количество повторений', async () => {
      const records = await statisticsService.getPersonalRecords(testUserId, testExerciseId);

      expect(records.maxReps).toBe(10);
    });

    it('должен рассчитать лучший 1RM', async () => {
      const records = await statisticsService.getPersonalRecords(testUserId, testExerciseId);

      // 150 кг × 1 rep → 1RM = 150
      // 120 кг × 3 reps → 1RM = 120 × (1 + 3/30) = 132
      // 100 кг × 5 reps → 1RM = 100 × (1 + 5/30) ≈ 117
      // 80 кг × 10 reps → 1RM = 80 × (1 + 10/30) ≈ 107
      // Лучший = 150
      expect(records.best1RM).toBe(150);
    });
  });

  describe('18.3.5 История прогресса', () => {
    it('должен вернуть историю прогресса по упражнению', async () => {
      await workoutService.createWorkout(testUserId, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [{ reps: 5, weight: 100 }],
        }],
      });

      await workoutService.createWorkout(testUserId, {
        date: '2024-01-20',
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [{ reps: 5, weight: 110 }],
        }],
      });

      const history = await statisticsService.getProgressHistory(
        testUserId,
        testExerciseId,
        '2024-01-01',
        '2024-01-31'
      );

      expect(history).toHaveLength(2);
      expect(history[0].weight).toBe(100);
      expect(history[1].weight).toBe(110);
    });
  });

  describe('18.3.6 Dashboard метрики', () => {
    it('должен вернуть корректные Dashboard метрики', async () => {
      const today = new Date();
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      // Создаем тренировку сегодня
      await workoutService.createWorkout(testUserId, {
        date: formatDate(today),
        skillBlocks: [{
          exerciseName: 'Test Stats Back Squat',
          sets: [
            { reps: 5, weight: 100 },
            { reps: 5, weight: 100 },
          ],
        }],
      });

      const dashboard = await statisticsService.getDashboard(testUserId);

      expect(dashboard.workoutsThisMonth).toBeGreaterThanOrEqual(1);
      expect(dashboard.tonnageThisMonth).toBeGreaterThanOrEqual(1000); // 2 × 5 × 100 = 1000
      expect(dashboard.streak).toBeDefined();
      expect(dashboard.streak.days).toBeGreaterThanOrEqual(1);
      expect(dashboard.recentWorkouts).toBeDefined();
      expect(dashboard.recentWorkouts.length).toBeGreaterThanOrEqual(1);
    });

    it('должен вернуть нулевые метрики для пользователя без тренировок', async () => {
      const dashboard = await statisticsService.getDashboard(testUserId);

      expect(dashboard.workoutsThisMonth).toBe(0);
      expect(dashboard.tonnageThisMonth).toBe(0);
      expect(dashboard.streak.days).toBe(0);
      expect(dashboard.streak.weeks).toBe(0);
    });
  });
});
