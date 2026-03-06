import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WorkoutService } from '../workout.service';

const prisma = new PrismaClient();
const workoutService = new WorkoutService();

describe('WorkoutService.getWorkoutById', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testWorkoutId: string;
  let testExerciseId: string;

  beforeAll(async () => {
    // Создаем тестовых пользователей
    const user1 = await prisma.user.create({
      data: {
        email: 'test-getworkoutbyid-1@example.com',
        passwordHash: 'hash1',
        verified: true
      }
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'test-getworkoutbyid-2@example.com',
        passwordHash: 'hash2',
        verified: true
      }
    });
    testUserId2 = user2.id;

    // Создаем тестовое упражнение
    const exercise = await prisma.exerciseDict.create({
      data: {
        name: 'Test Exercise GetById',
        isGlobal: true
      }
    });
    testExerciseId = exercise.id;
  });

  afterAll(async () => {
    // Очистка тестовых данных
    await prisma.workout.deleteMany({
      where: {
        userId: {
          in: [testUserId1, testUserId2]
        }
      }
    });
    await prisma.exerciseDict.deleteMany({
      where: {
        name: 'Test Exercise GetById'
      }
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUserId1, testUserId2]
        }
      }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Очистка тренировок перед каждым тестом
    await prisma.workout.deleteMany({
      where: {
        userId: {
          in: [testUserId1, testUserId2]
        }
      }
    });
  });

  /**
   * Требование 10.1: КОГДА пользователь запрашивает тренировку по ID,
   * ТО Система ДОЛЖНА вернуть полный объект со всеми вложенными блоками
   */
  it('должен вернуть полный объект тренировки со всеми вложенными блоками', async () => {
    // Создаем тренировку с skill и WOD блоками
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15',
        comment: 'Test workout'
      }
    });
    testWorkoutId = workout.id;

    // Создаем skill блок
    const skillBlock = await prisma.skillBlock.create({
      data: {
        workoutId: workout.id,
        exerciseDictId: testExerciseId
      }
    });

    await prisma.skillSet.create({
      data: {
        skillBlockId: skillBlock.id,
        setNumber: 1,
        reps: 5,
        weight: 100
      }
    });

    // Создаем WOD блок
    const wodBlock = await prisma.wodBlock.create({
      data: {
        workoutId: workout.id,
        wodType: 'FOR_TIME',
        level: 'RX',
        isLadder: false,
        resultType: 'TIME',
        resultDisplay: '10:30',
        resultSeconds: 630
      }
    });

    await prisma.wodExercise.create({
      data: {
        wodBlockId: wodBlock.id,
        exerciseDictId: testExerciseId,
        reps: 21,
        orderIndex: 1
      }
    });

    // Получаем тренировку
    const result = await workoutService.getWorkoutById(workout.id, testUserId1);

    // Проверяем, что вернулся полный объект
    expect(result).not.toBeNull();
    expect(result!.id).toBe(workout.id);
    expect(result!.userId).toBe(testUserId1);
    expect(result!.date).toBe('2024-01-15');
    expect(result!.comment).toBe('Test workout');

    // Проверяем skill блоки
    expect(result!.skillBlocks).toHaveLength(1);
    expect(result!.skillBlocks[0].exercise.name).toBe('Test Exercise GetById');
    expect(result!.skillBlocks[0].sets).toHaveLength(1);
    expect(result!.skillBlocks[0].sets[0].reps).toBe(5);
    expect(result!.skillBlocks[0].sets[0].weight).toBe(100);

    // Проверяем WOD блоки
    expect(result!.wodBlocks).toHaveLength(1);
    expect(result!.wodBlocks[0].wodType).toBe('FOR_TIME');
    expect(result!.wodBlocks[0].resultDisplay).toBe('10:30');
    expect(result!.wodBlocks[0].exercises).toHaveLength(1);
    expect(result!.wodBlocks[0].exercises[0].reps).toBe(21);
  });

  /**
   * Требование 10.2: КОГДА пользователь запрашивает чужую тренировку,
   * ТО Система ДОЛЖНА вернуть ошибку 403 Forbidden
   */
  it('должен выбросить ошибку FORBIDDEN при попытке доступа к чужой тренировке', async () => {
    // Создаем тренировку для пользователя 1
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15',
        comment: 'User 1 workout'
      }
    });

    // Пытаемся получить тренировку от имени пользователя 2
    await expect(
      workoutService.getWorkoutById(workout.id, testUserId2)
    ).rejects.toThrow('FORBIDDEN');
  });

  /**
   * Требование 10.3: КОГДА пользователь запрашивает несуществующую тренировку,
   * ТО Система ДОЛЖНА вернуть ошибку 404 Not Found
   */
  it('должен вернуть null для несуществующей тренировки', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    
    const result = await workoutService.getWorkoutById(nonExistentId, testUserId1);
    
    expect(result).toBeNull();
  });

  /**
   * Edge case: Тренировка без блоков
   */
  it('должен вернуть тренировку без блоков', async () => {
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15',
        comment: 'Empty workout'
      }
    });

    const result = await workoutService.getWorkoutById(workout.id, testUserId1);

    expect(result).not.toBeNull();
    expect(result!.skillBlocks).toHaveLength(0);
    expect(result!.wodBlocks).toHaveLength(0);
  });

  /**
   * Edge case: Тренировка с несколькими блоками
   */
  it('должен вернуть тренировку с несколькими skill блоками', async () => {
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15'
      }
    });

    // Создаем два skill блока
    const skillBlock1 = await prisma.skillBlock.create({
      data: {
        workoutId: workout.id,
        exerciseDictId: testExerciseId
      }
    });

    await prisma.skillSet.create({
      data: {
        skillBlockId: skillBlock1.id,
        setNumber: 1,
        reps: 5,
        weight: 100
      }
    });

    const skillBlock2 = await prisma.skillBlock.create({
      data: {
        workoutId: workout.id,
        exerciseDictId: testExerciseId
      }
    });

    await prisma.skillSet.create({
      data: {
        skillBlockId: skillBlock2.id,
        setNumber: 1,
        reps: 10,
        weight: 50
      }
    });

    const result = await workoutService.getWorkoutById(workout.id, testUserId1);

    expect(result).not.toBeNull();
    expect(result!.skillBlocks).toHaveLength(2);
  });
});
