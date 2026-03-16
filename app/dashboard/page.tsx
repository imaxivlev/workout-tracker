'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { statisticsApi, DashboardStats, ApiError } from '@/lib/api/client';
import { WorkoutCard } from '@/app/components/WorkoutCard';
import { MigrationModal } from '@/app/components/MigrationModal';

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${day} ${months[date.getMonth()]}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    statisticsApi.getDashboard()
      .then(data => {
        setStats(data);
      })
      .catch(err => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Ошибка загрузки данных');
        }
      })
      .finally(() => setLoading(false));

    // Проверяем наличие данных в localStorage для миграции
    try {
      const stored = localStorage.getItem('workouts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setShowMigration(true);
        }
      }
    } catch {
      // Игнорируем ошибки localStorage
    }
  }, []);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="form-error">{error}</div>
      </div>
    );
  }

  const bestWeightValue = stats?.bestWeight?.weight ?? 0;

  return (
    <div className="container">
      {showMigration && (
        <MigrationModal onClose={() => setShowMigration(false)} />
      )}

      <div className="page-header">
        <h1 className="page-title">Мои тренировки</h1>
        <Link href="/dashboard/workouts/new" className="btn btn-primary">
          <span className="btn-icon">➕</span>
          Новая тренировка
        </Link>
      </div>

      {/* Метрики */}
      <div className="quick-stats">
        <div className="stat-mini">
          <div className="stat-mini-value">{stats?.workoutsThisMonth ?? 0}</div>
          <div className="stat-mini-label">Тренировок<br />в этом месяце</div>
        </div>
        <div className="stat-mini best-weight-card">
          <div className="stat-mini-value">{bestWeightValue} кг</div>
          {stats?.bestWeight && (
            <>
              <div className="best-weight-exercise">{stats.bestWeight.exerciseName}</div>
              <div className="best-weight-date">{formatShortDate(stats.bestWeight.date)}</div>
            </>
          )}
          <div className="stat-mini-label">Лучший вес</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-value">🔥 {stats?.streak.days ?? 0}</div>
          <div className="stat-mini-label">
            Тренировочных дней<br />подряд
            {(stats?.streak.weeks ?? 0) > 0 && (
              <span style={{ display: 'block', fontSize: '0.75rem' }}>
                {stats!.streak.weeks} нед.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Последние тренировки */}
      <div className="workouts-section">
        <div className="section-header">
          <h2 className="section-title">Последние тренировки</h2>
          <Link href="/dashboard/workouts" className="link-all">
            Все →
          </Link>
        </div>

        {stats?.recentWorkouts.length === 0 ? (
          <div className="empty-state">
            <p>Нет тренировок. Добавьте первую!</p>
            <Link href="/dashboard/workouts/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              + Добавить тренировку
            </Link>
          </div>
        ) : (
          <div className="workout-list">
            {stats?.recentWorkouts.map(workout => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
