/**
 * Примеры использования middleware аутентификации
 * 
 * Этот файл демонстрирует, как использовать authenticateRequest()
 * в API Routes для защиты endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthSuccess, isAuthError } from './middleware';

/**
 * Пример 1: Защищенный API endpoint
 * 
 * Использование в app/api/workouts/route.ts
 */
export async function protectedEndpointExample(request: NextRequest) {
  // Шаг 1: Аутентификация запроса
  const authResult = await authenticateRequest(request);
  
  // Шаг 2: Проверка результата аутентификации
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }
  
  // Шаг 3: Использование данных пользователя
  const { user } = authResult;
  
  // Теперь можно безопасно использовать user.id и user.email
  return NextResponse.json({
    message: 'Доступ разрешен',
    userId: user.id,
    email: user.email
  });
}

/**
 * Пример 2: Middleware с дополнительной проверкой прав
 * 
 * Использование в app/api/workouts/[id]/route.ts
 */
export async function protectedWithOwnershipCheck(
  request: NextRequest,
  resourceOwnerId: string
) {
  // Шаг 1: Аутентификация
  const authResult = await authenticateRequest(request);
  
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }
  
  const { user } = authResult;
  
  // Шаг 2: Проверка прав доступа к ресурсу
  if (user.id !== resourceOwnerId) {
    return NextResponse.json(
      { error: 'Доступ запрещен. Вы не являетесь владельцем этого ресурса.' },
      { status: 403 }
    );
  }
  
  // Шаг 3: Доступ разрешен
  return NextResponse.json({
    message: 'Доступ разрешен',
    userId: user.id
  });
}

/**
 * Пример 3: Реальный API endpoint для получения тренировок
 * 
 * app/api/workouts/route.ts
 */
export async function GET(request: NextRequest) {
  // Аутентификация
  const authResult = await authenticateRequest(request);
  
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }
  
  const { user } = authResult;
  
  // Получение тренировок пользователя
  // const workouts = await workoutService.getWorkouts(user.id, { ... });
  
  return NextResponse.json({
    message: `Получение тренировок для пользователя ${user.email}`,
    userId: user.id
  });
}

/**
 * Пример 4: POST endpoint с аутентификацией
 * 
 * app/api/workouts/route.ts
 */
export async function POST(request: NextRequest) {
  // Аутентификация
  const authResult = await authenticateRequest(request);
  
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }
  
  const { user } = authResult;
  
  // Парсинг тела запроса
  const body = await request.json();
  
  // Создание тренировки для аутентифицированного пользователя
  // const workout = await workoutService.createWorkout(user.id, body);
  
  return NextResponse.json({
    message: 'Тренировка создана',
    userId: user.id,
    data: body
  }, { status: 201 });
}

/**
 * Пример 5: DELETE endpoint с проверкой владельца
 * 
 * app/api/workouts/[id]/route.ts
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Аутентификация
  const authResult = await authenticateRequest(request);
  
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }
  
  const { user } = authResult;
  
  // Получение тренировки для проверки владельца
  // const workout = await workoutService.getWorkoutById(params.id, user.id);
  
  // if (!workout) {
  //   return NextResponse.json(
  //     { error: 'Тренировка не найдена' },
  //     { status: 404 }
  //   );
  // }
  
  // Удаление тренировки
  // await workoutService.deleteWorkout(params.id, user.id);
  
  return NextResponse.json({
    message: 'Тренировка удалена',
    workoutId: params.id
  });
}

/**
 * Пример 6: Использование type guards для безопасности типов
 */
export async function typeGuardExample(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  // Type guard автоматически сужает тип
  if (isAuthSuccess(authResult)) {
    // TypeScript знает, что authResult имеет поле user
    console.log('User ID:', authResult.user.id);
    console.log('User Email:', authResult.user.email);
  }
  
  if (isAuthError(authResult)) {
    // TypeScript знает, что authResult имеет поле error
    console.log('Auth Error:', authResult.error);
  }
  
  return NextResponse.json({ status: 'ok' });
}
