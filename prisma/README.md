# Настройка базы данных

## Требования

Для локальной разработки необходим PostgreSQL.

### Установка PostgreSQL (Windows)

1. Скачайте PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/
2. Установите PostgreSQL (по умолчанию порт 5432)
3. Запомните пароль для пользователя `postgres`

### Создание базы данных

```sql
-- Подключитесь к PostgreSQL через psql или pgAdmin
CREATE DATABASE workout_tracker;
```

### Настройка переменных окружения

Скопируйте `.env.example` в `.env` и обновите `DATABASE_URL`:

```
DATABASE_URL="postgresql://postgres:ваш_пароль@localhost:5432/workout_tracker?schema=public"
```

## Миграции

### Первая миграция

```cmd
cmd.exe /c "npx prisma migrate dev --name init"
```

Эта команда:
- Создаст все таблицы в базе данных
- Сгенерирует Prisma Client
- Запустит seed скрипт для заполнения глобального справочника упражнений

### Последующие миграции

После изменения `schema.prisma`:

```cmd
cmd.exe /c "npx prisma migrate dev --name описание_изменений"
```

### Генерация Prisma Client

Если нужно только обновить клиент без миграции:

```cmd
cmd.exe /c "npx prisma generate"
```

### Просмотр базы данных

Prisma Studio - GUI для просмотра данных:

```cmd
cmd.exe /c "npx prisma studio"
```

## Seed данные

Для повторного заполнения справочника упражнений:

```cmd
cmd.exe /c "npm run prisma:seed"
```

## Сброс базы данных

⚠️ **ВНИМАНИЕ**: Удалит все данные!

```cmd
cmd.exe /c "npx prisma migrate reset"
```

Эта команда:
- Удалит базу данных
- Создаст её заново
- Применит все миграции
- Запустит seed скрипт
