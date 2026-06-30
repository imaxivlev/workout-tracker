/**
 * Тесты для новых полей тренировки:
 * - weightIsPercent: вес как % от 1RM в скилл-блоках
 * - hasGenderSplit / repsFemale / weightFemale / exerciseNameFemale: раздельные М/Ж в ВОД-блоках
 */
import { describe, it, expect, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WorkoutService } from '../workout.service';

const prisma = new PrismaClient();
const workoutService = new WorkoutService();

async function createUser() {
  return prisma.user.create({
    data: {
      email: `test-gp-${crypto.randomUUID()}@example.com`,
      passwordHash: 'test-hash',
      verified: true,
    },
  });
}

afterEach(async () => {
  const users = await prisma.user.findMany({ where: { email: { contains: 'test-gp-' } } });
  const userIds = users.map(u => u.id);
  if (userIds.length > 0) {
    const workouts = await prisma.workout.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const workoutIds = workouts.map(w => w.id);
    if (workoutIds.length > 0) {
      const skillBlocks = await prisma.skillBlock.findMany({ where: { workoutId: { in: workoutIds } }, select: { id: true } });
      const skillBlockIds = skillBlocks.map(sb => sb.id);
      if (skillBlockIds.length > 0) {
        await prisma.skillSet.deleteMany({ where: { skillBlockId: { in: skillBlockIds } } });
      }
      const wodBlocks = await prisma.wodBlock.findMany({ where: { workoutId: { in: workoutIds } }, select: { id: true } });
      const wodBlockIds = wodBlocks.map(wb => wb.id);
      if (wodBlockIds.length > 0) {
        await prisma.wodExercise.deleteMany({ where: { wodBlockId: { in: wodBlockIds } } });
      }
      await prisma.skillBlock.deleteMany({ where: { workoutId: { in: workoutIds } } });
      await prisma.wodBlock.deleteMany({ where: { workoutId: { in: workoutIds } } });
      await prisma.workout.deleteMany({ where: { id: { in: workoutIds } } });
    }
    await prisma.exerciseDict.deleteMany({ where: { userId: { in: userIds }, isGlobal: false } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

describe('WeightIsPercent в скилл-блоках', () => {
  it('сохраняет weightIsPercent: true в подходах', async () => {
    const user = await createUser();

    const workout = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      skillBlocks: [{
        exerciseName: 'Становая тяга',
        sets: [
          { reps: 5, weight: 80, weightIsPercent: true },
          { reps: 3, weight: 90, weightIsPercent: true },
        ],
      }],
    });

    expect(workout.skillBlocks).toHaveLength(1);
    const sets = workout.skillBlocks[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[0].weightIsPercent).toBe(true);
    expect(sets[0].weight).toBe(80);
    expect(sets[1].weightIsPercent).toBe(true);
    expect(sets[1].weight).toBe(90);
  });

  it('weightIsPercent по умолчанию false', async () => {
    const user = await createUser();

    const workout = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      skillBlocks: [{
        exerciseName: 'Жим лежа',
        sets: [{ reps: 5, weight: 100 }],
      }],
    });

    const sets = workout.skillBlocks[0].sets;
    expect(sets[0].weightIsPercent).toBe(false);
  });

  it('смешивает weightIsPercent и обычный вес в разных скилл-блоках', async () => {
    const user = await createUser();

    const workout = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      skillBlocks: [
        {
          exerciseName: 'Рывок',
          sets: [{ reps: 3, weight: 75, weightIsPercent: true }],
        },
        {
          exerciseName: 'Приседания со штангой на спине',
          sets: [{ reps: 5, weight: 120 }],
        },
      ],
    });

    expect(workout.skillBlocks[0].sets[0].weightIsPercent).toBe(true);
    expect(workout.skillBlocks[1].sets[0].weightIsPercent).toBe(false);
  });

  it('сохраняет weightIsPercent при обновлении тренировки', async () => {
    const user = await createUser();

    const created = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      skillBlocks: [{ exerciseName: 'Жим стоя', sets: [{ reps: 5, weight: 60 }] }],
    });

    const updated = await workoutService.updateWorkout(created.id, user.id, {
      skillBlocks: [{
        exerciseName: 'Жим стоя',
        sets: [{ reps: 5, weight: 70, weightIsPercent: true }],
      }],
    });

    expect(updated.skillBlocks[0].sets[0].weightIsPercent).toBe(true);
    expect(updated.skillBlocks[0].sets[0].weight).toBe(70);
  });
});

describe('Раздельные М/Ж в ВОД-блоках (hasGenderSplit)', () => {
  it('сохраняет hasGenderSplit: true с repsFemale и weightFemale', async () => {
    const user = await createUser();

    const workout = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      wodBlocks: [{
        wodType: 'FOR_TIME',
        level: 'RX',
        isLadder: false,
        hasGenderSplit: true,
        resultDisplay: '10:00',
        resultSeconds: 600,
        exercises: [{
          exerciseName: 'Становая тяга',
          reps: 10,
          weight: 100,
          repsFemale: 10,
          weightFemale: 70,
        }],
      }],
    });

    expect(workout.wodBlocks).toHaveLength(1);
    const block = workout.wodBlocks[0];
    expect(block.hasGenderSplit).toBe(true);
    const ex = block.exercises[0];
    expect(ex.reps).toBe(10);
    expect(ex.weight).toBe(100);
    expect(ex.repsFemale).toBe(10);
    expect(ex.weightFemale).toBe(70);
  });

  it('сохраняет exerciseNameFemale для разных упражнений у М/Ж', async () => {
    const user = await createUser();

    const workout = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      wodBlocks: [{
        wodType: 'FOR_TIME',
        level: 'RX',
        isLadder: false,
        hasGenderSplit: true,
        resultDisplay: '05:00',
        resultSeconds: 300,
        exercises: [{
          exerciseName: 'Подтягивания с весом',
          reps: 5,
          weight: 20,
          repsFemale: 5,
          weightFemale: 10,
          exerciseNameFemale: 'Подтягивания',
        }],
      }],
    });

    const ex = workout.wodBlocks[0].exercises[0];
    expect(ex.exerciseNameFemale).toBe('Подтягивания');
    expect(ex.weightFemale).toBe(10);
  });

  it('hasGenderSplit: false — repsFemale и weightFemale null', async () => {
    const user = await createUser();

    const workout = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      wodBlocks: [{
        wodType: 'AMRAP',
        level: 'RX',
        isLadder: false,
        hasGenderSplit: false,
        resultDisplay: '100',
        resultTotalReps: 100,
        exercises: [{
          exerciseName: 'Берпи',
          reps: 10,
        }],
      }],
    });

    const ex = workout.wodBlocks[0].exercises[0];
    expect(workout.wodBlocks[0].hasGenderSplit).toBe(false);
    expect(ex.repsFemale).toBeNull();
    expect(ex.weightFemale).toBeNull();
  });

  it('обновляет тренировку и добавляет hasGenderSplit', async () => {
    const user = await createUser();

    const created = await workoutService.createWorkout(user.id, {
      date: '2024-01-15',
      wodBlocks: [{
        wodType: 'FOR_TIME',
        level: 'RX',
        isLadder: false,
        hasGenderSplit: false,
        resultDisplay: '08:00',
        resultSeconds: 480,
        exercises: [{ exerciseName: 'Трастеры', reps: 21, weight: 43 }],
      }],
    });

    const updated = await workoutService.updateWorkout(created.id, user.id, {
      wodBlocks: [{
        wodType: 'FOR_TIME',
        level: 'RX',
        isLadder: false,
        hasGenderSplit: true,
        resultDisplay: '08:00',
        resultSeconds: 480,
        exercises: [{
          exerciseName: 'Трастеры',
          reps: 21,
          weight: 43,
          repsFemale: 21,
          weightFemale: 29,
        }],
      }],
    });

    const block = updated.wodBlocks[0];
    expect(block.hasGenderSplit).toBe(true);
    expect(block.exercises[0].repsFemale).toBe(21);
    expect(block.exercises[0].weightFemale).toBe(29);
  });
});
