import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';
import { EmailService } from '@/lib/services/email.service';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';

/**
 * Схема валидации для входа в систему
 */
const loginSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(1, 'Пароль обязателен'),
});

/**
 * POST /api/auth/login
 * 
 * Вход в систему
 * 
 * Требования: 1.4, 1.6, 21.5-21.6
 * 
 * @param request - HTTP запрос с учетными данными
 * @returns 200 OK с данными пользователя и JWT токеном в cookie или ошибка
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
          error: 'Слишком много попыток входа. Попробуйте позже.',
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
    const validationResult = loginSchema.safeParse(body);

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

    const { email, password } = validationResult.data;

    // Аутентификация через UserService
    const userService = new UserService();

    try {
      const result = await userService.login(email, password);

      // Создаем response с данными пользователя
      const response = NextResponse.json(
        {
          user: result.user,
          message: 'Вход выполнен успешно'
        },
        { status: 200 }
      );

      // Устанавливаем JWT токен в HTTP-only cookie
      // Требования: 21.5-21.6 (HTTP-only, Secure, SameSite)
      response.cookies.set('auth-token', result.token, {
        httpOnly: true, // Защита от XSS
        secure: process.env.NODE_ENV === 'production', // HTTPS только в production
        sameSite: 'lax', // Защита от CSRF
        maxAge: 7 * 24 * 60 * 60, // 7 дней в секундах
        path: '/', // Доступен для всех путей
      });

      return response;

    } catch (error) {
      // Обработка ошибок от UserService
      if (error instanceof Error) {
        // Email не подтверждён — отправляем повторное письмо
        if (error.message.startsWith('EMAIL_NOT_VERIFIED:')) {
          const token = error.message.split(':')[1];
          const emailService = new EmailService();
          emailService.sendVerificationEmail(email, token).catch((err) => {
            console.error('Ошибка отправки email подтверждения:', err);
          });

          return NextResponse.json(
            {
              error: 'Email не подтверждён. Мы отправили письмо с ссылкой для подтверждения на вашу почту. Проверьте входящие и папку «Спам».',
              code: 'EMAIL_NOT_VERIFIED'
            },
            { status: 403 }
          );
        }

        // Проверяем, является ли это ошибкой неверных учетных данных
        if (error.message.includes('Неверный email или пароль')) {
          return NextResponse.json(
            {
              error: 'Неверный email или пароль',
              code: 'INVALID_CREDENTIALS'
            },
            { status: 401 } // Unauthorized
          );
        }
      }

      // Неизвестная ошибка
      throw error;
    }

  } catch (error) {
    // Логируем ошибку для отладки
    console.error('Ошибка при входе в систему:', error);

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
