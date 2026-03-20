/**
 * Integration тесты для Migration Service
 *
 * Задача 18.4: Тестирование миграции данных из localStorage
 * - Успешная миграция валидных данных
 * - Обработка невалидных данных
 * - Сохранение оригинальных дат
 *
 * ВАЖНО: Для запуска необходим доступ к MySQL (workout_tracker_local)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MigrationService } from '../migration.service';

const prisma = new PrismaClient();
const migrationService = new MigrationService();

describe('MigrationService Integration Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-migration-integration@example.com',
        passwordHash: 'hash',
        verified: true,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.workout.deleteMany({ where: { userId: testUserId } });
    await prisma.exerciseDict.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.workout.deleteMany({ where: { userId: testUserId } });
    await prisma.exerciseDict.deleteMany({ where: { userId: testUserId } });
  });

  describe('18.4.1 Успешная миграция валидных данных', () => {
    it('должен мигрировать тренировку со skill блоками', async () => {
      const localStorageData = [
        {
          date: '2024-01-15',
          comment: 'Мигрированная тренировка',
          skillBlocks: [
            {
              exercise: 'Back Squat',
              sets: [
                { reps: 5, weight: 100 },
                { reps: 5, weight: 110 },
              ],
            },
          ],
          wodBlocks: [],
        },
      ];

      const result = await migrationService.migrateWorkouts(testUserId, localStorageData);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Проверяем что тренировка создана в БД
      const workouts = await prisma.workout.findMany({
        where: { userId: testUserId },
        include: {
          skillBlocks: { include: { sets: true, exercise: true } },
        },
      });

      expect(workouts).toHaveLength(1);
      expect(workouts[0].date).toBe('2024-01-15');
      expect(workouts[0].skillBlocks).toHaveLength(1);
      expect(workouts[0].skillBlocks[0].sets).toHaveLength(2);
    });

    it('должен мигрировать тренировку с WOD блоком', async () => {
      const localStorageData = [
        {
          date: '2024-01-16',
          wodBlocks: [
            {
              type: 'For Time',
              level: 'RX',
              isLadder: false,
              result: '15:30',
              exercises: [
                { name: 'Thruster', reps: 21, weight: 42.5 },
                { name: 'Pull-up', reps: 21 },
              ],
            },
          ],
        },
      ];

      const result = await migrationService.migrateWorkouts(testUserId, localStorageData);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('должен мигрировать несколько тренировок за раз', async () => {
      const localStorageData = [
        {
          date: '2024-01-10',
          skillBlocks: [{ exercise: 'Deadlift', sets: [{ reps: 5, weight: 140 }] }],
        },
        {
          date: '2024-01-12',
          skillBlocks: [{ exercise: 'Bench Press', sets: [{ reps: 8, weight: 80 }] }],
        },
        {
          date: '2024-01-14',
          skillBlocks: [{ exercise: 'Back Squat', sets: [{ reps: 5, weight: 120 }] }],
        },
      ];

      const result = await migrationService.migrateWorkouts(testUserId, localStorageData);

      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);

      const workouts = await prisma.workout.findMany({ where: { userId: testUserId } });
      expect(workouts).toHaveLength(3);
    });
  });

  describe('18.4.2 Обработка невалидных данных', () => {
    it('должен пропустить тренировку с невалидной датой и продолжить', async () => {
      const localStorageData = [
        {
          date: 'invalid-date',
          skillBlocks: [{ exercise: 'Back Squat', sets: [{ reps: 5, weight: 100 }] }],
        },
        {
          date: '2024-01-15',
          skillBlocks: [{ exercise: 'Back Squat', sets: [{ reps: 5, weight: 100 }] }],
        },
      ];

      const result = await migrationService.migrateWorkouts(testUserId, localStorageData);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('должен обработать пустой массив тренировок', async () => {
      const result = await migrationService.migrateWorkouts(testUserId, []);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('18.4.3 Сохранение оригинальных дат', () => {
    it('должен сохранить оригинальные даты тренировок при миграции', async () => {
      const dates = ['2023-06-15', '2023-09-20', '2024-01-05'];
      const localStorageData = dates.map(date => ({
        date,
        skillBlocks: [{ exercise: 'Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      }));

      await migrationService.migrateWorkouts(testUserId, localStorageData);

      const workouts = await prisma.workout.findMany({
        where: { userId: testUserId },
        orderBy: { date: 'asc' },
      });

      expect(workouts).toHaveLength(3);
      expect(workouts[0].date).toBe('2023-06-15');
      expect(workouts[1].date).toBe('2023-09-20');
      expect(workouts[2].date).toBe('2024-01-05');
    });
  });

  describe('18.4.4 Автоматическое создание упражнений', () => {
    it('должен автоматически создать пользовательские упражнения при миграции', async () => {
      const localStorageData = [
        {
          date: '2024-01-15',
          skillBlocks: [
            { exercise: 'Migration Custom Exercise 1', sets: [{ reps: 10, weight: 50 }] },
            { exercise: 'Migration Custom Exercise 2', sets: [{ reps: 8, weight: 60 }] },
          ],
        },
      ];

      await migrationService.migrateWorkouts(testUserId, localStorageData);

      // Проверяем что пользовательские упражнения созданы
      const exercises = await prisma.exerciseDict.findMany({
        where: {
          userId: testUserId,
          name: { startsWith: 'Migration Custom' },
        },
      });

      expect(exercises.length).toBeGreaterThanOrEqual(2);
      exercises.forEach(ex => {
        expect(ex.isGlobal).toBe(false);
        expect(ex.userId).toBe(testUserId);
      });
    });
  });
});
