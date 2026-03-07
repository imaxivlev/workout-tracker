#!/bin/bash

# Скрипт для быстрого обновления staging окружения
# Использование: bash scripts/update-staging.sh

set -e  # Остановка при ошибке

echo "🔄 Обновление staging окружения..."

# Получить последние изменения из Git
echo "📥 Получение изменений из Git..."
git pull origin main

# Установить новые зависимости (если есть)
echo "📦 Установка зависимостей..."
npm install

# Применить новые миграции (если есть)
echo "🗄️  Применение миграций БД..."
npx prisma migrate deploy

# Пересобрать проект
echo "🏗️  Сборка проекта..."
npm run build

# Перезапустить приложение через PM2
echo "🔄 Перезапуск приложения..."
pm2 restart workout-tracker-staging

echo "✅ Staging обновлен успешно!"
echo ""
echo "Для просмотра логов выполните:"
echo "  pm2 logs workout-tracker-staging"
