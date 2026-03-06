import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/exercises
 * Поиск упражнений (автодополнение)
 */
export async function GET(request: NextRequest) {
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

    // Парсинг query параметров
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Поиск в глобальном справочнике
    const globalExercises = await prisma.exerciseDict.findMany({
      where: {
        isGlobal: true,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        isGlobal: true,
      },
      take: limit,
    });

    // Поиск в пользовательских упражнениях
    const userExercises = await prisma.exerciseDict.findMany({
      where: {
        userId: user.userId,
        isGlobal: false,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        isGlobal: true,
      },
      take: limit,
    });

    // Объединение результатов (глобальные сначала)
    const exercises = [...globalExercises, ...userExercises].slice(0, limit);

    return NextResponse.json({ exercises }, { status: 200 });
  } catch (error) {
    console.error('Error searching exercises:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
