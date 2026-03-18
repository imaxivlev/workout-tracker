import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';
import { ruToEnName } from '@/lib/exercise-names';

const prisma = new PrismaClient();

/**
 * GET /api/exercises/history?name=EXERCISE_NAME
 * Returns the last skill block for an exercise with the highest weight set and its date.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const excludeWorkoutId = searchParams.get('excludeWorkoutId');

    if (!name) {
      return NextResponse.json({ lastWeight: null, lastDate: null });
    }

    // Конвертируем русское название в английское для поиска в БД
    const enName = ruToEnName(name);
    const nameFilter = enName !== name ? [name, enName] : [name];

    const skillBlocks = await prisma.skillBlock.findMany({
      where: {
        exercise: { name: { in: nameFilter } },
        workout: {
          userId: user.id,
          ...(excludeWorkoutId ? { id: { not: excludeWorkoutId } } : {}),
        },
        sets: { some: {} },
      },
      include: {
        sets: true,
        workout: { select: { date: true } },
      },
      orderBy: {
        workout: { date: 'desc' },
      },
    });

    if (skillBlocks.length === 0) {
      return NextResponse.json({ lastWeight: null, lastDate: null });
    }

    // Find the most recent block and its best weight
    const lastBlock = skillBlocks[0];
    let bestWeight = 0;
    for (const set of lastBlock.sets) {
      const w = Number(set.weight);
      if (w > bestWeight) bestWeight = w;
    }

    return NextResponse.json({
      lastWeight: bestWeight > 0 ? bestWeight : null,
      lastDate: lastBlock.workout.date,
    });
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
