# Настройка Staging окружения на Timeweb

## Обзор

Этот документ содержит пошаговые инструкции по настройке staging окружения для CrossFit Tracker на хостинге Timeweb.

**Staging окружение:**
- URL: https://test.crossfitapp.ru
- Порт: 3001
- База данных: cu797814_crosst (уже создана)

## Предварительные требования

У вас уже есть:
- ✅ SSH доступ к Timeweb (vh434.timeweb.ru)
- ✅ MySQL база данных для staging
- ✅ SMTP credentials для отправки email
- ✅ Домен test.crossfitapp.ru

## Шаг 1: Подключение к серверу по SSH

```bash
ssh cu797814@vh434.timeweb.ru
# Пароль: s4bZ@y6zUsVj
```

## Шаг 2: Установка Node.js 18 LTS

```bash
# Скачать Node.js 18 LTS
wget https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.gz

# Распаковать
tar xf node-v18.19.0-linux-x64.tar.gz

# Переименовать для удобства
mv node-v18.19.0-linux-x64 nodejs

# Добавить алиасы в .bash_profile
echo 'alias node="/home/c/cu797814/nodejs/bin/node"' >> ~/.bash_profile
echo 'alias npm="/home/c/cu797814/nodejs/bin/npm"' >> ~/.bash_profile
echo 'alias npx="/home/c/cu797814/nodejs/bin/npx"' >> ~/.bash_profile
echo 'export PATH=$PATH:/home/c/cu797814/nodejs/bin/' >> ~/.bash_profile

# Применить изменения
source ~/.bash_profile

# Проверить версию
node -v  # Должно показать v18.19.0
npm -v   # Должно показать 10.x.x
```

## Шаг 3: Клонирование репозитория

```bash
# Клонировать репозиторий в папку staging
git clone https://github.com/imaxivlev/workout-tracker.git ~/staging

# Перейти в папку проекта
cd ~/staging
```

## Шаг 4: Создание файла .env.staging

```bash
# Создать файл с переменными окружения
nano .env.staging
```

Вставьте следующее содержимое:

```env
# Database (MySQL на Timeweb)
DATABASE_URL="mysql://cu797814_crosst:BrKT3BD12cye@localhost:3306/cu797814_crosst"

# JWT Secret (сгенерирован для staging)
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"

# App URL (staging domain)
NEXT_PUBLIC_APP_URL="https://test.crossfitapp.ru"

# SMTP Settings (Timeweb SMTP)
SMTP_HOST="smtp.timeweb.ru"
SMTP_PORT="465"
SMTP_USER="noreply@crossfitapp.ru"
SMTP_PASSWORD="e236925zuS"

# Node Environment
NODE_ENV="production"
```

Сохраните файл: `Ctrl+O`, `Enter`, `Ctrl+X`

## Шаг 5: Установка зависимостей

```bash
# Установить зависимости проекта
npm install

# Это может занять несколько минут
```

## Шаг 6: Генерация Prisma Client

```bash
# Сгенерировать Prisma Client для работы с БД
npx prisma generate
```

## Шаг 7: Выполнение миграций базы данных

```bash
# Применить все миграции к staging БД
npx prisma migrate deploy

# Это создаст все необходимые таблицы в БД
```

## Шаг 8: Заполнение справочника упражнений

```bash
# Заполнить БД начальными данными (глобальные упражнения)
npx prisma db seed
```

## Шаг 9: Сборка проекта

```bash
# Собрать Next.js приложение для production
npm run build

# Это создаст оптимизированную версию в папке .next
```

## Шаг 10: Установка PM2 для управления процессами

```bash
# Установить PM2 глобально
npm install -g pm2

# Проверить установку
pm2 -v
```

## Шаг 11: Запуск приложения через PM2

```bash
# Запустить приложение на порту 3001
pm2 start npm --name "workout-tracker-staging" -- start -- -p 3001

# Сохранить конфигурацию PM2
pm2 save

# Настроить автозапуск при перезагрузке сервера
pm2 startup
# Выполните команду, которую выведет PM2
```

## Шаг 12: Проверка статуса приложения

```bash
# Посмотреть статус всех приложений
pm2 status

# Посмотреть логи staging приложения
pm2 logs workout-tracker-staging

# Посмотреть последние 100 строк логов
pm2 logs workout-tracker-staging --lines 100
```

## Шаг 13: Настройка домена в панели Timeweb

1. Зайдите в панель управления Timeweb
2. Перейдите в раздел "Домены"
3. Найдите домен crossfitapp.ru
4. Добавьте поддомен: `test.crossfitapp.ru`
5. Настройте проксирование на порт 3001:
   - Тип: HTTP
   - Порт: 3001
   - Путь: /
6. Включите SSL сертификат (Let's Encrypt)
7. Сохраните изменения

## Шаг 14: Проверка работы staging окружения

1. Откройте в браузере: https://test.crossfitapp.ru
2. Проверьте, что приложение загружается
3. Попробуйте зарегистрировать тестового пользователя
4. Проверьте отправку email (письмо верификации)
5. Создайте тестовую тренировку
6. Проверьте статистику

## Полезные команды PM2

```bash
# Перезапустить приложение
pm2 restart workout-tracker-staging

# Остановить приложение
pm2 stop workout-tracker-staging

# Удалить приложение из PM2
pm2 delete workout-tracker-staging

# Посмотреть детальную информацию
pm2 show workout-tracker-staging

# Мониторинг в реальном времени
pm2 monit
```

## Обновление staging окружения

Когда нужно обновить код на staging:

```bash
# Перейти в папку проекта
cd ~/staging

# Получить последние изменения из Git
git pull origin main

# Установить новые зависимости (если есть)
npm install

# Применить новые миграции (если есть)
npx prisma migrate deploy

# Пересобрать проект
npm run build

# Перезапустить приложение
pm2 restart workout-tracker-staging

# Проверить логи
pm2 logs workout-tracker-staging --lines 50
```

## Автоматизация обновлений (опционально)

Создайте скрипт для автоматического обновления:

```bash
# Создать скрипт
nano ~/update-staging.sh
```

Содержимое скрипта:

```bash
#!/bin/bash
cd ~/staging
git pull origin main
npm install
npx prisma migrate deploy
npm run build
pm2 restart workout-tracker-staging
echo "✅ Staging обновлен успешно!"
```

Сделайте скрипт исполняемым:

```bash
chmod +x ~/update-staging.sh
```

Теперь для обновления достаточно выполнить:

```bash
~/update-staging.sh
```

## Мониторинг и логирование

### Просмотр логов приложения

```bash
# Все логи
pm2 logs workout-tracker-staging

# Только ошибки
pm2 logs workout-tracker-staging --err

# Последние N строк
pm2 logs workout-tracker-staging --lines 200
```

### Мониторинг ресурсов

```bash
# Интерактивный мониторинг
pm2 monit

# Статистика использования ресурсов
pm2 status
```

### Логи базы данных

Логи MySQL можно посмотреть в панели управления Timeweb в разделе "Базы данных".

## Решение проблем

### Приложение не запускается

```bash
# Проверить логи
pm2 logs workout-tracker-staging --lines 100

# Проверить переменные окружения
cat .env.staging

# Проверить подключение к БД
npx prisma db pull
```

### Ошибки миграций

```bash
# Посмотреть статус миграций
npx prisma migrate status

# Сбросить БД и применить миграции заново (ОСТОРОЖНО!)
npx prisma migrate reset
```

### Порт уже занят

```bash
# Найти процесс на порту 3001
lsof -i :3001

# Убить процесс
kill -9 <PID>

# Или остановить через PM2
pm2 stop workout-tracker-staging
pm2 start workout-tracker-staging
```

### Проблемы с SSL

Если SSL сертификат не работает:
1. Проверьте настройки домена в панели Timeweb
2. Убедитесь, что DNS записи настроены правильно
3. Подождите 5-10 минут для применения изменений
4. Попробуйте перевыпустить сертификат в панели

## Бэкапы базы данных

### Создание бэкапа

```bash
# Экспорт БД в файл
mysqldump -u cu797814_crosst -p cu797814_crosst > backup_$(date +%Y%m%d).sql
# Пароль: BrKT3BD12cye
```

### Восстановление из бэкапа

```bash
# Импорт БД из файла
mysql -u cu797814_crosst -p cu797814_crosst < backup_20240115.sql
# Пароль: BrKT3BD12cye
```

### Автоматические бэкапы

Настройте автоматические бэкапы в панели управления Timeweb:
1. Перейдите в раздел "Базы данных"
2. Выберите БД cu797814_crosst
3. Включите автоматические бэкапы (ежедневно)

## Следующие шаги

После успешной настройки staging окружения:

1. ✅ Протестируйте все функции приложения
2. ✅ Проверьте отправку email
3. ✅ Проверьте PWA функциональность
4. ✅ Проверьте оффлайн режим
5. ✅ Проверьте миграцию данных из localStorage

Когда staging работает стабильно, можно настраивать production окружение по аналогичной схеме.

## Контакты и поддержка

- Документация Timeweb: https://timeweb.com/ru/help/
- Техподдержка Timeweb: support@timeweb.ru
- Документация Next.js: https://nextjs.org/docs
- Документация Prisma: https://www.prisma.io/docs

---

**Важно:** Сохраните все пароли и секретные ключи в безопасном месте!
