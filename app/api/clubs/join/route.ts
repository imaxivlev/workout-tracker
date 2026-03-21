import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';
import { ClubService } from '@/lib/services/club.service';
import { z } from 'zod';

const clubService = new ClubService();

const joinSchema = z.object({
  code: z.string().min(1, 'Код обязателен'),
});

/**
 * POST /api/clubs/join — Вступление в клуб по инвайт-коду
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
    const parsed = joinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Код приглашения обязателен', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const club = await clubService.joinByInvite(authResult.user.id, parsed.data.code.toUpperCase());

    return NextResponse.json({ club, message: 'Вы успешно вступили в клуб!' });
  } catch (error: any) {
    if (error.message === 'INVALID_INVITE') {
      return NextResponse.json({ error: 'Недействительный код приглашения', code: 'INVALID_INVITE' }, { status: 404 });
    }
    if (error.message === 'INVITE_EXPIRED') {
      return NextResponse.json({ error: 'Срок действия приглашения истёк', code: 'INVITE_EXPIRED' }, { status: 410 });
    }
    if (error.message === 'INVITE_EXHAUSTED') {
      return NextResponse.json({ error: 'Приглашение использовано максимальное число раз', code: 'INVITE_EXHAUSTED' }, { status: 410 });
    }
    if (error.message === 'ALREADY_MEMBER') {
      return NextResponse.json({ error: 'Вы уже состоите в этом клубе', code: 'ALREADY_MEMBER' }, { status: 409 });
    }

    console.error('POST /api/clubs/join error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
