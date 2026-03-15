'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { statisticsApi, ExerciseStats, ApiError } from '@/lib/api/client';

const PERIODS = [
  { label: '1 мес.', days: 30 },
  { label: '3 мес.', days: 90 },
  { label: '6 мес.', days: 180 },
  { label: 'Год', days: 365 },
];

export default function ExerciseStatsPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<ExerciseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(90);

  useEffect(() => {
    setLoading(true);
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    statisticsApi.getExerciseStats(id, { startDate, endDate })
      .then(data => setStats(data))
      .catch(err => {
        if (err instanceof ApiError) setError(err.message);
        else setError('Ошибка загрузки');
      })
      .finally(() => setLoading(false));
  }, [id, period]);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <Link href="/dashboard" className="back-link">← Главная</Link>
          <h1 className="page-title">Статистика упражнения</h1>
        </div>
      </div>

      <div className="period-selector">
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setPeriod(p.days)}
            className={`period-btn${period === p.days ? ' active' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-state"><div className="spinner" /></div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!loading && !error && stats && (
        <>
          {/* Личные рекорды */}
          <div className="pr-section">
            <h2 className="section-title">Личные рекорды</h2>
            <div className="pr-list">
              {stats.personalRecords.maxWeight !== null && (
                <div className="pr-item">
                  <div className="pr-exercise">
                    <div className="pr-name">Максимальный вес</div>
                  </div>
                  <div className="pr-value">{stats.personalRecords.maxWeight} кг</div>
                </div>
              )}
              {stats.personalRecords.maxReps !== null && (
                <div className="pr-item">
                  <div className="pr-exercise">
                    <div className="pr-name">Максимум повторений</div>
                  </div>
                  <div className="pr-value">{stats.personalRecords.maxReps}</div>
                </div>
              )}
              {stats.personalRecords.best1RM !== null && (
                <div className="pr-item">
                  <div className="pr-exercise">
                    <div className="pr-name">Лучший 1RM (расчётный)</div>
                  </div>
                  <div className="pr-value">{stats.personalRecords.best1RM} кг</div>
                </div>
              )}
              {stats.personalRecords.maxWeight === null &&
               stats.personalRecords.maxReps === null &&
               stats.personalRecords.best1RM === null && (
                <div className="empty-state">Нет данных за выбранный период</div>
              )}
            </div>
          </div>

          {/* История прогресса */}
          {stats.progressHistory.length > 0 && (
            <div className="workouts-section" style={{ marginTop: '2rem' }}>
              <h2 className="section-title">История подходов</h2>
              <table className="sets-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Вес (кг)</th>
                    <th>Повт.</th>
                    <th>Est. 1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.progressHistory.map((entry, i) => (
                    <tr key={i}>
                      <td>
                        {new Date(entry.date).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td>{entry.weight}</td>
                      <td>{entry.reps}</td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                        {entry.estimated1RM}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
