'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { workoutsApi, Workout, ApiError } from '@/lib/api/client';
import { enToRuName } from '@/lib/exercise-names';

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    workoutsApi.getById(id)
      .then(data => setWorkout(data.workout))
      .catch(err => {
        if (err instanceof ApiError && err.status === 404) {
          setError('Тренировка не найдена');
        } else {
          setError('Ошибка загрузки');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm('Удалить тренировку?')) return;
    try {
      await workoutsApi.delete(id);
      router.push('/dashboard/workouts');
    } catch {
      alert('Ошибка при удалении');
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state"><div className="spinner" /></div>
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="container">
        <div className="form-error">{error || 'Тренировка не найдена'}</div>
        <Link href="/dashboard/workouts" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          ← Назад
        </Link>
      </div>
    );
  }

  const date = new Date(workout.date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <button type="button" className="btn-secondary" onClick={() => router.push('/dashboard/workouts')}>← Назад</button>
          <h1 className="page-title">{date}</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/dashboard/workouts/${id}/edit`} className="btn btn-secondary">
            Редактировать
          </Link>
          <button onClick={handleDelete} className="btn-danger">
            Удалить
          </button>
        </div>
      </div>

      {workout.comment && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {workout.comment}
        </p>
      )}

      <div className="details-content">
        {workout.skillBlocks.map(block => {
          const skillDetails = block.sets.map((s, i) => `${s.reps}x${s.weight > 0 ? s.weight + 'кг' : '-'}`).join(', ');
          return (
            <div key={block.id} className="added-block skill-block" style={{ marginBottom: '2rem' }}>
              <h3 className="block-title" style={{ color: 'var(--color-secondary)', marginBottom: '1rem' }}>
                🏋️ Skill: {enToRuName(block.exercise.name)}
              </h3>
              <div className="detail-row" style={{ marginBottom: '0.5rem' }}>
                <strong>Подходы:</strong> {block.sets.length}
              </div>
              <div className="detail-row" style={{ marginBottom: '0.5rem' }}>
                <strong>Детали:</strong> {skillDetails}
              </div>
            </div>
          );
        })}

        {workout.wodBlocks.map(block => {
          const wodDetails = block.exercises.map(ex => {
            const parts = [enToRuName(ex.exercise.name)];
            if (ex.reps) parts.unshift(`${ex.reps}×`);
            if (ex.weight) parts.push(`@ ${ex.weight}кг`);
            return parts.join(' ');
          });
          return (
            <div key={block.id} className="added-block wod-block" style={{ marginBottom: '2rem' }}>
              <h3 className="block-title" style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>
                ⚡ WOD: {block.wodType}{block.isLadder ? ' · Лесенка' : ''}
              </h3>
              <div className="detail-row" style={{ marginBottom: '0.5rem' }}>
                <strong>Тип:</strong> {block.level ? block.level.toUpperCase() : 'RX'}
              </div>
              {block.wodType !== 'EMOM' && block.wodType !== 'TABATA' ? (
              <div className="detail-row" style={{ marginBottom: '0.5rem' }}>
                <strong>Результат:</strong> {block.resultDisplay}
                {block.timeCapSeconds ? ` (тайм-кап: ${Math.floor(block.timeCapSeconds / 60)} мин)` : ''}
              </div>
              ) : block.timeCapSeconds ? (
              <div className="detail-row" style={{ marginBottom: '0.5rem' }}>
                <strong>Время:</strong> {Math.floor(block.timeCapSeconds / 60)} мин
              </div>
              ) : null}
              {wodDetails.length > 0 && (
                <div className="detail-row" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  {wodDetails.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
