import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WorkoutService } from '../workout.service';

const prisma = new PrismaClient();
const workoutService = new WorkoutService();

describe('WorkoutService.deleteWorkout', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testExerciseId: string;

  beforeAll(async () => {
    // Создаем тестовых пользователей
    const user1 = await prisma.user.create({
      data: {
        email: 'test-deleteworkout-1@example.com',
        passwordHash: 'hash1',
        verified: true
      }
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'test-deleteworkout-2@example.com',
        passwordHash: 'hash2',
        verified: true
      }
    });
    testUserId2 = user2.id;

    // Создаем тестовое упражнение
    const exercise = await prisma.exerciseDict.create({
      data: {
        name: 'Test Exercise Delete',
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
        name: 'Test Exercise Delete'
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
   * Требование 10.5: КОГДА пользователь удаляет тренировку,
   * ТО Система ДОЛЖНА каскадно удалить все связанные блоки и подходы
   */
  it('должен каскадно удалить тренировку со всеми связанными блоками и подходами', async () => {
    // Создаем тренировку с skill и WOD блоками
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15',
        comment: 'Test workout for deletion'
      }
    });

    // Создаем skill блок с подходами
    const skillBlock = await prisma.skillBlock.create({
      data: {
        workoutId: workout.id,
        exerciseDictId: testExerciseId
      }
    });

    await prisma.skillSet.createMany({
      data: [
        {
          skillBlockId: skillBlock.id,
          setNumber: 1,
          reps: 5,
          weight: 100
        },
        {
          skillBlockId: skillBlock.id,
          setNumber: 2,
          reps: 5,
          weight: 110
        }
      ]
    });

    // Создаем WOD блок с упражнениями
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

    await prisma.wodExercise.createMany({
      data: [
        {
          wodBlockId: wodBlock.id,
          exerciseDictId: testExerciseId,
          reps: 21,
          orderIndex: 1
        },
        {
          wodBlockId: wodBlock.id,
          exerciseDictId: testExerciseId,
          reps: 15,
          orderIndex: 2
        }
      ]
    });

    // Проверяем, что данные созданы
    const skillSetsCount = await prisma.skillSet.count({
      where: { skillBlockId: skillBlock.id }
    });
    const wodExercisesCount = await prisma.wodExercise.count({
      where: { wodBlockId: wodBlock.id }
    });
    expect(skillSetsCount).toBe(2);
    expect(wodExercisesCount).toBe(2);

    // Удаляем тренировку
    await workoutService.deleteWorkout(workout.id, testUserId1);

    // Проверяем, что тренировка удалена
    const deletedWorkout = await prisma.workout.findUnique({
      where: { id: workout.id }
    });
    expect(deletedWorkout).toBeNull();

    // Проверяем, что skill блоки удалены
    const remainingSkillBlocks = await prisma.skillBlock.count({
      where: { workoutId: workout.id }
    });
    expect(remainingSkillBlocks).toBe(0);

    // Проверяем, что skill подходы удалены
    const remainingSkillSets = await prisma.skillSet.count({
      where: { skillBlockId: skillBlock.id }
    });
    expect(remainingSkillSets).toBe(0);

    // Проверяем, что WOD блоки удалены
    const remainingWodBlocks = await prisma.wodBlock.count({
      where: { workoutId: workout.id }
    });
    expect(remainingWodBlocks).toBe(0);

    // Проверяем, что WOD упражнения удалены
    const remainingWodExercises = await prisma.wodExercise.count({
      where: { wodBlockId: wodBlock.id }
    });
    expect(remainingWodExercises).toBe(0);
  });

  /**
   * Требование 10.6: КОГДА пользователь повторно удаляет уже удаленную тренировку,
   * ТО Система ДОЛЖНА вернуть тот же результат (идемпотентность)
   */
  it('должен быть идемпотентным - повторное удаление не вызывает ошибку', async () => {
    // Создаем тренировку
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15',
        comment: 'Test idempotency'
      }
    });

    // Первое удаление
    await workoutService.deleteWorkout(workout.id, testUserId1);

    // Проверяем, что тренировка удалена
    const deletedWorkout = await prisma.workout.findUnique({
      where: { id: workout.id }
    });
    expect(deletedWorkout).toBeNull();

    // Повторное удаление не должно вызывать ошибку
    await expect(
      workoutService.deleteWorkout(workout.id, testUserId1)
    ).resolves.toBeUndefined();
  });

  /**
   * Требование 10.5: КОГДА пользователь пытается удалить чужую тренировку,
   * ТО Система ДОЛЖНА вернуть ошибку 403 Forbidden
   */
  it('должен выбросить ошибку FORBIDDEN при попытке удалить чужую тренировку', async () => {
    // Создаем тренировку для пользователя 1
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15',
        comment: 'User 1 workout'
      }
    });

    // Пытаемся удалить тренировку от имени пользователя 2
    await expect(
      workoutService.deleteWorkout(workout.id, testUserId2)
    ).rejects.toThrow('FORBIDDEN');

    // Проверяем, что тренировка НЕ удалена
    const existingWorkout = await prisma.workout.findUnique({
      where: { id: workout.id }
    });
    expect(existingWorkout).not.toBeNull();
  });

  /**
   * Edge case: Удаление несуществующей тренировки (идемпотентность)
   */
  it('должен успешно обработать удаление несуществующей тренировки', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    
    // Не должно вызывать ошибку
    await expect(
      workoutService.deleteWorkout(nonExistentId, testUserId1)
    ).resolves.toBeUndefined();
  });

  /**
   * Edge case: Удаление тренировки без блоков
   */
  it('должен успешно удалить тренировку без блоков', async () => {
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15',
        comment: 'Empty workout'
      }
    });

    await workoutService.deleteWorkout(workout.id, testUserId1);

    const deletedWorkout = await prisma.workout.findUnique({
      where: { id: workout.id }
    });
    expect(deletedWorkout).toBeNull();
  });

  /**
   * Edge case: Удаление тренировки только с skill блоками
   */
  it('должен успешно удалить тренировку только с skill блоками', async () => {
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15'
      }
    });

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

    await workoutService.deleteWorkout(workout.id, testUserId1);

    const deletedWorkout = await prisma.workout.findUnique({
      where: { id: workout.id }
    });
    expect(deletedWorkout).toBeNull();

    const remainingSkillBlocks = await prisma.skillBlock.count({
      where: { id: skillBlock.id }
    });
    expect(remainingSkillBlocks).toBe(0);
  });

  /**
   * Edge case: Удаление тренировки только с WOD блоками
   */
  it('должен успешно удалить тренировку только с WOD блоками', async () => {
    const workout = await prisma.workout.create({
      data: {
        userId: testUserId1,
        date: '2024-01-15'
      }
    });

    const wodBlock = await prisma.wodBlock.create({
      data: {
        workoutId: workout.id,
        wodType: 'AMRAP',
        level: 'SCALED',
        isLadder: false,
        resultType: 'REPS',
        resultDisplay: '5+12',
        resultTotalReps: 72
      }
    });

    await prisma.wodExercise.create({
      data: {
        wodBlockId: wodBlock.id,
        exerciseDictId: testExerciseId,
        reps: 10,
        orderIndex: 1
      }
    });

    await workoutService.deleteWorkout(workout.id, testUserId1);

    const deletedWorkout = await prisma.workout.findUnique({
      where: { id: workout.id }
    });
    expect(deletedWorkout).toBeNull();

    const remainingWodBlocks = await prisma.wodBlock.count({
      where: { id: wodBlock.id }
    });
    expect(remainingWodBlocks).toBe(0);
  });
});
