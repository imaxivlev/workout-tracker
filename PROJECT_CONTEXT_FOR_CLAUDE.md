# 📋 ПОЛНЫЙ КОНТЕКСТ ПРОЕКТА: CROSSFIT WORKOUT TRACKER

## 🎯 О проекте

Это веб-приложение для отслеживания CrossFit тренировок. Проект находится в активной разработке и использует **spec-driven development** подход с двумя AI-агентами (Kiro и Antigravity), работающими по очереди.

**Репозиторий:** https://github.com/imaxivlev/workout-tracker.git

---

## 🛠 Технологический стек

- **Frontend:** Next.js 16.1.6 (App Router), React 19.2.3, TypeScript 5, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **База данных:** PostgreSQL + Prisma ORM 5.22.0
- **Аутентификация:** JWT (jsonwebtoken 9.0.3) + bcrypt 6.0.0
- **Валидация:** Zod 4.3.6
- **Тестирование:** (планируется property-based testing)

---

## 🚀 Запуск проекта

### ⚠️ ВАЖНО: Особенности Windows

Из-за политики выполнения PowerShell, прямые команды `npm` и `npx` не работают. Всегда используй обертку:

```cmd
cmd.exe /c "npm run dev"
```

### Доступные команды:

```cmd
# Запуск dev-сервера
cmd.exe /c "npm run dev"

# Сборка проекта
cmd.exe /c "npm run build"

# Production сервер
cmd.exe /c "npm start"

# Prisma команды
cmd.exe /c "npx prisma generate"
cmd.exe /c "npx prisma migrate dev"
cmd.exe /c "npm run prisma:seed"
```

### URL приложения:
- Основной: http://localhost:3000
- Workout tracker: http://localhost:3000/workout-tracker/index.html


---

## 📁 Структура проекта

```
workout-tracker/
├── app/                          # Next.js App Router
│   ├── workout-tracker/          # Основные страницы приложения
│   ├── page.tsx                  # Главная страница
│   └── layout.tsx                # Корневой layout
│
├── lib/                          # Библиотеки и утилиты
│   ├── auth/                     # Аутентификация
│   │   ├── middleware.ts         # Auth middleware (JWT валидация)
│   │   ├── rate-limiter.ts       # Rate limiter (token bucket)
│   │   ├── rate-limit-middleware.ts
│   │   └── __tests__/            # Тесты
│   └── services/                 # Бизнес-логика
│       └── user.service.ts       # User service
│
├── prisma/                       # Prisma ORM
│   ├── schema.prisma             # Схема БД (User, Workout, Exercise и т.д.)
│   ├── seed.ts                   # Seed данные
│   └── README.md                 # Документация по БД
│
├── public/                       # Статические файлы
│   └── workout-tracker/          # Ресурсы приложения
│
├── mockups/                      # HTML прототипы
│   ├── mvp-index.html            # MVP версия UI
│   ├── mvp-script.js             # Логика MVP
│   └── mvp-styles.css            # Стили MVP
│
├── documentation/                # Документация проекта
│   ├── mvp_scope.md              # Scope MVP
│   ├── requirements_analysis.md  # Анализ требований
│   ├── implementation_plan.md    # План реализации
│   └── market_research.md        # Исследование рынка
│
└── .kiro/                        # Spec-driven development
    ├── specs/                    # Спецификации
    │   ├── backend-api-database/ # Backend API и БД
    │   ├── backend-database-deployment/
    │   ├── crossfit-workout-tracker/
    │   └── workout-tracker-ui-fixes-3/ # Текущая активная спека
    └── steering/                 # Правила для AI агентов
```


---

## 🗄 Схема базы данных

### Основные модели:

**User** (пользователи)
- id (UUID), email (unique), passwordHash
- firstName, lastName, avatar
- verified (boolean), createdAt, updatedAt
- Связи: workouts[], exercises[]

**Workout** (тренировки)
- id (UUID), userId, date (YYYY-MM-DD)
- comment, createdAt, updatedAt
- Связи: skillBlocks[], wodBlocks[]

**SkillBlock** (блоки отработки техники)
- id (UUID), workoutId, exerciseDictId
- Связи: sets[] (SkillSet)

**SkillSet** (подходы в Skill блоке)
- id (UUID), skillBlockId, setNumber
- reps (int), weight (decimal)

**WodBlock** (блоки WOD тренировок)
- id (UUID), workoutId
- wodType (FOR_TIME, AMRAP, EMOM, TABATA)
- level (RX, SCALED)
- resultType (TIME, REPS, WEIGHT)
- resultDisplay, resultSeconds, resultTotalReps
- Связи: exercises[] (WodExercise)

**WodExercise** (упражнения в WOD блоке)
- id (UUID), wodBlockId, exerciseDictId
- reps, weight, orderIndex

**ExerciseDict** (справочник упражнений)
- id (UUID), name, isGlobal
- userId (для пользовательских упражнений)

### Полная схема доступна в файле: `prisma/schema.prisma`


---

## 📊 Текущее состояние проекта

### ✅ Что реализовано:

1. **Backend инфраструктура:**
   - ✅ Prisma схема с полной моделью данных
   - ✅ Rate limiting система (token bucket algorithm)
     - 5 попыток за 15 минут для auth endpoints
     - 100 запросов за минуту для API endpoints
     - 1 запрос за 5 минут для migration endpoint
   - ✅ Auth middleware (JWT валидация из HTTP-only cookies)
   - ✅ User service (регистрация, логин, хеширование паролей)
   - ✅ Тесты для rate limiter

2. **Frontend:**
   - ✅ Базовая структура Next.js приложения
   - ✅ MVP прототипы в `/mockups`
   - 🔄 Responsive дизайн (в процессе доработки)

3. **Документация:**
   - ✅ Полный анализ требований
   - ✅ План реализации
   - ✅ Scope MVP
   - ✅ Исследование рынка


### 🔄 В процессе:

**Активная спека: workout-tracker-ui-fixes-3**

Три основных улучшения UI:

1. **Уведомление об удалении упражнения**
   - Показывать "Нельзя удалить единственное упражнение" при попытке удалить последнее
   - Визуальное облако с полупрозрачным фоном
   - Автоскрытие через 5 секунд или при скролле/клике

2. **Плейсхолдеры для ввода результата WOD**
   - "420" для типа "Количество повторений"
   - "04:20" для типа "Время" с автоформатированием ММ:СС

3. **Фильтр календаря "За все время"**
   - Новый пресет в календаре
   - Диапазон от первой тренировки до сегодня
   - Последний элемент в списке пресетов

**Спека: backend-api-database**

Большой план миграции от MVP (localStorage) к полноценному backend:

**Выполнено:**
- ✅ Задача 1: Настройка проекта и БД (Prisma схема, миграции, seed)
- ✅ Задача 2.1: User Service (хеширование, JWT, регистрация, логин)
- ✅ Задача 2.3: Auth middleware (JWT валидация)
- ✅ Задача 2.5: Rate limiter

**В процессе (задачи 3.x - queued):**
- 🔄 Задача 3.1-3.6: Auth API Routes (register, login, logout, verify, reset-password)

**Следующие задачи:**
- ⏳ Задача 4: Workout Service (CRUD операций с тренировками)
- ⏳ Задача 5: Валидация данных (Zod схемы)
- ⏳ Задача 6: Workout API Routes
- ⏳ Задача 7: Statistics Service (1RM, тоннаж, стрик, PR)
- ⏳ Задача 10: Migration Service (миграция из localStorage)
- ⏳ Задача 13: PWA функциональность (Service Worker, IndexedDB, offline)
- ⏳ Задача 14: Безопасность (CSRF, CORS, security headers)
- ⏳ Задача 17: Интеграция фронтенда с API

**Отложено (требуют участия пользователя):**
- ⏸ Задача 4 (из старой нумерации): Email Service (требуется SMTP настройка)
- ⏸ Задача 16: Деплой на Vercel (требуется регистрация, домен, PostgreSQL на Supabase/Neon)

**Полный план задач доступен в файле:** `.kiro/specs/backend-api-database/tasks.md`


---

## 🎯 Философия MVP

**Цель:** Создать работающее приложение для личного использования одним атлетом.

**Принцип:** Минимум функций, максимум качества.

### Что входит в MVP:

1. ✅ Создание тренировок (Skill + WOD блоки)
2. ✅ История тренировок (Dashboard с метриками)
3. ✅ Личная статистика (графики, PR, прогресс)
4. ✅ Профиль пользователя
5. ✅ Аутентификация (регистрация, вход, выход)
6. ✅ PWA функционал (установка на домашний экран)

### Что НЕ входит в MVP (отложено на v2.0+):

- ❌ Клубы и подписки
- ❌ Лидерборды
- ❌ Система достижений
- ❌ Социальные функции
- ❌ Offline-first режим (только базовое кэширование)

**Подробный scope MVP доступен в файле:** `documentation/mvp_scope.md`

---

## 🔐 Безопасность

### Реализовано:

- ✅ JWT токены в HTTP-only cookies (secure, sameSite=lax)
- ✅ Bcrypt хеширование паролей (cost factor 12)
- ✅ Rate limiting (token bucket algorithm)
- ✅ Изоляция данных пользователей (userId проверки)

### Планируется:

- ⏳ CSRF защита для критичных операций
- ⏳ Security headers (X-Content-Type-Options, X-Frame-Options, CSP, HSTS)
- ⏳ CORS и Origin проверка
- ⏳ Валидация всех входных данных с Zod


---

## 🧪 Тестирование

### Подход:

Проект использует **Property-Based Testing (PBT)** для валидации корректности.

### Примеры свойств для тестирования:

- **Свойство 1:** Атомарность транзакций создания тренировки
- **Свойство 2:** Изоляция данных пользователей
- **Свойство 3:** Монотонность 1RM (больше вес/повторений = больше 1RM)
- **Свойство 6:** Валидность JWT токенов
- **Свойство 10:** Безопасность хеширования паролей
- **Свойство 25:** Rate Limiting для auth endpoints

---

## 🔄 Git Workflow

### Важные правила:

1. **Всегда коммитить изменения** перед завершением сессии
2. Проверять `git status` перед началом работы
3. Писать понятные commit messages на русском
4. Push в `main` ветку

### Типичный workflow:

```cmd
# Проверить изменения
git status

# Добавить файлы
git add .

# Закоммитить
git commit -m "Описание изменений"

# Отправить на GitHub
git push origin main
```

---

## 📝 Spec-Driven Development

Проект использует методологию spec-driven development:

1. **Requirements** → Документ требований (User Stories + Acceptance Criteria)
2. **Design** → Технический дизайн (архитектура, API, схемы)
3. **Tasks** → Пошаговый план реализации с чекбоксами
4. **Implementation** → Выполнение задач с обновлением статусов
5. **Testing** → Property-based тесты для валидации корректности

### Активные спеки:

- `.kiro/specs/workout-tracker-ui-fixes-3/` - UI улучшения
- `.kiro/specs/backend-api-database/` - Backend API и БД


---

## 🎨 UI/UX

### Текущие экраны (MVP прототипы):

1. **Главная** - список последних тренировок + кнопка "Создать"
2. **Создание тренировки** - форма Skill/WOD
3. **История** - список всех тренировок с фильтрами
4. **Статистика** - графики и PR
5. **Профиль** - настройки пользователя

### Навигация:

- 🏠 Главная
- ➕ Создать
- 📊 Статистика
- 👤 Профиль

### Дизайн:

- Темная тема (background: #1A1A1A)
- Акцентный цвет: #DC2626 (красный)
- Современный, мотивирующий дизайн
- Адаптивный (мобильные устройства)

**Прототипы доступны в директории:** `mockups/`

---

## 🚧 Что нужно делать дальше

### Приоритет 1 (Критично):

1. **Завершить Auth API Routes** (задачи 3.1-3.6)
   - Endpoints: register, login, logout, verify, reset-password
   - Интеграция с User Service и Rate Limiter

2. **Реализовать Workout Service** (задача 4)
   - CRUD операции с тренировками
   - Резолв упражнений (глобальные + пользовательские)
   - Транзакции для атомарности

3. **Создать Workout API Routes** (задача 6)
   - POST /api/workouts (создание)
   - GET /api/workouts (список с фильтрами)
   - GET /api/workouts/[id] (детали)
   - PATCH /api/workouts/[id] (обновление)
   - DELETE /api/workouts/[id] (удаление)


### Приоритет 2 (Важно):

4. **Statistics Service** (задача 7)
   - Расчет 1RM по формуле Эпли
   - Расчет тоннажа
   - Расчет стрика (дни/недели)
   - Личные рекорды (PR)
   - Dashboard метрики

5. **Интеграция фронтенда** (задача 17)
   - API клиент (fetch wrapper)
   - Замена localStorage на API запросы
   - Страницы аутентификации
   - Защита маршрутов

### Приоритет 3 (Желательно):

6. **PWA функциональность** (задача 13)
   - Service Worker
   - IndexedDB для оффлайн хранилища
   - Фоновая синхронизация

7. **Безопасность** (задача 14)
   - Security headers
   - CSRF защита
   - CORS настройка

### Отложено (требуют пользователя):

- Email Service (SMTP настройка)
- Деплой на Vercel (регистрация, домен, PostgreSQL)

---

## 💡 Полезные команды и заметки

### Prisma:

```cmd
# Генерация Prisma Client
cmd.exe /c "npx prisma generate"

# Создание миграции
cmd.exe /c "npx prisma migrate dev --name migration_name"

# Применение миграций
cmd.exe /c "npx prisma migrate deploy"

# Seed данных
cmd.exe /c "npm run prisma:seed"

# Prisma Studio (GUI для БД)
cmd.exe /c "npx prisma studio"
```

### Переменные окружения (.env):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/workout_tracker"
JWT_SECRET="your-256-bit-secret-key"
```


### Важные файлы для изучения:

- `prisma/schema.prisma` - полная схема БД
- `lib/auth/rate-limiter.ts` - реализация rate limiting
- `lib/auth/middleware.ts` - JWT валидация
- `lib/services/user.service.ts` - User service
- `.kiro/specs/backend-api-database/tasks.md` - полный план backend
- `documentation/mvp_scope.md` - scope MVP

---

## 🤝 Работа с двумя AI агентами

Проект разрабатывается двумя AI агентами по очереди:
- **Kiro** (один из агентов)
- **Antigravity** (второй агент)

### Правила коллаборации:

1. Всегда коммитить изменения перед передачей
2. Проверять `git status` при начале работы
3. Читать последние коммиты для понимания контекста
4. Обновлять документацию при изменениях

---

## 📚 Дополнительные ресурсы

- **GitHub:** https://github.com/imaxivlev/workout-tracker.git
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Zod Docs:** https://zod.dev

---

## 🌐 Языковые требования

### Коммуникация на русском языке:

Вся документация проекта, спецификации, комментарии в коде и коммуникация в чате ДОЛЖНЫ быть на русском языке.

Это включает:
- Requirements documents (requirements.md)
- Design documents (design.md)
- Task lists (tasks.md)
- Комментарии в коде
- Git commit messages
- Ответы в чате
- Весь пользовательский текст

### Исключения:

- Идентификаторы в коде (имена переменных, функций, классов) должны следовать стандартным английским соглашениям для читаемости кода
- Технические термины, которые обычно используются на английском (например, "property-based testing", "EARS patterns"), могут оставаться на английском при необходимости


---

## ✅ Чеклист для начала работы

Перед началом работы убедись:

- [ ] Прочитал весь контекст выше
- [ ] Понял текущее состояние проекта
- [ ] Знаешь, какие задачи в приоритете
- [ ] Проверил `git status` для понимания последних изменений
- [ ] Понял особенности Windows (cmd.exe /c для команд)
- [ ] Знаешь структуру проекта и расположение ключевых файлов
- [ ] Понял философию MVP и что входит/не входит в scope
- [ ] Готов работать в рамках spec-driven development подхода
- [ ] Помнишь, что вся коммуникация должна быть на русском языке

---

## 🎓 Ключевые концепции проекта

### CrossFit тренировки состоят из:

1. **Skill блоки** - отработка техники упражнений
   - Упражнение (например, "Приседания со штангой")
   - Несколько подходов с весом и повторениями
   - Используется для расчета 1RM и тоннажа

2. **WOD блоки** - тренировка дня (Workout of the Day)
   - Тип: FOR_TIME, AMRAP, EMOM, TABATA
   - Уровень: RX (prescribed) или SCALED (облегченный)
   - Список упражнений с повторениями
   - Результат (время или количество повторений)

### Важные метрики:

- **1RM (One Rep Max)** - максимальный вес на 1 повторение (формула Эпли)
- **Тоннаж** - сумма (вес × повторения) за период
- **Стрик** - количество дней/недель подряд с тренировками
- **PR (Personal Record)** - личные рекорды по упражнениям

---

## 🔍 Текущие открытые файлы (для контекста)

Если ты работаешь в VS Code, обрати внимание на эти файлы:

1. `.kiro/specs/backend-api-database/tasks.md` - основной план backend разработки
2. `.kiro/specs/workout-tracker-ui-fixes-3/requirements.md` - требования для UI улучшений
3. `lib/auth/rate-limiter.ts` - реализация rate limiting
4. `lib/auth/middleware.ts` - JWT аутентификация
5. `lib/services/user.service.ts` - сервис пользователей
6. `prisma/schema.prisma` - схема базы данных

---

**Удачи в разработке! 🚀**

**Если возникнут вопросы - изучи файлы в директориях:**
- `documentation/` - для понимания требований и scope
- `.kiro/specs/` - для понимания текущих задач
- `lib/` - для изучения уже реализованного кода
- `prisma/` - для понимания структуры данных
