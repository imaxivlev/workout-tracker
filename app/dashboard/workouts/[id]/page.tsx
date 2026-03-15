'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { workoutsApi, Workout, ApiError } from '@/lib/api/client';

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
    return <div className="container"><div className="loading-state"><div className="spinner" /></div></div>;
  }

  if (error || !workout) {
    return (
      <div className="container">
        <div className="form-error">{error || 'Тренировка не найдена'}</div>
        <Link href="/dashboard/workouts" className="btn btn-outline" style={{ marginTop: '1rem' }}>
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
          <Link href="/dashboard/workouts" className="back-link">← Назад</Link>
          <h1 className="page-title">{date}</h1>
        </div>
        <button onClick={handleDelete} className="btn btn-danger">
          Удалить
        </button>
      </div>

      {workout.comment && (
        <p className="workout-comment" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          {workout.comment}
        </p>
      )}

      {workout.skillBlocks.map(block => (
        <div key={block.id} className="detail-block">
          <div className="detail-block-header">
            <span className="workout-type skill">Skill</span>
            <Link href={`/dashboard/exercise/${block.exercise.id}`} className="exercise-link">
              🏋️ {block.exercise.name}
            </Link>
          </div>
          <table className="sets-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Повторений</th>
                <th>Вес (кг)</th>
                <th>1RM (est.)</th>
              </tr>
            </thead>
            <tbody>
              {block.sets.map((set, i) => {
                const orm = set.reps === 1 ? set.weight : Math.round(set.weight * (1 + set.reps / 30) * 2) / 2;
                return (
                  <tr key={set.id}>
                    <td>{i + 1}</td>
                    <td>{set.reps}</td>
                    <td>{set.weight}</td>
                    <td>{orm}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {workout.wodBlocks.map(block => (
        <div key={block.id} className="detail-block">
          <div className="detail-block-header">
            <span className="workout-type wod">WOD</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {block.wodType} · {block.level}
              {block.isLadder && ' · Лесенка'}
            </span>
          </div>
          <div className="wod-result">
            <span>Результат: </span>
            <strong>{block.resultDisplay}</strong>
          </div>
          {block.timeCapSeconds && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Тайм-кап: {Math.floor(block.timeCapSeconds / 60)} мин
            </div>
          )}
          <div className="wod-exercises">
            {block.exercises.map(ex => (
              <div key={ex.id} className="wod-exercise-item">
                <span>{ex.reps}× </span>
                <Link href={`/dashboard/exercise/${ex.exercise.id}`} className="exercise-link">
                  {ex.exercise.name}
                </Link>
                {ex.weight && <span> @ {ex.weight} кг</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
