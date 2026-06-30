import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { prisma } from '@/lib/prisma';


/** GET /api/admin — дашборд: общая статистика */
export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const [usersCount, clubsCount, workoutsCount, exercisesCount, consentsCount] = await Promise.all([
    prisma.user.count(),
    prisma.club.count(),
    prisma.workout.count(),
    prisma.exerciseDict.count(),
    prisma.userConsent.count(),
  ]);

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
  });

  return NextResponse.json({
    stats: { usersCount, clubsCount, workoutsCount, exercisesCount, consentsCount },
    recentUsers,
  });
}
