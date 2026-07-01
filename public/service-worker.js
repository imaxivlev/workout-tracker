/**
 * KILL-SWITCH service worker.
 *
 * Предыдущие версии SW ломали PWA на iOS (белый экран). Эта версия НИЧЕГО не
 * перехватывает — при активации она удаляет все кэши, снимает саму регистрацию
 * и перезагружает открытые окна, возвращая клиентов в рабочее состояние без SW.
 *
 * Существующие сломанные клиенты получают этот файл при штатной проверке
 * обновления SW браузером и самоизлечиваются.
 *
 * Оффлайн-поддержку планируется вернуть отдельным, протестированным на iOS SW.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Удаляем все кэши приложения.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // ignore
      }

      // 2. Снимаем регистрацию самого service worker.
      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }

      // 3. Перезагружаем открытые окна, чтобы они поднялись уже без SW.
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch {
        // ignore
      }
    })()
  );
});

// Никаких fetch-обработчиков: все запросы идут напрямую в сеть.
