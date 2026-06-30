import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { WorkoutService } from '@/lib/services/workout.service';
import { prisma } from '@/lib/prisma';


/** GET /api/admin/workouts/[id] — полная тренировка с блоками */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      skillBlocks: {
        include: { exercise: true, sets: { orderBy: { setNumber: 'asc' } } },
      },
      wodBlocks: {
        include: {
          exercises: {
            include: { exercise: true, exerciseFemale: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });

  if (!workout) return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
  return NextResponse.json({ workout });
}

/** PATCH /api/admin/workouts/[id] — редактирование тренировки (полный payload через WorkoutService) */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  const body = await request.json();

  // Полное редактирование (skillBlocks / wodBlocks) — через WorkoutService, передаём userId владельца
  if (body.skillBlocks !== undefined || body.wodBlocks !== undefined) {
    const existing = await prisma.workout.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });

    const workoutService = new WorkoutService();
    const workout = await workoutService.updateWorkout(id, existing.userId, body);
    return NextResponse.json({ workout });
  }

  // Простое редактирование (date, comment, isClubTemplate)
  const allowedFields: Record<string, boolean> = { date: true, comment: true, isClubTemplate: true };
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowedFields[key]) data[key] = value;
  }
  const workout = await prisma.workout.update({ where: { id }, data });
  return NextResponse.json({ workout });
}

/** DELETE /api/admin/workouts/[id] — удаление тренировки */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  await prisma.workout.delete({ where: { id } });
  return NextResponse.json({ message: 'Тренировка удалена' });
}
