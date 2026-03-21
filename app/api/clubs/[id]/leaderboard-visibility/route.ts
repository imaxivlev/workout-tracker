import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ClubService } from '@/lib/services/club.service';

const clubService = new ClubService();

/**
 * PATCH /api/clubs/[id]/leaderboard-visibility
 * Body: { show: boolean }
 * Текущий пользователь управляет своей видимостью
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const show = body.show === true;

    await clubService.updateLeaderboardVisibility(id, authResult.user.id, show);

    return NextResponse.json({ showInLeaderboard: show });
  } catch (error: any) {
    if (error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'Вы не состоите в этом клубе', code: 'NOT_MEMBER' }, { status: 403 });
    }
    console.error('PATCH leaderboard-visibility error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
