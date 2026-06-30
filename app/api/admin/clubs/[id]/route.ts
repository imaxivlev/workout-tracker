import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { prisma } from '@/lib/prisma';


/** GET /api/admin/clubs/[id] — детали клуба с участниками */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: { joinedAt: 'asc' },
      },
      _count: { select: { invites: true } },
    },
  });

  if (!club) return NextResponse.json({ error: 'Клуб не найден' }, { status: 404 });
  return NextResponse.json({ club });
}

/** PATCH /api/admin/clubs/[id] — редактирование клуба */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  const body = await request.json();
  const allowedFields: Record<string, boolean> = { name: true, city: true, description: true };
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowedFields[key]) data[key] = value;
  }

  const club = await prisma.club.update({ where: { id }, data });
  return NextResponse.json({ club });
}

/** DELETE /api/admin/clubs/[id] — удаление клуба */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { id } = await params;
  await prisma.club.delete({ where: { id } });
  return NextResponse.json({ message: 'Клуб удалён' });
}
