import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse, isAdminError } from '@/lib/auth/admin-middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** GET /api/admin/consents — список согласий */
export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAdminError(auth)) return adminErrorResponse(auth);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const type = searchParams.get('type') || undefined;

  const where: Record<string, unknown> = {};
  if (type) where.consentType = type;

  const [consents, total] = await Promise.all([
    prisma.userConsent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.userConsent.count({ where }),
  ]);

  return NextResponse.json({
    consents,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
