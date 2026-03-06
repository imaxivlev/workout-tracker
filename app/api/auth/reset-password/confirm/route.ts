import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';

/**
 * Схема валидации для подтверждения сброса пароля
 */
const resetPasswordConfirmSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'Невалидный формат токена'),
  newPassword: z.string().min(8, 'Пароль должен содержать минимум 8 символов')
});

/**
 * POST /api/auth/reset-password/confirm
 * 
 * Установка нового пароля после сброса
 * 
 * Требования: 4.4, 4.5
 * Свойство 24: Одноразовость токенов сброса пароля
 * 
 * @param request - HTTP запрос с токеном и новым паролем
 * @returns 200 OK при успешном сбросе или 400 Bad Request при истекшем/невалидном токене
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем IP адрес для rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Проверяем rate limit (5 попыток за 15 минут)
    const isRateLimited = await rateLimit(ip, RATE_LIMIT_CONFIGS.auth);
    
    if (isRateLimited) {
      return NextResponse.json(
        { 
          error: 'Слишком много попыток сброса пароля. Попробуйте позже.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': '900' // 15 минут в секундах
          }
        }
      );
    }
    
    // Парсим тело запроса
    const body = await request.json();
    
    // Валидация данных с помощью Zod
    const validationResult = resetPasswordConfirmSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Ошибка валидации данных',
          details: validationResult.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }
    
    const { token, newPassword } = validationResult.data;
    
    // Сброс пароля через UserService
    const userService = new UserService();
    
    try {
      const isReset = await userService.resetPassword(token, newPassword);
      
      if (!isReset) {
        // Токен невалиден или истек
        return NextResponse.json(
          {
            error: 'Невалидный или истекший токен сброса пароля',
            code: 'TOKEN_INVALID_OR_EXPIRED'
          },
          { status: 400 }
        );
      }
      
      // Успешный сброс пароля
      return NextResponse.json(
        {
          message: 'Пароль успешно изменен',
          success: true
        },
        { status: 200 }
      );
      
    } catch (error) {
      // Обработка ошибок валидации пароля от UserService
      if (error instanceof Error) {
        // Ошибки валидации пароля (минимум 8 символов, 1 цифра, 1 буква)
        if (error.message.includes('Пароль должен')) {
          return NextResponse.json(
            {
              error: error.message,
              code: 'PASSWORD_VALIDATION_FAILED'
            },
            { status: 400 }
          );
        }
      }
      
      // Неизвестная ошибка
      throw error;
    }
    
  } catch (error) {
    // Логируем ошибку для отладки
    console.error('Ошибка при подтверждении сброса пароля:', error);
    
    // Возвращаем общую ошибку без деталей
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}
