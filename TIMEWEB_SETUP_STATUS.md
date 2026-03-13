# Статус настройки Timeweb Staging - Отчет для Antigravity

**Дата:** 8 марта 2025  
**Агент:** Kiro  
**Сервер:** vh434.timeweb.ru  
**Пользователь:** cu797814  

---

## 🎯 Цель

Настроить staging окружение на сервере Timeweb для проекта workout-tracker.

---

## ✅ Что удалось сделать

### 1. SSH-доступ настроен

- ✅ Создан SSH-ключ на локальной машине: `~/.ssh/timeweb_rsa`
- ✅ Публичный ключ добавлен на сервер в `~/.ssh/authorized_keys`
- ✅ Подключение работает без пароля через команду:
  ```bash
  ssh -i "$env:USERPROFILE\.ssh\timeweb_rsa" cu797814@vh434.timeweb.ru
  ```

### 2. Проект уже развернут на сервере

**Расположение:** `~/staging`

**Что уже есть:**
- ✅ Репозиторий склонирован с GitHub
- ✅ Node.js v20.18.2 установлен
- ✅ npm v10.8.2 установлен
- ✅ Зависимости установлены (`node_modules` присутствует)
- ✅ Файл `.env.staging` создан и настроен
- ✅ Создан симлинк `.env` → `.env.staging`

### 3. Конфигурация окружения

**Файл `.env` (симлинк на `.env.staging`):**
```env
# Database (MySQL на Timeweb через socket)
DATABASE_URL="mysql://cu797814_crosst:BrKT3BD12cye@localhost/cu797814_crosst?socket=/var/run/mysqld/mysqld.sock"

# JWT Secret
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

**Важно:** DATABASE_URL обновлен для использования Unix socket вместо TCP-подключения.

### 4. MySQL настройки

**База данных:**
- Имя: `cu797814_crosst`
- Пользователь: `cu797814_crosst`
- Пароль: `BrKT3BD12cye`
- Socket: `/var/run/mysqld/mysqld.sock`

**Статус:** База данных создана в панели Timeweb, но подключение не проверено из-за проблем с сервером.

### 5. Prisma Client

- ✅ `npx prisma generate` выполнен успешно
- ✅ Prisma Client сгенерирован в `node_modules/@prisma/client`

---

## ❌ Что НЕ удалось сделать

### 1. Миграции базы данных

**Проблема:** Команда `npx prisma migrate deploy` зависает и не завершается.

**Причина:** 
- Зависший процесс от предыдущей попытки (8 марта)
- Процессы были убиты командой `kill -9`, но проблема осталась
- Сервер перегружен после перезагрузки (ошибки "Resource temporarily unavailable")

**Зависшие процессы (были убиты):**
```
cu797814 2423409 - npm exec prisma migrate deploy
cu797814 2426680 - sh -c prisma migrate deploy
cu797814 2426681 - node prisma migrate deploy
cu797814 2441968 - schema-engine
```

### 2. Seed данных

**Статус:** Не выполнен (зависит от миграций)

**Команда:** `npx prisma db seed`

### 3. Сборка проекта

**Статус:** Не выполнен

**Команда:** `npm run build`

**Причина:** Папка `.next` отсутствует

### 4. PM2 и запуск приложения

**Статус:** Не настроен

**Что нужно сделать:**
- Установить PM2 глобально: `npm install -g pm2`
- Запустить приложение: `pm2 start npm --name "workout-tracker-staging" -- start -- -p 3001`
- Сохранить конфигурацию: `pm2 save`
- Настроить автозапуск: `pm2 startup`

### 5. Настройка домена

**Статус:** Не настроен

**Домен:** test.crossfitapp.ru

**Что нужно сделать в панели Timeweb:**
1. Добавить поддомен `test` к домену `crossfitapp.ru`
2. Настроить проксирование на порт 3001
3. Включить SSL-сертификат (Let's Encrypt)

---

## 🚨 Текущие проблемы

### Проблема 1: Сервер Timeweb перегружен

**Симптомы:**
- Ошибки "bash: fork: retry: Resource temporarily unavailable"
- SSH-команды зависают или падают с "exec request failed on channel 0"
- Команды выполняются очень медленно
- SCP не работает ("subsystem request failed on channel 0")

**Возможные причины:**
- Сервер недавно перезагружен и еще восстанавливается
- Превышен лимит процессов для пользователя
- Недостаточно ресурсов (RAM/CPU)
- Зависшие процессы от предыдущих попыток

**Рекомендации:**
1. Подождать 30-60 минут после перезагрузки сервера
2. Проверить лимиты пользователя: `ulimit -a`
3. Проверить использование ресурсов: `top` или `htop`
4. Связаться с поддержкой Timeweb, если проблема не решится

### Проблема 2: Prisma migrate зависает

**Команда:** `npx prisma migrate deploy`

**Поведение:** Подключается к базе данных, но затем зависает без вывода.

**Возможные причины:**
- База данных заблокирована
- Недостаточно прав у пользователя MySQL
- Проблемы с подключением через socket
- Таймаут подключения

**Что попробовать:**
1. Проверить подключение к MySQL напрямую:
   ```bash
   mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst -e "SELECT 1;"
   ```

2. Проверить права пользователя:
   ```bash
   mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye -e "SHOW GRANTS;"
   ```

3. Попробовать альтернативный подход - применить миграции вручную:
   ```bash
   cd ~/staging/prisma/migrations
   # Выполнить SQL-файлы миграций вручную через mysql
   ```

---

## 📋 Следующие шаги для Antigravity

### Шаг 1: Проверить состояние сервера

```bash
# Подключиться к серверу
ssh cu797814@vh434.timeweb.ru

# Проверить загрузку системы
uptime
top

# Проверить лимиты
ulimit -a

# Проверить зависшие процессы
ps aux | grep -E '(prisma|node)' | grep -v grep
```

### Шаг 2: Проверить подключение к MySQL

```bash
cd ~/staging

# Проверить подключение
mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst -e "SELECT 1 as test;"

# Проверить существующие таблицы
mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst -e "SHOW TABLES;"
```

### Шаг 3: Применить миграции

**Вариант A: Через Prisma (если сервер восстановился)**

```bash
cd ~/staging
source ~/.bash_profile
npx prisma migrate deploy
```

**Вариант B: Вручную (если Prisma зависает)**

```bash
cd ~/staging/prisma/migrations

# Найти все миграции
ls -la

# Применить каждую миграцию вручную
for dir in */; do
  echo "Applying migration: $dir"
  mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst < "$dir/migration.sql"
done
```

### Шаг 4: Заполнить справочник упражнений

```bash
cd ~/staging
source ~/.bash_profile
npx prisma db seed
```

### Шаг 5: Собрать проект

```bash
cd ~/staging
source ~/.bash_profile
npm run build
```

### Шаг 6: Установить и настроить PM2

```bash
# Установить PM2 глобально
npm install -g pm2

# Запустить приложение
pm2 start npm --name "workout-tracker-staging" -- start -- -p 3001

# Проверить статус
pm2 status

# Посмотреть логи
pm2 logs workout-tracker-staging

# Сохранить конфигурацию
pm2 save

# Настроить автозапуск
pm2 startup
# Выполнить команду, которую выдаст PM2
```

### Шаг 7: Настроить домен в панели Timeweb

1. Зайти в панель управления Timeweb
2. Перейти в раздел "Домены"
3. Найти домен `crossfitapp.ru`
4. Добавить поддомен `test`
5. Настроить проксирование:
   - Тип: HTTP
   - Порт: 3001
   - Путь: /
6. Включить SSL (Let's Encrypt)
7. Сохранить изменения
8. Подождать 5-10 минут для применения DNS

### Шаг 8: Проверить работу

```bash
# На сервере проверить, что приложение запущено
pm2 status

# Проверить логи
pm2 logs workout-tracker-staging --lines 50

# В браузере открыть
https://test.crossfitapp.ru
```

---

## 🛠 Полезные команды

### SSH-подключение

```bash
# С локальной машины (Windows PowerShell)
ssh -i "$env:USERPROFILE\.ssh\timeweb_rsa" cu797814@vh434.timeweb.ru

# Выполнить команду удаленно
ssh -i "$env:USERPROFILE\.ssh\timeweb_rsa" cu797814@vh434.timeweb.ru "команда"
```

### Управление процессами

```bash
# Найти процессы
ps aux | grep prisma
ps aux | grep node

# Убить процесс
kill -9 PID

# Убить все процессы prisma
pkill -9 -f prisma

# Убить все процессы node
pkill -9 -f node
```

### PM2

```bash
# Список процессов
pm2 list

# Логи
pm2 logs workout-tracker-staging

# Перезапуск
pm2 restart workout-tracker-staging

# Остановка
pm2 stop workout-tracker-staging

# Удаление
pm2 delete workout-tracker-staging

# Очистка логов
pm2 flush
```

### MySQL

```bash
# Подключение
mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst

# Выполнить запрос
mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst -e "SQL_QUERY"

# Показать таблицы
mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst -e "SHOW TABLES;"

# Экспорт базы
mysqldump --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst > backup.sql

# Импорт базы
mysql --socket=/var/run/mysqld/mysqld.sock -u cu797814_crosst -pBrKT3BD12cye cu797814_crosst < backup.sql
```

---

## 📁 Созданные файлы

### setup-timeweb.sh (локально)

Автоматический скрипт для настройки. Находится в корне проекта.

**Содержимое:**
```bash
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
```

**Как использовать:**
1. Загрузить на сервер через SCP (когда заработает) или скопировать содержимое вручную
2. Сделать исполняемым: `chmod +x setup.sh`
3. Запустить: `./setup.sh`

---

## 🔐 Учетные данные

**SSH:**
- Хост: vh434.timeweb.ru
- Пользователь: cu797814
- Ключ: `~/.ssh/timeweb_rsa` (на локальной машине)

**MySQL:**
- Хост: localhost (через socket)
- Socket: /var/run/mysqld/mysqld.sock
- База данных: cu797814_crosst
- Пользователь: cu797814_crosst
- Пароль: BrKT3BD12cye

**SMTP (Timeweb):**
- Хост: smtp.timeweb.ru
- Порт: 465
- Пользователь: noreply@crossfitapp.ru
- Пароль: e236925zuS

**Домен:**
- Staging: test.crossfitapp.ru
- Порт приложения: 3001

---

## 📝 Примечания

1. **SSH-ключ важен!** Без него придется каждый раз вводить пароль. Ключ находится в `~/.ssh/timeweb_rsa` на локальной машине.

2. **Сервер нестабилен.** После перезагрузки Timeweb сервер работает нестабильно. Рекомендуется подождать или связаться с поддержкой.

3. **Prisma миграции.** Если `prisma migrate deploy` зависает, можно применить миграции вручную через MySQL.

4. **PM2 автозапуск.** После настройки PM2 startup нужно выполнить команду, которую выдаст PM2 (она будет содержать sudo).

5. **Домен.** Настройка домена делается через панель управления Timeweb, не через SSH.

6. **Логи.** Всегда проверяй логи PM2 после запуска: `pm2 logs workout-tracker-staging`

---

## 🆘 Если что-то пошло не так

### Сервер не отвечает
- Подождать 30-60 минут
- Перезагрузить сервер через панель Timeweb
- Написать в поддержку Timeweb

### Prisma зависает
- Убить процессы: `pkill -9 -f prisma`
- Применить миграции вручную через MySQL
- Проверить права пользователя MySQL

### PM2 не запускается
- Проверить, что Node.js в PATH: `which node`
- Переустановить PM2: `npm uninstall -g pm2 && npm install -g pm2`
- Проверить логи: `pm2 logs`

### Приложение не открывается
- Проверить статус PM2: `pm2 status`
- Проверить логи: `pm2 logs workout-tracker-staging`
- Проверить, что порт 3001 слушается: `netstat -tulpn | grep 3001`
- Проверить настройки домена в панели Timeweb

---

**Удачи, Antigravity! 🚀**

Если возникнут вопросы - вся информация здесь. Сервер Timeweb сейчас нестабилен, так что будь готов к тому, что команды могут зависать или падать. Главное - не запускать несколько `prisma migrate` одновременно, иначе снова будут зависшие процессы.
