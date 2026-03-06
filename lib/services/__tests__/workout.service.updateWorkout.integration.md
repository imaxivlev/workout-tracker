# Интеграционный тест для updateWorkout()

## Статус реализации

✅ **Метод `updateWorkout()` реализован** в `lib/services/workout.service.ts`

## Реализованная функциональность

Метод `updateWorkout()` выполняет следующие операции:

### 1. Проверка существования тренировки
- Запрашивает тренировку по ID
- Выбрасывает `Error('NOT_FOUND')` если тренировка не найдена

### 2. Проверка прав доступа (Требование 10.4)
- Сравнивает `existingWorkout.userId` с переданным `userId`
- Выбрасывает `Error('FORBIDDEN')` если userId не совпадает
- **Это ключевое требование 10.4**: "КОГДА пользователь обновляет тренировку, ТО Система ДОЛЖНА проверить, что userId совпадает"

### 3. Обновление данных в транзакции
- Использует `prisma.$transaction()` для атомарности
- Обновляет основные поля (date, comment) если они переданы
- Удаляет старые блоки и создает новые (если переданы)
- Автоматически резолвит названия упражнений через `resolveExerciseIdInTransaction()`

### 4. Возврат обновленного объекта
- Загружает полный объект со всеми вложенными данными через `loadWorkoutWithRelations()`
- Возвращает `WorkoutResponse` с обновленными данными

## Сигнатура метода

```typescript
async updateWorkout(
  workoutId: string,
  userId: string,
  data: Partial<CreateWorkoutRequest>
): Promise<WorkoutResponse>
```

## Параметры

- `workoutId` - UUID тренировки для обновления
- `userId` - UUID пользователя (для проверки прав доступа)
- `data` - Частичные данные для обновления:
  - `date?: string` - Новая дата (YYYY-MM-DD)
  - `comment?: string` - Новый комментарий
  - `skillBlocks?: SkillBlockInput[]` - Новые skill блоки (заменяют старые)
  - `wodBlocks?: WodBlockInput[]` - Новые WOD блоки (заменяют старые)

## Обработка ошибок

- `Error('NOT_FOUND')` - Тренировка не найдена
- `Error('FORBIDDEN')` - Попытка обновить чужую тренировку
- Любые другие ошибки приводят к откату транзакции

## Тестирование

### Unit тесты созданы

Файл: `lib/services/__tests__/workout.service.updateWorkout.test.ts`

Тестовые сценарии:
1. ✅ Обновление комментария
2. ✅ Обновление даты
3. ✅ Обновление skill блоков
4. ✅ Добавление WOD блока
5. ✅ Проверка FORBIDDEN для чужой тренировки
6. ✅ Проверка NOT_FOUND для несуществующей тренировки
7. ✅ Удаление всех блоков (пустые массивы)
8. ✅ Обновление нескольких полей одновременно

### Требования для запуска тестов

⚠️ **Тесты требуют запущенную PostgreSQL базу данных**

Перед запуском тестов:
```cmd
# 1. Убедитесь, что PostgreSQL запущен
sc query postgresql-x64-15

# 2. Выполните миграции
cmd.exe /c "npx prisma migrate dev"

# 3. Загрузите seed данные
cmd.exe /c "npx prisma db seed"

# 4. Запустите тесты
cmd.exe /c "npx vitest run lib/services/__tests__/workout.service.updateWorkout.test.ts"
```

## Использование в API

Метод готов к использованию в API endpoint:

```typescript
// app/api/workouts/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Аутентификация
    const { user } = await authenticateRequest(request);
    
    // Валидация данных
    const data = await request.json();
    
    // Обновление тренировки
    const updated = await workoutService.updateWorkout(
      params.id,
      user.id,
      data
    );
    
    return NextResponse.json(updated);
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Тренировка не найдена' },
        { status: 404 }
      );
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
```

## Валидация требований

✅ **Требование 10.4 выполнено**: "КОГДА пользователь обновляет тренировку, ТО Система ДОЛЖНА проверить, что userId совпадает"

Реализация:
```typescript
// Шаг 2: Требование 10.4 - Проверка прав доступа (userId совпадает)
if (existingWorkout.userId !== userId) {
  throw new Error('FORBIDDEN');
}
```

## Следующие шаги

1. Запустить PostgreSQL базу данных
2. Выполнить unit тесты для проверки корректности
3. Создать API endpoint PATCH /api/workouts/[id]
4. Добавить валидацию входных данных с Zod
5. Интегрировать с фронтендом

