'use client';

import { useEffect } from 'react';

/**
 * Регистрация Service Worker.
 *
 * При появлении новой версии SW отправляет ей SKIP_WAITING и один раз
 * перезагружает страницу (без блокирующего confirm и без циклов перезагрузки).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let refreshing = false;

    // Когда новый SW взял управление — перезагружаем страницу один раз.
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');

        // Если новая версия уже ждёт активации — применяем сразу.
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // Новая версия установлена при уже активном контроллере → обновляем.
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Периодически проверяем обновления (раз в час).
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      } catch (error) {
        console.error('[SW] Ошибка регистрации Service Worker:', error);
      }
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
