import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * DELETE /api/clubs/[id]/workouts/[workoutId]
 * Удаление тренировки владельцем/тренером клуба
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: clubId, workoutId } = await params;
    const { user } = authResult;

    // Проверяем роль в клубе
    const member = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } }
    });

    if (!member || (member.role !== 'OWNER' && member.role !== 'COACH')) {
      return NextResponse.json({ error: 'Недостаточно прав', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Проверяем что тренировка принадлежит участнику клуба
    const workout = await prisma.workout.findUnique({ where: { id: workoutId } });
    if (!workout) {
      return NextResponse.json({ message: 'Тренировка уже удалена' }, { status: 200 });
    }

    const workoutOwnerMember = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: workout.userId } }
    });

    if (!workoutOwnerMember) {
      return NextResponse.json({ error: 'Тренировка не принадлежит участнику клуба', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Удаляем тренировку (каскадно удалятся блоки)
    await prisma.workout.delete({ where: { id: workoutId } });

    return NextResponse.json({ message: 'Тренировка удалена' }, { status: 200 });
  } catch (error) {
    console.error('DELETE /api/clubs/[id]/workouts/[workoutId] error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
