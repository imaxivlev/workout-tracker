#!/bin/bash
cd ~/staging
source ~/.bash_profile

echo "=== Проверка подключения к базе данных ==="
mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst -e "SELECT 1 as test;" 2>&1

if [ $? -eq 0 ]; then
  echo "✓ База данных доступна"
else
  echo "✗ Ошибка подключения к базе данных"
  exit 1
fi

echo ""
echo "=== Применение миграций Prisma ==="
npx prisma migrate deploy

echo ""
echo "=== Заполнение справочника упражнений ==="
npx prisma db seed

echo ""
echo "=== Сборка проекта ==="
npm run build

echo ""
echo "=== Проверка PM2 процессов ==="
pm2 list

echo ""
echo "=== Перезапуск приложения ==="
pm2 restart workout-tracker-staging || pm2 start npm --name "workout-tracker-staging" -- start -- -p 3001

echo ""
echo "=== Сохранение конфигурации PM2 ==="
pm2 save

echo ""
echo "✓ Настройка завершена!"
echo "Приложение доступно по адресу: https://test.crossfitapp.ru"
