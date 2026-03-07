#!/bin/bash

# Скрипт для деплоя staging окружения на Timeweb
# Использование: bash scripts/deploy-staging.sh

set -e  # Остановка при ошибке

echo "🚀 Начинаем деплой staging окружения на Timeweb..."

# Проверка наличия .env.staging
if [ ! -f ".env.staging" ]; then
    echo "❌ Файл .env.staging не найден!"
    echo "Создайте файл .env.staging с необходимыми переменными окружения"
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

echo "✅ Деплой staging завершен успешно!"
echo ""
echo "Для запуска приложения выполните:"
echo "  pm2 start npm --name 'workout-tracker-staging' -- start -- -p 3001"
echo ""
echo "Для просмотра логов:"
echo "  pm2 logs workout-tracker-staging"
