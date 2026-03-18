'use client';

import Link from 'next/link';
import { Workout } from '@/lib/api/client';
import { enToRuName } from '@/lib/exercise-names';

interface WorkoutCardProps {
  workout: Workout;
  onDelete?: (id: string) => void;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${day} ${months[date.getMonth()]}`;
}

export function WorkoutCard({ workout, onDelete }: WorkoutCardProps) {
  const dateStr = formatShortDate(workout.date);

  return (
    <div className="workout-card">
      <Link href={`/dashboard/workouts/${workout.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="workout-header">
          <div className="workout-date">{dateStr}</div>
        </div>

        <div className="workout-blocks">
          {workout.skillBlocks.map(block => {
            const maxWeight = Math.max(...block.sets.map(s => s.weight));
            return (
              <div key={block.id} className="workout-block skill">
                <div className="block-title">🏋️ Skill: {enToRuName(block.exercise.name)}</div>
                <div className="workout-details">
                  <span className="detail-item">{block.sets.length} подходов</span>
                  {maxWeight > 0 && (
                    <span className="detail-item">Max: {maxWeight} кг</span>
                  )}
                </div>
              </div>
            );
          })}

          {workout.wodBlocks.map(block => (
            <div key={block.id} className="workout-block wod">
              <div className="block-title">⚡ WOD: {block.wodType}</div>
              <div className="workout-footer">
                <span className="result-time">⏱ {block.resultDisplay} ({block.level})</span>
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
