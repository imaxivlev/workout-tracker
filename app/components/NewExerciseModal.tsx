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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
        <h3 style={{ marginBottom: '0.25rem' }}>Новое упражнение</h3>
        <p style={{ color: 'var(--color-secondary)', fontWeight: 600, marginBottom: '1.25rem', fontSize: '0.95rem' }}>
          «{exerciseName}»
        </p>

        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Тип:</p>
          <label className="new-exercise-radio">
            <input type="radio" name="hasWeight" checked={!hasWeight} onChange={() => setHasWeight(false)} />
            <span>Без веса (собственный вес)</span>
          </label>
          <label className="new-exercise-radio">
            <input type="radio" name="hasWeight" checked={hasWeight} onChange={() => setHasWeight(true)} />
            <span>С весом (штанга, гиря, гантель)</span>
          </label>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Результат считается в:</p>
          <label className="new-exercise-radio">
            <input type="radio" name="measureUnit" checked={measureUnit === 'reps'} onChange={() => setMeasureUnit('reps')} />
            <span>Повторениях</span>
          </label>
          <label className="new-exercise-radio">
            <input type="radio" name="measureUnit" checked={measureUnit === 'meters'} onChange={() => setMeasureUnit('meters')} />
            <span>Метрах</span>
          </label>
          <label className="new-exercise-radio">
            <input type="radio" name="measureUnit" checked={measureUnit === 'calories'} onChange={() => setMeasureUnit('calories')} />
            <span>Калориях</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>Отмена</button>
          <button type="button" className="btn-primary" onClick={() => onConfirm({ hasWeight, measureUnit })}>Добавить</button>
        </div>
      </div>
    </div>
  );
}
