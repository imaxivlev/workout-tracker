import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { rateLimit } from '@/lib/auth/rate-limiter';
import { MigrationService } from '@/lib/services/migration.service';

const migrationService = new MigrationService();

/**
 * POST /api/migration
 * Миграция данных из localStorage
 */
export async function POST(request: NextRequest) {
  try {
    // Аутентификация
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Rate limiting (1 запрос за 5 минут)
    const rateLimitResult = await rateLimit(
      `migration:${user.userId}`,
      { windowMs: 5 * 60 * 1000, maxRequests: 1 }
    );

    if (!rateLimitResult) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': '300', // 5 минут
          },
        }
      );
    }

    // Парсинг тела запроса
    const body = await request.json();
    const { workouts } = body;

    if (!Array.isArray(workouts)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected array of workouts.' },
        { status: 400 }
      );
    }

    // Миграция тренировок
    const result = await migrationService.migrateWorkouts(user.userId, workouts);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
