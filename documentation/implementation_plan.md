# План реализации: CrossFit Workout Tracker (MVP)

Я разработал план создания Minimum Viable Product (MVP) на основе утвержденных требований.

## Цель MVP
Создать рабочее веб-приложение (PWA), где Владельцы клубов могут создавать клубы и тренировки (Skill + WOD), а Атлеты могут записывать свои результаты и видеть лидерборд.

## Стек технологий
*   **Framework:** Next.js 14+ (App Router).
*   **Language:** TypeScript.
*   **Styling:** Tailwind CSS + `shadcn/ui` (для качественных компонентов) + `framer-motion` (для анимаций).
*   **Database:** PostgreSQL (локально через Docker или облако).
*   **ORM:** Prisma.
*   **Auth:** NextAuth.js (Auth.js) v5.

## Требуется проверка пользователем
> [!IMPORTANT]
> **Модель данных "Тренировка":** Я предлагаю объединить WOD и Skill в одну сущность `WorkoutSession` с массивом блоков `WorkoutBlock`. Это даст гибкость (например, 2 Skill + 1 WOD в одной тренировке).

## Детальный план (Proposed Changes)

### Фаза 1: Фундамент (Foundation)
Настройка базовой архитектуры проекта.
#### [NEW] [setup](file:///D:/Program%20Files/.gemini/antigravity/playground/crossfit-project)
*   Инициализация Next.js проекта.
*   Настройка Tailwind CSS (цветовая палитра: Graphite/Neon Green/White).
*   Настройка Docker Compose для PostgreSQL.
*   Подключение Prisma ORM.

### Фаза 2: База данных и API (Backend Core)
Реализация схемы данных.
#### [NEW] [schema.prisma](file:///D:/Program%20Files/.gemini/antigravity/playground/crossfit-project/prisma/schema.prisma)
*   `User`: Роли (ADMIN, OWNER, ATHLETE), Профиль.
*   `Club`: Название, Владелец, Члены.
*   `Workout`: Дата, Описание, Блоки (JSON или связанные таблицы).
*   `Result`: Связь User -> WorkoutBlock, Значение (вес/время/повторы).

### Фаза 3: Ключевые интерфейсы (Frontend)
Реализация экранов для пользователей.
#### [NEW] [Dashboard](file:///D:/Program%20Files/.gemini/antigravity/playground/crossfit-project/app)
*   Главная страница: Календарь тренировок, Текущий WOD.
#### [NEW] [Workout Builder](file:///D:/Program%20Files/.gemini/antigravity/playground/crossfit-project/app/manage)
*   Интерфейс создания тренировки (для Owner: Клубная WOD).
*   Интерфейс создания личной тренировки (для Athlete: Personal WOD).
*   Выбор типа блока: Skill или WOD.
#### [NEW] [Result Logger](file:///D:/Program%20Files/.gemini/antigravity/playground/crossfit-project/app/log)
*   Ввод результатов (Вес для Skill, Время/Репы для WOD).
*   Переключатель "За кого вношу" (Я / Атлет X) — *Proxy Logging*.

### Фаза 4: Лидерборд и Профиль
#### [NEW] [Leaderboard](file:///D:/Program%20Files/.gemini/antigravity/playground/crossfit-project/app/leaderboard)
*   Таблица с фильтрами (WOD, Пол, Дата).
*   Расчет очков (базовая логика: сортировка).

## План проверки (Verification Plan)

### Автоматизированные тесты
Будут добавлены unit-тесты для критической логики подсчета очков (Scoring).
`npm run test`

### Ручная проверка (Manual Verification)
1.  **Сценарий "Владелец":**
    *   Создать Клуб.
    *   Создать Тренировку (Присед 5x5 + WOD Fran).
    *   Записать результат за себя.
    *   Записать результат за Атлета "Иван".
2.  **Сценарий "Атлет":**
    *   Зайти в приложение (PWA).
    *   Увидеть тренировку дня.
    *   Записать свой результат.
    *   Увидеть себя в Лидерборде выше/ниже Ивана.
