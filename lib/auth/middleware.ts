import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';


/**
 * Интерфейс для JWT payload
 */
export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Интерфейс для результата аутентификации (успех)
 */
export interface AuthSuccess {
  user: {
    id: string;
    email: string;
  };
}

/**
 * Интерфейс для результата аутентификации (ошибка)
 */
export interface AuthError {
  error: string;
}

/**
 * Тип результата аутентификации
 */
export type AuthResult = AuthSuccess | AuthError;

/**
 * Middleware для аутентификации запросов
 * 
 * Ответственности:
 * - Извлечение JWT токена из HTTP-only cookie с именем "auth-token"
 * - Валидация токена (подпись, срок действия)
 * - Извлечение userId и email из payload
 * - Проверка существования пользователя в БД
 * - Возврат 401 Unauthorized при невалидном токене
 * 
 * @param request - Next.js request объект
 * @returns Объект с данными пользователя или ошибкой
 * 
 * Требования: 3.2-3.5, 21.1-21.2
 * Свойство 6: Валидность JWT токенов
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult> {
  try {
    // Шаг 1: Извлечение JWT токена из HTTP-only cookie
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return {
        error: 'Требуется аутентификация. JWT токен отсутствует.'
      };
    }
    
    // Шаг 2: Получение JWT_SECRET из переменных окружения
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET не установлен в переменных окружения');
      return {
        error: 'Ошибка конфигурации сервера'
      };
    }
    
    // Шаг 3: Валидация токена (подпись и срок действия)
    let decoded: JWTPayload;
    
    try {
      decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          error: 'JWT токен истек. Требуется повторный вход.'
        };
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          error: 'Невалидный JWT токен.'
        };
      }
      
      // Неизвестная ошибка при валидации токена
      console.error('Ошибка валидации JWT токена:', error);
      return {
        error: 'Ошибка валидации токена'
      };
    }
    
    // Шаг 4: Извлечение userId и email из payload
    const { userId, email } = decoded;
    
    if (!userId || !email) {
      return {
        error: 'Невалидный payload JWT токена'
      };
    }
    
    // Шаг 5: Проверка существования пользователя в БД
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true
      }
    });
    
    if (!user) {
      return {
        error: 'Пользователь не найден. Токен невалиден.'
      };
    }
    
    // Проверка соответствия email в токене и в БД
    if (user.email !== email) {
      return {
        error: 'Email в токене не совпадает с данными пользователя'
      };
    }
    
    // Шаг 6: Возврат данных пользователя
    return {
      user: {
        id: user.id,
        email: user.email
      }
    };
    
  } catch (error) {
    // Обработка неожиданных ошибок
    console.error('Неожиданная ошибка в authenticateRequest:', error);
    return {
      error: 'Внутренняя ошибка сервера при аутентификации'
    };
  }
}

/**
 * Type guard для проверки успешной аутентификации
 * 
 * @param result - Результат аутентификации
 * @returns true если аутентификация успешна
 */
export function isAuthSuccess(result: AuthResult): result is AuthSuccess {
  return 'user' in result;
}

/**
 * Type guard для проверки ошибки аутентификации
 * 
 * @param result - Результат аутентификации
 * @returns true если произошла ошибка
 */
export function isAuthError(result: AuthResult): result is AuthError {
  return 'error' in result;
}
