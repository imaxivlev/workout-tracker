#!/bin/bash

# Скрипт для деплоя production окружения на Timeweb
# Использование: bash scripts/deploy-production.sh

set -e  # Остановка при ошибке

echo "🚀 Начинаем деплой production окружения на Timeweb..."

# Проверка наличия .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ Файл .env.production не найден!"
    echo "Создайте файл .env.production с необходимыми переменными окружения"
    exit 1
fi

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

# Генерация Prisma Client
echo "🔧 Генерация Prisma Client..."
npx prisma generate

# Сборка проекта
echo "🏗️  Сборка проекта..."
npm run build

# Выполнение миграций БД
echo "🗄️  Выполнение миграций базы данных..."
npx prisma migrate deploy

# Заполнение справочника упражнений
echo "🌱 Заполнение справочника упражнений..."
npx prisma db seed

echo "✅ Деплой production завершен успешно!"
echo ""
echo "Для запуска приложения выполните:"
echo "  pm2 start npm --name 'workout-tracker-production' -- start"
echo ""
echo "Для просмотра логов:"
echo "  pm2 logs workout-tracker-production"
