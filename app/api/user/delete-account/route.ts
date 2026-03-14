import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthSuccess } from '@/lib/auth/middleware';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Схема валидации для удаления аккаунта
 */
const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Пароль обязателен для подтверждения'),
  csrfToken: z.string().min(1, 'CSRF токен обязателен')
});

/**
 * DELETE /api/user/delete-account
 * 
 * Удаление аккаунта пользователя с каскадным удалением всех данных
 * 
 * Требования: 23.4, 23.5, 5.9
 * Свойство 20: Каскадное удаление данных пользователя
 * 
 * @param request - HTTP запрос с паролем и CSRF токеном
 * @returns 200 OK с сообщением об успешном удалении или ошибка
 */
export async function DELETE(request: NextRequest) {
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
    const validationResult = deleteAccountSchema.safeParse(body);

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

    const { password, csrfToken } = validationResult.data;

    // Проверка CSRF токена
    const sessionCsrfToken = request.cookies.get('csrf-token')?.value;

    if (!sessionCsrfToken || sessionCsrfToken !== csrfToken) {
      return NextResponse.json(
        { error: 'Невалидный CSRF токен' },
        { status: 403 }
      );
    }

    // Получение пользователя из БД для проверки пароля
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        passwordHash: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Проверка пароля
    const userService = new UserService();
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Неверный пароль' },
        { status: 401 }
      );
    }

    // Удаление аккаунта (каскадное удаление всех связанных данных)
    await userService.deleteAccount(authUser.id);

    // Создание response с удалением auth cookie
    const response = NextResponse.json({
      message: 'Аккаунт успешно удален'
    });

    // Удаление JWT токена из cookie
    response.cookies.delete('auth-token');

    // Удаление CSRF токена из cookie
    response.cookies.delete('csrf-token');

    return response;

  } catch (error) {
    console.error('Ошибка при удалении аккаунта:', error);

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
