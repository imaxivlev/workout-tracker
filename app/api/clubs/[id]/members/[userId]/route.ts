import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ClubService } from '@/lib/services/club.service';
import { ClubRole } from '@prisma/client';
import { z } from 'zod';

const clubService = new ClubService();

const updateRoleSchema = z.object({
  role: z.enum(['OWNER', 'COACH', 'ATHLETE']),
});

/**
 * PATCH /api/clubs/[id]/members/[userId] — Изменение роли участника (OWNER)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id, userId } = await params;
    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Невалидная роль', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    await clubService.updateMemberRole(id, authResult.user.id, userId, parsed.data.role as ClubRole);

    return NextResponse.json({ message: 'Роль обновлена' });
  } catch (error: any) {
    if (error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'Участник не найден', code: 'NOT_FOUND' }, { status: 404 });
    }
    if (error.message === 'INSUFFICIENT_ROLE') {
      return NextResponse.json({ error: 'Недостаточно прав', code: 'FORBIDDEN' }, { status: 403 });
    }
    if (error.message === 'CANNOT_CHANGE_OWN_ROLE') {
      return NextResponse.json({ error: 'Нельзя изменить собственную роль', code: 'FORBIDDEN' }, { status: 403 });
    }
    console.error('PATCH /api/clubs/[id]/members/[userId] error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * DELETE /api/clubs/[id]/members/[userId] — Удаление участника (OWNER)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id, userId } = await params;
    await clubService.removeMember(id, authResult.user.id, userId);

    return NextResponse.json({ message: 'Участник удалён из клуба' });
  } catch (error: any) {
    if (error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'Участник не найден', code: 'NOT_FOUND' }, { status: 404 });
    }
    if (error.message === 'INSUFFICIENT_ROLE') {
      return NextResponse.json({ error: 'Недостаточно прав', code: 'FORBIDDEN' }, { status: 403 });
    }
    if (error.message === 'CANNOT_REMOVE_SELF') {
      return NextResponse.json({ error: 'Используйте выход из клуба для удаления себя', code: 'FORBIDDEN' }, { status: 403 });
    }
    console.error('DELETE /api/clubs/[id]/members/[userId] error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
