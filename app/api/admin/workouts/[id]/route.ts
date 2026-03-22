import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** DELETE /api/admin/workouts/[id] — удаление тренировки */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  await prisma.workout.delete({ where: { id } });
  return NextResponse.json({ message: 'Тренировка удалена' });
}
