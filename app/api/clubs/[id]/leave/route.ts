import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ClubService } from '@/lib/services/club.service';

const clubService = new ClubService();

/**
 * POST /api/clubs/[id]/leave — Выход из клуба
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = await params;
    await clubService.leaveClub(id, authResult.user.id);

    return NextResponse.json({ message: 'Вы вышли из клуба' });
  } catch (error: any) {
    if (error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'Вы не состоите в этом клубе', code: 'NOT_MEMBER' }, { status: 404 });
    }
    if (error.message === 'LAST_OWNER') {
      return NextResponse.json({ error: 'Невозможно выйти: вы единственный владелец. Назначьте другого владельца.', code: 'LAST_OWNER' }, { status: 409 });
    }
    console.error('POST /api/clubs/[id]/leave error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
