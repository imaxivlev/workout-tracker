import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { prisma } from '@/lib/prisma';


/** GET /api/admin/users/[id] — детали пользователя */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      verified: true, isAdmin: true, createdAt: true, updatedAt: true,
      _count: { select: { workouts: true } },
      clubMemberships: {
        select: { role: true, club: { select: { id: true, name: true } } },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

/** PATCH /api/admin/users/[id] — редактирование пользователя */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  const body = await request.json();

  // Привязка к клубу
  if (body.addToClub) {
    const { clubId, role } = body.addToClub;
    if (!clubId || !['OWNER', 'COACH', 'ATHLETE'].includes(role)) {
      return NextResponse.json({ error: 'Укажите clubId и role (OWNER/COACH/ATHLETE)' }, { status: 400 });
    }
    // Проверяем, нет ли уже членства
    const existing = await prisma.clubMember.findFirst({
      where: { userId: id, clubId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Пользователь уже в этом клубе' }, { status: 409 });
    }
    await prisma.clubMember.create({
      data: { userId: id, clubId, role },
    });
    return NextResponse.json({ message: 'Пользователь добавлен в клуб' });
  }

  // Изменение роли в клубе
  if (body.updateRoleInClub) {
    const { clubId, role } = body.updateRoleInClub;
    if (!clubId || !['OWNER', 'COACH', 'ATHLETE'].includes(role)) {
      return NextResponse.json({ error: 'Укажите clubId и role (OWNER/COACH/ATHLETE)' }, { status: 400 });
    }
    await prisma.clubMember.updateMany({
      where: { userId: id, clubId },
      data: { role },
    });
    return NextResponse.json({ message: 'Роль обновлена' });
  }

  // Отвязка от клуба
  if (body.removeFromClub) {
    const { clubId } = body.removeFromClub;
    await prisma.clubMember.deleteMany({
      where: { userId: id, clubId },
    });
    return NextResponse.json({ message: 'Пользователь удалён из клуба' });
  }

  const allowedFields: Record<string, boolean> = {
    firstName: true, lastName: true, email: true, verified: true, isAdmin: true,
  };

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowedFields[key]) data[key] = value;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      verified: true, isAdmin: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json({ user });
}

/** DELETE /api/admin/users/[id] — удаление пользователя */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;

  // Нельзя удалить самого себя
  if (id === auth.user.id) {
    return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: 'Пользователь удалён' });
}
