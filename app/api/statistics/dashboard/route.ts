import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { StatisticsService } from '@/lib/services/statistics.service';

const statisticsService = new StatisticsService();

/**
 * GET /api/statistics/dashboard
 * Получение метрик для Dashboard
 */
export async function GET(request: NextRequest) {
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

    // Получение метрик Dashboard
    const dashboard = await statisticsService.getDashboard(user.userId);

    return NextResponse.json(dashboard, { status: 200 });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
