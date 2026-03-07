import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthSuccess } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { UserService } from '@/lib/services/user.service';

const prisma = new PrismaClient();

/**
 * Схема валидации для обновления профиля
 */
const updateProfileSchema = z.object({
  firstName: z.string().max(100, 'Имя не должно превышать 100 символов').optional(),
  lastName: z.string().max(100, 'Фамилия не должна превышать 100 символов').optional(),
  avatar: z.string().max(500, 'URL аватара не должен превышать 500 символов').optional()
});

/**
 * GET /api/user/profile
 * 
 * Получение профиля текущего пользователя
 * 
 * Требования: 23.1
 * 
 * @param request - HTTP запрос
 * @returns 200 OK с данными профиля или ошибка
 */
export async function GET(request: NextRequest) {
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
    
    // Получение полных данных пользователя из БД
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        verified: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        verified: user.verified,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Ошибка при получении профиля:', error);
    
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 * 
 * Обновление профиля текущего пользователя
 * 
 * Требования: 23.2
 * 
 * @param request - HTTP запрос с данными для обновления
 * @returns 200 OK с обновленными данными профиля или ошибка
 */
export async function PATCH(request: NextRequest) {
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
    const validationResult = updateProfileSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Ошибка валидации данных',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }
    
    const { firstName, lastName, avatar } = validationResult.data;
    
    // Обновление профиля через UserService
    const userService = new UserService();
    const updatedUser = await userService.updateProfile(authUser.id, {
      firstName,
      lastName,
      avatar
    });
    
    return NextResponse.json({
      user: updatedUser,
      message: 'Профиль успешно обновлен'
    });
    
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
