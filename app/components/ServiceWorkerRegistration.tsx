'use client';

import { useEffect } from 'react';

/**
 * Снятие регистрации service worker.
 *
 * Предыдущий SW ломал PWA на iOS (белый экран), поэтому SW временно отключён:
 * при загрузке приложение снимает любые оставшиеся регистрации SW.
 * Сам файл /service-worker.js работает как kill-switch (см. public/service-worker.js).
 *
 * Оффлайн-поддержку планируется вернуть отдельным, протестированным на iOS SW.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {});
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
