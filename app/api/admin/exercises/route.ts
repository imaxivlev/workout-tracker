import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { prisma } from '@/lib/prisma';


/** GET /api/admin/exercises — все упражнения */
export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const search = searchParams.get('search') || '';
  const filter = searchParams.get('filter') || 'all'; // all | global | user

  const where: Record<string, unknown> = {};
  if (search) where.name = { contains: search };
  if (filter === 'global') where.isGlobal = true;
  if (filter === 'user') where.isGlobal = false;

  const [exercises, total] = await Promise.all([
    prisma.exerciseDict.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, isGlobal: true, hasWeight: true, measureUnit: true, createdAt: true,
        user: { select: { id: true, email: true, firstName: true } },
      },
    }),
    prisma.exerciseDict.count({ where }),
  ]);

  return NextResponse.json({
    exercises,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** POST /api/admin/exercises — создать глобальное упражнение */
export async function POST(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const body = await request.json();
  const { name, hasWeight, measureUnit } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
  }

  const exercise = await prisma.exerciseDict.create({
    data: {
      name: name.trim(),
      isGlobal: true,
      hasWeight: hasWeight !== undefined ? Boolean(hasWeight) : true,
      measureUnit: measureUnit || 'reps',
    },
  });

  return NextResponse.json({ exercise }, { status: 201 });
}
