'use client';

import { useEffect, useState, useCallback } from 'react';
import { workoutsApi, WorkoutsResponse, ApiError } from '@/lib/api/client';
import { WorkoutCard } from '@/app/components/WorkoutCard';

export default function WorkoutsPage() {
  const [data, setData] = useState<WorkoutsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkouts = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const result = await workoutsApi.getAll({ page: p, limit: 10 });
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ошибка загрузки тренировок');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkouts(page);
  }, [page, loadWorkouts]);

  async function handleDelete(id: string) {
    if (!confirm('Удалить тренировку?')) return;
    try {
      await workoutsApi.delete(id);
      loadWorkouts(page);
    } catch {
      alert('Ошибка при удалении');
    }
  }

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Тренировки</h1>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!loading && !error && data && (
        <>
          {data.workouts.length === 0 ? (
            <div className="empty-state">
              <p>Нет тренировок. Добавьте первую!</p>
            </div>
          ) : (
            <div className="workout-list">
              {data.workouts.map(workout => (
                <WorkoutCard key={workout.id} workout={workout} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination-container" style={{ display: 'flex', marginTop: '2rem' }}>
              <button
                className="pagination-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ←
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`pagination-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                className="pagination-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
