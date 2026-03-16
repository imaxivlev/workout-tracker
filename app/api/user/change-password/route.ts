import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthSuccess } from '@/lib/auth/middleware';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: z.string().min(8, 'Пароль должен быть минимум 8 символов'),
  confirmPassword: z.string().min(1, 'Подтвердите пароль'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

/**
 * POST /api/user/change-password
 *
 * Смена пароля авторизованного пользователя
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);

    if (!isAuthSuccess(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const body = await request.json();

    const validationResult = changePasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Ошибка валидации данных',
          details: validationResult.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    const userService = new UserService();

    try {
      await userService.changePassword(authResult.user.id, currentPassword, newPassword);
      return NextResponse.json({ message: 'Пароль успешно изменён' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Неверный текущий пароль')) {
          return NextResponse.json({ error: error.message }, { status: 401 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при смене пароля:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
