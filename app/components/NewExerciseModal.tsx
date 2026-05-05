'use client';

import { useState } from 'react';

export type MeasureUnit = 'reps' | 'meters' | 'calories';

interface NewExerciseModalProps {
  exerciseName: string;
  onConfirm: (settings: { hasWeight: boolean; measureUnit: MeasureUnit }) => void;
  onCancel: () => void;
}

export function NewExerciseModal({ exerciseName, onConfirm, onCancel }: NewExerciseModalProps) {
  const [hasWeight, setHasWeight] = useState(false);
  const [measureUnit, setMeasureUnit] = useState<MeasureUnit>('reps');

  return (
    <div className="nex-overlay" onClick={onCancel}>
      <div className="nex-modal" onClick={e => e.stopPropagation()}>
        <div className="nex-top-bar" />

        <div className="nex-header">
          <div className="nex-badge">НОВОЕ УПРАЖНЕНИЕ</div>
          <div className="nex-exercise-name">«{exerciseName}»</div>
        </div>

        <div className="nex-section">
          <div className="nex-section-label">Тип</div>
          <div className="nex-card-grid nex-grid-2">
            <button
              type="button"
              className={`nex-card nex-card-green${!hasWeight ? ' nex-card-selected' : ''}`}
              onClick={() => setHasWeight(false)}
            >
              <span className="nex-card-icon">🤸</span>
              <span className="nex-card-text">Без веса</span>
              <span className="nex-card-sub">собственный вес</span>
            </button>
            <button
              type="button"
              className={`nex-card nex-card-yellow${hasWeight ? ' nex-card-selected' : ''}`}
              onClick={() => setHasWeight(true)}
            >
              <span className="nex-card-icon">🏋️</span>
              <span className="nex-card-text">С весом</span>
              <span className="nex-card-sub">штанга, гиря, гантель</span>
            </button>
          </div>
        </div>

        <div className="nex-section">
          <div className="nex-section-label">Результат считается в</div>
          <div className="nex-card-grid nex-grid-3">
            <button
              type="button"
              className={`nex-card nex-card-red${measureUnit === 'reps' ? ' nex-card-selected' : ''}`}
              onClick={() => setMeasureUnit('reps')}
            >
              <span className="nex-card-icon">🔢</span>
              <span className="nex-card-text">Повторения</span>
            </button>
            <button
              type="button"
              className={`nex-card nex-card-red${measureUnit === 'meters' ? ' nex-card-selected' : ''}`}
              onClick={() => setMeasureUnit('meters')}
            >
              <span className="nex-card-icon">📏</span>
              <span className="nex-card-text">Метры</span>
            </button>
            <button
              type="button"
              className={`nex-card nex-card-red${measureUnit === 'calories' ? ' nex-card-selected' : ''}`}
              onClick={() => setMeasureUnit('calories')}
            >
              <span className="nex-card-icon">🔥</span>
              <span className="nex-card-text">Калории</span>
            </button>
          </div>
        </div>

        <div className="nex-actions">
          <button type="button" className="nex-btn-cancel" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="nex-btn-confirm" onClick={() => onConfirm({ hasWeight, measureUnit })}>
            Добавить →
          </button>
        </div>
      </div>
    </div>
  );
}
