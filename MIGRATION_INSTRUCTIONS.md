# Инструкции по миграции базы данных

## Задача 3.5: Добавление таблицы password_reset_tokens

### Что было сделано:

1. ✅ Добавлена модель `PasswordResetToken` в `prisma/schema.prisma`
2. ✅ Обновлен метод `requestPasswordReset` в `lib/services/user.service.ts`
3. ✅ Создан endpoint `app/api/auth/reset-password/route.ts`
4. ✅ Сгенерирован Prisma Client (`npx prisma generate`)

### Что нужно сделать при запуске базы данных:

Когда PostgreSQL будет запущен, выполните следующую команду для создания миграции:

```cmd
cmd.exe /c "npx prisma migrate dev --name add_password_reset_tokens"
```

Эта команда:
- Создаст таблицу `password_reset_tokens` в базе данных
- Добавит необходимые индексы
- Обновит историю миграций

### Структура таблицы password_reset_tokens:

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_password_reset_tokens_token (token),
  INDEX idx_password_reset_tokens_user_id (user_id)
);
```

### Функциональность:

- Токен сброса пароля генерируется как 32-байтовая случайная строка (64 символа hex)
- Срок действия токена: 1 час
- Токены одноразовые (удаляются после использования)
- При создании нового токена старые токены пользователя удаляются
- Каскадное удаление при удалении пользователя

### Endpoint:

**POST /api/auth/reset-password**

Request:
```json
{
  "email": "user@example.com"
}
```

Response (всегда 200 OK для защиты от перечисления email):
```json
{
  "message": "Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по сбросу пароля.",
  "success": true
}
```

### Примечания:

- Отправка email будет реализована в задаче 4 (Email Service)
- Endpoint для подтверждения сброса пароля будет реализован в задаче 3.6
