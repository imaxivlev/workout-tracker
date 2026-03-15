'use client';

import Link from 'next/link';
import { Workout } from '@/lib/api/client';

interface WorkoutCardProps {
  workout: Workout;
  onDelete?: (id: string) => void;
}

export function WorkoutCard({ workout, onDelete }: WorkoutCardProps) {
  const date = new Date(workout.date);
  const dateStr = date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="workout-card">
      <Link href={`/dashboard/workouts/${workout.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="workout-header">
          <span className="workout-date">{dateStr}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {workout.skillBlocks.length > 0 && (
              <span className="workout-type skill">Skill</span>
            )}
            {workout.wodBlocks.length > 0 && (
              <span className="workout-type wod">WOD</span>
            )}
          </div>
        </div>

        <div className="workout-blocks">
          {workout.skillBlocks.map(block => {
            const maxWeight = Math.max(...block.sets.map(s => s.weight));
            return (
              <div key={block.id} className="workout-block skill">
                <div className="block-title">🏋️ {block.exercise.name}</div>
                <div className="workout-details">
                  <span className="detail-item">{block.sets.length} подх.</span>
                  <span className="detail-item">Макс: {maxWeight} кг</span>
                </div>
              </div>
            );
          })}

          {workout.wodBlocks.map(block => (
            <div key={block.id} className="workout-block wod">
              <div className="block-title">⚡ {block.wodType} ({block.level})</div>
              <div className="workout-footer">
                <span className="result-time">⏱ {block.resultDisplay}</span>
              </div>
            </div>
          ))}
        </div>

        {workout.comment && (
          <p className="workout-comment">{workout.comment}</p>
        )}
      </Link>

      {onDelete && (
        <button
          onClick={e => { e.preventDefault(); onDelete(workout.id); }}
          className="btn btn-danger btn-sm"
          style={{ marginTop: '0.75rem' }}
        >
          Удалить
        </button>
      )}
    </div>
  );
}
