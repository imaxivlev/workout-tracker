import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ClubService } from '@/lib/services/club.service';
import { z } from 'zod';

const clubService = new ClubService();

const updateClubSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional(),
  city: z.string().max(100).optional(),
  logo: z.string().max(500).optional(),
});

/**
 * GET /api/clubs/[id] — Получение клуба по ID
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
    const club = await clubService.getClubById(id, authResult.user.id);

    if (!club) {
      return NextResponse.json({ error: 'Клуб не найден', code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ club });
  } catch (error: any) {
    console.error('GET /api/clubs/[id] error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * PATCH /api/clubs/[id] — Обновление клуба (OWNER/COACH)
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
    const parsed = updateClubSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Ошибка валидации', code: 'VALIDATION_ERROR',
        details: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
      }, { status: 400 });
    }

    const club = await clubService.updateClub(id, authResult.user.id, parsed.data);

    return NextResponse.json({ club });
  } catch (error: any) {
    if (error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'Вы не состоите в этом клубе', code: 'NOT_MEMBER' }, { status: 403 });
    }
    if (error.message === 'INSUFFICIENT_ROLE') {
      return NextResponse.json({ error: 'Недостаточно прав', code: 'INSUFFICIENT_ROLE' }, { status: 403 });
    }
    console.error('PATCH /api/clubs/[id] error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
