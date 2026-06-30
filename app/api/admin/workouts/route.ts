import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { prisma } from '@/lib/prisma';


/** GET /api/admin/workouts — все тренировки */
export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const userId = searchParams.get('userId') || undefined;
  const date = searchParams.get('date') || undefined;
  const search = searchParams.get('search') || undefined;

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (date) where.date = date;
  if (search) {
    where.user = {
      OR: [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    };
  }

  const [workouts, total] = await Promise.all([
    prisma.workout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, date: true, comment: true, isClubTemplate: true, createdAt: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { skillBlocks: true, wodBlocks: true } },
      },
    }),
    prisma.workout.count({ where }),
  ]);

  return NextResponse.json({
    workouts: workouts.map(w => ({
      ...w,
      skillBlocksCount: w._count.skillBlocks,
      wodBlocksCount: w._count.wodBlocks,
      _count: undefined,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
