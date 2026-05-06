import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/clubs/[id]/workouts/dates
 * Возвращает даты клубных шаблонов с типами (skill/wod) для пометки в календаре
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = await params;

    const workouts = await prisma.workout.findMany({
      where: {
        userId: authResult.user.id,
        isClubTemplate: true,
        isTemplateOnly: true,
      },
      select: {
        date: true,
        skillBlocks: { select: { id: true }, take: 1 },
        wodBlocks: { select: { id: true }, take: 1 },
      },
    });

    // Также берём шаблоны других участников клуба
    const clubWorkouts = await prisma.workout.findMany({
      where: {
        isClubTemplate: true,
        isTemplateOnly: true,
        user: {
          clubMemberships: {
            some: { clubId: id },
          },
        },
      },
      select: {
        date: true,
        skillBlocks: { select: { id: true }, take: 1 },
        wodBlocks: { select: { id: true }, take: 1 },
      },
    });

    const allWorkouts = [...workouts, ...clubWorkouts];
    const dates: Record<string, { hasSkill: boolean; hasWod: boolean }> = {};
    for (const w of allWorkouts) {
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
