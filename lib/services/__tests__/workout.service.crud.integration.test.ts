/**
 * Integration тесты для Workout CRUD
 *
 * Задача 18.2: Тестирование создания, получения, обновления и удаления тренировок
 *
 * ВАЖНО: Для запуска необходим доступ к MySQL (workout_tracker_local)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WorkoutService } from '../workout.service';

const prisma = new PrismaClient();
const workoutService = new WorkoutService();

describe('WorkoutService CRUD Integration Tests', () => {
  let testUserId1: string;
  let testUserId2: string;
  let globalExerciseId: string;

  beforeAll(async () => {
    // Создаем тестовых пользователей
    const user1 = await prisma.user.create({
      data: {
        email: 'test-crud-integration-1@example.com',
        passwordHash: 'hash1',
        verified: true,
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'test-crud-integration-2@example.com',
        passwordHash: 'hash2',
        verified: true,
      },
    });
    testUserId2 = user2.id;

    // Создаем глобальное упражнение
    const exercise = await prisma.exerciseDict.create({
      data: {
        name: 'Test CRUD Back Squat',
        isGlobal: true,
      },
    });
    globalExerciseId = exercise.id;
  });

  afterAll(async () => {
    // Очистка в правильном порядке (foreign keys)
    await prisma.workout.deleteMany({
      where: { userId: { in: [testUserId1, testUserId2] } },
    });
    await prisma.exerciseDict.deleteMany({
      where: { name: { startsWith: 'Test CRUD' } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId1, testUserId2] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Очищаем тренировки перед каждым тестом
    await prisma.workout.deleteMany({
      where: { userId: { in: [testUserId1, testUserId2] } },
    });
    // Очищаем пользовательские упражнения
    await prisma.exerciseDict.deleteMany({
      where: { userId: { in: [testUserId1, testUserId2] } },
    });
  });

  describe('18.2.1 Создание тренировки с skill и WOD блоками', () => {
    it('должен создать тренировку с skill блоком', async () => {
      const result = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-15',
        comment: 'Силовая тренировка',
        skillBlocks: [
          {
            exerciseName: 'Test CRUD Back Squat',
            sets: [
              { reps: 5, weight: 100 },
              { reps: 5, weight: 110 },
              { reps: 3, weight: 120 },
            ],
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.date).toBe('2024-01-15');
      expect(result.comment).toBe('Силовая тренировка');
      expect(result.skillBlocks).toHaveLength(1);
      expect(result.skillBlocks[0].exercise.name).toBe('Test CRUD Back Squat');
      expect(result.skillBlocks[0].sets).toHaveLength(3);
      expect(result.skillBlocks[0].sets[0].weight).toBe(100);
      expect(result.skillBlocks[0].sets[1].weight).toBe(110);
      expect(result.skillBlocks[0].sets[2].weight).toBe(120);
    });

    it('должен создать тренировку с WOD блоком FOR_TIME', async () => {
      const result = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-16',
        wodBlocks: [
          {
            wodType: 'FOR_TIME',
            level: 'RX',
            isLadder: false,
            resultDisplay: '12:45',
            resultSeconds: 765,
            exercises: [
              { exerciseName: 'Test CRUD Back Squat', reps: 21, weight: 42.5 },
            ],
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.wodBlocks).toHaveLength(1);
      expect(result.wodBlocks[0].wodType).toBe('FOR_TIME');
      expect(result.wodBlocks[0].level).toBe('RX');
      expect(result.wodBlocks[0].resultDisplay).toBe('12:45');
      expect(result.wodBlocks[0].resultSeconds).toBe(765);
      expect(result.wodBlocks[0].exercises).toHaveLength(1);
    });

    it('должен создать тренировку со skill и WOD блоками одновременно', async () => {
      const result = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-17',
        comment: 'Комбинированная тренировка',
        skillBlocks: [
          {
            exerciseName: 'Test CRUD Back Squat',
            sets: [{ reps: 5, weight: 80 }],
          },
        ],
        wodBlocks: [
          {
            wodType: 'AMRAP',
            level: 'SCALED',
            isLadder: false,
            resultDisplay: '5+12',
            resultTotalReps: 87,
            exercises: [
              { exerciseName: 'Test CRUD Back Squat', reps: 15 },
            ],
          },
        ],
      });

      expect(result.skillBlocks).toHaveLength(1);
      expect(result.wodBlocks).toHaveLength(1);
      expect(result.wodBlocks[0].wodType).toBe('AMRAP');
      expect(result.wodBlocks[0].resultTotalReps).toBe(87);
    });

    it('должен автоматически создать пользовательское упражнение', async () => {
      const result = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-18',
        skillBlocks: [
          {
            exerciseName: 'Test CRUD Новое Упражнение',
            sets: [{ reps: 10, weight: 50 }],
          },
        ],
      });

      expect(result.skillBlocks[0].exercise.name).toBe('Test CRUD Новое Упражнение');

      // Проверяем что упражнение создано в БД
      const exercise = await prisma.exerciseDict.findFirst({
        where: { name: 'Test CRUD Новое Упражнение', userId: testUserId1 },
      });
      expect(exercise).not.toBeNull();
      expect(exercise!.isGlobal).toBe(false);
    });
  });

  describe('18.2.2 Получение списка тренировок с фильтрацией', () => {
    beforeEach(async () => {
      // Создаем несколько тренировок для тестирования
      await workoutService.createWorkout(testUserId1, {
        date: '2024-01-10',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      });
      await workoutService.createWorkout(testUserId1, {
        date: '2024-01-15',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 3, weight: 120 }] }],
      });
      await workoutService.createWorkout(testUserId1, {
        date: '2024-02-01',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 110 }] }],
      });
    });

    it('должен вернуть все тренировки пользователя', async () => {
      const result = await workoutService.getWorkouts(testUserId1, { page: 1, limit: 10 });

      expect(result.workouts).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('должен поддерживать пагинацию', async () => {
      const page1 = await workoutService.getWorkouts(testUserId1, { page: 1, limit: 2 });
      expect(page1.workouts).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await workoutService.getWorkouts(testUserId1, { page: 2, limit: 2 });
      expect(page2.workouts).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it('должен фильтровать по диапазону дат', async () => {
      const result = await workoutService.getWorkouts(testUserId1, {
        page: 1,
        limit: 10,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result.workouts).toHaveLength(2);
      result.workouts.forEach((w: any) => {
        expect(w.date >= '2024-01-01').toBe(true);
        expect(w.date <= '2024-01-31').toBe(true);
      });
    });

    it('должен сортировать по дате в порядке убывания', async () => {
      const result = await workoutService.getWorkouts(testUserId1, { page: 1, limit: 10 });

      for (let i = 1; i < result.workouts.length; i++) {
        expect(result.workouts[i - 1].date >= result.workouts[i].date).toBe(true);
      }
    });
  });

  describe('18.2.3 Обновление тренировки', () => {
    it('должен обновить комментарий тренировки', async () => {
      const created = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-20',
        comment: 'Старый комментарий',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      });

      const updated = await workoutService.updateWorkout(created.id, testUserId1, {
        comment: 'Новый комментарий',
      });

      expect(updated.comment).toBe('Новый комментарий');
      expect(updated.date).toBe('2024-01-20');
    });

    it('должен обновить дату тренировки', async () => {
      const created = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-20',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      });

      const updated = await workoutService.updateWorkout(created.id, testUserId1, {
        date: '2024-01-21',
      });

      expect(updated.date).toBe('2024-01-21');
    });

    it('должен выбросить ошибку при обновлении чужой тренировки', async () => {
      const created = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-20',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      });

      await expect(
        workoutService.updateWorkout(created.id, testUserId2, { comment: 'Hack!' })
      ).rejects.toThrow('FORBIDDEN');
    });
  });

  describe('18.2.4 Удаление тренировки', () => {
    it('должен удалить тренировку и все связанные данные', async () => {
      const created = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-20',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
        wodBlocks: [{
          wodType: 'FOR_TIME',
          level: 'RX',
          isLadder: false,
          resultDisplay: '10:00',
          resultSeconds: 600,
          exercises: [{ exerciseName: 'Test CRUD Back Squat', reps: 21 }],
        }],
      });

      await workoutService.deleteWorkout(created.id, testUserId1);

      // Проверяем что тренировка удалена
      const workout = await prisma.workout.findUnique({ where: { id: created.id } });
      expect(workout).toBeNull();

      // Проверяем каскадное удаление skill блоков
      const skillBlocks = await prisma.skillBlock.findMany({ where: { workoutId: created.id } });
      expect(skillBlocks).toHaveLength(0);

      // Проверяем каскадное удаление WOD блоков
      const wodBlocks = await prisma.wodBlock.findMany({ where: { workoutId: created.id } });
      expect(wodBlocks).toHaveLength(0);
    });

    it('должен быть идемпотентным (повторное удаление не вызывает ошибку)', async () => {
      const created = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-20',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      });

      // Первое удаление
      await workoutService.deleteWorkout(created.id, testUserId1);

      // Повторное удаление не должно бросать ошибку
      await expect(
        workoutService.deleteWorkout(created.id, testUserId1)
      ).resolves.not.toThrow();
    });

    it('должен выбросить ошибку при удалении чужой тренировки', async () => {
      const created = await workoutService.createWorkout(testUserId1, {
        date: '2024-01-20',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      });

      await expect(
        workoutService.deleteWorkout(created.id, testUserId2)
      ).rejects.toThrow('FORBIDDEN');

      // Тренировка всё ещё существует
      const workout = await prisma.workout.findUnique({ where: { id: created.id } });
      expect(workout).not.toBeNull();
    });
  });

  describe('18.2.5 Изоляция данных между пользователями', () => {
    it('пользователь не должен видеть тренировки другого', async () => {
      await workoutService.createWorkout(testUserId1, {
        date: '2024-01-20',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 5, weight: 100 }] }],
      });

      await workoutService.createWorkout(testUserId2, {
        date: '2024-01-20',
        skillBlocks: [{ exerciseName: 'Test CRUD Back Squat', sets: [{ reps: 3, weight: 80 }] }],
      });

      const user1Workouts = await workoutService.getWorkouts(testUserId1, { page: 1, limit: 10 });
      const user2Workouts = await workoutService.getWorkouts(testUserId2, { page: 1, limit: 10 });

      expect(user1Workouts.total).toBe(1);
      expect(user2Workouts.total).toBe(1);

      // Проверяем что данные изолированы
      expect(user1Workouts.workouts[0].userId).toBe(testUserId1);
      expect(user2Workouts.workouts[0].userId).toBe(testUserId2);
    });
  });
});
