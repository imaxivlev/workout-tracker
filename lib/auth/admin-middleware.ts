import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from './middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type AdminAuthSuccess = { user: { id: string; email: string } };
type AdminAuthError = { error: string; status: number };
type AdminAuthResult = AdminAuthSuccess | AdminAuthError;

export function isAdminError(result: AdminAuthResult): result is AdminAuthError {
  return 'error' in result;
}

/**
 * Middleware для проверки прав администратора.
 */
export async function authenticateAdmin(request: NextRequest): Promise<AdminAuthResult> {
  const authResult = await authenticateRequest(request);

  if ('error' in authResult) {
    return { error: authResult.error, status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: authResult.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return { error: 'Доступ запрещён', status: 403 };
  }

  return { user: authResult.user };
}

/**
 * Обёртка для JSON-ответа ошибки
 */
export function adminErrorResponse(result: AdminAuthError) {
  return NextResponse.json(
    { error: result.error, code: result.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN' },
    { status: result.status }
  );
}
