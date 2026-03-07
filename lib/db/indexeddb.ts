/**
 * IndexedDB утилита для оффлайн хранилища
 * Используется для кэширования тренировок и очереди синхронизации
 */

const DB_NAME = 'workout-tracker';
const DB_VERSION = 1;

// Типы для TypeScript
export interface CachedWorkout {
  id: string;
  userId: string;
  date: string;
  comment?: string;
  skillBlocks?: any[];
  wodBlocks?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface PendingWorkout {
  id: string;
  data: any;
  timestamp: number;
  retryCount?: number;
}

export interface CachedExercise {
  id: string;
  name: string;
  isGlobal: boolean;
  userId?: string;
}

/**
 * Открытие соединения с IndexedDB
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Error opening database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[IndexedDB] Database opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[IndexedDB] Upgrading database schema...');

      // Хранилище для кэшированных тренировок (последние 100)
      if (!db.objectStoreNames.contains('workouts')) {
        const workoutStore = db.createObjectStore('workouts', { keyPath: 'id' });
        workoutStore.createIndex('userId', 'userId', { unique: false });
        workoutStore.createIndex('date', 'date', { unique: false });
        workoutStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[IndexedDB] Created workouts store');
      }

      // Хранилище для ожидающих синхронизации тренировок
      if (!db.objectStoreNames.contains('pending-workouts')) {
        const pendingStore = db.createObjectStore('pending-workouts', { keyPath: 'id' });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[IndexedDB] Created pending-workouts store');
      }

      // Хранилище для справочника упражнений
      if (!db.objectStoreNames.contains('exercises')) {
        const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' });
        exerciseStore.createIndex('name', 'name', { unique: false });
        exerciseStore.createIndex('isGlobal', 'isGlobal', { unique: false });
        console.log('[IndexedDB] Created exercises store');
      }
    };
  });
}

/**
 * Сохранение тренировки в кэш
 */
export async function saveWorkout(workout: CachedWorkout): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['workouts'], 'readwrite');
    const store = transaction.objectStore('workouts');
    const request = store.put(workout);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Workout saved:', workout.id);
      resolve();
    };

    transaction.oncomplete = () => {
      // Проверяем лимит в 100 тренировок
      limitWorkoutsCache(db);
    };
  });
}

/**
 * Получение тренировки из кэша
 */
export async function getWorkout(id: string): Promise<CachedWorkout | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['workouts'], 'readonly');
    const store = transaction.objectStore('workouts');
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Получение всех кэшированных тренировок
 */
export async function getAllWorkouts(): Promise<CachedWorkout[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['workouts'], 'readonly');
    const store = transaction.objectStore('workouts');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Ограничение кэша до 100 последних тренировок
 */
async function limitWorkoutsCache(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['workouts'], 'readwrite');
    const store = transaction.objectStore('workouts');
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev'); // Сортировка по убыванию

    let count = 0;
    const toDelete: string[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      
      if (cursor) {
        count++;
        
        // Помечаем для удаления все тренировки после 100-й
        if (count > 100) {
          toDelete.push(cursor.value.id);
        }
        
        cursor.continue();
      } else {
        // Удаляем старые тренировки
        if (toDelete.length > 0) {
          const deleteTransaction = db.transaction(['workouts'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('workouts');
          
          toDelete.forEach(id => deleteStore.delete(id));
          
          console.log(`[IndexedDB] Deleted ${toDelete.length} old workouts from cache`);
        }
        
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Добавление тренировки в очередь синхронизации
 */
export async function addPendingWorkout(data: any): Promise<string> {
  const db = await openDB();
  
  const pendingWorkout: PendingWorkout = {
    id: crypto.randomUUID(),
    data,
    timestamp: Date.now(),
    retryCount: 0
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readwrite');
    const store = transaction.objectStore('pending-workouts');
    const request = store.add(pendingWorkout);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Workout added to sync queue:', pendingWorkout.id);
      resolve(pendingWorkout.id);
    };
  });
}

/**
 * Получение всех ожидающих синхронизации тренировок
 */
export async function getPendingWorkouts(): Promise<PendingWorkout[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readonly');
    const store = transaction.objectStore('pending-workouts');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Удаление тренировки из очереди синхронизации
 */
export async function deletePendingWorkout(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readwrite');
    const store = transaction.objectStore('pending-workouts');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Pending workout deleted:', id);
      resolve();
    };
  });
}

/**
 * Обновление счетчика попыток синхронизации
 */
export async function incrementRetryCount(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readwrite');
    const store = transaction.objectStore('pending-workouts');
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const workout = getRequest.result;
      if (workout) {
        workout.retryCount = (workout.retryCount || 0) + 1;
        const putRequest = store.put(workout);
        
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Сохранение упражнения в кэш
 */
export async function saveExercise(exercise: CachedExercise): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    const request = store.put(exercise);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[IndexedDB] Exercise saved:', exercise.name);
      resolve();
    };
  });
}

/**
 * Получение всех упражнений из кэша
 */
export async function getAllExercises(): Promise<CachedExercise[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['exercises'], 'readonly');
    const store = transaction.objectStore('exercises');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Поиск упражнения по имени
 */
export async function findExerciseByName(name: string): Promise<CachedExercise | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['exercises'], 'readonly');
    const store = transaction.objectStore('exercises');
    const index = store.index('name');
    const request = index.get(name);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Очистка всех данных (для тестирования или выхода из системы)
 */
export async function clearAllData(): Promise<void> {
  const db = await openDB();
  
  const stores = ['workouts', 'pending-workouts', 'exercises'];
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, 'readwrite');
    
    stores.forEach(storeName => {
      const store = transaction.objectStore(storeName);
      store.clear();
    });

    transaction.oncomplete = () => {
      console.log('[IndexedDB] All data cleared');
      resolve();
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Получение статистики по хранилищу
 */
export async function getStorageStats(): Promise<{
  workouts: number;
  pendingWorkouts: number;
  exercises: number;
}> {
  const db = await openDB();
  
  const getCount = (storeName: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  };

  const [workouts, pendingWorkouts, exercises] = await Promise.all([
    getCount('workouts'),
    getCount('pending-workouts'),
    getCount('exercises')
  ]);

  return { workouts, pendingWorkouts, exercises };
}
