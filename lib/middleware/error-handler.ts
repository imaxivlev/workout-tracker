import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Централизованная обработка ошибок для API endpoints
 * 
 * Требования: 25.1-25.5
 * 
 * Обрабатывает:
 * - Ошибки валидации Zod (400 Bad Request)
 * - Ошибки БД Prisma (500 Internal Server Error, 409 Conflict)
 * - Общие ошибки (500 Internal Server Error)
 */

/**
 * Интерфейс для структурированного ответа об ошибке
 */
interface ErrorResponse {
  error: string;
  details?: any;
  code?: string;
}

/**
 * Обработчик ошибок для API routes
 * 
 * @param error - Ошибка для обработки
 * @returns NextResponse с соответствующим статусом и сообщением
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  // Логирование полной ошибки для отладки
  console.error('[Error Handler] Обработка ошибки:', error);

  // Ошибки валидации Zod
  if (error instanceof ZodError) {
    return handleValidationError(error);
  }

  // Ошибки Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  // Ошибки Prisma валидации
  if (error instanceof Prisma.PrismaClientValidationError) {
    return handlePrismaValidationError(error);
  }

  // Общие ошибки JavaScript
  if (error instanceof Error) {
    return handleGenericError(error);
  }

  // Неизвестные ошибки
  return NextResponse.json(
    {
      error: 'Внутренняя ошибка сервера',
      code: 'UNKNOWN_ERROR'
    },
    { status: 500 }
  );
}

/**
 * Обработка ошибок валидации Zod
 * Требования: 25.1
 */
function handleValidationError(error: ZodError): NextResponse<ErrorResponse> {
  console.error('[Error Handler] Ошибка валидации Zod:', error.issues);

  return NextResponse.json(
    {
      error: 'Ошибка валидации данных',
      details: error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      })),
      code: 'VALIDATION_ERROR'
    },
    { status: 400 }
  );
}

/**
 * Обработка ошибок Prisma
 * Требования: 25.2, 25.4
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): NextResponse<ErrorResponse> {
  console.error('[Error Handler] Ошибка Prisma:', {
    code: error.code,
    meta: error.meta,
    message: error.message
  });

  // P2002: Unique constraint violation
  if (error.code === 'P2002') {
    const target = error.meta?.target as string[] | undefined;
    const field = target ? target[0] : 'поле';

    return NextResponse.json(
      {
        error: `Запись с таким значением ${field} уже существует`,
        code: 'DUPLICATE_ENTRY',
        details: { field }
      },
      { status: 409 }
    );
  }

  // P2025: Record not found
  if (error.code === 'P2025') {
    return NextResponse.json(
      {
        error: 'Запись не найдена',
        code: 'NOT_FOUND'
      },
      { status: 404 }
    );
  }

  // P2003: Foreign key constraint violation
  if (error.code === 'P2003') {
    return NextResponse.json(
      {
        error: 'Нарушение связи между записями',
        code: 'FOREIGN_KEY_VIOLATION'
      },
      { status: 400 }
    );
  }

  // P2014: Invalid relation
  if (error.code === 'P2014') {
    return NextResponse.json(
      {
        error: 'Некорректная связь между записями',
        code: 'INVALID_RELATION'
      },
      { status: 400 }
    );
  }

  // Другие ошибки Prisma - не раскрываем детали
  return NextResponse.json(
    {
      error: 'Ошибка базы данных',
      code: 'DATABASE_ERROR'
    },
    { status: 500 }
  );
}

/**
 * Обработка ошибок валидации Prisma
 * Требования: 25.2
 */
function handlePrismaValidationError(error: Prisma.PrismaClientValidationError): NextResponse<ErrorResponse> {
  console.error('[Error Handler] Ошибка валидации Prisma:', error.message);

  // Не раскрываем детали схемы БД в production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'Некорректные данные запроса',
        code: 'INVALID_REQUEST'
      },
      { status: 400 }
    );
  }

  // В development можем показать больше деталей
  return NextResponse.json(
    {
      error: 'Некорректные данные запроса',
      details: error.message,
      code: 'INVALID_REQUEST'
    },
    { status: 400 }
  );
}

/**
 * Обработка общих ошибок JavaScript
 * Требования: 25.3, 25.5
 */
function handleGenericError(error: Error): NextResponse<ErrorResponse> {
  console.error('[Error Handler] Общая ошибка:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });

  // Специфичные ошибки приложения
  if (error.message.includes('Unauthorized') || error.message.includes('Неавторизован')) {
    return NextResponse.json(
      {
        error: 'Требуется аутентификация',
        code: 'UNAUTHORIZED'
      },
      { status: 401 }
    );
  }

  if (error.message.includes('Forbidden') || error.message.includes('Доступ запрещен')) {
    return NextResponse.json(
      {
        error: 'Доступ запрещен',
        code: 'FORBIDDEN'
      },
      { status: 403 }
    );
  }

  if (error.message.includes('Not found') || error.message.includes('не найден')) {
    return NextResponse.json(
      {
        error: 'Ресурс не найден',
        code: 'NOT_FOUND'
      },
      { status: 404 }
    );
  }

  // Общая ошибка сервера - не раскрываем детали в production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }

  // В development показываем больше информации
  return NextResponse.json(
    {
      error: 'Внутренняя ошибка сервера',
      details: error.message,
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  );
}

/**
 * Wrapper для API route handlers с автоматической обработкой ошибок
 * 
 * @param handler - Асинхронная функция-обработчик API route
 * @returns Обернутая функция с обработкой ошибок
 * 
 * @example
 * export const POST = withErrorHandler(async (request) => {
 *   // Ваш код здесь
 *   return NextResponse.json({ success: true });
 * });
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  }) as T;
}
