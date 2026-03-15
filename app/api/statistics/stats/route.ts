import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];

  let startDate: string;
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split('T')[0];
  } else if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = d.toISOString().split('T')[0];
  } else if (period === 'year') {
    const d = new Date(now.getFullYear(), 0, 1);
    startDate = d.toISOString().split('T')[0];
  } else {
    // all
    startDate = '2000-01-01';
  }

  return { startDate, endDate };
}

/**
 * GET /api/statistics/stats?period=week|month|year|all
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const { startDate, endDate } = getDateRange(period);

    // Fetch workouts in period with blocks
    const workouts = await prisma.workout.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        skillBlocks: {
          include: {
            exercise: true,
            sets: true,
          },
        },
        wodBlocks: true,
      },
      orderBy: { date: 'asc' },
    });

    const workoutsCount = workouts.length;
    const skillSessions = workouts.filter(w => w.skillBlocks.length > 0).length;
    const wodSessions = workouts.filter(w => w.wodBlocks.length > 0).length;

    // Personal records: best set per exercise (in period)
    // Also count newPRs: exercises where the max weight in the period is the all-time max
    const exerciseBestInPeriod: Map<string, { exerciseName: string; weight: number; date: string; reps: number }> = new Map();

    for (const workout of workouts) {
      for (const block of workout.skillBlocks) {
        const exName = block.exercise.name;
        for (const set of block.sets) {
          const w = Number(set.weight);
          const existing = exerciseBestInPeriod.get(exName);
          if (!existing || w > existing.weight) {
            exerciseBestInPeriod.set(exName, {
              exerciseName: exName,
              weight: w,
              date: workout.date,
              reps: set.reps,
            });
          }
        }
      }
    }

    const personalRecords = Array.from(exerciseBestInPeriod.values()).sort(
      (a, b) => b.weight - a.weight
    );

    // newPRs: count exercises where the period best is the all-time best
    let newPRs = 0;
    for (const [exName, periodBest] of exerciseBestInPeriod) {
      // Find all-time best for this exercise
      const allTimeBlocks = await prisma.skillBlock.findMany({
        where: {
          exercise: { name: exName },
          workout: { userId: user.id },
        },
        include: { sets: true },
      });
      let allTimeBest = 0;
      for (const b of allTimeBlocks) {
        for (const s of b.sets) {
          const w = Number(s.weight);
          if (w > allTimeBest) allTimeBest = w;
        }
      }
      if (periodBest.weight >= allTimeBest) {
        newPRs++;
      }
    }

    return NextResponse.json({
      workoutsCount,
      skillSessions,
      wodSessions,
      newPRs,
      personalRecords,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
