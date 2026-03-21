import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';
import { ClubService } from '@/lib/services/club.service';
import { z } from 'zod';

const clubService = new ClubService();

const createClubSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа').max(200, 'Максимум 200 символов'),
  description: z.string().max(1000).optional(),
  city: z.string().max(100).optional(),
});

/**
 * POST /api/clubs — Создание клуба
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const isRateLimited = await rateLimit(authResult.user.id, RATE_LIMIT_CONFIGS.api);
    if (isRateLimited) {
      return NextResponse.json({ error: 'Слишком много запросов', code: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = createClubSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Ошибка валидации',
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
      }, { status: 400 });
    }

    const club = await clubService.createClub(authResult.user.id, parsed.data);

    return NextResponse.json({ club }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/clubs error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
