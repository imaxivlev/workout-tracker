import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { prisma } from '@/lib/prisma';


/** GET /api/admin/users — список пользователей с пагинацией и поиском */
export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const search = searchParams.get('search') || '';

  const where = search
    ? {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        verified: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { workouts: true, clubMemberships: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map(u => ({
      ...u,
      workoutsCount: u._count.workouts,
      clubsCount: u._count.clubMemberships,
      _count: undefined,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
