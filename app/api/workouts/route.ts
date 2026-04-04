import { NextRequest, NextResponse } from 'next/server';
import { WorkoutService } from '@/lib/services/workout.service';
import { createWorkoutSchema } from '@/lib/validation/workout.schema';
import { authenticateRequest } from '@/lib/auth/middleware';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';

/**
 * GET /api/workouts
 * 
 * Получение списка тренировок с пагинацией и фильтрацией
 * 
 * Требования: 9.1-9.6
 * Свойство 2: Изоляция данных пользователей
 * 
 * Query параметры:
 * - page: номер страницы (по умолчанию 1)
 * - limit: количество тренировок на странице (по умолчанию 10, максимум 100)
 * - startDate: начальная дата фильтрации (YYYY-MM-DD)
 * - endDate: конечная дата фильтрации (YYYY-MM-DD)
 * - exerciseId: ID упражнения для фильтрации
 * 
 * @param request - HTTP запрос с query параметрами
 * @returns 200 OK со списком тренировок и метаданными пагинации
 */
export async function GET(request: NextRequest) {
  try {
    // Шаг 1: Аутентификация пользователя
    const authResult = await authenticateRequest(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        {
          error: 'Требуется аутентификация',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }
    
    const { user } = authResult;
    
    // Шаг 2: Rate limiting (100 запросов за минуту)
    const isRateLimited = await rateLimit(user.id, RATE_LIMIT_CONFIGS.api);
    
    if (isRateLimited) {
      return NextResponse.json(
        {
          error: 'Слишком много запросов. Попробуйте позже.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60' // 1 минута в секундах
          }
        }
      );
    }
    
    // Шаг 3: Парсинг query параметров
    const { searchParams } = new URL(request.url);
    
    // Требование 9.2: Параметр page (по умолчанию 1)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    
    // Требование 9.3: Параметр limit (по умолчанию 10, максимум 100)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    
    // Требование 9.4: Параметры диапазона дат
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    
    // Требование 9.5: Параметр фильтрации по упражнению
    const exerciseId = searchParams.get('exerciseId') || undefined;
    
    // Валидация формата дат (если указаны)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return NextResponse.json(
        {
          error: 'Параметр startDate должен быть в формате YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT'
        },
        { status: 400 }
      );
    }
    
    if (endDate && !dateRegex.test(endDate)) {
      return NextResponse.json(
        {
          error: 'Параметр endDate должен быть в формате YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT'
        },
        { status: 400 }
      );
    }
    
    // Шаг 4: Получение списка тренировок через WorkoutService
    const workoutService = new WorkoutService();
    
    const result = await workoutService.getWorkouts(user.id, {
      page,
      limit,
      startDate,
      endDate,
      exerciseId
    });
    
    // Требование 9.1-9.6: Возврат списка тренировок с метаданными пагинации
    return NextResponse.json(
      {
        workouts: result.workouts,
        pagination: {
          page,
          limit,
          total: result.total,
          hasMore: result.hasMore,
          totalPages: Math.ceil(result.total / limit)
        }
      },
      { status: 200 }
    );
    
  } catch (error) {
    // Логирование ошибки
    console.error('Ошибка при получении списка тренировок:', error);
    
    // Возврат 500 Internal Server Error
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workouts
 * 
 * Создание новой тренировки
 * 
 * Требования: 7.1-7.6, 8.1-8.8, 25.1-25.2
 * Свойство 1: Атомарность транзакций создания тренировки
 * Свойство 13: Валидность дат тренировок
 * Свойство 14: Диапазон весов
 * Свойство 16: Соответствие результатов WOD типу комплекса
 * 
 * @param request - HTTP запрос с данными тренировки
 * @returns 201 Created с полным объектом тренировки или ошибка
 */
export async function POST(request: NextRequest) {
  try {
    // Шаг 1: Аутентификация пользователя
    const authResult = await authenticateRequest(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        {
          error: 'Требуется аутентификация',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }
    
    const { user } = authResult;
    
    // Шаг 2: Rate limiting (100 запросов за минуту)
    const isRateLimited = await rateLimit(user.id, RATE_LIMIT_CONFIGS.api);
    
    if (isRateLimited) {
      return NextResponse.json(
        {
          error: 'Слишком много запросов. Попробуйте позже.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60' // 1 минута в секундах
          }
        }
      );
    }
    
    // Шаг 3: Парсинг тела запроса
    const body = await request.json();
    
    // Шаг 4: Валидация данных с помощью Zod
    const validationResult = createWorkoutSchema.safeParse(body);
    
    if (!validationResult.success) {
      // Требование 25.1: Возврат 400 Bad Request с детальным описанием ошибок валидации
      return NextResponse.json(
        {
          error: 'Ошибка валидации данных',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }
    
    const workoutData = validationResult.data;
    
    // Шаг 5: Создание тренировки через WorkoutService
    const workoutService = new WorkoutService();
    
    try {
      const workout = await workoutService.createWorkout(user.id, workoutData);
      
      // Требование 7.1: Возврат 201 Created с полным объектом тренировки
      return NextResponse.json(
        {
          workout,
          message: 'Тренировка успешно создана'
        },
        { status: 201 }
      );
      
    } catch (error) {
      // Обработка ошибок от WorkoutService
      if (error instanceof Error) {
        // Проверка на ошибку дублирования UUID (конфликт)
        if (error.message.includes('Unique constraint') || 
            error.message.includes('duplicate key')) {
          return NextResponse.json(
            {
              error: 'Тренировка с таким ID уже существует',
              code: 'WORKOUT_ALREADY_EXISTS'
            },
            { status: 409 } // Conflict
          );
        }
        
        // Проверка на ошибку валидации упражнения
        if (error.message.includes('Название упражнения')) {
          return NextResponse.json(
            {
              error: error.message,
              code: 'INVALID_EXERCISE_NAME'
            },
            { status: 400 }
          );
        }
      }
      
      // Требование 25.2: Откат транзакции и возврат 500 Internal Server Error
      // Транзакция автоматически откатывается в WorkoutService
      throw error;
    }
    
  } catch (error) {
    // Требование 25.3: Логирование полного стек-трейса
    console.error('Ошибка при создании тренировки:', error);

    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && { detail: String(error) }),
      },
      { status: 500 }
    );
  }
}
