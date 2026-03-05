# Authentication Middleware

Middleware для аутентификации запросов с использованием JWT токенов.

## Обзор

Модуль `middleware.ts` предоставляет функцию `authenticateRequest()` для защиты API endpoints от неавторизованного доступа. Middleware извлекает JWT токен из HTTP-only cookie, валидирует его и проверяет существование пользователя в базе данных.

## Основные компоненты

### `authenticateRequest(request: NextRequest): Promise<AuthResult>`

Главная функция middleware для аутентификации запросов.

**Параметры:**
- `request` - Next.js request объект

**Возвращает:**
- `AuthSuccess` - объект с данными пользователя при успешной аутентификации
- `AuthError` - объект с сообщением об ошибке при неудачной аутентификации

**Процесс аутентификации:**

1. **Извлечение токена** - Читает JWT токен из HTTP-only cookie с именем `auth-token`
2. **Валидация токена** - Проверяет подпись и срок действия токена
3. **Извлечение payload** - Получает `userId` и `email` из токена
4. **Проверка пользователя** - Проверяет существование пользователя в БД
5. **Возврат результата** - Возвращает данные пользователя или ошибку

### Type Guards

**`isAuthSuccess(result: AuthResult): result is AuthSuccess`**
- Проверяет, является ли результат успешной аутентификацией
- Используется для type narrowing в TypeScript

**`isAuthError(result: AuthResult): result is AuthError`**
- Проверяет, является ли результат ошибкой аутентификации
- Используется для type narrowing в TypeScript

## Использование

### Базовый пример

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  // Аутентификация запроса
  const authResult = await authenticateRequest(request);
  
  // Проверка результата
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }
  
  // Использование данных пользователя
  const { user } = authResult;
  
  return NextResponse.json({
    message: 'Доступ разрешен',
    userId: user.id,
    email: user.email
  });
}
```

### Пример с проверкой владельца ресурса

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Аутентификация
  const authResult = await authenticateRequest(request);
  
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }
  
  const { user } = authResult;
  
  // Получение ресурса
  const workout = await workoutService.getWorkoutById(params.id, user.id);
  
  if (!workout) {
    return NextResponse.json(
      { error: 'Тренировка не найдена' },
      { status: 404 }
    );
  }
  
  // Проверка прав доступа
  if (workout.userId !== user.id) {
    return NextResponse.json(
      { error: 'Доступ запрещен' },
      { status: 403 }
    );
  }
  
  // Удаление ресурса
  await workoutService.deleteWorkout(params.id, user.id);
  
  return NextResponse.json({ message: 'Тренировка удалена' });
}
```

## Обработка ошибок

Middleware возвращает различные сообщения об ошибках в зависимости от ситуации:

| Ошибка | Описание | HTTP Status |
|--------|----------|-------------|
| `JWT токен отсутствует` | Cookie `auth-token` не найден | 401 |
| `JWT токен истек` | Токен истек (срок действия > 7 дней) | 401 |
| `Невалидный JWT токен` | Подпись токена невалидна | 401 |
| `Пользователь не найден` | Пользователь с `userId` из токена не существует в БД | 401 |
| `Email в токене не совпадает` | Email в токене отличается от email в БД | 401 |

## Требования

### Переменные окружения

- `JWT_SECRET` - Секретный ключ для подписи JWT токенов (256-bit случайная строка)

### Зависимости

- `jsonwebtoken` - Библиотека для работы с JWT
- `@prisma/client` - ORM для работы с PostgreSQL
- `next` - Next.js framework

## Безопасность

### JWT токены

- **Алгоритм**: HS256 (HMAC with SHA-256)
- **Срок действия**: 7 дней
- **Payload**: `{ userId, email, iat, exp }`
- **Хранение**: HTTP-only cookie (защита от XSS)

### HTTP-only Cookie

Токен хранится в HTTP-only cookie с именем `auth-token`, что предотвращает доступ к токену из JavaScript и защищает от XSS атак.

### Проверка существования пользователя

Middleware всегда проверяет существование пользователя в БД, даже если токен валиден. Это защищает от использования токенов удаленных пользователей.

## Связанные требования

- **Требование 3.2**: Извлечение JWT токена из HTTP-only cookie
- **Требование 3.3**: Валидация токена (подпись, срок действия)
- **Требование 3.4**: Извлечение userId и email из payload
- **Требование 3.5**: Проверка существования пользователя в БД
- **Требование 21.1**: Все API endpoints (кроме auth) должны проверять JWT токен
- **Требование 21.2**: Возврат 401 Unauthorized при невалидном токене

## Свойства корректности

**Свойство 6: Валидность JWT токенов**

Для любого JWT токена, если токен валиден и не истек, то должен существовать пользователь с `userId` и `email` из payload токена.

## Примеры

Полные примеры использования middleware доступны в файле `middleware.example.ts`.

## Тестирование

Для тестирования middleware рекомендуется:

1. **Unit тесты** - Тестирование с mock request объектами
2. **Integration тесты** - Тестирование с реальной БД и JWT токенами
3. **Property-based тесты** - Проверка инвариантов (Свойство 6)

Пример unit теста:

```typescript
import { authenticateRequest, isAuthSuccess } from './middleware';
import { NextRequest } from 'next/server';

test('должен успешно аутентифицировать запрос с валидным токеном', async () => {
  const validToken = 'valid.jwt.token';
  
  const request = new NextRequest('http://localhost:3000/api/test', {
    headers: {
      cookie: `auth-token=${validToken}`
    }
  });
  
  const result = await authenticateRequest(request);
  
  expect(isAuthSuccess(result)).toBe(true);
});
```

## Rate Limiting

Модуль также включает систему rate limiting для защиты API от злоупотреблений.

### Файлы

- `rate-limiter.ts` - Основная реализация rate limiting
- `rate-limit-middleware.ts` - Next.js middleware wrapper

### Конфигурации

Три предустановленные конфигурации:

- **Auth endpoints**: 5 запросов за 15 минут (login, register, password reset)
- **API endpoints**: 100 запросов за минуту (общие API вызовы)
- **Migration endpoint**: 1 запрос за 5 минут (миграция данных)

### Использование

#### Auth Endpoints

```typescript
import { applyAuthRateLimit } from '@/lib/auth/rate-limit-middleware';

export async function POST(request: NextRequest) {
  // Применяем rate limiting
  const rateLimitResponse = await applyAuthRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse; // Возвращает 429 если лимит превышен
  }

  // Продолжаем логику входа
  // ...
}
```

#### API Endpoints (с аутентификацией)

```typescript
import { authenticateRequest } from '@/lib/auth/middleware';
import { applyApiRateLimit } from '@/lib/auth/rate-limit-middleware';

export async function GET(request: NextRequest) {
  // Сначала аутентификация
  const authResult = await authenticateRequest(request);
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  // Применяем rate limiting с userId
  const rateLimitResponse = await applyApiRateLimit(request, authResult.user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Продолжаем логику API
  // ...
}
```

#### Migration Endpoint

```typescript
import { applyMigrationRateLimit } from '@/lib/auth/rate-limit-middleware';

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  // Строгий rate limiting для миграции
  const rateLimitResponse = await applyMigrationRateLimit(request, authResult.user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Продолжаем логику миграции
  // ...
}
```

### Формат ответа при превышении лимита

```json
{
  "error": "Too Many Requests",
  "message": "Превышен лимит запросов. Попробуйте снова через 60 секунд.",
  "retryAfter": 60
}
```

С заголовками:
- `Retry-After`: Секунды до сброса лимита
- `X-RateLimit-Limit`: Максимальное количество запросов
- `X-RateLimit-Remaining`: Оставшиеся запросы (0 при блокировке)
- `X-RateLimit-Reset`: Timestamp сброса лимита

### Связанные требования

- **Требование 1.7**: Возврат 429 при превышении лимита попыток входа
- **Требование 17.1**: 5 попыток входа за 15 минут
- **Требование 17.2**: 100 запросов к API за минуту
- **Требование 17.3**: 1 запрос миграции за 5 минут
- **Требование 17.4**: Заголовок Retry-After при ошибке 429

## Дальнейшее развитие

Возможные улучшения middleware:

1. **Refresh токены** - Автоматическое обновление истекших токенов
2. **Redis для rate limiting** - Масштабируемое хранилище вместо in-memory
3. **Blacklist токенов** - Список отозванных токенов (для logout)
4. **Роли и права** - Проверка прав доступа на основе ролей пользователя
5. **Audit log** - Логирование всех попыток аутентификации
