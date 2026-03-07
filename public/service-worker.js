// Service Worker для CrossFit Tracker PWA
// Версия кэша - обновлять при изменении ресурсов
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Ресурсы для предварительного кэширования
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/workout-tracker/index.html',
  // Добавить другие критичные ресурсы
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static resources');
        return cache.addAll(PRECACHE_URLS);
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
        // Удаление старых кэшей
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('static-') ||
                     cacheName.startsWith('api-') ||
                     cacheName.startsWith('runtime-');
            })
            .filter((cacheName) => {
              return cacheName !== STATIC_CACHE &&
                     cacheName !== API_CACHE &&
                     cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
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

  // Игнорируем запросы к другим доменам
  if (url.origin !== location.origin) {
    return;
  }

  // Стратегия для API запросов: Network-First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Стратегия для статических ресурсов: Cache-First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Стратегия для HTML страниц: Network-First с fallback
  if (request.destination === 'document') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Для остальных запросов: Network-First
  event.respondWith(networkFirstStrategy(request));
});

// Стратегия Cache-First (для статических ресурсов)
async function cacheFirstStrategy(request) {
  try {
    // Проверяем кэш
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Если нет в кэше - загружаем из сети
    const networkResponse = await fetch(request);
    
    // Кэшируем успешные ответы
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-First strategy failed:', error);
    
    // Fallback для изображений
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#ddd" width="200" height="200"/></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    throw error;
  }
}

// Стратегия Network-First (для API и динамического контента)
async function networkFirstStrategy(request) {
  try {
    // Пытаемся загрузить из сети
    const networkResponse = await fetch(request);

    // Кэшируем успешные GET запросы
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(
        request.url.includes('/api/') ? API_CACHE : RUNTIME_CACHE
      );
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network request failed, trying cache:', request.url);

    // Fallback на кэш при отсутствии сети
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Если это API запрос и нет кэша - возвращаем ошибку
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'Нет подключения к интернету',
          offline: true
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    throw error;
  }
}

// Обработка фоновой синхронизации
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event triggered:', event.tag);

  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncPendingWorkouts());
  }
});

// Синхронизация ожидающих тренировок
async function syncPendingWorkouts() {
  try {
    console.log('[SW] Starting workout synchronization...');

    // Открываем IndexedDB
    const db = await openIndexedDB();
    const pendingWorkouts = await getAllPendingWorkouts(db);

    if (pendingWorkouts.length === 0) {
      console.log('[SW] No pending workouts to sync');
      return;
    }

    console.log(`[SW] Found ${pendingWorkouts.length} pending workouts`);

    let synced = 0;
    let failed = 0;

    for (const workout of pendingWorkouts) {
      try {
        // Отправляем тренировку на сервер
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
          
          // Сохраняем синхронизированную тренировку в локальный кэш
          const serverWorkout = await response.json();
          await saveWorkoutToCache(db, serverWorkout);
          
          synced++;
          console.log('[SW] Workout synced successfully:', workout.id);
        } else {
          failed++;
          console.error('[SW] Failed to sync workout:', workout.id, response.status);
        }
      } catch (error) {
        failed++;
        console.error('[SW] Error syncing workout:', workout.id, error);
      }
    }

    // Уведомляем пользователя о результатах синхронизации
    if (synced > 0) {
      await showNotification(
        'Синхронизация завершена',
        `Синхронизировано тренировок: ${synced}${failed > 0 ? `, не удалось: ${failed}` : ''}`
      );
    }

    console.log(`[SW] Sync completed: ${synced} synced, ${failed} failed`);
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Открытие IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('workout-tracker', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Создание хранилищ если их нет
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

// Получение всех ожидающих тренировок
function getAllPendingWorkouts(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readonly');
    const store = transaction.objectStore('pending-workouts');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Удаление ожидающей тренировки
function deletePendingWorkout(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-workouts'], 'readwrite');
    const store = transaction.objectStore('pending-workouts');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Сохранение тренировки в локальный кэш
function saveWorkoutToCache(db, workout) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['workouts'], 'readwrite');
    const store = transaction.objectStore('workouts');
    const request = store.put(workout);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Показ уведомления
async function showNotification(title, body) {
  try {
    const registration = await self.registration;
    await registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'sync-notification',
      requireInteraction: false
    });
  } catch (error) {
    console.error('[SW] Failed to show notification:', error);
  }
}

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SYNC_NOW') {
    syncPendingWorkouts();
  }
});

console.log('[SW] Service Worker loaded');
