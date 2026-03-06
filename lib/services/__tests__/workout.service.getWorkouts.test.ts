import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WorkoutService } from '../workout.service';

const prisma = new PrismaClient();

/**
 * Unit тесты для метода getWorkouts()
 * 
 * Валидирует:
 * - Требование 9.1: Изоляция данных пользователей
 * - Требование 9.2: Пагинация с параметром page
 * - Требование 9.3: Ограничение количества с параметром limit
 * - Требование 9.4: Фильтрация по диапазону дат
 * - Требование 9.5: Фильтрация по упражнению
 * - Требование 9.6: Сортировка по дате в порядке убывания
 */
describe('WorkoutService.getWorkouts()', () => {
  const workoutService = new WorkoutService();
  let testUser1: any;
  let testUser2: any;
  let testExercise: any;

  beforeEach(async () => {
    // Создаем тестовых пользователей
    testUser1 = await prisma.user.create({
      data: {
        email: 'test1@example.com',
        passwordHash: 'test-hash',
        verified: true
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        email: 'test2@example.com',
        passwordHash: 'test-hash',
        verified: true
      }
    });

    // Создаем тестовое упражнение
    testExercise = await prisma.exerciseDict.create({
      data: {
        name: 'Test Exercise',
        isGlobal: false,
        userId: testUser1.id
      }
    });
  });

  afterEach(async () => {
    // Очистка тестовых данных
    await prisma.skillSet.deleteMany({});
    await prisma.skillBlock.deleteMany({});
    await prisma.wodExercise.deleteMany({});
    await prisma.wodBlock.deleteMany({});
    await prisma.workout.deleteMany({});
    await prisma.exerciseDict.deleteMany({ where: { isGlobal: false } });
    await prisma.user.deleteMany({});
  });

  /**
   * Требование 9.1: Изоляция данных пользователей
   */
  describe('Требование 9.1: Изоляция данных пользователей', () => {
    it('возвращает только тренировки текущего пользователя', async () => {
      // Создаем тренировки для обоих пользователей
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser2.id, {
        date: '2024-01-16',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Получаем тренировки для user1
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10
      });

      // Проверяем, что возвращена только 1 тренировка
      expect(result.workouts.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.workouts[0].userId).toBe(testUser1.id);
    });
  });

  /**
   * Требование 9.2, 9.3: Пагинация
   */
  describe('Требование 9.2, 9.3: Пагинация', () => {
    it('возвращает правильную страницу результатов', async () => {
      // Создаем 5 тренировок
      for (let i = 1; i <= 5; i++) {
        await workoutService.createWorkout(testUser1.id, {
          date: `2024-01-${String(i).padStart(2, '0')}`,
          skillBlocks: [{
            exerciseName: 'Test Exercise',
            sets: [{ reps: 5, weight: 100 }]
          }]
        });
      }

      // Получаем первую страницу (2 элемента)
      const page1 = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 2
      });

      expect(page1.workouts.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);

      // Получаем вторую страницу
      const page2 = await workoutService.getWorkouts(testUser1.id, {
        page: 2,
        limit: 2
      });

      expect(page2.workouts.length).toBe(2);
      expect(page2.total).toBe(5);
      expect(page2.hasMore).toBe(true);

      // Получаем третью страницу (последняя)
      const page3 = await workoutService.getWorkouts(testUser1.id, {
        page: 3,
        limit: 2
      });

      expect(page3.workouts.length).toBe(1);
      expect(page3.total).toBe(5);
      expect(page3.hasMore).toBe(false);
    });

    it('ограничивает количество результатов параметром limit', async () => {
      // Создаем 10 тренировок
      for (let i = 1; i <= 10; i++) {
        await workoutService.createWorkout(testUser1.id, {
          date: `2024-01-${String(i).padStart(2, '0')}`,
          skillBlocks: [{
            exerciseName: 'Test Exercise',
            sets: [{ reps: 5, weight: 100 }]
          }]
        });
      }

      // Запрашиваем с limit = 3
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 3
      });

      expect(result.workouts.length).toBe(3);
      expect(result.total).toBe(10);
    });
  });

  /**
   * Требование 9.4: Фильтрация по диапазону дат
   */
  describe('Требование 9.4: Фильтрация по диапазону дат', () => {
    it('фильтрует тренировки по startDate', async () => {
      // Создаем тренировки в разные даты
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-20',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Фильтруем с startDate = 2024-01-15
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10,
        startDate: '2024-01-15'
      });

      expect(result.workouts.length).toBe(2);
      expect(result.total).toBe(2);
      // Проверяем, что все даты >= startDate
      result.workouts.forEach(w => {
        expect(w.date >= '2024-01-15').toBe(true);
      });
    });

    it('фильтрует тренировки по endDate', async () => {
      // Создаем тренировки в разные даты
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-20',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Фильтруем с endDate = 2024-01-15
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10,
        endDate: '2024-01-15'
      });

      expect(result.workouts.length).toBe(2);
      expect(result.total).toBe(2);
      // Проверяем, что все даты <= endDate
      result.workouts.forEach(w => {
        expect(w.date <= '2024-01-15').toBe(true);
      });
    });

    it('фильтрует тренировки по диапазону дат (startDate и endDate)', async () => {
      // Создаем тренировки в разные даты
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-05',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-20',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Фильтруем диапазоном 2024-01-10 до 2024-01-15
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10,
        startDate: '2024-01-10',
        endDate: '2024-01-15'
      });

      expect(result.workouts.length).toBe(2);
      expect(result.total).toBe(2);
      // Проверяем, что все даты в диапазоне
      result.workouts.forEach(w => {
        expect(w.date >= '2024-01-10').toBe(true);
        expect(w.date <= '2024-01-15').toBe(true);
      });
    });
  });

  /**
   * Требование 9.5: Фильтрация по упражнению
   */
  describe('Требование 9.5: Фильтрация по упражнению', () => {
    it('фильтрует тренировки по упражнению в skill блоках', async () => {
      // Создаем второе упражнение
      const exercise2 = await prisma.exerciseDict.create({
        data: {
          name: 'Another Exercise',
          isGlobal: false,
          userId: testUser1.id
        }
      });

      // Создаем тренировку с testExercise
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Создаем тренировку с exercise2
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-11',
        skillBlocks: [{
          exerciseName: 'Another Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Фильтруем по testExercise
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10,
        exerciseId: testExercise.id
      });

      expect(result.workouts.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.workouts[0].date).toBe('2024-01-10');
    });

    it('фильтрует тренировки по упражнению в WOD блоках', async () => {
      // Создаем второе упражнение
      const exercise2 = await prisma.exerciseDict.create({
        data: {
          name: 'Another Exercise',
          isGlobal: false,
          userId: testUser1.id
        }
      });

      // Создаем тренировку с testExercise в WOD
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-10',
        wodBlocks: [{
          wodType: 'FOR_TIME',
          level: 'RX',
          isLadder: false,
          resultDisplay: '10:30',
          resultSeconds: 630,
          exercises: [{
            exerciseName: 'Test Exercise',
            reps: 21
          }]
        }]
      });

      // Создаем тренировку с exercise2 в WOD
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-11',
        wodBlocks: [{
          wodType: 'FOR_TIME',
          level: 'RX',
          isLadder: false,
          resultDisplay: '12:00',
          resultSeconds: 720,
          exercises: [{
            exerciseName: 'Another Exercise',
            reps: 21
          }]
        }]
      });

      // Фильтруем по testExercise
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10,
        exerciseId: testExercise.id
      });

      expect(result.workouts.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.workouts[0].date).toBe('2024-01-10');
    });
  });

  /**
   * Требование 9.6: Сортировка по дате в порядке убывания
   */
  describe('Требование 9.6: Сортировка по дате в порядке убывания', () => {
    it('возвращает тренировки отсортированными по дате (новые первыми)', async () => {
      // Создаем тренировки в случайном порядке
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-20',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Получаем тренировки
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10
      });

      expect(result.workouts.length).toBe(3);
      
      // Проверяем сортировку (новые первыми)
      expect(result.workouts[0].date).toBe('2024-01-20');
      expect(result.workouts[1].date).toBe('2024-01-15');
      expect(result.workouts[2].date).toBe('2024-01-10');
    });
  });

  /**
   * Дополнительные тесты
   */
  describe('Дополнительные тесты', () => {
    it('возвращает пустой массив если нет тренировок', async () => {
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10
      });

      expect(result.workouts.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('загружает все вложенные данные (eager loading)', async () => {
      // Создаем тренировку с skill и WOD блоками
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-15',
        comment: 'Test workout',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [
            { reps: 5, weight: 100 },
            { reps: 5, weight: 110 }
          ]
        }],
        wodBlocks: [{
          wodType: 'FOR_TIME',
          level: 'RX',
          isLadder: false,
          resultDisplay: '10:30',
          resultSeconds: 630,
          exercises: [{
            exerciseName: 'Test Exercise',
            reps: 21
          }]
        }]
      });

      // Получаем тренировки
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10
      });

      expect(result.workouts.length).toBe(1);
      
      const workout = result.workouts[0];
      
      // Проверяем skill блоки
      expect(workout.skillBlocks.length).toBe(1);
      expect(workout.skillBlocks[0].sets.length).toBe(2);
      expect(workout.skillBlocks[0].exercise.name).toBe('Test Exercise');
      
      // Проверяем WOD блоки
      expect(workout.wodBlocks.length).toBe(1);
      expect(workout.wodBlocks[0].exercises.length).toBe(1);
      expect(workout.wodBlocks[0].exercises[0].exercise.name).toBe('Test Exercise');
    });

    it('комбинирует все фильтры одновременно', async () => {
      // Создаем второе упражнение
      const exercise2 = await prisma.exerciseDict.create({
        data: {
          name: 'Another Exercise',
          isGlobal: false,
          userId: testUser1.id
        }
      });

      // Создаем несколько тренировок
      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-05',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-10',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Another Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      await workoutService.createWorkout(testUser1.id, {
        date: '2024-01-20',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 100 }]
        }]
      });

      // Фильтруем: диапазон дат + упражнение + пагинация
      const result = await workoutService.getWorkouts(testUser1.id, {
        page: 1,
        limit: 10,
        startDate: '2024-01-08',
        endDate: '2024-01-18',
        exerciseId: testExercise.id
      });

      // Должна вернуться только одна тренировка (2024-01-10 с Test Exercise)
      expect(result.workouts.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.workouts[0].date).toBe('2024-01-10');
    });
  });
});
