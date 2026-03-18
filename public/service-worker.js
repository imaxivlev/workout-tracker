/**
 * Service Worker для Workout Tracker PWA
 * 
 * Реализует:
 * - Cache-first стратегию для статических ресурсов
 * - Network-first стратегию для API запросов с fallback на кэш
 * - Оффлайн создание тренировок с постановкой в очередь
 * - Фоновую синхронизацию при восстановлении сети
 * 
 * Требования: 18.2-18.4, 19.1-19.5
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `workout-tracker-static-${CACHE_VERSION}`;
const API_CACHE = `workout-tracker-api-${CACHE_VERSION}`;
const EXERCISES_CACHE = `workout-tracker-exercises-${CACHE_VERSION}`;

// Статические ресурсы для кэширования
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/workout-tracker/icon-192.png',
  '/workout-tracker/icon-512.png'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Удаляем старые версии кэша
              return name.startsWith('workout-tracker-') && 
                     !name.includes(CACHE_VERSION);
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Обработка fetch запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // API запросы - network-first с fallback на кэш
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Справочник упражнений - кэшируем отдельно
  if (url.pathname === '/api/exercises') {
    event.respondWith(handleExercisesRequest(request));
    return;
  }
  
  // Статические ресурсы - cache-first
  event.respondWith(handleStaticRequest(request));
});

/**
 * Cache-first стратегия для статических ресурсов
 * Требования: 18.3
 */
async function handleStaticRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Кэшируем успешные ответы
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Static request failed:', error);
    
    // Возвращаем оффлайн страницу, если есть
    const cachedResponse = await caches.match('/offline.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first стратегия для API запросов с fallback на кэш
 * Требования: 18.4
 */
async function handleApiRequest(request) {
  try {
    console.log('[SW] API request:', request.url);
    
    // Попытка выполнить запрос к сети
    const networkResponse = await fetch(request);
    
    // Кэшируем успешные GET запросы
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Fallback на кэш для GET запросов
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      
      if (cachedResponse) {
        console.log('[SW] Serving API from cache:', request.url);
        return cachedResponse;
      }
    }
    
    // Для POST запросов (создание тренировок) - сохраняем в очередь
    if (request.method === 'POST' && request.url.includes('/api/workouts')) {
      return handleOfflineWorkoutCreation(request);
    }
    
    return new Response(
      JSON.stringify({ error: 'Нет подключения к сети' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Кэширование справочника упражнений
 * Требования: 18.4
 */
async function handleExercisesRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(EXERCISES_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Exercises network failed, trying cache');
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(
      JSON.stringify({ exercises: [] }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Обработка оффлайн создания тренировок
 * Требования: 19.1
 */
async function handleOfflineWorkoutCreation(request) {
  try {
    // Читаем тело запроса
    const requestData = await request.json();
    
    // Открываем IndexedDB
    const db = await openIndexedDB();
    
    // Сохраняем тренировку в очередь ожидающих синхронизации
    const pendingWorkout = {
      id: generateUUID(),
      data: requestData,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    await addPendingWorkout(db, pendingWorkout);
    
    console.log('[SW] Workout saved to pending queue:', pendingWorkout.id);
    
    // Регистрируем фоновую синхронизацию
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-workouts');
      console.log('[SW] Background sync registered');
    }
    
    // Возвращаем 202 Accepted
    return new Response(
      JSON.stringify({
        message: 'Тренировка сохранена и будет синхронизирована при восстановлении сети',
        id: pendingWorkout.id,
        status: 'pending'
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[SW] Failed to save offline workout:', error);
    
    return new Response(
      JSON.stringify({ error: 'Не удалось сохранить тренировку оффлайн' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Фоновая синхронизация ожидающих тренировок
 * Требования: 19.2-19.5
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event triggered:', event.tag);
  
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncPendingWorkouts());
  }
});

/**
 * Синхронизация всех ожидающих тренировок
 */
async function syncPendingWorkouts() {
  try {
    console.log('[SW] Starting workout synchronization...');
    
    const db = await openIndexedDB();
    const pendingWorkouts = await getPendingWorkouts(db);
    
    if (pendingWorkouts.length === 0) {
      console.log('[SW] No pending workouts to sync');
      return;
    }
    
    console.log(`[SW] Found ${pendingWorkouts.length} pending workouts`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const workout of pendingWorkouts) {
      try {
        // Попытка отправить тренировку на сервер
        const response = await fetch('/api/workouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(workout.data)
        });
        
        if (response.ok) {
          // Успешная синхронизация - удаляем из очереди
          await deletePendingWorkout(db, workout.id);
          successCount++;
          console.log('[SW] Workout synced successfully:', workout.id);
        } else {
          // Ошибка сервера - оставляем в очереди для повторной попытки
          failCount++;
          console.error('[SW] Server error syncing workout:', workout.id, response.status);
        }
        
      } catch (error) {
        // Сетевая ошибка - оставляем в очереди
        failCount++;
        console.error('[SW] Network error syncing workout:', workout.id, error);
      }
    }
    
    console.log(`[SW] Sync completed: ${successCount} success, ${failCount} failed`);
    
    // Уведомляем пользователя о результатах
    if (successCount > 0) {
      await notifyUser(`Синхронизировано тренировок: ${successCount}`);
    }
    
    if (failCount > 0) {
      await notifyUser(`Не удалось синхронизировать: ${failCount}. Попробуем позже.`);
    }
    
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

/**
 * Открытие IndexedDB
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WorkoutTrackerDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Создаем object stores если их нет
      if (!db.objectStoreNames.contains('workouts')) {
        db.createObjectStore('workouts', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('pending-workouts')) {
        db.createObjectStore('pending-workouts', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('exercises')) {
        db.createObjectStore('exercises', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Добавление тренировки в очередь ожидающих синхронизации
 */
function addPendingWorkout(db, workout) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readwrite');
    const store = transaction.objectStore('pending-workouts');
    const request = store.add(workout);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Получение всех ожидающих синхронизации тренировок
 */
function getPendingWorkouts(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readonly');
    const store = transaction.objectStore('pending-workouts');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Удаление тренировки из очереди после успешной синхронизации
 */
function deletePendingWorkout(db, workoutId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readwrite');
    const store = transaction.objectStore('pending-workouts');
    const request = store.delete(workoutId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Отправка уведомления пользователю
 */
async function notifyUser(message) {
  try {
    if ('Notification' in self && Notification.permission === 'granted') {
      await self.registration.showNotification('Workout Tracker', {
        body: message,
        icon: '/workout-tracker/icon-192.png',
        badge: '/workout-tracker/icon-192.png',
        tag: 'sync-notification'
      });
    }
  } catch (error) {
    console.error('[SW] Failed to show notification:', error);
  }
}

/**
 * Генерация UUID для оффлайн тренировок
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

console.log('[SW] Service Worker loaded');
