/**
 * Хук для создания тренировок с поддержкой оффлайн режима
 * Автоматически определяет доступность сети и сохраняет в очередь при необходимости
 */

import { useState, useEffect, useCallback } from 'react';
import { addPendingWorkout, getPendingWorkouts } from '@/lib/db/indexeddb';

interface CreateWorkoutData {
  date: string;
  comment?: string;
  skillBlocks?: any[];
  wodBlocks?: any[];
}

interface UseOfflineWorkoutResult {
  createWorkout: (data: CreateWorkoutData) => Promise<{
    success: boolean;
    offline: boolean;
    workoutId?: string;
    error?: string;
  }>;
  isOnline: boolean;
  pendingCount: number;
  syncPending: () => Promise<void>;
}

export function useOfflineWorkout(): UseOfflineWorkoutResult {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Отслеживание статуса сети
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      console.log('[Offline] Network status changed:', navigator.onLine);
    };

    // Начальная проверка
    updateOnlineStatus();

    // Подписка на события
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Обновление счетчика ожидающих тренировок
  const updatePendingCount = useCallback(async () => {
    try {
      const pending = await getPendingWorkouts();
      setPendingCount(pending.length);
    } catch (error) {
      console.error('[Offline] Failed to get pending count:', error);
    }
  }, []);

  // Обновляем счетчик при монтировании и изменении статуса сети
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount, isOnline]);

  // Создание тренировки (онлайн или оффлайн)
  const createWorkout = useCallback(async (data: CreateWorkoutData) => {
    try {
      // Попытка отправить на сервер
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const workout = await response.json();
        console.log('[Offline] Workout created online:', workout.id);
        
        return {
          success: true,
          offline: false,
          workoutId: workout.id,
        };
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.log('[Offline] Network error, saving to queue:', error);

      // Сохраняем в очередь для последующей синхронизации
      try {
        const pendingId = await addPendingWorkout(data);
        await updatePendingCount();

        // Регистрируем фоновую синхронизацию
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-workouts');
          console.log('[Offline] Background sync registered');
        }

        return {
          success: true,
          offline: true,
          workoutId: pendingId,
        };
      } catch (dbError) {
        console.error('[Offline] Failed to save to queue:', dbError);
        
        return {
          success: false,
          offline: true,
          error: 'Не удалось сохранить тренировку для синхронизации',
        };
      }
    }
  }, [updatePendingCount]);

  // Ручная синхронизация ожидающих тренировок
  const syncPending = useCallback(async () => {
    if (!isOnline) {
      console.log('[Offline] Cannot sync: offline');
      return;
    }

    try {
      const pending = await getPendingWorkouts();
      
      if (pending.length === 0) {
        console.log('[Offline] No pending workouts to sync');
        return;
      }

      console.log(`[Offline] Syncing ${pending.length} pending workouts...`);

      // Отправляем сообщение Service Worker для синхронизации
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: 'SYNC_NOW' });
      }

      // Обновляем счетчик после небольшой задержки
      setTimeout(updatePendingCount, 2000);
    } catch (error) {
      console.error('[Offline] Sync failed:', error);
    }
  }, [isOnline, updatePendingCount]);

  return {
    createWorkout,
    isOnline,
    pendingCount,
    syncPending,
  };
}
