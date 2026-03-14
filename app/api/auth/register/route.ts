import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/auth/rate-limiter';

/**
 * Схема валидации для регистрации пользователя
 */
const registerSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string()
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .regex(/\d/, 'Пароль должен содержать хотя бы 1 цифру')
    .regex(/[a-zA-Z]/, 'Пароль должен содержать хотя бы 1 букву'),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
});

/**
 * POST /api/auth/register
 * 
 * Регистрация нового пользователя
 * 
 * Требования: 1.2, 1.3
 * Свойство 9: Уникальность email пользователей
 * Свойство 11: Уникальность хешей паролей с солью
 * 
 * @param request - HTTP запрос с данными регистрации
 * @returns 201 Created с данными пользователя или ошибка
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
          error: 'Слишком много попыток регистрации. Попробуйте позже.',
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
    const validationResult = registerSchema.safeParse(body);

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

    const { email, password, firstName, lastName } = validationResult.data;

    // Создаем пользователя через UserService
    const userService = new UserService();

    try {
      const result = await userService.register({
        email,
        password,
        firstName,
        lastName
      });

      // TODO: Отправить email с подтверждением (задача 4)
      // await emailService.sendVerificationEmail(email, result.verificationToken);

      // Возвращаем данные пользователя (без токена верификации)
      return NextResponse.json(
        {
          user: result.user,
          message: 'Регистрация успешна. Проверьте email для подтверждения.'
        },
        { status: 201 }
      );

    } catch (error) {
      // Обработка ошибок от UserService
      if (error instanceof Error) {
        // Проверяем, является ли это ошибкой дублирования email
        if (error.message.includes('уже существует')) {
          return NextResponse.json(
            {
              error: error.message,
              code: 'EMAIL_ALREADY_EXISTS'
            },
            { status: 409 } // Conflict
          );
        }

        // Проверяем, является ли это ошибкой валидации пароля
        if (error.message.includes('Пароль')) {
          return NextResponse.json(
            {
              error: error.message,
              code: 'INVALID_PASSWORD'
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
    console.error('Ошибка при регистрации пользователя:', error);

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
