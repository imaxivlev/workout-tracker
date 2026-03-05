# Документ технического дизайна: Backend API и База данных

## Обзор

Данный документ описывает техническую архитектуру перехода CrossFit Tracker от MVP версии (localStorage) к полноценному веб-приложению с серверной частью. Система будет построена на базе Next.js 15 с использованием App Router, API Routes для бэкенда, PostgreSQL в качестве базы данных, Prisma ORM для работы с данными, JWT аутентификации и PWA функциональности для оффлайн режима.

Основные технологические решения:
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (серверные функции)
- **База данных**: PostgreSQL с Prisma ORM
- **Аутентификация**: JWT токены в HTTP-only cookies
- **Оффлайн**: Service Workers + IndexedDB для локального кэша
- **Деплой**: Vercel (фронтенд + API) + Supabase/Neon (PostgreSQL)
- **Email**: SMTP интеграция (Яндекс.Почта или Mail.ru)

## Архитектура системы

### Общая архитектура

```mermaid
graph TB
    subgraph "Client Layer"
        PWA[PWA Client<br/>Next.js + React]
        SW[Service Worker]
        IDB[IndexedDB<br/>Offline Cache]
    end
    
    subgraph "API Layer - Next.js"
        API[API Routes<br/>/api/*]
        AUTH[Auth Middleware<br/>JWT Validation]
        RATE[Rate Limiter]
    end
    
    subgraph "Business Logic"
        WORKOUT[Workout Service]
        STATS[Statistics Service]
        USER[User Service]
        MIGRATION[Migration Service]
    end
    
    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        PG[(PostgreSQL)]
    end
    
    subgraph "External Services"
        SMTP[SMTP Server<br/>Email Delivery]
    end
    
    PWA -->|HTTPS| API
    SW -->|Cache| IDB
    API --> AUTH
    AUTH --> RATE
    RATE --> WORKOUT
    RATE --> STATS
    RATE --> USER
    RATE --> MIGRATION
    WORKOUT --> PRISMA
    STATS --> PRISMA
    USER --> PRISMA
    MIGRATION --> PRISMA
    PRISMA --> PG
    USER --> SMTP
```


### Диаграмма последовательности: Создание тренировки

```mermaid
sequenceDiagram
    participant Client as PWA Client
    participant SW as Service Worker
    participant API as API Routes
    participant Auth as Auth Middleware
    participant Service as Workout Service
    participant Prisma as Prisma ORM
    participant DB as PostgreSQL
    
    Client->>SW: POST /api/workouts (offline?)
    alt Offline Mode
        SW->>IndexedDB: Save to queue
        SW-->>Client: 202 Queued
    else Online Mode
        SW->>API: Forward request
        API->>Auth: Validate JWT
        Auth->>Auth: Extract user_id
        Auth->>API: Authorized
        API->>Service: createWorkout(data, user_id)
        Service->>Prisma: Begin transaction
        Prisma->>DB: INSERT workout
        Prisma->>DB: INSERT skill_blocks
        Prisma->>DB: INSERT skill_sets
        Prisma->>DB: INSERT wod_blocks
        Prisma->>DB: INSERT wod_exercises
        Prisma->>Service: Commit transaction
        Service->>API: Return workout
        API-->>Client: 201 Created
    end
```

### Диаграмма последовательности: Аутентификация

```mermaid
sequenceDiagram
    participant Client as PWA Client
    participant API as /api/auth/*
    participant Service as User Service
    participant DB as PostgreSQL
    participant SMTP as Email Service
    
    Client->>API: POST /api/auth/register
    API->>Service: registerUser(email, password)
    Service->>Service: Hash password (bcrypt)
    Service->>DB: INSERT user
    Service->>Service: Generate verification token
    Service->>SMTP: Send verification email
    Service->>API: Return user (pending)
    API-->>Client: 201 Created
    
    Note over Client,SMTP: User clicks verification link
    
    Client->>API: GET /api/auth/verify?token=xxx
    API->>Service: verifyEmail(token)
    Service->>DB: UPDATE user.verified = true
    Service->>API: Success
    API-->>Client: 200 OK (redirect to login)
    
    Client->>API: POST /api/auth/login
    API->>Service: login(email, password)
    Service->>DB: SELECT user WHERE email
    Service->>Service: Verify password hash
    Service->>Service: Generate JWT token
    Service->>API: Return token
    API->>API: Set HTTP-only cookie
    API-->>Client: 200 OK + Set-Cookie
```


## Компоненты и интерфейсы

### 1. Prisma Schema (Модель данных)

**Назначение**: Определение структуры базы данных PostgreSQL с использованием Prisma ORM

**Схема базы данных**:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid()) @db.Uuid
  email         String    @unique
  passwordHash  String    @map("password_hash")
  firstName     String?   @map("first_name")
  lastName      String?   @map("last_name")
  avatar        String?
  verified      Boolean   @default(false)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  
  workouts      Workout[]
  exercises     ExerciseDict[]
  
  @@map("users")
  @@index([email])
}

model ExerciseDict {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  isGlobal  Boolean  @default(false) @map("is_global")
  userId    String?  @map("user_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  
  user          User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  skillBlocks   SkillBlock[]
  wodExercises  WodExercise[]
  
  @@unique([name, userId])
  @@map("exercises_dict")
  @@index([name])
  @@index([userId])
}

model Workout {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  date      String   // YYYY-MM-DD format
  comment   String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  skillBlocks SkillBlock[]
  wodBlocks   WodBlock[]
  
  @@map("workouts")
  @@index([userId, date])
  @@index([date])
}

model SkillBlock {
  id             String   @id @default(uuid()) @db.Uuid
  workoutId      String   @map("workout_id") @db.Uuid
  exerciseDictId String   @map("exercise_dict_id") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at")
  
  workout      Workout        @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  exercise     ExerciseDict   @relation(fields: [exerciseDictId], references: [id])
  sets         SkillSet[]
  
  @@map("skill_blocks")
  @@index([workoutId])
  @@index([exerciseDictId])
}

model SkillSet {
  id           String  @id @default(uuid()) @db.Uuid
  skillBlockId String  @map("skill_block_id") @db.Uuid
  setNumber    Int     @map("set_number")
  reps         Int
  weight       Decimal @db.Decimal(6, 2) // Max 9999.99 kg
  
  skillBlock SkillBlock @relation(fields: [skillBlockId], references: [id], onDelete: Cascade)
  
  @@map("skill_sets")
  @@index([skillBlockId])
}

enum WodType {
  FOR_TIME
  AMRAP
  EMOM
  TABATA
  
  @@map("wod_type")
}

enum WodLevel {
  RX
  SCALED
  
  @@map("wod_level")
}

enum ResultType {
  TIME
  REPS
  WEIGHT
  
  @@map("result_type")
}

model WodBlock {
  id               String     @id @default(uuid()) @db.Uuid
  workoutId        String     @map("workout_id") @db.Uuid
  wodType          WodType    @map("wod_type")
  level            WodLevel
  timeCapSeconds   Int?       @map("time_cap_seconds")
  isLadder         Boolean    @default(false) @map("is_ladder")
  resultType       ResultType @map("result_type")
  resultDisplay    String     @map("result_display") // "15:30" or "5+12"
  resultSeconds    Int?       @map("result_seconds") // For TIME type
  resultTotalReps  Int?       @map("result_total_reps") // For AMRAP type
  createdAt        DateTime   @default(now()) @map("created_at")
  
  workout   Workout       @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  exercises WodExercise[]
  
  @@map("wod_blocks")
  @@index([workoutId])
}

model WodExercise {
  id             String  @id @default(uuid()) @db.Uuid
  wodBlockId     String  @map("wod_block_id") @db.Uuid
  exerciseDictId String  @map("exercise_dict_id") @db.Uuid
  reps           Int
  weight         Decimal? @db.Decimal(6, 2)
  orderIndex     Int     @map("order_index") // For maintaining exercise order
  
  wodBlock WodBlock     @relation(fields: [wodBlockId], references: [id], onDelete: Cascade)
  exercise ExerciseDict @relation(fields: [exerciseDictId], references: [id])
  
  @@map("wod_exercises")
  @@index([wodBlockId])
  @@index([exerciseDictId])
}
```

**Ключевые решения**:
- UUID v4 для всех первичных ключей (совместимость с оффлайн генерацией)
- Decimal(6,2) для весов (точность до 0.01 кг, максимум 9999.99 кг)
- Дата тренировки в формате строки YYYY-MM-DD (избежание проблем с часовыми поясами)
- Каскадное удаление (onDelete: Cascade) для всех связанных данных
- Индексы на часто используемых полях для оптимизации запросов


### 2. API Routes Structure

**Назначение**: RESTful API endpoints для взаимодействия клиента с сервером

**Структура маршрутов**:

```typescript
// app/api/auth/register/route.ts
interface RegisterRequest {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

interface RegisterResponse {
  user: {
    id: string
    email: string
    verified: boolean
  }
  message: string
}

// app/api/auth/login/route.ts
interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
  message: string
}

// app/api/auth/logout/route.ts
interface LogoutResponse {
  message: string
}

// app/api/workouts/route.ts
interface CreateWorkoutRequest {
  date: string // YYYY-MM-DD
  comment?: string
  skillBlocks?: SkillBlockInput[]
  wodBlocks?: WodBlockInput[]
}

interface SkillBlockInput {
  exerciseName: string // Will be resolved to exerciseDictId
  sets: {
    reps: number
    weight: number // kg
  }[]
}

interface WodBlockInput {
  wodType: 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA'
  level: 'RX' | 'SCALED'
  timeCapSeconds?: number
  isLadder: boolean
  resultDisplay: string
  resultSeconds?: number
  resultTotalReps?: number
  exercises: {
    exerciseName: string
    reps: number
    weight?: number
  }[]
}

interface WorkoutResponse {
  id: string
  date: string
  comment: string | null
  skillBlocks: SkillBlockOutput[]
  wodBlocks: WodBlockOutput[]
  createdAt: string
}

// app/api/workouts/[id]/route.ts
// GET, PATCH, DELETE для конкретной тренировки

// app/api/exercises/route.ts
interface ExerciseSearchRequest {
  query: string
  limit?: number
}

interface ExerciseSearchResponse {
  exercises: {
    id: string
    name: string
    isGlobal: boolean
  }[]
}

// app/api/statistics/dashboard/route.ts
interface DashboardResponse {
  workoutsThisMonth: number
  tonnageThisMonth: number // kg
  currentStreak: {
    days: number
    weeks: number
  }
  recentWorkouts: WorkoutSummary[]
}

// app/api/statistics/exercise/[exerciseId]/route.ts
interface ExerciseStatsResponse {
  exerciseName: string
  personalRecords: {
    maxWeight: number
    maxReps: number
    best1RM: number
  }
  history: {
    date: string
    weight: number
    reps: number
    estimated1RM: number
  }[]
}

// app/api/migration/route.ts
interface MigrationRequest {
  workouts: LocalStorageWorkout[]
}

interface MigrationResponse {
  imported: number
  failed: number
  errors: string[]
}
```


### 3. Authentication Middleware

**Назначение**: Проверка JWT токенов и защита API endpoints

**Интерфейс**:

```typescript
// lib/auth/middleware.ts
interface JWTPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string
    email: string
  }
}

// Middleware function
async function authenticateRequest(
  request: NextRequest
): Promise<{ user: JWTPayload } | { error: string }>

// Rate limiter
interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<boolean>
```

**Ответственности**:
- Извлечение JWT токена из HTTP-only cookie
- Валидация токена (подпись, срок действия)
- Извлечение user_id из payload
- Rate limiting для auth endpoints (5 попыток за 15 минут)
- Возврат 401 Unauthorized при невалидном токене
- Возврат 429 Too Many Requests при превышении лимита

### 4. Workout Service

**Назначение**: Бизнес-логика для работы с тренировками

**Интерфейс**:

```typescript
// lib/services/workout.service.ts
class WorkoutService {
  // Создание тренировки с транзакцией
  async createWorkout(
    userId: string,
    data: CreateWorkoutRequest
  ): Promise<WorkoutResponse>
  
  // Получение списка тренировок с пагинацией
  async getWorkouts(
    userId: string,
    options: {
      page: number
      limit: number
      startDate?: string
      endDate?: string
      exerciseId?: string
    }
  ): Promise<{
    workouts: WorkoutResponse[]
    total: number
    hasMore: boolean
  }>
  
  // Получение одной тренировки
  async getWorkoutById(
    workoutId: string,
    userId: string
  ): Promise<WorkoutResponse | null>
  
  // Обновление тренировки
  async updateWorkout(
    workoutId: string,
    userId: string,
    data: Partial<CreateWorkoutRequest>
  ): Promise<WorkoutResponse>
  
  // Удаление тренировки
  async deleteWorkout(
    workoutId: string,
    userId: string
  ): Promise<void>
  
  // Резолв названий упражнений в ID из справочника
  private async resolveExerciseId(
    exerciseName: string,
    userId: string
  ): Promise<string>
}
```

**Ответственности**:
- Создание тренировок с вложенными блоками в одной транзакции
- Автоматический резолв названий упражнений в exercise_dict_id
- Создание новых пользовательских упражнений при необходимости
- Валидация прав доступа (userId совпадает)
- Пагинация и фильтрация результатов


### 5. Statistics Service

**Назначение**: Расчет статистики, PR и 1RM

**Интерфейс**:

```typescript
// lib/services/statistics.service.ts
class StatisticsService {
  // Dashboard метрики
  async getDashboard(userId: string): Promise<DashboardResponse>
  
  // Статистика по упражнению
  async getExerciseStats(
    userId: string,
    exerciseId: string
  ): Promise<ExerciseStatsResponse>
  
  // Расчет 1RM по формуле Эпли
  calculate1RM(weight: number, reps: number): number
  
  // Расчет тоннажа за период
  async calculateTonnage(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<number>
  
  // Расчет стрика (дни подряд)
  async calculateStreak(userId: string): Promise<{
    days: number
    weeks: number
  }>
  
  // Получение личных рекордов
  async getPersonalRecords(
    userId: string,
    exerciseId: string
  ): Promise<{
    maxWeight: number
    maxReps: number
    best1RM: number
  }>
  
  // История прогресса для графика
  async getProgressHistory(
    userId: string,
    exerciseId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    date: string
    weight: number
    reps: number
    estimated1RM: number
  }[]>
}
```

**Ответственности**:
- Расчет 1RM по формуле Эпли: `1RM = weight × (1 + reps / 30)`
- Агрегация тоннажа: `Σ(weight × reps)` для всех skill_sets
- Расчет стрика по дням (последовательные дни с тренировками)
- Расчет стрика по неделям (недели с хотя бы 1 тренировкой)
- Поиск максимальных значений для PR
- Подготовка данных для Chart.js графиков

### 6. User Service

**Назначение**: Управление пользователями и аутентификация

**Интерфейс**:

```typescript
// lib/services/user.service.ts
class UserService {
  // Регистрация нового пользователя
  async register(data: {
    email: string
    password: string
    firstName?: string
    lastName?: string
  }): Promise<{
    user: User
    verificationToken: string
  }>
  
  // Вход в систему
  async login(
    email: string,
    password: string
  ): Promise<{
    user: User
    token: string
  }>
  
  // Подтверждение email
  async verifyEmail(token: string): Promise<boolean>
  
  // Сброс пароля (генерация токена)
  async requestPasswordReset(email: string): Promise<string>
  
  // Установка нового пароля
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<boolean>
  
  // Обновление профиля
  async updateProfile(
    userId: string,
    data: {
      firstName?: string
      lastName?: string
      avatar?: string
    }
  ): Promise<User>
  
  // Удаление аккаунта
  async deleteAccount(userId: string): Promise<void>
  
  // Генерация JWT токена
  generateJWT(userId: string, email: string): string
  
  // Хеширование пароля
  private async hashPassword(password: string): Promise<string>
  
  // Проверка пароля
  private async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean>
}
```

**Ответственности**:
- Хеширование паролей с использованием bcrypt (cost factor 12)
- Генерация JWT токенов (срок действия 7 дней)
- Генерация одноразовых токенов для верификации email и сброса пароля
- Валидация email формата
- Каскадное удаление всех данных пользователя при удалении аккаунта


### 7. Migration Service

**Назначение**: Миграция данных из localStorage в PostgreSQL

**Интерфейс**:

```typescript
// lib/services/migration.service.ts
interface LocalStorageWorkout {
  id?: string
  date: string
  comment?: string
  skillBlocks?: {
    exercise: string // Raw text name
    sets: { reps: number; weight: number }[]
  }[]
  wodBlocks?: {
    type: string
    level: string
    result: string
    exercises: {
      name: string
      reps: number
      weight?: number
    }[]
  }[]
}

class MigrationService {
  // Миграция всех тренировок из localStorage
  async migrateWorkouts(
    userId: string,
    workouts: LocalStorageWorkout[]
  ): Promise<{
    imported: number
    failed: number
    errors: string[]
  }>
  
  // Миграция одной тренировки
  private async migrateWorkout(
    userId: string,
    workout: LocalStorageWorkout
  ): Promise<void>
  
  // Нормализация названия упражнения
  private normalizeExerciseName(name: string): string
  
  // Поиск или создание упражнения в справочнике
  private async findOrCreateExercise(
    name: string,
    userId: string
  ): Promise<string>
}
```

**Ответственности**:
- Парсинг данных из localStorage формата
- Нормализация названий упражнений (trim, lowercase для поиска)
- Автоматический поиск соответствий в глобальном справочнике
- Создание пользовательских упражнений для уникальных названий
- Обработка ошибок и возврат детального отчета
- Сохранение оригинальных дат тренировок

### 8. Email Service

**Назначение**: Отправка транзакционных писем

**Интерфейс**:

```typescript
// lib/services/email.service.ts
interface EmailTemplate {
  subject: string
  html: string
  text: string
}

class EmailService {
  // Отправка письма с подтверждением email
  async sendVerificationEmail(
    to: string,
    verificationToken: string
  ): Promise<void>
  
  // Отправка письма для сброса пароля
  async sendPasswordResetEmail(
    to: string,
    resetToken: string
  ): Promise<void>
  
  // Базовая отправка через SMTP
  private async sendEmail(
    to: string,
    template: EmailTemplate
  ): Promise<void>
  
  // Генерация HTML из шаблона
  private renderTemplate(
    templateName: string,
    data: Record<string, any>
  ): EmailTemplate
}
```

**Ответственности**:
- SMTP интеграция (Яндекс.Почта или Mail.ru)
- HTML шаблоны писем с брендингом приложения
- Обработка ошибок отправки (логирование, retry)
- Генерация ссылок с токенами (срок действия 1 час)
- Fallback на текстовую версию письма


## Модели данных

### User (Пользователь)

```typescript
interface User {
  id: string // UUID v4
  email: string // Уникальный, валидация формата
  passwordHash: string // bcrypt hash
  firstName: string | null
  lastName: string | null
  avatar: string | null // URL или base64
  verified: boolean // Email подтвержден
  createdAt: Date
  updatedAt: Date
}
```

**Правила валидации**:
- Email: RFC 5322 формат, уникальный
- Password: минимум 8 символов, хотя бы 1 цифра, 1 буква
- firstName/lastName: опциональные, максимум 50 символов
- Avatar: опциональный, максимум 2MB

### ExerciseDict (Справочник упражнений)

```typescript
interface ExerciseDict {
  id: string // UUID v4
  name: string // Название упражнения
  isGlobal: boolean // true для предустановленных
  userId: string | null // null для глобальных
  createdAt: Date
}
```

**Предустановленные упражнения** (isGlobal = true):
- Snatch (Рывок)
- Clean & Jerk (Толчок)
- Back Squat (Приседания со штангой на спине)
- Front Squat (Приседания со штангой на груди)
- Deadlift (Становая тяга)
- Bench Press (Жим лежа)
- Overhead Press (Жим стоя)
- Pull-ups (Подтягивания)
- Push-ups (Отжимания)
- Burpees (Бёрпи)
- Box Jumps (Запрыгивания на бокс)
- Kettlebell Swing (Махи гирей)
- Thruster (Трастер)
- Wall Balls (Броски мяча в стену)
- Rope Climbs (Лазание по канату)

### Workout (Тренировка)

```typescript
interface Workout {
  id: string // UUID v4
  userId: string // Владелец тренировки
  date: string // YYYY-MM-DD формат
  comment: string | null // Опциональный комментарий
  createdAt: Date
  updatedAt: Date
  
  // Связи
  skillBlocks: SkillBlock[]
  wodBlocks: WodBlock[]
}
```

**Правила валидации**:
- Date: формат YYYY-MM-DD, не может быть в будущем
- Comment: опциональный, максимум 500 символов
- Минимум 1 блок (skill или wod) должен присутствовать

### SkillBlock (Силовой блок)

```typescript
interface SkillBlock {
  id: string // UUID v4
  workoutId: string
  exerciseDictId: string // Ссылка на справочник
  createdAt: Date
  
  // Связи
  exercise: ExerciseDict
  sets: SkillSet[]
}
```

### SkillSet (Подход в силовом блоке)

```typescript
interface SkillSet {
  id: string // UUID v4
  skillBlockId: string
  setNumber: number // Порядковый номер подхода (1, 2, 3...)
  reps: number // Количество повторений
  weight: number // Вес в кг (Decimal 6,2)
}
```

**Правила валидации**:
- setNumber: положительное целое, уникальное в рамках блока
- reps: положительное целое, от 1 до 100
- weight: положительное число, от 0.5 до 9999.99 кг, шаг 0.5


### WodBlock (Метаболический блок)

```typescript
interface WodBlock {
  id: string // UUID v4
  workoutId: string
  wodType: 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA'
  level: 'RX' | 'SCALED'
  timeCapSeconds: number | null // Лимит времени в секундах
  isLadder: boolean // Лесенка (несколько раундов)
  resultType: 'TIME' | 'REPS' | 'WEIGHT'
  resultDisplay: string // Отображаемый результат "15:30" или "5+12"
  resultSeconds: number | null // Для сортировки TIME результатов
  resultTotalReps: number | null // Для сортировки AMRAP результатов
  createdAt: Date
  
  // Связи
  exercises: WodExercise[]
}
```

**Правила валидации**:
- wodType: один из допустимых типов
- level: RX или SCALED
- timeCapSeconds: опциональный, положительное целое
- resultDisplay: обязательный, максимум 50 символов
- resultSeconds: обязательный для wodType = FOR_TIME
- resultTotalReps: обязательный для wodType = AMRAP

**Примеры результатов**:
- FOR_TIME: resultDisplay = "15:30", resultSeconds = 930
- AMRAP: resultDisplay = "5+12", resultTotalReps = 5 * roundReps + 12
- EMOM: resultDisplay = "Completed", resultSeconds = null
- TABATA: resultDisplay = "8 rounds", resultSeconds = null

### WodExercise (Упражнение в WOD блоке)

```typescript
interface WodExercise {
  id: string // UUID v4
  wodBlockId: string
  exerciseDictId: string // Ссылка на справочник
  reps: number // Количество повторений
  weight: number | null // Вес в кг (опционально)
  orderIndex: number // Порядок упражнений в комплексе
  
  // Связи
  exercise: ExerciseDict
}
```

**Правила валидации**:
- reps: положительное целое, от 1 до 1000
- weight: опциональный, положительное число, от 0.5 до 9999.99 кг
- orderIndex: положительное целое, уникальное в рамках блока

## Алгоритмическая логика

### Алгоритм 1: Создание тренировки с транзакцией

```typescript
ALGORITHM createWorkout(userId, workoutData)
INPUT: userId (UUID), workoutData (CreateWorkoutRequest)
OUTPUT: workout (WorkoutResponse)

PRECONDITIONS:
  - userId существует в базе данных
  - workoutData.date в формате YYYY-MM-DD
  - workoutData.date не в будущем
  - Минимум 1 блок (skill или wod) присутствует

POSTCONDITIONS:
  - Тренировка создана в БД со всеми вложенными блоками
  - Все упражнения резолвлены в exercise_dict_id
  - Транзакция зафиксирована или откачена полностью
  - Возвращен полный объект тренировки

BEGIN
  // Начало транзакции БД
  transaction ← prisma.$transaction()
  
  TRY
    // Шаг 1: Создание основной записи тренировки
    workout ← transaction.workout.create({
      data: {
        id: generateUUID(),
        userId: userId,
        date: workoutData.date,
        comment: workoutData.comment
      }
    })
    
    // Шаг 2: Обработка Skill блоков
    FOR EACH skillBlock IN workoutData.skillBlocks DO
      // Резолв названия упражнения в ID
      exerciseId ← resolveExerciseId(skillBlock.exerciseName, userId)
      
      // Создание skill блока
      createdSkillBlock ← transaction.skillBlock.create({
        data: {
          id: generateUUID(),
          workoutId: workout.id,
          exerciseDictId: exerciseId
        }
      })
      
      // Создание подходов
      setNumber ← 1
      FOR EACH set IN skillBlock.sets DO
        ASSERT set.reps > 0 AND set.weight >= 0.5
        
        transaction.skillSet.create({
          data: {
            id: generateUUID(),
            skillBlockId: createdSkillBlock.id,
            setNumber: setNumber,
            reps: set.reps,
            weight: set.weight
          }
        })
        
        setNumber ← setNumber + 1
      END FOR
    END FOR
    
    // Шаг 3: Обработка WOD блоков
    FOR EACH wodBlock IN workoutData.wodBlocks DO
      // Создание wod блока
      createdWodBlock ← transaction.wodBlock.create({
        data: {
          id: generateUUID(),
          workoutId: workout.id,
          wodType: wodBlock.wodType,
          level: wodBlock.level,
          timeCapSeconds: wodBlock.timeCapSeconds,
          isLadder: wodBlock.isLadder,
          resultType: determineResultType(wodBlock.wodType),
          resultDisplay: wodBlock.resultDisplay,
          resultSeconds: wodBlock.resultSeconds,
          resultTotalReps: wodBlock.resultTotalReps
        }
      })
      
      // Создание упражнений WOD
      orderIndex ← 1
      FOR EACH exercise IN wodBlock.exercises DO
        exerciseId ← resolveExerciseId(exercise.exerciseName, userId)
        
        transaction.wodExercise.create({
          data: {
            id: generateUUID(),
            wodBlockId: createdWodBlock.id,
            exerciseDictId: exerciseId,
            reps: exercise.reps,
            weight: exercise.weight,
            orderIndex: orderIndex
          }
        })
        
        orderIndex ← orderIndex + 1
      END FOR
    END FOR
    
    // Фиксация транзакции
    transaction.commit()
    
    // Загрузка полного объекта с вложенными данными
    fullWorkout ← loadWorkoutWithRelations(workout.id)
    
    RETURN fullWorkout
    
  CATCH error
    // Откат транзакции при любой ошибке
    transaction.rollback()
    THROW error
  END TRY
END
```


### Алгоритм 2: Резолв названия упражнения в ID справочника

```typescript
ALGORITHM resolveExerciseId(exerciseName, userId)
INPUT: exerciseName (string), userId (UUID)
OUTPUT: exerciseId (UUID)

PRECONDITIONS:
  - exerciseName не пустая строка
  - userId существует в базе данных

POSTCONDITIONS:
  - Возвращен ID существующего или созданного упражнения
  - Упражнение доступно для данного пользователя

BEGIN
  // Нормализация названия для поиска
  normalizedName ← exerciseName.trim().toLowerCase()
  
  // Шаг 1: Поиск в глобальном справочнике
  globalExercise ← prisma.exerciseDict.findFirst({
    where: {
      name: { equals: exerciseName, mode: 'insensitive' },
      isGlobal: true
    }
  })
  
  IF globalExercise IS NOT NULL THEN
    RETURN globalExercise.id
  END IF
  
  // Шаг 2: Поиск в пользовательских упражнениях
  userExercise ← prisma.exerciseDict.findFirst({
    where: {
      name: { equals: exerciseName, mode: 'insensitive' },
      userId: userId,
      isGlobal: false
    }
  })
  
  IF userExercise IS NOT NULL THEN
    RETURN userExercise.id
  END IF
  
  // Шаг 3: Создание нового пользовательского упражнения
  newExercise ← prisma.exerciseDict.create({
    data: {
      id: generateUUID(),
      name: exerciseName,
      isGlobal: false,
      userId: userId
    }
  })
  
  RETURN newExercise.id
END
```

### Алгоритм 3: Расчет 1RM (одноповторный максимум)

```typescript
ALGORITHM calculate1RM(weight, reps)
INPUT: weight (number, kg), reps (number)
OUTPUT: estimated1RM (number, kg)

PRECONDITIONS:
  - weight > 0
  - reps > 0
  - reps <= 10 (формула точна только для малого числа повторений)

POSTCONDITIONS:
  - Возвращен расчетный 1RM
  - Результат округлен до 0.5 кг

BEGIN
  // Формула Эпли: 1RM = weight × (1 + reps / 30)
  IF reps = 1 THEN
    RETURN weight
  END IF
  
  raw1RM ← weight × (1 + reps / 30)
  
  // Округление до 0.5 кг
  rounded1RM ← Math.round(raw1RM × 2) / 2
  
  RETURN rounded1RM
END
```

### Алгоритм 4: Расчет стрика (дни подряд)

```typescript
ALGORITHM calculateStreak(userId)
INPUT: userId (UUID)
OUTPUT: streak (object { days: number, weeks: number })

PRECONDITIONS:
  - userId существует в базе данных

POSTCONDITIONS:
  - Возвращен текущий стрик по дням и неделям
  - Стрик = 0 если нет тренировок или последняя тренировка > 1 дня назад

BEGIN
  // Получение всех дат тренировок пользователя (сортировка по убыванию)
  workoutDates ← prisma.workout.findMany({
    where: { userId: userId },
    select: { date: true },
    orderBy: { date: 'desc' }
  })
  
  IF workoutDates.length = 0 THEN
    RETURN { days: 0, weeks: 0 }
  END IF
  
  // Расчет стрика по дням
  today ← getCurrentDate() // YYYY-MM-DD
  yesterday ← getDateMinusDays(today, 1)
  
  lastWorkoutDate ← workoutDates[0].date
  
  // Проверка: последняя тренировка сегодня или вчера
  IF lastWorkoutDate != today AND lastWorkoutDate != yesterday THEN
    RETURN { days: 0, weeks: 0 }
  END IF
  
  // Подсчет последовательных дней
  dayStreak ← 0
  expectedDate ← lastWorkoutDate
  uniqueDates ← new Set(workoutDates.map(w => w.date))
  
  WHILE uniqueDates.has(expectedDate) DO
    dayStreak ← dayStreak + 1
    expectedDate ← getDateMinusDays(expectedDate, 1)
  END WHILE
  
  // Расчет стрика по неделям
  weekStreak ← 0
  currentWeekStart ← getStartOfWeek(today)
  weekDates ← new Set()
  
  FOR EACH workout IN workoutDates DO
    weekStart ← getStartOfWeek(workout.date)
    weekDates.add(weekStart)
  END FOR
  
  sortedWeeks ← Array.from(weekDates).sort().reverse()
  expectedWeek ← currentWeekStart
  
  FOR EACH week IN sortedWeeks DO
    IF week = expectedWeek THEN
      weekStreak ← weekStreak + 1
      expectedWeek ← getWeekMinusOne(expectedWeek)
    ELSE
      BREAK
    END IF
  END FOR
  
  RETURN { days: dayStreak, weeks: weekStreak }
END
```


### Алгоритм 5: Расчет тоннажа за период

```typescript
ALGORITHM calculateTonnage(userId, startDate, endDate)
INPUT: userId (UUID), startDate (string), endDate (string)
OUTPUT: tonnage (number, kg)

PRECONDITIONS:
  - userId существует в базе данных
  - startDate и endDate в формате YYYY-MM-DD
  - startDate <= endDate

POSTCONDITIONS:
  - Возвращен суммарный тоннаж за период
  - Учитываются только Skill блоки
  - Формула: Σ(weight × reps) для всех подходов

BEGIN
  // Получение всех skill_sets за период
  skillSets ← prisma.skillSet.findMany({
    where: {
      skillBlock: {
        workout: {
          userId: userId,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      }
    },
    select: {
      weight: true,
      reps: true
    }
  })
  
  // Расчет суммарного тоннажа
  totalTonnage ← 0
  
  FOR EACH set IN skillSets DO
    setTonnage ← set.weight × set.reps
    totalTonnage ← totalTonnage + setTonnage
  END FOR
  
  RETURN totalTonnage
END
```

### Алгоритм 6: Миграция данных из localStorage

```typescript
ALGORITHM migrateWorkouts(userId, localWorkouts)
INPUT: userId (UUID), localWorkouts (LocalStorageWorkout[])
OUTPUT: result (object { imported: number, failed: number, errors: string[] })

PRECONDITIONS:
  - userId существует в базе данных
  - localWorkouts является массивом

POSTCONDITIONS:
  - Все валидные тренировки импортированы в БД
  - Возвращен отчет о результатах миграции
  - Невалидные тренировки пропущены с записью ошибок

BEGIN
  imported ← 0
  failed ← 0
  errors ← []
  
  FOR EACH localWorkout IN localWorkouts DO
    TRY
      // Валидация базовой структуры
      IF NOT isValidWorkoutStructure(localWorkout) THEN
        failed ← failed + 1
        errors.push("Invalid structure for workout " + localWorkout.id)
        CONTINUE
      END IF
      
      // Создание объекта для API
      workoutData ← {
        date: localWorkout.date,
        comment: localWorkout.comment,
        skillBlocks: [],
        wodBlocks: []
      }
      
      // Обработка skill блоков
      IF localWorkout.skillBlocks EXISTS THEN
        FOR EACH skillBlock IN localWorkout.skillBlocks DO
          // Нормализация названия упражнения
          normalizedName ← normalizeExerciseName(skillBlock.exercise)
          
          workoutData.skillBlocks.push({
            exerciseName: normalizedName,
            sets: skillBlock.sets
          })
        END FOR
      END IF
      
      // Обработка WOD блоков
      IF localWorkout.wodBlocks EXISTS THEN
        FOR EACH wodBlock IN localWorkout.wodBlocks DO
          // Парсинг результата
          parsedResult ← parseWodResult(wodBlock.type, wodBlock.result)
          
          wodExercises ← []
          FOR EACH exercise IN wodBlock.exercises DO
            normalizedName ← normalizeExerciseName(exercise.name)
            wodExercises.push({
              exerciseName: normalizedName,
              reps: exercise.reps,
              weight: exercise.weight
            })
          END FOR
          
          workoutData.wodBlocks.push({
            wodType: mapWodType(wodBlock.type),
            level: mapWodLevel(wodBlock.level),
            resultDisplay: wodBlock.result,
            resultSeconds: parsedResult.seconds,
            resultTotalReps: parsedResult.totalReps,
            exercises: wodExercises
          })
        END FOR
      END IF
      
      // Создание тренировки через основной API
      createWorkout(userId, workoutData)
      
      imported ← imported + 1
      
    CATCH error
      failed ← failed + 1
      errors.push("Failed to import workout " + localWorkout.id + ": " + error.message)
    END TRY
  END FOR
  
  RETURN {
    imported: imported,
    failed: failed,
    errors: errors
  }
END
```


### Алгоритм 7: Синхронизация оффлайн данных

```typescript
ALGORITHM syncOfflineWorkouts()
INPUT: none (выполняется на клиенте)
OUTPUT: syncResult (object { synced: number, failed: number })

PRECONDITIONS:
  - Service Worker зарегистрирован
  - IndexedDB содержит очередь ожидающих тренировок
  - Интернет соединение доступно

POSTCONDITIONS:
  - Все ожидающие тренировки отправлены на сервер
  - Успешно синхронизированные тренировки удалены из очереди
  - Неудачные попытки остаются в очереди для повтора

BEGIN
  // Открытие IndexedDB
  db ← openIndexedDB('workout-tracker')
  
  // Получение всех ожидающих тренировок
  pendingWorkouts ← db.getAll('pending-workouts')
  
  IF pendingWorkouts.length = 0 THEN
    RETURN { synced: 0, failed: 0 }
  END IF
  
  synced ← 0
  failed ← 0
  
  FOR EACH workout IN pendingWorkouts DO
    TRY
      // Отправка на сервер
      response ← fetch('/api/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workout.data)
      })
      
      IF response.ok THEN
        // Успешная синхронизация
        db.delete('pending-workouts', workout.id)
        synced ← synced + 1
        
        // Обновление локального кэша
        serverWorkout ← response.json()
        db.put('workouts', serverWorkout)
      ELSE
        // Ошибка сервера, оставляем в очереди
        failed ← failed + 1
      END IF
      
    CATCH error
      // Сетевая ошибка, оставляем в очереди
      failed ← failed + 1
    END TRY
  END FOR
  
  // Уведомление пользователя
  IF synced > 0 THEN
    showNotification("Синхронизировано тренировок: " + synced)
  END IF
  
  IF failed > 0 THEN
    showNotification("Не удалось синхронизировать: " + failed)
  END IF
  
  RETURN { synced: synced, failed: failed }
END
```

## Ключевые функции с формальными спецификациями

### Функция 1: authenticateRequest()

```typescript
async function authenticateRequest(request: NextRequest): Promise<AuthResult>
```

**Предусловия:**
- request является валидным NextRequest объектом
- request.cookies доступен для чтения

**Постусловия:**
- Возвращает объект с user данными если токен валиден
- Возвращает объект с error если токен невалиден или отсутствует
- Не изменяет состояние базы данных

**Инварианты цикла:** N/A (функция не содержит циклов)

### Функция 2: createWorkout()

```typescript
async function createWorkout(
  userId: string,
  data: CreateWorkoutRequest
): Promise<WorkoutResponse>
```

**Предусловия:**
- userId существует в таблице users
- data.date в формате YYYY-MM-DD и не в будущем
- data содержит минимум 1 блок (skillBlocks или wodBlocks)
- Все веса в data >= 0.5 и <= 9999.99
- Все reps в data >= 1

**Постусловия:**
- Тренировка создана в БД со всеми вложенными блоками
- Все упражнения резолвлены в exercise_dict_id
- Транзакция зафиксирована полностью или откачена полностью
- Возвращен полный объект тренировки с вложенными данными
- workout.userId === userId
- workout.createdAt установлен на текущее время

**Инварианты цикла:**
- При обработке skill блоков: все предыдущие блоки успешно созданы
- При обработке подходов: setNumber увеличивается монотонно (1, 2, 3...)
- При обработке WOD упражнений: orderIndex увеличивается монотонно


### Функция 3: calculate1RM()

```typescript
function calculate1RM(weight: number, reps: number): number
```

**Предусловия:**
- weight > 0
- reps > 0
- reps <= 10 (формула Эпли точна для малого числа повторений)

**Постусловия:**
- Возвращен расчетный 1RM
- Результат округлен до 0.5 кг
- Если reps = 1, то результат = weight
- Результат >= weight (1RM всегда больше или равен рабочему весу)

**Инварианты цикла:** N/A (функция не содержит циклов)

### Функция 4: calculateStreak()

```typescript
async function calculateStreak(userId: string): Promise<StreakResult>
```

**Предусловия:**
- userId существует в таблице users

**Постусловия:**
- Возвращен объект с days и weeks стриками
- days >= 0 и weeks >= 0
- Если нет тренировок, то days = 0 и weeks = 0
- Если последняя тренировка > 1 дня назад, то days = 0
- days стрик учитывает только последовательные дни
- weeks стрик учитывает недели с хотя бы 1 тренировкой

**Инварианты цикла:**
- При подсчете дней: expectedDate уменьшается на 1 день каждую итерацию
- При подсчете недель: expectedWeek уменьшается на 1 неделю каждую итерацию
- Все проверенные даты являются последовательными

### Функция 5: migrateWorkouts()

```typescript
async function migrateWorkouts(
  userId: string,
  workouts: LocalStorageWorkout[]
): Promise<MigrationResult>
```

**Предусловия:**
- userId существует в таблице users
- workouts является массивом (может быть пустым)

**Постусловия:**
- Все валидные тренировки импортированы в БД
- result.imported + result.failed = workouts.length
- result.errors.length = result.failed
- Невалидные тренировки не изменили состояние БД
- Оригинальные даты тренировок сохранены

**Инварианты цикла:**
- imported + failed = количество обработанных тренировок
- errors.length = failed
- Каждая итерация обрабатывает ровно 1 тренировку
- База данных остается в консистентном состоянии после каждой итерации

## Примеры использования

### Пример 1: Создание тренировки с Skill и WOD блоками

```typescript
// Клиентский код
const workoutData = {
  date: '2024-01-15',
  comment: 'Отличная тренировка!',
  skillBlocks: [
    {
      exerciseName: 'Back Squat',
      sets: [
        { reps: 5, weight: 100 },
        { reps: 5, weight: 110 },
        { reps: 5, weight: 120 }
      ]
    }
  ],
  wodBlocks: [
    {
      wodType: 'FOR_TIME',
      level: 'RX',
      timeCapSeconds: 1200,
      isLadder: false,
      resultDisplay: '15:30',
      resultSeconds: 930,
      exercises: [
        { exerciseName: 'Thruster', reps: 21, weight: 42.5 },
        { exerciseName: 'Pull-ups', reps: 21 },
        { exerciseName: 'Thruster', reps: 15, weight: 42.5 },
        { exerciseName: 'Pull-ups', reps: 15 },
        { exerciseName: 'Thruster', reps: 9, weight: 42.5 },
        { exerciseName: 'Pull-ups', reps: 9 }
      ]
    }
  ]
}

const response = await fetch('/api/workouts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(workoutData)
})

const workout = await response.json()
console.log('Создана тренировка:', workout.id)
```

### Пример 2: Получение статистики по упражнению

```typescript
// Получение истории прогресса для графика
const exerciseId = 'uuid-back-squat'
const response = await fetch(`/api/statistics/exercise/${exerciseId}`)
const stats = await response.json()

// Отображение в Chart.js
const chartData = {
  labels: stats.history.map(h => h.date),
  datasets: [{
    label: '1RM (расчетный)',
    data: stats.history.map(h => h.estimated1RM),
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)'
  }]
}

console.log('Личный рекорд:', stats.personalRecords.best1RM, 'кг')
```


### Пример 3: Миграция данных из localStorage

```typescript
// Клиентский код при первом входе
async function migrateLocalData() {
  // Проверка наличия данных в localStorage
  const localWorkouts = localStorage.getItem('workouts')
  
  if (!localWorkouts) {
    return // Нет данных для миграции
  }
  
  const workouts = JSON.parse(localWorkouts)
  
  // Отправка на сервер
  const response = await fetch('/api/migration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workouts })
  })
  
  const result = await response.json()
  
  if (result.imported > 0) {
    console.log(`Импортировано тренировок: ${result.imported}`)
    
    // Очистка localStorage после успешной миграции
    localStorage.removeItem('workouts')
    
    // Уведомление пользователя
    showNotification(`Перенесено ${result.imported} тренировок в облако`)
  }
  
  if (result.failed > 0) {
    console.error('Ошибки миграции:', result.errors)
  }
}
```

### Пример 4: Оффлайн режим с Service Worker

```typescript
// service-worker.ts
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Перехват POST запросов к /api/workouts
  if (url.pathname === '/api/workouts' && event.request.method === 'POST') {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          // Сеть недоступна - сохраняем в IndexedDB
          const data = await event.request.json()
          const db = await openDB('workout-tracker')
          
          await db.add('pending-workouts', {
            id: generateUUID(),
            data: data,
            timestamp: Date.now()
          })
          
          return new Response(
            JSON.stringify({ 
              status: 'queued',
              message: 'Тренировка сохранена локально и будет синхронизирована при подключении к сети'
            }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          )
        })
    )
  }
})

// Фоновая синхронизация при восстановлении сети
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncOfflineWorkouts())
  }
})
```

### Пример 5: Аутентификация с JWT

```typescript
// Серверный код - API Route
// app/api/auth/login/route.ts
export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  
  // Валидация
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email и пароль обязательны' },
      { status: 400 }
    )
  }
  
  // Поиск пользователя
  const user = await prisma.user.findUnique({
    where: { email }
  })
  
  if (!user) {
    return NextResponse.json(
      { error: 'Неверный email или пароль' },
      { status: 401 }
    )
  }
  
  // Проверка пароля
  const isValid = await bcrypt.compare(password, user.passwordHash)
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Неверный email или пароль' },
      { status: 401 }
    )
  }
  
  // Генерация JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )
  
  // Установка HTTP-only cookie
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    },
    message: 'Вход выполнен успешно'
  })
  
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 дней
  })
  
  return response
}
```

## Обработка ошибок

### Сценарий 1: Невалидные данные тренировки

**Условие**: Клиент отправляет тренировку с некорректными данными (вес < 0, дата в будущем)

**Ответ**: 
- HTTP 400 Bad Request
- JSON с детальным описанием ошибок валидации
- Транзакция БД не начинается

**Восстановление**: Клиент исправляет данные и повторяет запрос

### Сценарий 2: Ошибка базы данных при создании тренировки

**Условие**: Сбой PostgreSQL или нарушение constraint во время транзакции

**Ответ**:
- HTTP 500 Internal Server Error
- Транзакция автоматически откатывается
- Логирование полного стек-трейса
- JSON с общим сообщением об ошибке (без деталей БД)

**Восстановление**: Клиент может повторить запрос после задержки

### Сценарий 3: Невалидный или истекший JWT токен

**Условие**: Клиент отправляет запрос с невалидным токеном

**Ответ**:
- HTTP 401 Unauthorized
- JSON с сообщением "Требуется аутентификация"
- Cookie удаляется

**Восстановление**: Клиент перенаправляется на страницу входа


### Сценарий 4: Превышение Rate Limit

**Условие**: Пользователь отправляет слишком много запросов на auth endpoints

**Ответ**:
- HTTP 429 Too Many Requests
- JSON с сообщением и временем до сброса лимита
- Header `Retry-After` с количеством секунд

**Восстановление**: Клиент ожидает указанное время перед повторной попыткой

### Сценарий 5: Ошибка отправки email

**Условие**: SMTP сервер недоступен при регистрации

**Ответ**:
- Пользователь создается в БД со статусом verified = false
- Ошибка логируется на сервере
- HTTP 201 Created с предупреждением о задержке письма
- Фоновая задача повторяет отправку

**Восстановление**: Система автоматически повторяет отправку через 5, 15, 30 минут

### Сценарий 6: Конфликт при синхронизации оффлайн данных

**Условие**: Тренировка с тем же UUID уже существует на сервере

**Ответ**:
- HTTP 409 Conflict
- JSON с информацией о существующей тренировке
- Клиент предлагает пользователю выбор: перезаписать или создать дубликат

**Восстановление**: Пользователь принимает решение через UI

## Стратегия тестирования

### Unit тестирование

**Подход**: Изолированное тестирование бизнес-логики с моками БД

**Ключевые тест-кейсы**:

1. **WorkoutService.createWorkout()**
   - Создание тренировки только с Skill блоками
   - Создание тренировки только с WOD блоками
   - Создание тренировки с обоими типами блоков
   - Откат транзакции при ошибке в середине процесса
   - Автоматическое создание новых упражнений

2. **StatisticsService.calculate1RM()**
   - Расчет для 1 повторения (должен вернуть исходный вес)
   - Расчет для 5 повторений
   - Расчет для 10 повторений
   - Округление до 0.5 кг

3. **StatisticsService.calculateStreak()**
   - Стрик = 0 при отсутствии тренировок
   - Стрик = 0 если последняя тренировка > 1 дня назад
   - Корректный подсчет последовательных дней
   - Корректный подсчет недель с тренировками

4. **UserService.hashPassword() / verifyPassword()**
   - Хеш не совпадает с оригинальным паролем
   - Верификация корректного пароля возвращает true
   - Верификация неверного пароля возвращает false
   - Два одинаковых пароля дают разные хеши (salt)

5. **MigrationService.migrateWorkouts()**
   - Успешная миграция валидных данных
   - Пропуск невалидных тренировок
   - Нормализация названий упражнений
   - Корректный отчет о результатах

**Инструменты**: Jest, Vitest

### Property-Based тестирование

**Подход**: Генерация случайных входных данных для проверки инвариантов

**Property Test Library**: fast-check (для TypeScript/JavaScript)

**Свойства для тестирования**:

1. **Свойство: 1RM всегда >= рабочего веса**
   ```typescript
   fc.assert(
     fc.property(
       fc.float({ min: 0.5, max: 500 }), // weight
       fc.integer({ min: 1, max: 10 }),  // reps
       (weight, reps) => {
         const oneRM = calculate1RM(weight, reps)
         return oneRM >= weight
       }
     )
   )
   ```

2. **Свойство: Создание и удаление тренировки идемпотентно**
   ```typescript
   fc.assert(
     fc.property(
       fc.uuid(),
       fc.record({
         date: fc.date().map(d => d.toISOString().split('T')[0]),
         skillBlocks: fc.array(fc.record({ /* ... */ }))
       }),
       async (userId, workoutData) => {
         const workout = await createWorkout(userId, workoutData)
         await deleteWorkout(workout.id, userId)
         const deleted = await getWorkoutById(workout.id, userId)
         return deleted === null
       }
     )
   )
   ```

3. **Свойство: Тоннаж монотонно возрастает при добавлении подходов**
   ```typescript
   fc.assert(
     fc.property(
       fc.uuid(),
       fc.date(),
       fc.array(fc.record({ weight: fc.float(), reps: fc.integer() })),
       async (userId, date, sets) => {
         const tonnage1 = await calculateTonnage(userId, date, date)
         // Добавляем тренировку с подходами
         await createWorkout(userId, { date, skillBlocks: [{ sets }] })
         const tonnage2 = await calculateTonnage(userId, date, date)
         return tonnage2 >= tonnage1
       }
     )
   )
   ```

### Integration тестирование

**Подход**: Тестирование полного flow с реальной тестовой БД

**Ключевые сценарии**:

1. **Полный цикл аутентификации**
   - Регистрация → Подтверждение email → Вход → Выход
   - Проверка JWT токена в cookie
   - Проверка доступа к защищенным endpoints

2. **Создание тренировки через API**
   - POST /api/workouts с полными данными
   - Проверка создания всех связанных записей в БД
   - GET /api/workouts для проверки возврата данных

3. **Миграция и синхронизация**
   - Миграция данных из localStorage
   - Оффлайн создание тренировки
   - Синхронизация при восстановлении сети

4. **Расчет статистики**
   - Создание нескольких тренировок
   - Проверка корректности Dashboard метрик
   - Проверка графиков прогресса

**Инструменты**: Playwright для E2E, Testcontainers для PostgreSQL


## Соображения производительности

### Индексы базы данных

**Критические индексы для оптимизации запросов**:

1. **users.email** - уникальный индекс для быстрого поиска при логине
2. **workouts(userId, date)** - композитный индекс для фильтрации тренировок пользователя по дате
3. **workouts.date** - для сортировки и фильтрации по периодам
4. **exercises_dict.name** - для автодополнения и поиска упражнений
5. **exercises_dict.userId** - для фильтрации пользовательских упражнений
6. **skill_blocks.workoutId** - для JOIN при загрузке тренировки
7. **skill_blocks.exerciseDictId** - для статистики по упражнениям
8. **skill_sets.skillBlockId** - для загрузки подходов
9. **wod_blocks.workoutId** - для JOIN при загрузке тренировки
10. **wod_exercises.wodBlockId** - для загрузки упражнений WOD
11. **wod_exercises.exerciseDictId** - для статистики по упражнениям

### Оптимизация запросов

**Стратегия 1: Eager Loading с Prisma**
```typescript
// Загрузка тренировки со всеми вложенными данными за 1 запрос
const workout = await prisma.workout.findUnique({
  where: { id: workoutId },
  include: {
    skillBlocks: {
      include: {
        exercise: true,
        sets: {
          orderBy: { setNumber: 'asc' }
        }
      }
    },
    wodBlocks: {
      include: {
        exercises: {
          include: { exercise: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    }
  }
})
```

**Стратегия 2: Пагинация с cursor-based подходом**
```typescript
// Более эффективно чем offset для больших датасетов
const workouts = await prisma.workout.findMany({
  where: { userId },
  take: 20,
  cursor: lastWorkoutId ? { id: lastWorkoutId } : undefined,
  orderBy: { date: 'desc' }
})
```

**Стратегия 3: Агрегация на уровне БД**
```typescript
// Расчет тоннажа одним запросом вместо N+1
const result = await prisma.$queryRaw`
  SELECT SUM(ss.weight * ss.reps) as tonnage
  FROM skill_sets ss
  JOIN skill_blocks sb ON ss.skill_block_id = sb.id
  JOIN workouts w ON sb.workout_id = w.id
  WHERE w.user_id = ${userId}
    AND w.date >= ${startDate}
    AND w.date <= ${endDate}
`
```

### Кэширование

**Уровень 1: HTTP кэширование статических данных**
- Справочник глобальных упражнений: Cache-Control: max-age=86400 (24 часа)
- Аватары пользователей: Cache-Control: max-age=3600 (1 час)

**Уровень 2: Service Worker кэш**
- Статические ассеты (JS, CSS, шрифты): cache-first стратегия
- API responses: network-first с fallback на кэш

**Уровень 3: IndexedDB для оффлайн**
- Последние 100 тренировок пользователя
- Справочник упражнений
- Очередь ожидающих синхронизации тренировок

### Ограничения и квоты

**Rate Limiting**:
- Auth endpoints: 5 запросов за 15 минут на IP
- API endpoints: 100 запросов за минуту на пользователя
- Migration endpoint: 1 запрос за 5 минут на пользователя

**Размеры данных**:
- Максимум 50 skill блоков на тренировку
- Максимум 20 подходов на skill блок
- Максимум 10 WOD блоков на тренировку
- Максимум 30 упражнений на WOD блок
- Комментарий тренировки: максимум 500 символов

## Соображения безопасности

### Аутентификация и авторизация

**JWT токены**:
- Алгоритм: HS256 (HMAC with SHA-256)
- Срок действия: 7 дней
- Payload: userId, email, iat, exp
- Secret: 256-bit случайная строка в переменной окружения
- Хранение: HTTP-only cookie (защита от XSS)

**Защита паролей**:
- Алгоритм: bcrypt
- Cost factor: 12 (компромисс между безопасностью и производительностью)
- Минимальные требования: 8 символов, 1 цифра, 1 буква
- Проверка на утечки: интеграция с Have I Been Pwned API (опционально)

**Токены верификации и сброса пароля**:
- Формат: 32-байтовая случайная строка (crypto.randomBytes)
- Срок действия: 1 час
- Одноразовые: удаляются после использования
- Хранение: отдельная таблица password_reset_tokens с индексом по token

### Защита от атак

**SQL Injection**:
- Использование Prisma ORM с параметризованными запросами
- Валидация всех входных данных
- Никаких сырых SQL запросов с интерполяцией строк

**XSS (Cross-Site Scripting)**:
- React автоматически экранирует вывод
- HTTP-only cookies для JWT (недоступны из JavaScript)
- Content-Security-Policy header
- Санитизация HTML в комментариях тренировок

**CSRF (Cross-Site Request Forgery)**:
- SameSite=Lax для cookies
- Проверка Origin header для мутирующих запросов
- CSRF токены для критичных операций (удаление аккаунта)

**Rate Limiting и DDoS**:
- Ограничение запросов на уровне IP и пользователя
- Exponential backoff для повторных попыток
- Cloudflare или аналог для защиты от DDoS

**Безопасность данных**:
- HTTPS обязательно (TLS 1.3)
- Шифрование данных в покое (PostgreSQL encryption at rest)
- Регулярные бэкапы БД (ежедневно)
- Логирование всех операций с чувствительными данными

### GDPR и приватность

**Права пользователей**:
- Право на доступ: экспорт всех данных в JSON
- Право на удаление: полное удаление аккаунта и всех данных
- Право на исправление: редактирование профиля
- Право на переносимость: экспорт в стандартном формате

**Обработка персональных данных**:
- Email: обязательное поле, используется только для аутентификации
- Имя/Фамилия: опциональные, не передаются третьим лицам
- IP адреса: логируются только для rate limiting, удаляются через 30 дней
- Cookies: только технические (JWT), без аналитики


## Зависимости

### Backend зависимости (package.json)

**Основные**:
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^5.0.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.0",
    "nodemailer": "^6.9.0",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/bcrypt": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/nodemailer": "^6.4.0",
    "jest": "^29.7.0",
    "@testing-library/react": "^14.0.0",
    "fast-check": "^3.15.0"
  }
}
```

**Описание ключевых зависимостей**:

1. **@prisma/client** - ORM для работы с PostgreSQL
   - Типобезопасные запросы
   - Автоматическая генерация типов TypeScript
   - Поддержка транзакций и миграций

2. **bcrypt** - Хеширование паролей
   - Индустриальный стандарт
   - Защита от rainbow table атак
   - Настраиваемый cost factor

3. **jsonwebtoken** - Генерация и валидация JWT
   - Поддержка различных алгоритмов подписи
   - Автоматическая проверка срока действия
   - Стандарт RFC 7519

4. **zod** - Валидация схем данных
   - TypeScript-first подход
   - Автоматический вывод типов
   - Детальные сообщения об ошибках

5. **nodemailer** - Отправка email
   - Поддержка SMTP
   - HTML шаблоны
   - Обработка вложений

6. **chart.js** - Визуализация данных
   - Легковесная библиотека
   - Адаптивные графики
   - Темная тема

### Внешние сервисы

**PostgreSQL Database**:
- Провайдер: Supabase / Neon / Render
- Версия: PostgreSQL 15+
- Расширения: uuid-ossp для генерации UUID
- Бэкапы: автоматические ежедневные

**SMTP Email Service**:
- Провайдер: Яндекс.Почта для домена / Mail.ru Cloud Solutions
- Альтернатива: SendGrid / Mailgun (для международных пользователей)
- Лимиты: 500 писем в день (бесплатный тариф)

**Hosting Platform**:
- Провайдер: Vercel
- Регион: Europe (для соответствия GDPR)
- CDN: Автоматический через Vercel Edge Network
- SSL: Автоматический Let's Encrypt сертификат

**Мониторинг и логирование**:
- Vercel Analytics (встроенный)
- Sentry для отслеживания ошибок (опционально)
- Vercel Logs для серверных логов

## PWA конфигурация

### Manifest.json

```json
{
  "name": "CrossFit Tracker",
  "short_name": "CF Tracker",
  "description": "Трекер тренировок для кроссфита",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1A1A1A",
  "theme_color": "#DC2626",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["health", "fitness", "sports"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1170x2532",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/workout.png",
      "sizes": "1170x2532",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### Service Worker стратегии

**Cache-First** (для статических ассетов):
```typescript
// Стратегия для JS, CSS, шрифтов, изображений
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'script' || 
      event.request.destination === 'style' ||
      event.request.destination === 'font' ||
      event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    )
  }
})
```

**Network-First** (для API запросов):
```typescript
// Стратегия для API endpoints
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кэшируем успешные GET запросы
          if (event.request.method === 'GET' && response.ok) {
            const cache = await caches.open('api-cache')
            cache.put(event.request, response.clone())
          }
          return response
        })
        .catch(() => {
          // Fallback на кэш при отсутствии сети
          return caches.match(event.request)
        })
    )
  }
})
```

**Background Sync** (для оффлайн операций):
```typescript
// Регистрация фоновой синхронизации
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncPendingWorkouts())
  }
})

async function syncPendingWorkouts() {
  const db = await openDB('workout-tracker')
  const pending = await db.getAll('pending-workouts')
  
  for (const workout of pending) {
    try {
      const response = await fetch('/api/workouts', {
        method: 'POST',
        body: JSON.stringify(workout.data)
      })
      
      if (response.ok) {
        await db.delete('pending-workouts', workout.id)
      }
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }
}
```


## Деплой и CI/CD

### Vercel конфигурация

**vercel.json**:
```json
{
  "buildCommand": "prisma generate && next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["fra1"],
  "env": {
    "DATABASE_URL": "@database-url",
    "JWT_SECRET": "@jwt-secret",
    "SMTP_HOST": "@smtp-host",
    "SMTP_PORT": "@smtp-port",
    "SMTP_USER": "@smtp-user",
    "SMTP_PASSWORD": "@smtp-password",
    "NEXT_PUBLIC_APP_URL": "https://crossfit-tracker.vercel.app"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

### Переменные окружения

**Production (.env.production)**:
```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"

# Authentication
JWT_SECRET="256-bit-random-string-generated-securely"
JWT_EXPIRES_IN="7d"

# SMTP Configuration
SMTP_HOST="smtp.yandex.ru"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="noreply@crossfit-tracker.ru"
SMTP_PASSWORD="secure-password"
SMTP_FROM="CrossFit Tracker <noreply@crossfit-tracker.ru>"

# Application
NEXT_PUBLIC_APP_URL="https://crossfit-tracker.vercel.app"
NODE_ENV="production"

# Rate Limiting
RATE_LIMIT_AUTH_MAX="5"
RATE_LIMIT_AUTH_WINDOW="900000"
RATE_LIMIT_API_MAX="100"
RATE_LIMIT_API_WINDOW="60000"
```

**Development (.env.development)**:
```bash
DATABASE_URL="postgresql://localhost:5432/crossfit_tracker_dev"
JWT_SECRET="dev-secret-key-not-for-production"
JWT_EXPIRES_IN="7d"
SMTP_HOST="localhost"
SMTP_PORT="1025"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### CI/CD Pipeline

**GitHub Actions (.github/workflows/deploy.yml)**:
```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate Prisma Client
        run: npx prisma generate
      
      - name: Run database migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run linter
        run: npm run lint
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Миграции базы данных

**Процесс миграции**:

1. **Локальная разработка**:
   ```bash
   # Создание новой миграции
   npx prisma migrate dev --name add_user_avatar
   
   # Применение миграций
   npx prisma migrate dev
   
   # Генерация Prisma Client
   npx prisma generate
   ```

2. **Production деплой**:
   ```bash
   # Применение миграций на production
   npx prisma migrate deploy
   
   # Проверка статуса миграций
   npx prisma migrate status
   ```

3. **Откат миграции** (в случае проблем):
   ```bash
   # Откат последней миграции
   npx prisma migrate resolve --rolled-back <migration_name>
   
   # Восстановление из бэкапа
   pg_restore -d dbname backup.dump
   ```

### Мониторинг и алертинг

**Метрики для отслеживания**:

1. **Производительность API**:
   - Среднее время ответа: < 200ms (p95)
   - Throughput: запросов в секунду
   - Error rate: < 1%

2. **База данных**:
   - Количество активных соединений
   - Время выполнения медленных запросов (> 1s)
   - Размер базы данных

3. **Аутентификация**:
   - Количество регистраций в день
   - Количество неудачных попыток входа
   - Rate limit violations

4. **Оффлайн синхронизация**:
   - Количество ожидающих синхронизации тренировок
   - Процент успешных синхронизаций
   - Среднее время задержки синхронизации

**Алерты**:
- Error rate > 5% за 5 минут → уведомление в Telegram
- API response time > 1s (p95) → уведомление
- Database connections > 80% → уведомление
- Disk space > 90% → критический алерт

### Бэкапы

**Стратегия бэкапов**:

1. **Автоматические ежедневные бэкапы**:
   - Время: 03:00 UTC (минимальная нагрузка)
   - Retention: 30 дней
   - Провайдер: Supabase/Neon встроенные бэкапы

2. **Еженедельные полные бэкапы**:
   - Время: Воскресенье 02:00 UTC
   - Retention: 12 недель
   - Хранение: S3-совместимое хранилище

3. **Тестирование восстановления**:
   - Ежемесячная проверка восстановления из бэкапа
   - Документирование процедуры восстановления
   - RTO (Recovery Time Objective): < 4 часа
   - RPO (Recovery Point Objective): < 24 часа


## Детальная спецификация API Endpoints

### Authentication Endpoints

#### POST /api/auth/register

**Описание**: Регистрация нового пользователя

**Request Body**:
```typescript
{
  email: string        // RFC 5322 формат
  password: string     // Минимум 8 символов
  firstName?: string   // Опционально
  lastName?: string    // Опционально
}
```

**Response 201 Created**:
```typescript
{
  user: {
    id: string
    email: string
    verified: false
  },
  message: "Регистрация успешна. Проверьте email для подтверждения."
}
```

**Response 400 Bad Request**:
```typescript
{
  error: "Validation failed",
  details: [
    { field: "email", message: "Invalid email format" },
    { field: "password", message: "Password must be at least 8 characters" }
  ]
}
```

**Response 409 Conflict**:
```typescript
{
  error: "Email already registered"
}
```

#### POST /api/auth/login

**Описание**: Вход в систему

**Request Body**:
```typescript
{
  email: string
  password: string
}
```

**Response 200 OK**:
```typescript
{
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  },
  message: "Вход выполнен успешно"
}
// + Set-Cookie: auth-token=<jwt>; HttpOnly; Secure; SameSite=Lax
```

**Response 401 Unauthorized**:
```typescript
{
  error: "Неверный email или пароль"
}
```

**Response 429 Too Many Requests**:
```typescript
{
  error: "Слишком много попыток входа. Попробуйте через 15 минут.",
  retryAfter: 900
}
```

#### POST /api/auth/logout

**Описание**: Выход из системы

**Response 200 OK**:
```typescript
{
  message: "Выход выполнен успешно"
}
// + Set-Cookie: auth-token=; Max-Age=0
```

#### GET /api/auth/verify

**Описание**: Подтверждение email

**Query Parameters**:
- `token`: string (verification token из письма)

**Response 200 OK**:
```typescript
{
  message: "Email подтвержден успешно"
}
```

**Response 400 Bad Request**:
```typescript
{
  error: "Невалидный или истекший токен"
}
```

#### POST /api/auth/password-reset

**Описание**: Запрос на сброс пароля

**Request Body**:
```typescript
{
  email: string
}
```

**Response 200 OK**:
```typescript
{
  message: "Инструкции по сбросу пароля отправлены на email"
}
```

#### POST /api/auth/password-reset/confirm

**Описание**: Установка нового пароля

**Request Body**:
```typescript
{
  token: string
  newPassword: string
}
```

**Response 200 OK**:
```typescript
{
  message: "Пароль успешно изменен"
}
```

### Workout Endpoints

#### POST /api/workouts

**Описание**: Создание новой тренировки

**Authentication**: Required (JWT)

**Request Body**:
```typescript
{
  date: string              // YYYY-MM-DD
  comment?: string          // Максимум 500 символов
  skillBlocks?: [
    {
      exerciseName: string
      sets: [
        {
          reps: number      // 1-100
          weight: number    // 0.5-9999.99 kg
        }
      ]
    }
  ]
  wodBlocks?: [
    {
      wodType: 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA'
      level: 'RX' | 'SCALED'
      timeCapSeconds?: number
      isLadder: boolean
      resultDisplay: string
      resultSeconds?: number      // Обязательно для FOR_TIME
      resultTotalReps?: number    // Обязательно для AMRAP
      exercises: [
        {
          exerciseName: string
          reps: number
          weight?: number
        }
      ]
    }
  ]
}
```

**Response 201 Created**:
```typescript
{
  id: string
  userId: string
  date: string
  comment: string | null
  skillBlocks: [
    {
      id: string
      exercise: {
        id: string
        name: string
      }
      sets: [
        {
          id: string
          setNumber: number
          reps: number
          weight: number
        }
      ]
    }
  ]
  wodBlocks: [
    {
      id: string
      wodType: string
      level: string
      resultDisplay: string
      exercises: [
        {
          id: string
          exercise: {
            id: string
            name: string
          }
          reps: number
          weight: number | null
          orderIndex: number
        }
      ]
    }
  ]
  createdAt: string
  updatedAt: string
}
```

**Response 400 Bad Request**:
```typescript
{
  error: "Validation failed",
  details: [
    { field: "date", message: "Date cannot be in the future" },
    { field: "skillBlocks[0].sets[0].weight", message: "Weight must be >= 0.5" }
  ]
}
```

#### GET /api/workouts

**Описание**: Получение списка тренировок с пагинацией

**Authentication**: Required (JWT)

**Query Parameters**:
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 100)
- `startDate`: string (YYYY-MM-DD, optional)
- `endDate`: string (YYYY-MM-DD, optional)
- `exerciseId`: string (UUID, optional)

**Response 200 OK**:
```typescript
{
  workouts: WorkoutResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}
```

#### GET /api/workouts/[id]

**Описание**: Получение одной тренировки

**Authentication**: Required (JWT)

**Response 200 OK**: WorkoutResponse (см. POST /api/workouts)

**Response 404 Not Found**:
```typescript
{
  error: "Тренировка не найдена"
}
```

**Response 403 Forbidden**:
```typescript
{
  error: "Доступ запрещен"
}
```

#### PATCH /api/workouts/[id]

**Описание**: Обновление тренировки

**Authentication**: Required (JWT)

**Request Body**: Partial<CreateWorkoutRequest>

**Response 200 OK**: WorkoutResponse

#### DELETE /api/workouts/[id]

**Описание**: Удаление тренировки

**Authentication**: Required (JWT)

**Response 204 No Content**

### Exercise Endpoints

#### GET /api/exercises

**Описание**: Поиск упражнений для автодополнения

**Authentication**: Required (JWT)

**Query Parameters**:
- `query`: string (минимум 2 символа)
- `limit`: number (default: 10, max: 50)

**Response 200 OK**:
```typescript
{
  exercises: [
    {
      id: string
      name: string
      isGlobal: boolean
    }
  ]
}
```

#### POST /api/exercises

**Описание**: Создание пользовательского упражнения

**Authentication**: Required (JWT)

**Request Body**:
```typescript
{
  name: string  // Уникальное для пользователя
}
```

**Response 201 Created**:
```typescript
{
  id: string
  name: string
  isGlobal: false
  userId: string
}
```

### Statistics Endpoints

#### GET /api/statistics/dashboard

**Описание**: Метрики для главной страницы

**Authentication**: Required (JWT)

**Response 200 OK**:
```typescript
{
  workoutsThisMonth: number
  tonnageThisMonth: number
  currentStreak: {
    days: number
    weeks: number
  }
  recentWorkouts: [
    {
      id: string
      date: string
      hasSkill: boolean
      hasWod: boolean
      comment: string | null
    }
  ]
}
```

#### GET /api/statistics/exercise/[exerciseId]

**Описание**: Статистика и история по упражнению

**Authentication**: Required (JWT)

**Query Parameters**:
- `startDate`: string (YYYY-MM-DD, optional)
- `endDate`: string (YYYY-MM-DD, optional)

**Response 200 OK**:
```typescript
{
  exerciseName: string
  personalRecords: {
    maxWeight: number
    maxReps: number
    best1RM: number
  }
  history: [
    {
      date: string
      weight: number
      reps: number
      estimated1RM: number
    }
  ]
}
```

#### GET /api/statistics/tonnage

**Описание**: Расчет тоннажа за период

**Authentication**: Required (JWT)

**Query Parameters**:
- `startDate`: string (YYYY-MM-DD, required)
- `endDate`: string (YYYY-MM-DD, required)

**Response 200 OK**:
```typescript
{
  tonnage: number
  period: {
    startDate: string
    endDate: string
  }
}
```

### Migration Endpoint

#### POST /api/migration

**Описание**: Миграция данных из localStorage

**Authentication**: Required (JWT)

**Rate Limit**: 1 запрос за 5 минут

**Request Body**:
```typescript
{
  workouts: LocalStorageWorkout[]
}
```

**Response 200 OK**:
```typescript
{
  imported: number
  failed: number
  errors: string[]
}
```

### User Profile Endpoints

#### GET /api/user/profile

**Описание**: Получение профиля пользователя

**Authentication**: Required (JWT)

**Response 200 OK**:
```typescript
{
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatar: string | null
  verified: boolean
  createdAt: string
}
```

#### PATCH /api/user/profile

**Описание**: Обновление профиля

**Authentication**: Required (JWT)

**Request Body**:
```typescript
{
  firstName?: string
  lastName?: string
  avatar?: string  // Base64 или URL
}
```

**Response 200 OK**: User profile

#### DELETE /api/user/account

**Описание**: Удаление аккаунта

**Authentication**: Required (JWT)

**Request Body**:
```typescript
{
  password: string      // Подтверждение
  csrfToken: string     // CSRF защита
}
```

**Response 204 No Content**


## Корректные свойства (Correctness Properties)

### Универсальные свойства системы

**Свойство 1: Атомарность транзакций**
```
∀ workout_creation_request:
  (transaction_started ∧ any_step_fails) ⟹ all_changes_rolled_back
  ∧
  (transaction_started ∧ all_steps_succeed) ⟹ all_changes_committed
```
Создание тренировки либо полностью успешно, либо полностью откатывается. Частичное сохранение невозможно.

**Свойство 2: Изоляция данных пользователей**
```
∀ user1, user2, workout:
  (workout.userId = user1.id ∧ user1.id ≠ user2.id) ⟹ 
  user2_cannot_access(workout)
```
Пользователь может получить доступ только к своим тренировкам. Доступ к чужим данным запрещен.

**Свойство 3: Монотонность 1RM**
```
∀ weight, reps:
  (reps > 0 ∧ weight > 0) ⟹ calculate1RM(weight, reps) ≥ weight
```
Расчетный одноповторный максимум всегда больше или равен рабочему весу.

**Свойство 4: Консистентность справочника упражнений**
```
∀ exercise_name, user_id:
  resolveExerciseId(exercise_name, user_id) = id1 ∧
  resolveExerciseId(exercise_name, user_id) = id2 ⟹
  id1 = id2
```
Повторный резолв одного и того же названия упражнения для одного пользователя всегда возвращает один и тот же ID.

**Свойство 5: Идемпотентность удаления**
```
∀ workout_id, user_id:
  deleteWorkout(workout_id, user_id) ∧
  deleteWorkout(workout_id, user_id) ⟹
  same_result
```
Повторное удаление тренировки не вызывает ошибку и приводит к тому же результату.

**Свойство 6: Валидность JWT токенов**
```
∀ token:
  (isValidToken(token) ∧ token.exp > now()) ⟹ 
  ∃ user: user.id = token.userId ∧ user.email = token.email
```
Валидный и не истекший JWT токен всегда соответствует существующему пользователю.

**Свойство 7: Монотонность тоннажа**
```
∀ user_id, date, new_workout:
  tonnage_before = calculateTonnage(user_id, date, date) ∧
  createWorkout(user_id, {date, skillBlocks: [...]}) ∧
  tonnage_after = calculateTonnage(user_id, date, date) ⟹
  tonnage_after ≥ tonnage_before
```
Добавление тренировки с skill блоками увеличивает или сохраняет тоннаж за день.

**Свойство 8: Корректность стрика**
```
∀ user_id:
  streak = calculateStreak(user_id) ∧
  last_workout_date > today - 1_day ⟹
  streak.days = 0
```
Если последняя тренировка была более 1 дня назад, стрик равен 0.

**Свойство 9: Уникальность email**
```
∀ user1, user2:
  (user1.id ≠ user2.id) ⟹ (user1.email ≠ user2.email)
```
Два разных пользователя не могут иметь одинаковый email.

**Свойство 10: Безопасность паролей**
```
∀ password, hash:
  hash = hashPassword(password) ⟹ hash ≠ password
```
Хеш пароля никогда не совпадает с оригинальным паролем.

**Свойство 11: Консистентность оффлайн синхронизации**
```
∀ workout:
  (workout ∈ pending_queue ∧ sync_successful(workout)) ⟹
  (workout ∉ pending_queue ∧ workout ∈ server_database)
```
После успешной синхронизации тренировка удаляется из локальной очереди и присутствует на сервере.

**Свойство 12: Валидность дат тренировок**
```
∀ workout:
  workout.date ≤ today
```
Дата тренировки не может быть в будущем.

**Свойство 13: Положительность весов**
```
∀ skill_set:
  skill_set.weight ≥ 0.5 ∧ skill_set.weight ≤ 9999.99
```
Все веса находятся в допустимом диапазоне.

**Свойство 14: Последовательность подходов**
```
∀ skill_block:
  sets = skill_block.sets ∧
  sorted_by_set_number(sets) ⟹
  ∀ i ∈ [0, len(sets)-1]: sets[i].setNumber = i + 1
```
Номера подходов последовательны и начинаются с 1.

**Свойство 15: Корректность результатов WOD**
```
∀ wod_block:
  (wod_block.wodType = 'FOR_TIME') ⟹ (wod_block.resultSeconds ≠ null)
  ∧
  (wod_block.wodType = 'AMRAP') ⟹ (wod_block.resultTotalReps ≠ null)
```
Результаты WOD соответствуют типу комплекса.

## Заключение

Данный технический дизайн описывает полную архитектуру перехода CrossFit Tracker от MVP версии к production-ready веб-приложению. Ключевые технические решения:

**Архитектура**: Next.js 15 с App Router обеспечивает современный full-stack подход с серверными компонентами и API Routes в одном проекте.

**База данных**: PostgreSQL с Prisma ORM предоставляет типобезопасность, автоматические миграции и оптимизированные запросы. Нормализованная структура с UUID ключами обеспечивает масштабируемость и совместимость с оффлайн режимом.

**Безопасность**: JWT аутентификация в HTTP-only cookies, bcrypt хеширование паролей, rate limiting и защита от основных веб-атак (SQL injection, XSS, CSRF) обеспечивают высокий уровень безопасности.

**Оффлайн режим**: PWA с Service Workers и IndexedDB позволяет приложению работать без интернета, автоматически синхронизируя данные при восстановлении соединения.

**Производительность**: Индексы БД, eager loading, cursor-based пагинация и кэширование на нескольких уровнях обеспечивают быстрый отклик системы.

**Деплой**: Vercel для фронтенда и API, Supabase/Neon для PostgreSQL, автоматический CI/CD через GitHub Actions и ежедневные бэкапы обеспечивают надежность и доступность.

Система готова к реализации и масштабированию для тысяч пользователей.
