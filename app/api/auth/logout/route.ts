import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * 
 * Выход из системы
 * 
 * Требования: 1.5
 * 
 * @param request - HTTP запрос
 * @returns 200 OK с сообщением об успешном выходе
 */
export async function POST(request: NextRequest) {
  try {
    // Создаем response с сообщением об успешном выходе
    const response = NextResponse.json(
      {
        message: 'Выход выполнен успешно'
      },
      { status: 200 }
    );
    
    // Удаляем JWT токен из cookie
    // Устанавливаем maxAge: 0 чтобы немедленно удалить cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Удаляем cookie
      path: '/',
    });
    
    return response;
    
  } catch (error) {
    // Логируем ошибку для отладки
    console.error('Ошибка при выходе из системы:', error);
    
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
