import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { StatisticsService } from '@/lib/services/statistics.service';
import { prisma } from '@/lib/prisma';

const statisticsService = new StatisticsService();

/**
 * GET /api/statistics/exercise/[exerciseId]
 * Получение статистики по упражнению
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  try {
    // Аутентификация
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const { exerciseId } = await params;

    // Парсинг query параметров
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Получение личных рекордов
    const personalRecords = await statisticsService.getPersonalRecords(
      user.id,
      exerciseId
    );

    // Получение истории прогресса
    const history = await statisticsService.getProgressHistory(
      user.id,
      exerciseId,
      startDate,
      endDate
    );

    // Получение названия упражнения
    const exercise = await prisma.exerciseDict.findUnique({
      where: { id: exerciseId },
      select: { name: true },
    });

    if (!exercise) {
      return NextResponse.json(
        { error: 'Exercise not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        exerciseName: exercise.name,
        personalRecords,
        progressHistory: history,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching exercise statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
