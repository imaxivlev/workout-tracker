import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** PATCH /api/admin/exercises/[id] — редактирование упражнения */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.isGlobal !== undefined) data.isGlobal = body.isGlobal;

  const exercise = await prisma.exerciseDict.update({ where: { id }, data });
  return NextResponse.json({ exercise });
}

/** DELETE /api/admin/exercises/[id] — удаление упражнения */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  await prisma.exerciseDict.delete({ where: { id } });
  return NextResponse.json({ message: 'Упражнение удалено' });
}
