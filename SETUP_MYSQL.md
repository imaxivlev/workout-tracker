# Настройка MySQL для локальной разработки

## Вариант 1: Использовать Docker (рекомендуется)

Самый простой способ - запустить MySQL в Docker контейнере:

```cmd
docker run --name mysql-workout -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=workout_tracker -p 3306:3306 -d mysql:8.0
```

Затем обновить `.env`:
```env
DATABASE_URL="mysql://root:password@localhost:3306/workout_tracker"
```

## Вариант 2: Установить MySQL локально

1. Скачать MySQL Community Server: https://dev.mysql.com/downloads/mysql/
2. Установить и запустить MySQL
3. Создать базу данных:
   ```sql
   CREATE DATABASE workout_tracker;
   ```
4. Обновить `.env` с вашими credentials

## Вариант 3: Использовать XAMPP/WAMP

1. Установить XAMPP или WAMP
2. Запустить MySQL через панель управления
3. Создать базу `workout_tracker` через phpMyAdmin
4. Обновить `.env`:
   ```env
   DATABASE_URL="mysql://root:@localhost:3306/workout_tracker"
   ```

## После настройки MySQL

Выполнить миграции и seed:

```cmd
cmd.exe /c "npx prisma migrate dev --name init_mysql"
cmd.exe /c "npx prisma db seed"
```

Проверить, что все работает:

```cmd
cmd.exe /c "npm test"
```

## Что изменилось

- ✅ Схема Prisma переведена на MySQL
- ✅ UUID типы заменены на VARCHAR(36)
- ✅ Добавлены явные размеры для строковых полей
- ✅ Обновлен .env.example
- ✅ Обновлена документация задач

Все тесты и код остаются без изменений - Prisma автоматически адаптирует запросы под MySQL.
