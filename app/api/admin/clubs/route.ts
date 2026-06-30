import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { prisma } from '@/lib/prisma';


/** GET /api/admin/clubs — список клубов */
export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const search = searchParams.get('search') || '';

  const where = search
    ? { OR: [{ name: { contains: search } }, { city: { contains: search } }] }
    : {};

  const [clubs, total] = await Promise.all([
    prisma.club.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, slug: true, city: true, createdAt: true,
        _count: { select: { members: true } },
      },
    }),
    prisma.club.count({ where }),
  ]);

  return NextResponse.json({
    clubs: clubs.map(c => ({ ...c, membersCount: c._count.members, _count: undefined })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
