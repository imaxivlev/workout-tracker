'use client';

import { useEffect } from 'react';

/**
 * Компонент для регистрации Service Worker
 * Автоматически регистрирует SW при монтировании приложения
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Проверяем поддержку Service Worker браузером
    if ('serviceWorker' in navigator) {
      // Регистрируем Service Worker после загрузки страницы
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            console.log('[SW] Service Worker зарегистрирован:', registration.scope);

            // Проверяем обновления каждый час
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000);

            // Обработка обновлений Service Worker
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Новая версия доступна
                    console.log('[SW] Новая версия Service Worker доступна');
                    
                    // Можно показать уведомление пользователю
                    if (confirm('Доступна новая версия приложения. Обновить?')) {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('[SW] Ошибка регистрации Service Worker:', error);
          });

        // Обработка события контроллера (когда новый SW активируется)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW] Service Worker обновлен');
        });
      });

      // Регистрация фоновой синхронизации
      if ('sync' in ServiceWorkerRegistration.prototype) {
        console.log('[SW] Background Sync поддерживается');
      } else {
        console.warn('[SW] Background Sync не поддерживается');
      }

      // Проверка поддержки уведомлений
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          // Можно запросить разрешение позже при необходимости
          console.log('[SW] Уведомления доступны, разрешение не запрошено');
        }
      }
    } else {
      console.warn('[SW] Service Worker не поддерживается браузером');
    }
  }, []);

  return null; // Компонент не рендерит ничего
}
