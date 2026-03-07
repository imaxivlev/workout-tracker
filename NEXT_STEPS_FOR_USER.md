# Следующие шаги для настройки Staging окружения

## Что уже готово ✅

1. ✅ Созданы скрипты для деплоя:
   - `scripts/deploy-staging.sh` - деплой staging
   - `scripts/deploy-production.sh` - деплой production
   - `scripts/update-staging.sh` - быстрое обновление staging

2. ✅ Созданы шаблоны конфигурации:
   - `.env.staging.example` - пример переменных окружения для staging
   - `.env.production.example` - пример переменных окружения для production
   - `ecosystem.config.js` - конфигурация PM2

3. ✅ Создана документация:
   - `TIMEWEB_STAGING_SETUP.md` - подробная инструкция по настройке staging
   - `STAGING_CHECKLIST.md` - чеклист для проверки настройки
   - `TIMEWEB_DEPLOYMENT_GUIDE.md` - общая информация о деплое

## Что нужно сделать сейчас 🚀

### Шаг 1: Подключиться к серверу Timeweb

```bash
ssh cu797814@vh434.timeweb.ru
# Пароль: s4bZ@y6zUsVj
```

### Шаг 2: Установить Node.js 18 LTS

Следуйте инструкциям из `TIMEWEB_STAGING_SETUP.md`, раздел "Шаг 2".

### Шаг 3: Клонировать репозиторий

```bash
git clone https://github.com/imaxivlev/workout-tracker.git ~/staging
cd ~/staging
```

### Шаг 4: Создать файл .env.staging

```bash
nano .env.staging
```

Скопируйте содержимое из `.env.staging.example` и вставьте в файл.

**Важно:** Замените `JWT_SECRET` на новый случайный ключ:

```bash
# Сгенерировать новый JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Шаг 5: Выполнить деплой

```bash
# Сделать скрипт исполняемым
chmod +x scripts/deploy-staging.sh

# Запустить деплой
bash scripts/deploy-staging.sh
```

Скрипт автоматически:
- Установит зависимости
- Сгенерирует Prisma Client
- Соберет проект
- Применит миграции БД
- Заполнит справочник упражнений

### Шаг 6: Запустить приложение через PM2

```bash
# Установить PM2 (если еще не установлен)
npm install -g pm2

# Запустить приложение на порту 3001
pm2 start npm --name "workout-tracker-staging" -- start -- -p 3001

# Сохранить конфигурацию
pm2 save

# Настроить автозапуск
pm2 startup
# Выполните команду, которую выведет PM2
```

### Шаг 7: Настроить домен test.crossfitapp.ru

1. Зайдите в панель управления Timeweb
2. Перейдите в раздел "Домены"
3. Добавьте поддомен `test.crossfitapp.ru`
4. Настройте проксирование на порт 3001
5. Включите SSL сертификат (Let's Encrypt)

### Шаг 8: Проверить работу

Откройте в браузере: https://test.crossfitapp.ru

Используйте `STAGING_CHECKLIST.md` для проверки всех функций.

## Полезные команды

```bash
# Посмотреть статус приложения
pm2 status

# Посмотреть логи
pm2 logs workout-tracker-staging

# Перезапустить приложение
pm2 restart workout-tracker-staging

# Обновить staging (после git push)
cd ~/staging
bash scripts/update-staging.sh
```

## Если возникли проблемы

1. **Приложение не запускается:**
   ```bash
   pm2 logs workout-tracker-staging --lines 100
   ```

2. **Ошибки подключения к БД:**
   - Проверьте DATABASE_URL в .env.staging
   - Проверьте, что БД создана в панели Timeweb

3. **Ошибки миграций:**
   ```bash
   npx prisma migrate status
   npx prisma migrate deploy
   ```

4. **Нужна помощь:**
   - Смотрите `TIMEWEB_STAGING_SETUP.md` (раздел "Решение проблем")
   - Проверьте логи PM2
   - Проверьте логи MySQL в панели Timeweb

## После успешной настройки staging

Когда staging работает стабильно:

1. ✅ Протестируйте все функции (используйте `STAGING_CHECKLIST.md`)
2. ✅ Проверьте отправку email
3. ✅ Проверьте PWA функциональность
4. ✅ Проверьте оффлайн режим

Затем можно переходить к задачам 17-19:
- Задача 17: Интеграция фронтенда с API
- Задача 18: Тестирование и оптимизация
- Задача 19: Финальный checkpoint и документация

---

**Удачи с настройкой! 🚀**
