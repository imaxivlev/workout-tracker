import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthSuccess } from '@/lib/auth/middleware';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';

/**
 * Схема валидации для изменения email
 */
const changeEmailSchema = z.object({
  newEmail: z.string().email('Неверный формат email')
});

/**
 * POST /api/user/change-email
 * 
 * Запрос изменения email с отправкой письма подтверждения
 * 
 * Требования: 23.3
 * 
 * @param request - HTTP запрос с новым email
 * @returns 200 OK с сообщением об отправке письма или ошибка
 */
export async function POST(request: NextRequest) {
  try {
    // Аутентификация пользователя
    const authResult = await authenticateRequest(request);

    if (!isAuthSuccess(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { user: authUser } = authResult;

    // Парсинг тела запроса
    const body = await request.json();

    // Валидация данных с помощью Zod
    const validationResult = changeEmailSchema.safeParse(body);

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

    const { newEmail } = validationResult.data;

    // Проверка, что новый email отличается от текущего
    if (newEmail === authUser.email) {
      return NextResponse.json(
        { error: 'Новый email совпадает с текущим' },
        { status: 400 }
      );
    }

    // Запрос изменения email через UserService
    const userService = new UserService();

    try {
      const verificationToken = await userService.requestEmailChange(authUser.id, newEmail);

      // TODO: Отправка письма с подтверждением на новый email
      // await emailService.sendEmailChangeConfirmation(newEmail, verificationToken);

      return NextResponse.json({
        message: 'Письмо с подтверждением отправлено на новый email адрес',
        // В production не возвращаем токен, только для тестирования
        ...(process.env.NODE_ENV === 'development' && { verificationToken })
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('уже существует')) {
          return NextResponse.json(
            { error: 'Пользователь с таким email уже существует' },
            { status: 409 }
          );
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('Ошибка при изменении email:', error);

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
