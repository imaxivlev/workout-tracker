import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ClubService } from '@/lib/services/club.service';

const clubService = new ClubService();

/**
 * GET /api/clubs/[id]/leaderboard — Лидерборд клуба
 *
 * Query params:
 * - type: 'wod' | 'monthly' (по умолчанию 'monthly')
 * - date: YYYY-MM-DD (для WOD лидерборда, по умолчанию сегодня)
 * - year: число (для monthly, по умолчанию текущий год)
 * - month: число 1-12 (для monthly, по умолчанию текущий месяц)
 * - signature: строка (опционально, для фильтрации WOD по сигнатуре)
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
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'monthly';

    if (type === 'wod') {
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
      const signature = url.searchParams.get('signature') || undefined;

      const entries = await clubService.getWodLeaderboard(id, date, signature);
      return NextResponse.json({ type: 'wod', date, entries });
    }

    // monthly
    const now = new Date();
    const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
    const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1));

    const entries = await clubService.getMonthlyLeaderboard(id, year, month);
    return NextResponse.json({ type: 'monthly', year, month, entries });
  } catch (error: any) {
    console.error('GET /api/clubs/[id]/leaderboard error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
