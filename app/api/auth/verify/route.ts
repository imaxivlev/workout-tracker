import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';

/**
 * GET /api/auth/verify
 * 
 * Подтверждение email пользователя
 * 
 * Требования: 4.2, 4.5
 * Свойство 23: Срок действия токенов верификации
 * 
 * @param request - HTTP запрос с токеном верификации в query параметрах
 * @returns 200 OK при успешной верификации или 400 Bad Request при невалидном/истекшем токене
 */
export async function GET(request: NextRequest) {
  try {
    // Извлечение токена из query параметров
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    // Проверка наличия токена
    if (!token) {
      return NextResponse.json(
        {
          error: 'Токен верификации не предоставлен',
          code: 'TOKEN_MISSING'
        },
        { status: 400 }
      );
    }
    
    // Проверка формата токена (должен быть 64 символа hex)
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        {
          error: 'Невалидный формат токена',
          code: 'INVALID_TOKEN_FORMAT'
        },
        { status: 400 }
      );
    }
    
    // Верификация email через UserService
    const userService = new UserService();
    const isVerified = await userService.verifyEmail(token);
    
    if (!isVerified) {
      return NextResponse.json(
        {
          error: 'Невалидный или истекший токен верификации',
          code: 'TOKEN_INVALID_OR_EXPIRED'
        },
        { status: 400 }
      );
    }
    
    // Успешная верификация
    return NextResponse.json(
      {
        message: 'Email успешно подтвержден',
        verified: true
      },
      { status: 200 }
    );
    
  } catch (error) {
    // Логируем ошибку для отладки
    console.error('Ошибка при верификации email:', error);
    
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
