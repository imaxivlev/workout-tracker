'use client';

import { useEffect, useState, useCallback } from 'react';
import { workoutsApi, WorkoutsResponse, ApiError } from '@/lib/api/client';
import { WorkoutCard } from '@/app/components/WorkoutCard';
import { CustomDatePicker } from '@/app/components/CustomDatePicker';

type TypeFilter = 'all' | 'skill' | 'wod';

function buildPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | '...')[] = [];
  const add = (n: number) => {
    if (!pages.includes(n)) pages.push(n);
  };

  add(1);
  if (current - 1 > 2) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    add(p);
  }
  if (current + 1 < total - 1) pages.push('...');
  add(total);

  return pages;
}

export default function WorkoutsPage() {
  const [data, setData] = useState<WorkoutsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [exerciseFilter, setExerciseFilter] = useState('');

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
    // useEffect перезагружает данные при изменении page/startDate/endDate
  }

  function handleDateReset() {
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  function handleDateChange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  const totalPages = data?.pagination.totalPages ?? 1;

  // Client-side filtering
  const filteredWorkouts = (data?.workouts ?? []).filter(w => {
    if (typeFilter === 'skill' && w.skillBlocks.length === 0) return false;
    if (typeFilter === 'wod' && w.wodBlocks.length === 0) return false;
    if (exerciseFilter.trim()) {
      const term = exerciseFilter.trim().toLowerCase();
      const hasSkillMatch = w.skillBlocks.some(b =>
        b.exercise.name.toLowerCase().includes(term)
      );
      const hasWodMatch = w.wodBlocks.some(b =>
        b.exercises.some(e => e.exercise.name.toLowerCase().includes(term))
      );
      if (!hasSkillMatch && !hasWodMatch) return false;
    }
    return true;
  });

  const paginationPages = buildPaginationPages(page, totalPages);

  return (
    <div className="container">
      <h1 className="page-title">История тренировок</h1>

      {/* Фильтры */}
      <div className="filters-section">
        <CustomDatePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          onApply={handleDateApply}
          onReset={handleDateReset}
        />

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

          <input
            type="text"
            className="form-input"
            placeholder="Фильтр по упражнению"
            value={exerciseFilter}
            onChange={e => setExerciseFilter(e.target.value)}
            style={{ maxWidth: '220px' }}
          />
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
              {paginationPages.map((p, i) =>
                p === '...'
                  ? <span key={`ellipsis-${i}`} className="pagination-btn" style={{ cursor: 'default' }}>…</span>
                  : (
                    <button
                      key={p}
                      className={`pagination-btn${p === page ? ' active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
              )}
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
