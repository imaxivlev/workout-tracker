'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { workoutsApi, Workout, ApiError } from '@/lib/api/client';

export default function EditWorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [date, setDate] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    workoutsApi.getById(id)
      .then(data => {
        setWorkout(data.workout);
        setDate(data.workout.date);
        setComment(data.workout.comment || '');
      })
      .catch(err => {
        if (err instanceof ApiError && err.status === 404) {
          setLoadError('Тренировка не найдена');
        } else {
          setLoadError('Ошибка загрузки');
        }
      })
      .finally(() => setLoadingData(false));
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      await workoutsApi.update(id, {
        date,
        comment: comment.trim() || undefined,
      });
      router.push(`/dashboard/workouts/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError('Ошибка при сохранении');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return (
      <div className="container">
        <div className="loading-state"><div className="spinner" /></div>
      </div>
    );
  }

  if (loadError || !workout) {
    return (
      <div className="container">
        <div className="form-error">{loadError || 'Тренировка не найдена'}</div>
        <Link href="/dashboard/workouts" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          ← Назад
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <Link href={`/dashboard/workouts/${id}`} className="back-link">← Назад</Link>
          <h1 className="page-title">Редактировать тренировку</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">Дата тренировки</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="form-input"
            style={{ maxWidth: '220px' }}
            max={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">Комментарий (необязательно)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="form-input"
            rows={3}
            placeholder="Как прошло? Самочувствие, нюансы..."
            maxLength={500}
          />
        </div>

        <div className="form-group" style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            ℹ️ Редактирование блоков в разработке. Здесь можно изменить дату и комментарий.
          </p>
        </div>

        {saveError && <div className="form-error">{saveError}</div>}

        <div className="form-actions">
          <Link href={`/dashboard/workouts/${id}`} className="btn-secondary">
            Отмена
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
