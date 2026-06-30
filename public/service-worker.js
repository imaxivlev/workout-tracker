/**
 * Service Worker для Workout Tracker PWA
 *
 * Консервативная стратегия: SW вмешивается ТОЛЬКО в те запросы, которые
 * безопасно кэшировать. Всё остальное (навигация, RSC-пейлоады Next.js,
 * кросс-доменные запросы — Яндекс.Метрика, Involveo и т.п.) пропускается
 * напрямую в сеть, чтобы не ломать гидрацию и не отдавать устаревшие ассеты.
 *
 * - app-shell + content-hashed чанки Next.js → cache-first
 * - GET /api/* → network-first с fallback на кэш
 * - POST /api/workouts офлайн → очередь в IndexedDB + background sync
 *
 * Требования: 18.2-18.4, 19.1-19.5
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `workout-tracker-static-${CACHE_VERSION}`;
const API_CACHE = `workout-tracker-api-${CACHE_VERSION}`;

// Минимальный app-shell. Навигации обрабатывает сеть, поэтому HTML тут не нужен.
const STATIC_ASSETS = [
  '/manifest.json',
  '/workout-tracker/icon-192.png',
  '/workout-tracker/icon-512.png',
];

// Установка: прекэшируем app-shell. НЕ вызываем skipWaiting автоматически —
// активацией новой версии управляет клиент через сообщение SKIP_WAITING.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) => {
        console.error('[SW] Не удалось прекэшировать app-shell:', err);
      })
    )
  );
});

// Активация: удаляем кэши старых версий и берём контроль над клиентами.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith('workout-tracker-') && !name.includes(CACHE_VERSION)
            )
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Сообщение от клиента: применить ожидающую версию SW немедленно.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Маршрутизация fetch-запросов.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Кросс-домен (Яндекс.Метрика, Involveo, внешние шрифты) — не трогаем.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Навигационные запросы — напрямую в сеть.
  //    Иначе iOS Safari в PWA-режиме падает на редиректах.
  if (request.mode === 'navigate') {
    return;
  }

  // 3. RSC-пейлоады клиентской навигации Next.js — только сеть, без кэша,
  //    иначе после деплоя страница не гидрируется (вечный лоадер).
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') {
    return;
  }

  // 4. Внутренние ресурсы Next.js.
  if (url.pathname.startsWith('/_next/')) {
    // Чанки со встроенным хэшем безопасно кэшировать навсегда.
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
    }
    // _next/data, оптимизатор изображений и т.п. — пропускаем в сеть.
    return;
  }

  // 5. API.
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      event.respondWith(networkFirst(request));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/workouts') {
      event.respondWith(handleWorkoutPost(request));
      return;
    }
    // Прочие мутации (PATCH/DELETE/PUT) — напрямую, без перехвата.
    return;
  }

  // 6. Остальная статика того же origin (иконки, svg, manifest) — cache-first.
  if (request.method === 'GET') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

/**
 * Cache-first: отдаём из кэша, иначе сеть + кэшируем успешный ответ.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first для GET /api/*: свежие данные, fallback на кэш при офлайне.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Нет подключения к сети' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/workouts: пробуем сеть, при офлайне ставим в очередь синхронизации.
 */
async function handleWorkoutPost(request) {
  try {
    return await fetch(request.clone());
  } catch (error) {
    return handleOfflineWorkoutCreation(request);
  }
}

/**
 * Сохранение тренировки в очередь IndexedDB для последующей синхронизации.
 * Требования: 19.1
 */
async function handleOfflineWorkoutCreation(request) {
  try {
    const requestData = await request.json();
    const db = await openIndexedDB();

    const pendingWorkout = {
      id: generateUUID(),
      data: requestData,
      timestamp: Date.now(),
      status: 'pending',
    };

    await addPendingWorkout(db, pendingWorkout);

    if ('sync' in self.registration) {
      try {
        await self.registration.sync.register('sync-workouts');
      } catch {
        // Background Sync недоступен — синхронизируем при следующем заходе.
      }
    }

    return new Response(
      JSON.stringify({
        message:
          'Тренировка сохранена и будет синхронизирована при восстановлении сети',
        id: pendingWorkout.id,
        status: 'pending',
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SW] Не удалось сохранить тренировку офлайн:', error);
    return new Response(
      JSON.stringify({ error: 'Не удалось сохранить тренировку оффлайн' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Фоновая синхронизация ожидающих тренировок. Требования: 19.2-19.5
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncPendingWorkouts());
  }
});

async function syncPendingWorkouts() {
  const db = await openIndexedDB();
  const pendingWorkouts = await getPendingWorkouts(db);

  if (pendingWorkouts.length === 0) {
    return;
  }

  let successCount = 0;
  for (const workout of pendingWorkouts) {
    try {
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workout.data),
      });
      if (response.ok) {
        await deletePendingWorkout(db, workout.id);
        successCount++;
      }
      // Ошибка сервера/сети — оставляем в очереди для повторной попытки.
    } catch (error) {
      // Сеть недоступна — прерываем, попробуем при следующем sync.
      break;
    }
  }

  if (successCount > 0) {
    await notifyUser(`Синхронизировано тренировок: ${successCount}`);
  }
}

// --- IndexedDB helpers ---

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WorkoutTrackerDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
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

function addPendingWorkout(db, workout) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pending-workouts'], 'readwrite');
    const request = tx.objectStore('pending-workouts').add(workout);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getPendingWorkouts(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pending-workouts'], 'readonly');
    const request = tx.objectStore('pending-workouts').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deletePendingWorkout(db, workoutId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pending-workouts'], 'readwrite');
    const request = tx.objectStore('pending-workouts').delete(workoutId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function notifyUser(message) {
  try {
    if ('Notification' in self && Notification.permission === 'granted') {
      await self.registration.showNotification('Workout Tracker', {
        body: message,
        icon: '/workout-tracker/icon-192.png',
        badge: '/workout-tracker/icon-192.png',
        tag: 'sync-notification',
      });
    }
  } catch (error) {
    // Уведомления недоступны — не критично.
  }
}

function generateUUID() {
  if (self.crypto && self.crypto.randomUUID) {
    return self.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
