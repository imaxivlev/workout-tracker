# CLAUDE.md — CrossFit Workout Tracker

## Команды

```bash
npm run dev          # dev-сервер
npm run build        # production build
npm run test         # тесты (Vitest)
npm run test:watch   # тесты в watch-режиме
npm run lint         # ESLint

npx prisma migrate dev   # применить миграции + regenerate client
npx prisma db seed       # сидировать БД
npx prisma studio        # GUI для БД
```

## Стек

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4**, **Prisma 5** + MySQL
- **Auth:** JWT в HTTP-only cookies + bcrypt
- **Валидация:** Zod 4
- **Тесты:** Vitest + fast-check (property-based)
- **Offline:** IndexedDB + Service Worker (PWA)

## Структура

```
app/
  api/           # API Routes (auth, workouts, clubs, exercises, statistics, admin)
  (pages)/       # Next.js страницы
lib/
  services/      # Бизнес-логика: workout, user, club, email, statistics, migration
  auth/          # JWT middleware, rate-limiter (token bucket)
  middleware/    # error-handler, csrf, security-headers, cors
prisma/
  schema.prisma  # Модели БД
  seed.ts        # Сидирование
.kiro/           # Spec-driven development specs
```

## Соглашения

- **Язык:** UI, коммиты, комментарии — на **русском**
- **Бизнес-логика** — только в `lib/services/`, не в API routes
- **Транзакции:** операции с несколькими таблицами — через `prisma.$transaction()`
- **Ошибки:** использовать централизованный error-handler из `lib/middleware/`
- **Rate limiting:** auth-эндпоинты — 20 попыток/15мин; общий API — 100 req/мин
- **Упражнения:** глобальные названия хранятся в `lib/exercise-names.ts` (RU)

## Ключевые модели Prisma

- `User` — auth, верификация email, роль admin
- `Workout` → `SkillBlock` / `WodBlock` — структура тренировки
- `WodExercise` — тип (FOR_TIME/AMRAP/EMOM/TABATA), результат (TIME/REPS/WEIGHT), уровень (RX/SCALED)
- `Club` / `ClubMember` / `ClubInvite` — роли OWNER/COACH/ATHLETE
- `ExerciseDict` — глобальные + пользовательские упражнения
- `UserConsent` — GDPR (cookies, privacy, terms)
