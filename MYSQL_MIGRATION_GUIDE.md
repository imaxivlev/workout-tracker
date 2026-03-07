# Миграция на MySQL

## Что изменилось

Проект переведен с PostgreSQL на MySQL для совместимости с Timeweb хостингом.

## Изменения в схеме Prisma

1. **Провайдер БД**: `postgresql` → `mysql`
2. **UUID типы**: `@db.Uuid` → `@db.VarChar(36)`
3. **Строковые поля**: Добавлены явные размеры (`@db.VarChar(255)`, `@db.Text`)
4. **Decimal**: Синтаксис остался прежним, но MySQL использует свою реализацию

## Шаги для локальной разработки

### 1. Установить MySQL локально

**Windows:**
```cmd
# Скачать MySQL Community Server с https://dev.mysql.com/downloads/mysql/
# Или использовать XAMPP/WAMP
```

**Или использовать Docker:**
```cmd
docker run --name mysql-workout -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=workout_tracker -p 3306:3306 -d mysql:8.0
```

### 2. Обновить .env файл

```env
DATABASE_URL="mysql://root:password@localhost:3306/workout_tracker"
```

### 3. Пересоздать миграции

```cmd
# Удалить старые миграции (уже сделано)
# Создать новую миграцию для MySQL
cmd.exe /c "npx prisma migrate dev --name init_mysql"

# Применить seed
cmd.exe /c "npx prisma db seed"
```

### 4. Перезапустить тесты

```cmd
cmd.exe /c "npm test"
```

## Для production на Timeweb

1. Создать MySQL базу в панели Timeweb
2. Скопировать DATABASE_URL
3. Добавить в переменные окружения Node.js приложения
4. Выполнить миграции:
   ```cmd
   npx prisma migrate deploy
   npx prisma db seed
   ```

## Совместимость

Все существующие тесты и код остаются без изменений. Prisma ORM автоматически адаптирует запросы под MySQL.

## Преимущества MySQL на Timeweb

- ✅ Включен в базовые тарифы
- ✅ Дешевле PostgreSQL
- ✅ Автоматические бэкапы
- ✅ Простая настройка в панели управления
