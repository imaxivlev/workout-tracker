# Настройка базы данных для локальной разработки

## Статус

✅ Зависимости установлены:
- `@prisma/client@5`
- `prisma@5`
- `bcrypt`
- `jsonwebtoken`
- `zod`
- `@types/bcrypt`
- `@types/jsonwebtoken`

✅ Файлы созданы:
- `prisma/schema.prisma` - полная схема базы данных
- `prisma/seed.ts` - скрипт для заполнения справочника упражнений
- `.env` - переменные окружения (локальная конфигурация)
- `.env.example` - пример конфигурации

## Требуется действие пользователя

### 1. Установка PostgreSQL

Для продолжения работы необходимо установить и запустить PostgreSQL:

**Windows:**
1. Скачайте PostgreSQL: https://www.postgresql.org/download/windows/
2. Установите PostgreSQL (рекомендуемая версия: 15 или 16)
3. При установке запомните пароль для пользователя `postgres`
4. Убедитесь, что PostgreSQL запущен (порт 5432)

**Проверка установки:**
```cmd
cmd.exe /c "psql --version"
```

### 2. Создание базы данных

Подключитесь к PostgreSQL и создайте базу данных:

```cmd
cmd.exe /c "psql -U postgres"
```

В консоли PostgreSQL выполните:
```sql
CREATE DATABASE workout_tracker;
\q
```

### 3. Настройка переменных окружения

Откройте файл `.env` и обновите `DATABASE_URL` с вашим паролем:

```
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/workout_tracker?schema=public"
```

### 4. Выполнение миграции

После настройки PostgreSQL выполните:

```cmd
cmd.exe /c "npx prisma migrate dev --name init"
```

Эта команда:
- ✅ Создаст все таблицы в базе данных
- ✅ Сгенерирует Prisma Client
- ✅ Запустит seed скрипт (15 глобальных упражнений)

### 5. Проверка

Откройте Prisma Studio для просмотра данных:

```cmd
cmd.exe /c "npx prisma studio"
```

## Альтернатива: Docker

Если не хотите устанавливать PostgreSQL локально, можно использовать Docker:

```cmd
docker run --name workout-tracker-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=workout_tracker -p 5432:5432 -d postgres:15
```

Затем используйте в `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workout_tracker?schema=public"
```

## Структура базы данных

После миграции будут созданы следующие таблицы:

- `users` - пользователи
- `exercises_dict` - справочник упражнений (глобальные + пользовательские)
- `workouts` - тренировки
- `skill_blocks` - силовые блоки
- `skill_sets` - подходы в силовых блоках
- `wod_blocks` - метаболические блоки (WOD)
- `wod_exercises` - упражнения в WOD блоках

Все таблицы имеют необходимые индексы для оптимизации запросов.

## Следующие шаги

После успешной настройки базы данных можно продолжить с задачей 2:
- Реализация User Service и аутентификации
- Создание API Routes для auth
- Реализация JWT токенов

## Помощь

Если возникли проблемы:
1. Убедитесь, что PostgreSQL запущен
2. Проверьте правильность пароля в `.env`
3. Проверьте, что порт 5432 не занят другим приложением
4. Проверьте логи PostgreSQL
