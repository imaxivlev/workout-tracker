import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ClubService } from '@/lib/services/club.service';

const clubService = new ClubService();

/**
 * GET /api/clubs/[id]/leaderboard
 *
 * Query params:
 * - type: 'wod' | 'monthly' | 'all' | 'skill'
 * - date: YYYY-MM-DD (для WOD)
 * - year/month (для monthly)
 * - signature (для фильтрации WOD)
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

    if (type === 'skill') {
      const entries = await clubService.getSkillLeaderboard(id);
      return NextResponse.json({ type: 'skill', entries });
    }

    if (type === 'all') {
      const entries = await clubService.getGeneralLeaderboard(id, 'all');
      return NextResponse.json({ type: 'all', entries });
    }

    // monthly
    const now = new Date();
    const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
    const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1));
    const entries = await clubService.getGeneralLeaderboard(id, 'month', year, month);
    return NextResponse.json({ type: 'monthly', year, month, entries });
  } catch (error: any) {
    console.error('GET /api/clubs/[id]/leaderboard error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
