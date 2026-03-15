'use client';

import { useState } from 'react';
import { migrationApi, ApiError } from '@/lib/api/client';

interface MigrationModalProps {
  onClose: () => void;
}

export function MigrationModal({ onClose }: MigrationModalProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  async function handleMigrate() {
    setStatus('loading');
    setError('');

    try {
      const raw = localStorage.getItem('workouts');
      const workouts = raw ? JSON.parse(raw) : [];

      const data = await migrationApi.migrate(workouts);
      setResult(data);
      setStatus('done');

      if (data.imported > 0) {
        localStorage.removeItem('workouts');
      }
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ошибка миграции');
      }
    }
  }

  function handleSkip() {
    localStorage.removeItem('workouts');
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2 className="modal-title">Перенос данных</h2>

        {status === 'idle' && (
          <>
            <p className="modal-text">
              Обнаружены тренировки в локальном хранилище браузера.
              Перенести их в ваш аккаунт?
            </p>
            <div className="modal-actions">
              <button onClick={handleMigrate} className="btn btn-primary">
                Перенести
              </button>
              <button onClick={handleSkip} className="btn btn-outline">
                Пропустить
              </button>
            </div>
          </>
        )}

        {status === 'loading' && (
          <div className="modal-status">
            <div className="spinner" />
            <p>Переносим тренировки...</p>
          </div>
        )}

        {status === 'done' && result && (
          <>
            <div className="modal-result">
              <p className="form-success">
                Перенесено: {result.imported} тренировок
              </p>
              {result.failed > 0 && (
                <p className="form-error">
                  Не удалось перенести: {result.failed}
                </p>
              )}
              {result.errors.length > 0 && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Подробности ошибок
                  </summary>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', fontSize: '0.8rem' }}>
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
            </div>
            <button onClick={onClose} className="btn btn-primary btn-full" style={{ marginTop: '1rem' }}>
              Готово
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="form-error">{error}</p>
            <div className="modal-actions">
              <button onClick={handleMigrate} className="btn btn-primary">
                Повторить
              </button>
              <button onClick={onClose} className="btn btn-outline">
                Закрыть
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
