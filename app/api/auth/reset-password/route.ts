import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';
import { EmailService } from '@/lib/services/email.service';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';

/**
 * Схема валидации для запроса сброса пароля
 */
const resetPasswordRequestSchema = z.object({
  email: z.string().email('Неверный формат email'),
});

/**
 * POST /api/auth/reset-password
 * 
 * Запрос сброса пароля
 * 
 * Требования: 4.3
 * Свойство 23: Срок действия токенов верификации (1 час)
 * 
 * @param request - HTTP запрос с email пользователя
 * @returns 200 OK с сообщением об отправке письма
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
    const validationResult = resetPasswordRequestSchema.safeParse(body);

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

    const { email } = validationResult.data;

    // Генерация токена сброса через UserService
    const userService = new UserService();

    try {
      const resetToken = await userService.requestPasswordReset(email);

      // Отправка email с токеном сброса (не блокирует ответ)
      const emailService = new EmailService();
      emailService.sendPasswordResetEmail(email, resetToken).catch((err) => {
        console.error('Ошибка отправки email сброса пароля:', err);
      });

      // Возвращаем успешный ответ
      // Примечание: Мы всегда возвращаем 200 OK, даже если пользователь не найден,
      // чтобы не раскрывать информацию о существовании email в системе
      return NextResponse.json(
        {
          message: 'Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по сбросу пароля.',
          success: true
        },
        { status: 200 }
      );

    } catch (error) {
      // Обработка ошибок от UserService
      if (error instanceof Error) {
        // Даже если пользователь не найден, возвращаем успешный ответ
        // для защиты от перечисления email адресов
        if (error.message.includes('не найден')) {
          return NextResponse.json(
            {
              message: 'Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по сбросу пароля.',
              success: true
            },
            { status: 200 }
          );
        }
      }

      // Неизвестная ошибка
      throw error;
    }

  } catch (error) {
    // Логируем ошибку для отладки
    console.error('Ошибка при запросе сброса пароля:', error);

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
