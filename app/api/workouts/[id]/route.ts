import { NextRequest, NextResponse } from 'next/server';
import { WorkoutService } from '@/lib/services/workout.service';
import { updateWorkoutSchema } from '@/lib/validation/workout.schema';
import { authenticateRequest } from '@/lib/auth/middleware';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';

/**
 * GET /api/workouts/[id]
 * 
 * Получение одной тренировки по ID
 * 
 * Требования: 10.1-10.3
 * Свойство 2: Изоляция данных пользователей
 * 
 * @param request - HTTP запрос
 * @param params - Параметры маршрута с ID тренировки
 * @returns 200 OK с полным объектом тренировки, 403 Forbidden или 404 Not Found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Шаг 3: Получение ID тренировки из параметров маршрута
    const workoutId = params.id;
    
    // Шаг 4: Получение тренировки через WorkoutService
    const workoutService = new WorkoutService();
    
    try {
      const workout = await workoutService.getWorkoutById(workoutId, user.id);
      
      // Требование 10.3: Возврат 404 Not Found для несуществующей тренировки
      if (!workout) {
        return NextResponse.json(
          {
            error: 'Тренировка не найдена',
            code: 'WORKOUT_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      
      // Требование 10.1: Возврат полного объекта со всеми вложенными блоками
      return NextResponse.json(
        {
          workout
        },
        { status: 200 }
      );
      
    } catch (error) {
      // Требование 10.2: Обработка ошибки доступа (403 Forbidden)
      if (error instanceof Error && error.message === 'FORBIDDEN') {
        return NextResponse.json(
          {
            error: 'Доступ запрещен. Вы не можете просматривать чужие тренировки.',
            code: 'FORBIDDEN'
          },
          { status: 403 }
        );
      }
      
      throw error;
    }
    
  } catch (error) {
    // Логирование ошибки
    console.error('Ошибка при получении тренировки:', error);
    
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
 * PATCH /api/workouts/[id]
 * 
 * Обновление тренировки
 * 
 * Требования: 10.4
 * Свойство 2: Изоляция данных пользователей
 * 
 * @param request - HTTP запрос с данными для обновления
 * @param params - Параметры маршрута с ID тренировки
 * @returns 200 OK с обновленным объектом тренировки, 403 Forbidden или 404 Not Found
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Шаг 3: Получение ID тренировки из параметров маршрута
    const workoutId = params.id;
    
    // Шаг 4: Парсинг тела запроса
    const body = await request.json();
    
    // Шаг 5: Валидация данных с помощью Zod (используем updateWorkoutSchema)
    const validationResult = updateWorkoutSchema.safeParse(body);
    
    if (!validationResult.success) {
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
    
    const updateData = validationResult.data;
    
    // Шаг 6: Обновление тренировки через WorkoutService
    const workoutService = new WorkoutService();
    
    try {
      const workout = await workoutService.updateWorkout(workoutId, user.id, updateData);
      
      // Требование 10.4: Возврат обновленного объекта
      return NextResponse.json(
        {
          workout,
          message: 'Тренировка успешно обновлена'
        },
        { status: 200 }
      );
      
    } catch (error) {
      // Обработка ошибок от WorkoutService
      if (error instanceof Error) {
        // Требование 10.2: Обработка ошибки доступа (403 Forbidden)
        if (error.message === 'FORBIDDEN') {
          return NextResponse.json(
            {
              error: 'Доступ запрещен. Вы не можете редактировать чужие тренировки.',
              code: 'FORBIDDEN'
            },
            { status: 403 }
          );
        }
        
        // Требование 10.3: Обработка 404 Not Found
        if (error.message === 'NOT_FOUND') {
          return NextResponse.json(
            {
              error: 'Тренировка не найдена',
              code: 'WORKOUT_NOT_FOUND'
            },
            { status: 404 }
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
      
      throw error;
    }
    
  } catch (error) {
    // Логирование ошибки
    console.error('Ошибка при обновлении тренировки:', error);
    
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
 * DELETE /api/workouts/[id]
 * 
 * Удаление тренировки
 * 
 * Требования: 10.5, 10.6
 * Свойство 2: Изоляция данных пользователей
 * Свойство 5: Идемпотентность удаления тренировки
 * 
 * @param request - HTTP запрос
 * @param params - Параметры маршрута с ID тренировки
 * @returns 200 OK, 403 Forbidden или 404 Not Found
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Шаг 3: Получение ID тренировки из параметров маршрута
    const workoutId = params.id;
    
    // Шаг 4: Удаление тренировки через WorkoutService
    const workoutService = new WorkoutService();
    
    try {
      await workoutService.deleteWorkout(workoutId, user.id);
      
      // Требование 10.5, 10.6: Возврат 200 OK (идемпотентность)
      return NextResponse.json(
        {
          message: 'Тренировка успешно удалена'
        },
        { status: 200 }
      );
      
    } catch (error) {
      // Требование 10.2: Обработка ошибки доступа (403 Forbidden)
      if (error instanceof Error && error.message === 'FORBIDDEN') {
        return NextResponse.json(
          {
            error: 'Доступ запрещен. Вы не можете удалять чужие тренировки.',
            code: 'FORBIDDEN'
          },
          { status: 403 }
        );
      }
      
      throw error;
    }
    
  } catch (error) {
    // Логирование ошибки
    console.error('Ошибка при удалении тренировки:', error);
    
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
