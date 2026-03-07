# Деплой Next.js на Timeweb через SSH

## Пошаговая инструкция

Timeweb предоставляет виртуальный хостинг с SSH доступом. Настроим Next.js приложение вручную.

## Подготовка на Timeweb

### 1. Создать виртуальный хостинг
- Выбрать тариф с SSH доступом
- Получить SSH credentials (хост, логин, пароль)

### 2. Подключиться по SSH
```bash
ssh user@your-server.timeweb.ru
```

### 3. Установить Node.js вручную
```bash
# Скачать Node.js 18 LTS
wget https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.gz

# Распаковать
tar xf node-v18.19.0-linux-x64.tar.gz

# Переименовать
mv node-v18.19.0-linux-x64 nodejs

# Добавить алиасы в .bash_profile
echo "alias node='/home/u/user/nodejs/bin/node'" >> ~/.bash_profile
echo "alias npm='/home/u/user/nodejs/bin/npm'" >> ~/.bash_profile
echo "export PATH=\$PATH:/home/u/user/nodejs/bin/" >> ~/.bash_profile

# Применить изменения
source ~/.bash_profile

# Проверить версию
node -v
npm -v
```

### 4. Загрузить код проекта
```bash
# Вариант 1: Через Git
git clone https://github.com/imaxivlev/workout-tracker.git
cd workout-tracker

# Вариант 2: Через FTP/SFTP
# Загрузить файлы через FileZilla или WinSCP
```

### 5. Установить зависимости и собрать проект
```bash
npm install
npm run build
```

### 6. Настроить переменные окружения
```bash
# Создать .env файл
nano .env

# Добавить:
DATABASE_URL="mysql://user:password@localhost:3306/workout_tracker_staging"
JWT_SECRET="your-secret-key"
NEXT_PUBLIC_APP_URL="https://your-domain.timeweb.ru"
NODE_ENV="production"
```

### 7. Выполнить миграции БД
```bash
npx prisma migrate deploy
npx prisma db seed
```

### 8. Запустить приложение
```bash
# Вариант 1: Простой запуск (остановится при закрытии SSH)
npm start

# Вариант 2: Через PM2 (рекомендуется)
npm install -g pm2
pm2 start npm --name "workout-tracker" -- start
pm2 save
pm2 startup
```

### 9. Настроить Nginx (если нужно)
Timeweb обычно использует Apache, но может потребоваться настройка проксирования на порт 3000.

## Важные моменты

⚠️ **Node.js версия:** Используй Node.js 18 LTS (не 6.x из примера Timeweb)
⚠️ **PM2:** Обязательно используй PM2 для автозапуска
⚠️ **Порты:** Staging на 3001, Production на 3000
⚠️ **Бэкапы:** Настрой автоматические бэкапы БД в панели Timeweb

## Настройка автоматического обновления (опционально)

### Вариант 1: Webhook для автоматического деплоя
Создать скрипт `~/deploy.sh`:
```bash
#!/bin/bash
cd ~/workout-tracker
git pull origin master
npm install
npm run build
pm2 restart workout-tracker
```

Настроить GitHub webhook для автоматического запуска при push.

### Вариант 2: Cron для периодического обновления
```bash
# Добавить в crontab
crontab -e

# Обновлять каждые 5 минут
*/5 * * * * cd ~/workout-tracker && git pull origin master && npm install && npm run build && pm2 restart workout-tracker
```

## Настройка для Staging и Production

### Staging окружение
```bash
# Клонировать в отдельную папку
git clone https://github.com/imaxivlev/workout-tracker.git ~/staging
cd ~/staging

# Создать .env для staging
nano .env
# DATABASE_URL="mysql://user:password@localhost:3306/workout_tracker_staging"

# Запустить на порту 3001
pm2 start npm --name "workout-tracker-staging" -- start -- -p 3001
```

### Production окружение
```bash
# Клонировать в отдельную папку
git clone https://github.com/imaxivlev/workout-tracker.git ~/production
cd ~/production

# Создать .env для production
nano .env
# DATABASE_URL="mysql://user:password@localhost:3306/workout_tracker_production"

# Запустить на порту 3000
pm2 start npm --name "workout-tracker-production" -- start
```

## Настройка доменов

В панели Timeweb настроить:
- `staging.yourdomain.ru` → порт 3001
- `app.yourdomain.ru` → порт 3000

## Мониторинг и логи

```bash
# Посмотреть статус приложений
pm2 status

# Посмотреть логи
pm2 logs workout-tracker-staging
pm2 logs workout-tracker-production

# Перезапустить
pm2 restart workout-tracker-staging
pm2 restart workout-tracker-production

# Остановить
pm2 stop workout-tracker-staging
```

## Резюме

После настройки у тебя будет:
- ✅ Staging окружение на порту 3001
- ✅ Production окружение на порту 3000
- ✅ Автоматический перезапуск при падении (PM2)
- ✅ Две отдельные MySQL БД
- ✅ Возможность автоматического обновления через Git

Все работает на российском хостинге Timeweb!
