# План разработки: CrossFit Workout Tracker (MVP)

## Фаза 1: UI/UX Мокапы (1 неделя)

### 1.1 Экран создания тренировки

**Варианты:**
- Выбор типа: Skill / WOD
- Для Skill: название, схема (подходы), вес
- Для WOD: название, тип, параметры (время, повторения, вес, инструмент)

**UI элементы:**
- Кнопки выбора типа
- Форма ввода с автодополнением
- Селект инструментов
- Кастомный ввод схемы (5x10-10-8-8-6)

---

### 1.2 Календарь

**Функционал:**
- Отображение тренировок пользователя на даты
- Статус выполнения (не начато/в процессе/выполнено)
- Фильтрация по типу тренировки (Skill/WOD)
- Клик по дню → детали тренировки

**UI:**
- Месячный календарь
- Цветовые индикаторы статуса
- Всплывающие подсказки

---

### 1.3 История тренировок

**Функционал:**
- Список всех тренировок пользователя
- Фильтрация по типу, дате, упражнению
- Просмотр деталей
- Редактирование результатов

**UI:**
- Список с пагинацией
- Фильтры сверху
- Карточки тренировок

---

### 1.4 Профиль

**Секции:**
- Аватар, имя, пол
- "О себе"
- Контакты (email, telegram, телефон)
- Настройки приватности

---

## Фаза 2: Архитектура и База данных (1-2 недели)

### 2.1 Схема базы данных (PostgreSQL)

#### Таблицы:
- **users** - пользователи системы
  - id, email, password_hash, role (admin/visitor), created_at
- **workouts** - тренировки
  - id, author_id, name, type (skill/wod), created_at
- **skill_sessions** - сессии Skill
  - id, workout_id, exercise_name, sets_json (5x10-10-8-8-6), max_weight, recorded_at
- **wod_sessions** - сессии WOD
  - id, workout_id, wod_type (emom/amrap/fortime/forload/ladder/chipper/tabata), duration_minutes, rounds, reps, weight, equipment, recorded_at
- **user_results** - результаты пользователей
  - id, user_id, skill_session_id/wod_session_id, result_value, result_type (time/weight/reps), is_scaled, recorded_by (user_id), created_at
- **workout_history** - история тренировок пользователя
  - id, user_id, workout_id, result_id, created_at
- **exercise_history** - история упражнений для уведомлений
  - id, user_id, exercise_name, last_workout_id, last_result, last_result_date, last_result_type, created_at, updated_at
- **exercises** - справочник упражнений
  - id, name, category (cardio/weights/bodyweight), subcategory (pullups/pushups/squats)
- **profiles** - профили пользователей
  - id, user_id, name, avatar_url, gender, bio, phone, telegram, privacy_level, created_at, updated_at

#### Индексы:
- user_id в workouts
- user_id в user_results
- user_id + exercise_name в exercise_history (для уникальности)
- exercise_name в exercises (для fuzzy search)

---

### 2.2 Структура Next.js проекта

```
crossfit-tracker/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── workouts/
│   │   │   │   ├── create/
│   │   │   │   └── [id]/
│   │   │   ├── calendar/
│   │   │   ├── history/
│   │   │   ├── profile/
│   │   │   └── stats/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── workouts/
│   │   │   ├── results/
│   │   │   ├── profile/
│   │   │   └── exercises/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── workouts/
│   │   ├── calendar/
│   │   └── profile/
│   ├── lib/
│   │   ├── db/
│   │   ├── auth/
│   │   └── utils/
│   └── types/
├── prisma/
│   └── schema.prisma
├── public/
│   ├── manifest.json
│   └── icons/
├── docker-compose.yml
└── next.config.js
```

---

### 2.3 API Endpoints

#### Auth
- `POST /api/auth/register` - регистрация
- `POST /api/auth/login` - вход
- `POST /api/auth/logout` - выход
- `GET /api/auth/me` - текущий пользователь

#### Workouts
- `GET /api/workouts` - список тренировок пользователя
- `POST /api/workouts` - создание тренировки
- `GET /api/workouts/:id` - детали тренировки
- `PUT /api/workouts/:id` - обновление тренировки
- `DELETE /api/workouts/:id` - удаление тренировки

#### Results
- `GET /api/results` - результаты пользователя
- `POST /api/results` - запись результата
- `PUT /api/results/:id` - редактирование результата
- `DELETE /api/results/:id` - удаление результата

#### Profile
- `GET /api/profile` - профиль текущего пользователя
- `PUT /api/profile` - обновление профиля
- `GET /api/profile/stats` - статистика пользователя

#### Exercises
- `GET /api/exercises` - список упражнений
- `GET /api/exercises/search?q=` - поиск упражнений (нечеткий)
- `GET /api/results/similar?exercise_name=` - похожие тренировки

#### History
- `GET /api/workouts/history` - история тренировок пользователя с фильтрами

---

### 2.4 Система ролей и прав

| Роль | Создание тренировок | Запись результатов | Видимость |
|------|---------------------|-------------------|-----------|
| Admin | Все | Все | Все |
| Visitor | Только личные | Свои | Личные |

---

## Фаза 3: Реализация

### 3.1 База данных

**Задачи:**
- Создать schema.prisma
- Выполнить `npx prisma generate` и `npx prisma migrate dev`
- Создать начальные данные (категории упражнений)

---

### 3.2 Auth система

**Задачи:**
- Настроить NextAuth.js
- Создать provider для PostgreSQL
- Реализовать endpoints /api/auth/*

---

### 3.3 API endpoints

**Приоритет:**
1. Auth (login, register, me)
2. Workouts (CRUD)
3. Results (запись результатов)
4. Profile (CRUD)
5. Exercises (список + поиск)
6. History (фильтрация)

---

### 3.4 UI компоненты

**Приоритет:**
1. Layout (темная тема, навигация, PWA manifest)
2. Auth (login, register)
3. Workouts (создание, список)
4. Calendar
5. History
6. Profile
7. Stats

---

## Фаза 4: PWA и Polish (1 неделя)

### 4.1 PWA

- manifest.json
- Service worker (кэширование статики)
- Standalone mode (без интерфейса браузера)
- Уведомление при отсутствии интернета

**Примечание:** Полноценный Offline-first режим (создание тренировок без сети + авто-синхронизация) вынесен в отдельный фича-реквест после MVP.

### 4.2 Оптимизация

- Кэширование результатов
- Пагинация для больших списков
- Оптимизация запросов к БД

### 4.3 Тестирование

- Unit тесты для API
- Integration тесты для ключевых сценариев
- E2E тесты (Playwright/Cypress)

---

## Примечания

- Все задачи должны быть выполнены в порядке следования
- После каждой фазы можно остановиться и проверить результат
- Мокапы должны быть утверждены перед началом реализации архитектуры
- MVP фокус на простоту и скорость релиза
- Клубная система и лидерборды вынесены после MVP