import { WorkoutService } from '../workout.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const workoutService = new WorkoutService();

/**
 * Unit тесты для метода updateWorkout()
 * 
 * Требование 10.4: КОГДА пользователь обновляет тренировку, 
 * ТО Система ДОЛЖНА проверить, что userId совпадает
 */

describe('WorkoutService.updateWorkout()', () => {
  let testUserId: string;
  let otherUserId: string;
  let workoutId: string;

  beforeAll(async () => {
    // Создаем тестовых пользователей
    const user1 = await prisma.user.create({
      data: {
        email: `test-update-${Date.now()}@example.com`,
        passwordHash: 'hash',
        verified: true
      }
    });
    testUserId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `test-update-other-${Date.now()}@example.com`,
        passwordHash: 'hash',
        verified: true
      }
    });
    otherUserId = user2.id;

    // Создаем тестовую тренировку
    const workout = await workoutService.createWorkout(testUserId, {
      date: '2024-01-15',
      comment: 'Original comment',
      skillBlocks: [
        {
          exerciseName: 'Back Squat',
          sets: [
            { reps: 5, weight: 100 },
            { reps: 5, weight: 110 }
          ]
        }
      ]
    });
    workoutId = workout.id;
  });

  afterAll(async () => {
    // Очистка тестовых данных
    await prisma.workout.deleteMany({
      where: { userId: { in: [testUserId, otherUserId] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, otherUserId] } }
    });
    await prisma.$disconnect();
  });

  test('должен обновить комментарий тренировки', async () => {
    const updated = await workoutService.updateWorkout(
      workoutId,
      testUserId,
      {
        comment: 'Updated comment'
      }
    );

    expect(updated.comment).toBe('Updated comment');
    expect(updated.date).toBe('2024-01-15');
    expect(updated.skillBlocks).toHaveLength(1);
  });

  test('должен обновить дату тренировки', async () => {
    const updated = await workoutService.updateWorkout(
      workoutId,
      testUserId,
      {
        date: '2024-01-20'
      }
    );

    expect(updated.date).toBe('2024-01-20');
    expect(updated.comment).toBe('Updated comment'); // Предыдущее значение
  });

  test('должен обновить skill блоки', async () => {
    const updated = await workoutService.updateWorkout(
      workoutId,
      testUserId,
      {
        skillBlocks: [
          {
            exerciseName: 'Deadlift',
            sets: [
              { reps: 3, weight: 150 },
              { reps: 3, weight: 160 },
              { reps: 3, weight: 170 }
            ]
          }
        ]
      }
    );

    expect(updated.skillBlocks).toHaveLength(1);
    expect(updated.skillBlocks[0].exercise.name).toBe('Deadlift');
    expect(updated.skillBlocks[0].sets).toHaveLength(3);
    expect(updated.skillBlocks[0].sets[0].weight).toBe(150);
  });

  test('должен добавить WOD блок к существующей тренировке', async () => {
    const updated = await workoutService.updateWorkout(
      workoutId,
      testUserId,
      {
        wodBlocks: [
          {
            wodType: 'FOR_TIME',
            level: 'RX',
            isLadder: false,
            resultDisplay: '12:30',
            resultSeconds: 750,
            exercises: [
              { exerciseName: 'Pull-ups', reps: 21 },
              { exerciseName: 'Push-ups', reps: 21 }
            ]
          }
        ]
      }
    );

    expect(updated.wodBlocks).toHaveLength(1);
    expect(updated.wodBlocks[0].wodType).toBe('FOR_TIME');
    expect(updated.wodBlocks[0].exercises).toHaveLength(2);
  });

  test('должен выбросить FORBIDDEN при попытке обновить чужую тренировку', async () => {
    await expect(
      workoutService.updateWorkout(
        workoutId,
        otherUserId, // Другой пользователь
        {
          comment: 'Hacker comment'
        }
      )
    ).rejects.toThrow('FORBIDDEN');
  });

  test('должен выбросить NOT_FOUND для несуществующей тренировки', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    
    await expect(
      workoutService.updateWorkout(
        fakeId,
        testUserId,
        {
          comment: 'Test'
        }
      )
    ).rejects.toThrow('NOT_FOUND');
  });

  test('должен удалить все блоки при передаче пустых массивов', async () => {
    const updated = await workoutService.updateWorkout(
      workoutId,
      testUserId,
      {
        skillBlocks: [],
        wodBlocks: []
      }
    );

    expect(updated.skillBlocks).toHaveLength(0);
    expect(updated.wodBlocks).toHaveLength(0);
  });

  test('должен обновить несколько полей одновременно', async () => {
    const updated = await workoutService.updateWorkout(
      workoutId,
      testUserId,
      {
        date: '2024-01-25',
        comment: 'Final comment',
        skillBlocks: [
          {
            exerciseName: 'Front Squat',
            sets: [
              { reps: 5, weight: 80 }
            ]
          }
        ]
      }
    );

    expect(updated.date).toBe('2024-01-25');
    expect(updated.comment).toBe('Final comment');
    expect(updated.skillBlocks).toHaveLength(1);
    expect(updated.skillBlocks[0].exercise.name).toBe('Front Squat');
  });
});
