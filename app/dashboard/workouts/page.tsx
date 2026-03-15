'use client';

import { useEffect, useState, useCallback } from 'react';
import { workoutsApi, WorkoutsResponse, ApiError } from '@/lib/api/client';
import { WorkoutCard } from '@/app/components/WorkoutCard';

type TypeFilter = 'all' | 'skill' | 'wod';

export default function WorkoutsPage() {
  const [data, setData] = useState<WorkoutsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const loadWorkouts = useCallback(async (p: number, start: string, end: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await workoutsApi.getAll({
        page: p,
        limit: 10,
        startDate: start || undefined,
        endDate: end || undefined,
      });
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
    loadWorkouts(page, startDate, endDate);
  }, [page, loadWorkouts, startDate, endDate]);

  async function handleDelete(id: string) {
    if (!confirm('Удалить тренировку?')) return;
    try {
      await workoutsApi.delete(id);
      loadWorkouts(page, startDate, endDate);
    } catch {
      alert('Ошибка при удалении');
    }
  }

  function handleDateApply() {
    setPage(1);
    loadWorkouts(1, startDate, endDate);
  }

  function handleDateReset() {
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  const totalPages = data?.pagination.totalPages ?? 1;

  // Фильтрация по типу на клиенте (Skill/WOD/Все)
  const filteredWorkouts = (data?.workouts ?? []).filter(w => {
    if (typeFilter === 'skill') return w.skillBlocks.length > 0;
    if (typeFilter === 'wod') return w.wodBlocks.length > 0;
    return true;
  });

  return (
    <div className="container">
      <h1 className="page-title">История тренировок</h1>

      {/* Фильтры */}
      <div className="filters-section">
        <div className="date-range-inputs">
          <div className="date-input-group">
            <label>От</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>
          <div className="date-input-group">
            <label>До</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleDateApply}>
            Применить
          </button>
          {(startDate || endDate) && (
            <button className="btn btn-secondary btn-sm" onClick={handleDateReset}>
              Сбросить
            </button>
          )}
        </div>

        <div className="period-selector">
          <button
            className={`period-btn${typeFilter === 'all' ? ' active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            Все
          </button>
          <button
            className={`period-btn${typeFilter === 'skill' ? ' active' : ''}`}
            onClick={() => setTypeFilter('skill')}
          >
            Skill
          </button>
          <button
            className={`period-btn${typeFilter === 'wod' ? ' active' : ''}`}
            onClick={() => setTypeFilter('wod')}
          >
            WOD
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!loading && !error && (
        <>
          {filteredWorkouts.length === 0 ? (
            <div className="empty-state">
              <p>{data?.workouts.length === 0 ? 'Нет тренировок. Добавьте первую!' : 'Нет тренировок по выбранному фильтру.'}</p>
            </div>
          ) : (
            <div className="workout-list">
              {filteredWorkouts.map(workout => (
                <WorkoutCard key={workout.id} workout={workout} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination-container" style={{ marginTop: '2rem' }}>
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
                  className={`pagination-btn${p === page ? ' active' : ''}`}
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
