import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/workouts/dates
 *
 * Возвращает даты тренировок с типами (skill/wod) для пометки в календаре
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const workouts = await prisma.workout.findMany({
      where: { userId: authResult.user.id },
      select: {
        date: true,
        skillBlocks: { select: { id: true }, take: 1 },
        wodBlocks: { select: { id: true }, take: 1 },
      },
    });

    const dates: Record<string, { hasSkill: boolean; hasWod: boolean }> = {};
    for (const w of workouts) {
      const existing = dates[w.date];
      dates[w.date] = {
        hasSkill: (existing?.hasSkill || false) || w.skillBlocks.length > 0,
        hasWod: (existing?.hasWod || false) || w.wodBlocks.length > 0,
      };
    }

    return NextResponse.json({ dates });
  } catch {
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
