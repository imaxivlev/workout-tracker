'use client';

import { useEffect, useState } from 'react';
import { statisticsApi, StatsData, ApiError } from '@/lib/api/client';

type Period = 'week' | 'month' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
  all: 'Всё время',
};

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    statisticsApi.getStats(period)
      .then(d => setData(d))
      .catch(err => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Ошибка загрузки статистики');
        }
      })
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="container">
      <h1 className="page-title">Статистика</h1>

      <div className="period-selector">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            className={`period-btn${period === p ? ' active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Загрузка...</p>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="quick-stats">
            <div className="stat-mini">
              <div className="stat-mini-value">{data.workoutsCount}</div>
              <div className="stat-mini-label">Тренировок</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-value">{data.skillSessions}</div>
              <div className="stat-mini-label">Skill сессий</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-value">{data.wodSessions}</div>
              <div className="stat-mini-label">WOD сессий</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-value">{data.newPRs}</div>
              <div className="stat-mini-label">Новых PR</div>
            </div>
          </div>

          <div className="section-header" style={{ marginTop: '2rem' }}>
            <h2 className="section-title">Личные рекорды</h2>
          </div>

          {data.personalRecords.length === 0 ? (
            <div className="empty-state">
              <p>Нет данных за выбранный период.</p>
            </div>
          ) : (
            <div className="pr-list">
              {data.personalRecords.map((pr, i) => (
                <div key={i} className="pr-item">
                  <span className="pr-name">{pr.exerciseName}</span>
                  <span className="pr-value">{pr.weight} кг × {pr.reps}</span>
                  <span className="pr-date">{new Date(pr.date).toLocaleDateString('ru-RU')}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
