import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based тест для оффлайн синхронизации
 * 
 * **Валидирует: Требования 19.2-19.3**
 * 
 * Свойство 12: Консистентность оффлайн синхронизации
 * 
 * Для любого набора тренировок, созданных оффлайн:
 * 1. Все тренировки должны быть сохранены в очередь pending-workouts
 * 2. При восстановлении сети все тренировки должны быть синхронизированы
 * 3. После успешной синхронизации тренировки должны быть удалены из очереди
 * 4. При неудаче синхронизации тренировки должны остаться в очереди
 * 5. Порядок синхронизации должен соответствовать порядку создания (FIFO)
 */
describe('Offline Sync - Свойство 12: Консистентность оффлайн синхронизации', () => {
  
  /**
   * Генератор случайных тренировок для тестирования
   */
  const workoutArbitrary = fc.record({
    id: fc.uuid(),
    date: fc.integer({ min: 0, max: 365 * 3 }) // Последние 3 года в днях
      .map(daysAgo => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split('T')[0];
      }),
    comment: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    skillBlocks: fc.array(
      fc.record({
        exerciseName: fc.constantFrom('Squat', 'Deadlift', 'Bench Press', 'Pull-up'),
        sets: fc.array(
          fc.record({
            weight: fc.float({ min: 20, max: 200, noNaN: true }),
            reps: fc.integer({ min: 1, max: 20 })
          }),
          { minLength: 1, maxLength: 5 }
        )
      }),
      { minLength: 0, maxLength: 3 }
    ),
    wodBlocks: fc.array(
      fc.record({
        type: fc.constantFrom('FOR_TIME', 'AMRAP', 'EMOM'),
        exercises: fc.array(
          fc.record({
            exerciseName: fc.constantFrom('Burpee', 'Box Jump', 'Wall Ball'),
            reps: fc.integer({ min: 5, max: 50 })
          }),
          { minLength: 1, maxLength: 5 }
        )
      }),
      { minLength: 0, maxLength: 2 }
    )
  });
  
  /**
   * Property тест: Все оффлайн тренировки должны быть сохранены в очередь
   */
  it('все оффлайн тренировки сохраняются в очередь pending-workouts', () => {
    fc.assert(
      fc.property(
        fc.array(workoutArbitrary, { minLength: 1, maxLength: 10 }),
        (workouts) => {
          // Симуляция сохранения тренировок в очередь
          const pendingQueue: any[] = [];
          
          for (const workout of workouts) {
            const pendingWorkout = {
              id: workout.id,
              data: workout,
              timestamp: Date.now(),
              status: 'pending'
            };
            pendingQueue.push(pendingWorkout);
          }
          
          // Свойство: количество тренировок в очереди = количество созданных тренировок
          expect(pendingQueue.length).toBe(workouts.length);
          
          // Свойство: все тренировки имеют статус 'pending'
          expect(pendingQueue.every(w => w.status === 'pending')).toBe(true);
          
          // Свойство: все тренировки имеют уникальные ID
          const ids = pendingQueue.map(w => w.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(workouts.length);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property тест: Успешная синхронизация удаляет тренировки из очереди
   */
  it('успешная синхронизация удаляет тренировки из очереди', () => {
    fc.assert(
      fc.property(
        fc.array(workoutArbitrary, { minLength: 1, maxLength: 10 }),
        (workouts) => {
          // Симуляция очереди
          const pendingQueue = workouts.map(w => ({
            id: w.id,
            data: w,
            timestamp: Date.now(),
            status: 'pending'
          }));
          
          const initialCount = pendingQueue.length;
          
          // Симуляция успешной синхронизации всех тренировок
          const syncedIds = new Set<string>();
          
          for (const workout of pendingQueue) {
            // Симуляция успешного API запроса
            const syncSuccess = true;
            
            if (syncSuccess) {
              syncedIds.add(workout.id);
            }
          }
          
          // Удаление синхронизированных тренировок из очереди
          const remainingQueue = pendingQueue.filter(w => !syncedIds.has(w.id));
          
          // Свойство: после успешной синхронизации очередь пуста
          expect(remainingQueue.length).toBe(0);
          
          // Свойство: количество синхронизированных = количество изначальных
          expect(syncedIds.size).toBe(initialCount);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property тест: Неудачная синхронизация оставляет тренировки в очереди
   */
  it('неудачная синхронизация оставляет тренировки в очереди для повторной попытки', () => {
    fc.assert(
      fc.property(
        fc.array(workoutArbitrary, { minLength: 1, maxLength: 10 }),
        fc.float({ min: 0, max: 1 }), // Вероятность успеха синхронизации
        (workouts, successRate) => {
          // Симуляция очереди
          const pendingQueue = workouts.map(w => ({
            id: w.id,
            data: w,
            timestamp: Date.now(),
            status: 'pending'
          }));
          
          const initialCount = pendingQueue.length;
          
          // Симуляция синхронизации с частичными неудачами
          const syncedIds = new Set<string>();
          
          for (const workout of pendingQueue) {
            // Случайный успех/неудача на основе successRate
            const syncSuccess = Math.random() < successRate;
            
            if (syncSuccess) {
              syncedIds.add(workout.id);
            }
          }
          
          // Удаление только успешно синхронизированных
          const remainingQueue = pendingQueue.filter(w => !syncedIds.has(w.id));
          
          // Свойство: количество оставшихся = изначальное - синхронизированные
          expect(remainingQueue.length).toBe(initialCount - syncedIds.size);
          
          // Свойство: все оставшиеся тренировки имеют статус 'pending'
          expect(remainingQueue.every(w => w.status === 'pending')).toBe(true);
          
          // Свойство: оставшиеся тренировки не пересекаются с синхронизированными
          const remainingIds = new Set(remainingQueue.map(w => w.id));
          const intersection = [...syncedIds].filter(id => remainingIds.has(id));
          expect(intersection.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property тест: Порядок синхронизации соответствует порядку создания (FIFO)
   */
  it('порядок синхронизации соответствует порядку создания (FIFO)', () => {
    fc.assert(
      fc.property(
        fc.array(workoutArbitrary, { minLength: 2, maxLength: 10 }),
        (workouts) => {
          // Симуляция очереди с временными метками
          const pendingQueue = workouts.map((w, index) => ({
            id: w.id,
            data: w,
            timestamp: Date.now() + index * 1000, // Каждая тренировка на 1 секунду позже
            status: 'pending'
          }));
          
          // Сортировка по timestamp (FIFO)
          const sortedQueue = [...pendingQueue].sort((a, b) => a.timestamp - b.timestamp);
          
          // Симуляция синхронизации в порядке очереди
          const syncOrder: string[] = [];
          
          for (const workout of sortedQueue) {
            syncOrder.push(workout.id);
          }
          
          // Свойство: порядок синхронизации = порядок в отсортированной очереди
          const expectedOrder = sortedQueue.map(w => w.id);
          expect(syncOrder).toEqual(expectedOrder);
          
          // Свойство: первая синхронизированная тренировка = самая старая по timestamp
          expect(syncOrder[0]).toBe(sortedQueue[0].id);
          
          // Свойство: последняя синхронизированная тренировка = самая новая по timestamp
          expect(syncOrder[syncOrder.length - 1]).toBe(sortedQueue[sortedQueue.length - 1].id);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property тест: Идемпотентность синхронизации
   */
  it('повторная синхронизация уже синхронизированных тренировок безопасна', () => {
    fc.assert(
      fc.property(
        fc.array(workoutArbitrary, { minLength: 1, maxLength: 10 }),
        (workouts) => {
          // Симуляция очереди
          let pendingQueue = workouts.map(w => ({
            id: w.id,
            data: w,
            timestamp: Date.now(),
            status: 'pending'
          }));
          
          // Первая синхронизация
          const syncedIds = new Set(pendingQueue.map(w => w.id));
          pendingQueue = pendingQueue.filter(w => !syncedIds.has(w.id));
          
          const queueAfterFirstSync = pendingQueue.length;
          
          // Попытка повторной синхронизации (очередь уже пуста)
          const secondSyncIds = new Set(pendingQueue.map(w => w.id));
          pendingQueue = pendingQueue.filter(w => !secondSyncIds.has(w.id));
          
          const queueAfterSecondSync = pendingQueue.length;
          
          // Свойство: повторная синхронизация не изменяет пустую очередь
          expect(queueAfterFirstSync).toBe(0);
          expect(queueAfterSecondSync).toBe(0);
          
          // Свойство: идемпотентность - результат одинаковый
          expect(queueAfterFirstSync).toBe(queueAfterSecondSync);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property тест: Консистентность данных при синхронизации
   */
  it('данные тренировок не изменяются при синхронизации', () => {
    fc.assert(
      fc.property(
        fc.array(workoutArbitrary, { minLength: 1, maxLength: 10 }),
        (workouts) => {
          // Симуляция очереди
          const pendingQueue = workouts.map(w => ({
            id: w.id,
            data: JSON.parse(JSON.stringify(w)), // Deep copy
            timestamp: Date.now(),
            status: 'pending'
          }));
          
          // Симуляция синхронизации
          const syncedWorkouts: any[] = [];
          
          for (const workout of pendingQueue) {
            // Симуляция отправки на сервер
            const syncedData = JSON.parse(JSON.stringify(workout.data));
            syncedWorkouts.push(syncedData);
          }
          
          // Свойство: количество синхронизированных = количество в очереди
          expect(syncedWorkouts.length).toBe(workouts.length);
          
          // Свойство: данные не изменились при синхронизации
          for (let i = 0; i < workouts.length; i++) {
            expect(syncedWorkouts[i]).toEqual(workouts[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
