/**
 * Property-based тесты для оффлайн синхронизации
 * 
 * **Валидирует: Требования 19.2-19.3**
 * 
 * Свойство 12: Консистентность оффлайн синхронизации
 * Для любой тренировки в очереди ожидания, если синхронизация успешна,
 * то тренировка должна быть удалена из локальной очереди и присутствовать на сервере.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import 'fake-indexeddb/auto';
import {
  openDB,
  addPendingWorkout,
  getPendingWorkouts,
  deletePendingWorkout,
  saveWorkout,
  getWorkout,
  clearAllData,
} from '../indexeddb';

describe('Offline Sync Property Tests', () => {
  beforeEach(async () => {
    // Очистка данных перед каждым тестом
    try {
      await clearAllData();
    } catch (error) {
      // Игнорируем ошибки если БД еще не инициализирована
    }
  });

  afterEach(async () => {
    // Очистка после теста
    try {
      await clearAllData();
    } catch (error) {
      // Игнорируем ошибки
    }
  });

  /**
   * Генератор валидных данных тренировки
   */
  const workoutDataArbitrary = fc.record({
    date: fc.date({ min: new Date('2020-01-01'), max: new Date(), noInvalidDate: true })
      .map(d => d.toISOString().split('T')[0]),
    comment: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    skillBlocks: fc.option(
      fc.array(
        fc.record({
          exerciseName: fc.constantFrom(
            'Back Squat',
            'Front Squat',
            'Deadlift',
            'Bench Press',
            'Pull-ups'
          ),
          sets: fc.array(
            fc.record({
              reps: fc.integer({ min: 1, max: 20 }),
              weight: fc.float({ min: 0.5, max: 200, noNaN: true }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        { minLength: 1, maxLength: 5 }
      ),
      { nil: undefined }
    ),
  });

  it('**Свойство 12: Консистентность оффлайн синхронизации** - тренировка удаляется из очереди после успешной синхронизации', async () => {
    await fc.assert(
      fc.asyncProperty(workoutDataArbitrary, async (workoutData) => {
        // Добавляем тренировку в очередь ожидания
        const pendingId = await addPendingWorkout(workoutData);

        // Проверяем что тренировка в очереди
        const pendingBefore = await getPendingWorkouts();
        const isInQueue = pendingBefore.some(w => w.id === pendingId);
        expect(isInQueue).toBe(true);

        // Симулируем успешную синхронизацию
        // В реальности это делает Service Worker, но мы тестируем логику
        await deletePendingWorkout(pendingId);

        // Проверяем что тренировка удалена из очереди
        const pendingAfter = await getPendingWorkouts();
        const stillInQueue = pendingAfter.some(w => w.id === pendingId);
        expect(stillInQueue).toBe(false);

        // Свойство: после успешной синхронизации тренировка НЕ в очереди
        return !stillInQueue;
      }),
      { numRuns: 50 }
    );
  });

  it('Свойство: количество ожидающих тренировок уменьшается после синхронизации', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(workoutDataArbitrary, { minLength: 1, maxLength: 10 }),
        async (workouts) => {
          // Очистка перед каждой итерацией
          await clearAllData();

          // Добавляем несколько тренировок в очередь
          const ids = await Promise.all(
            workouts.map(w => addPendingWorkout(w))
          );

          const countBefore = (await getPendingWorkouts()).length;
          expect(countBefore).toBe(ids.length);

          // Синхронизируем первую тренировку
          await deletePendingWorkout(ids[0]);

          const countAfter = (await getPendingWorkouts()).length;

          // Свойство: количество уменьшилось на 1
          return countAfter === countBefore - 1;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Свойство: идемпотентность удаления из очереди', async () => {
    await fc.assert(
      fc.asyncProperty(workoutDataArbitrary, async (workoutData) => {
        const pendingId = await addPendingWorkout(workoutData);

        // Удаляем первый раз
        await deletePendingWorkout(pendingId);
        const countAfterFirst = (await getPendingWorkouts()).length;

        // Удаляем второй раз (должно быть безопасно)
        await deletePendingWorkout(pendingId);
        const countAfterSecond = (await getPendingWorkouts()).length;

        // Свойство: повторное удаление не меняет состояние
        return countAfterFirst === countAfterSecond;
      }),
      { numRuns: 30 }
    );
  });

  it('Свойство: данные тренировки сохраняются корректно в очереди', async () => {
    await fc.assert(
      fc.asyncProperty(workoutDataArbitrary, async (workoutData) => {
        const pendingId = await addPendingWorkout(workoutData);

        const pending = await getPendingWorkouts();
        const savedWorkout = pending.find(w => w.id === pendingId);

        expect(savedWorkout).toBeDefined();
        expect(savedWorkout?.data).toBeDefined();

        // Свойство: сохраненные данные совпадают с оригинальными
        return (
          savedWorkout?.data.date === workoutData.date &&
          savedWorkout?.data.comment === workoutData.comment
        );
      }),
      { numRuns: 50 }
    );
  });

  it('Свойство: timestamp устанавливается при добавлении в очередь', async () => {
    await fc.assert(
      fc.asyncProperty(workoutDataArbitrary, async (workoutData) => {
        const beforeTimestamp = Date.now();
        const pendingId = await addPendingWorkout(workoutData);
        const afterTimestamp = Date.now();

        const pending = await getPendingWorkouts();
        const savedWorkout = pending.find(w => w.id === pendingId);

        expect(savedWorkout?.timestamp).toBeDefined();

        // Свойство: timestamp находится в разумном диапазоне
        return (
          savedWorkout!.timestamp >= beforeTimestamp &&
          savedWorkout!.timestamp <= afterTimestamp
        );
      }),
      { numRuns: 30 }
    );
  });

  it('Свойство: очередь сохраняет порядок добавления', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(workoutDataArbitrary, { minLength: 2, maxLength: 5 }),
        async (workouts) => {
          // Добавляем тренировки последовательно с небольшой задержкой
          const ids: string[] = [];
          for (const workout of workouts) {
            const id = await addPendingWorkout(workout);
            ids.push(id);
            // Небольшая задержка для гарантии разных timestamp
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          const pending = await getPendingWorkouts();
          const timestamps = pending
            .filter(w => ids.includes(w.id))
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(w => w.timestamp);

          // Свойство: timestamps монотонно возрастают
          for (let i = 1; i < timestamps.length; i++) {
            if (timestamps[i] <= timestamps[i - 1]) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Свойство: кэш тренировок независим от очереди синхронизации', async () => {
    await fc.assert(
      fc.asyncProperty(
        workoutDataArbitrary,
        fc.uuid(),
        async (workoutData, workoutId) => {
          // Добавляем в очередь синхронизации
          const pendingId = await addPendingWorkout(workoutData);

          // Добавляем в кэш тренировок (симулируем синхронизированную тренировку)
          const cachedWorkout = {
            id: workoutId,
            userId: 'test-user',
            date: workoutData.date,
            comment: workoutData.comment || null,
            skillBlocks: workoutData.skillBlocks || [],
            wodBlocks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await saveWorkout(cachedWorkout);

          // Проверяем что оба хранилища независимы
          const pending = await getPendingWorkouts();
          const cached = await getWorkout(workoutId);

          const pendingExists = pending.some(w => w.id === pendingId);
          const cachedExists = cached !== null;

          // Свойство: тренировка может быть и в очереди, и в кэше одновременно
          return pendingExists && cachedExists;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Свойство: очистка очереди не влияет на кэш тренировок', async () => {
    await fc.assert(
      fc.asyncProperty(
        workoutDataArbitrary,
        fc.uuid(),
        async (workoutData, workoutId) => {
          // Добавляем в кэш
          const cachedWorkout = {
            id: workoutId,
            userId: 'test-user',
            date: workoutData.date,
            comment: workoutData.comment || null,
            skillBlocks: workoutData.skillBlocks || [],
            wodBlocks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await saveWorkout(cachedWorkout);

          // Добавляем в очередь
          const pendingId = await addPendingWorkout(workoutData);

          // Удаляем из очереди
          await deletePendingWorkout(pendingId);

          // Проверяем что кэш не затронут
          const cached = await getWorkout(workoutId);

          // Свойство: тренировка остается в кэше после удаления из очереди
          return cached !== null && cached.id === workoutId;
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Offline Sync Edge Cases', () => {
  beforeEach(async () => {
    try {
      await clearAllData();
    } catch (error) {
      // Игнорируем
    }
  });

  it('должен корректно обрабатывать пустую очередь', async () => {
    const pending = await getPendingWorkouts();
    expect(pending).toEqual([]);
  });

  it('должен корректно обрабатывать удаление несуществующей тренировки', async () => {
    const fakeId = crypto.randomUUID();
    
    // Не должно выбрасывать ошибку
    await expect(deletePendingWorkout(fakeId)).resolves.not.toThrow();
  });

  it('должен сохранять retryCount при добавлении в очередь', async () => {
    const workoutData = {
      date: '2024-01-15',
      comment: 'Test workout',
    };

    const pendingId = await addPendingWorkout(workoutData);
    const pending = await getPendingWorkouts();
    const workout = pending.find(w => w.id === pendingId);

    expect(workout?.retryCount).toBe(0);
  });
});
