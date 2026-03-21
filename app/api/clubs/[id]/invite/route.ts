import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ClubService } from '@/lib/services/club.service';
import { z } from 'zod';

const clubService = new ClubService();

const inviteSchema = z.object({
  maxUses: z.number().int().min(1).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * POST /api/clubs/[id]/invite — Создание инвайт-кода (OWNER/COACH)
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
    const body = await request.json().catch(() => ({}));
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ошибка валидации', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const invite = await clubService.createInvite(id, authResult.user.id, parsed.data);

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'NOT_MEMBER' || error.message === 'INSUFFICIENT_ROLE') {
      return NextResponse.json({ error: 'Недостаточно прав', code: 'FORBIDDEN' }, { status: 403 });
    }
    console.error('POST /api/clubs/[id]/invite error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
