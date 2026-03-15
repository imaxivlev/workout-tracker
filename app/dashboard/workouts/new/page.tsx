'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { workoutsApi, exercisesApi, Exercise, ApiError, WorkoutInput } from '@/lib/api/client';
import { ExerciseAutocomplete } from '@/app/components/ExerciseAutocomplete';

type WodType = 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA';
type WodLevel = 'RX' | 'SCALED';

interface SkillSetForm { reps: string; weight: string; }
interface SkillBlockForm { exerciseName: string; sets: SkillSetForm[]; }

interface WodExerciseForm { exerciseName: string; reps: string; weight: string; }
interface WodBlockForm {
  wodType: WodType;
  level: WodLevel;
  timeCapSeconds: string;
  isLadder: boolean;
  resultDisplay: string;
  resultSeconds: string;
  resultTotalReps: string;
  exercises: WodExerciseForm[];
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('');
  const [skillBlocks, setSkillBlocks] = useState<SkillBlockForm[]>([]);
  const [wodBlocks, setWodBlocks] = useState<WodBlockForm[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Skill блоки ---
  function addSkillBlock() {
    setSkillBlocks(prev => [...prev, {
      exerciseName: '',
      sets: [{ reps: '', weight: '' }],
    }]);
  }

  function updateSkillBlock(idx: number, field: keyof SkillBlockForm, value: string) {
    setSkillBlocks(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }

  function addSkillSet(blockIdx: number) {
    setSkillBlocks(prev => prev.map((b, i) =>
      i === blockIdx ? { ...b, sets: [...b.sets, { reps: '', weight: '' }] } : b
    ));
  }

  function removeSkillSet(blockIdx: number, setIdx: number) {
    setSkillBlocks(prev => prev.map((b, i) =>
      i === blockIdx ? { ...b, sets: b.sets.filter((_, j) => j !== setIdx) } : b
    ));
  }

  function updateSkillSet(blockIdx: number, setIdx: number, field: keyof SkillSetForm, value: string) {
    setSkillBlocks(prev => prev.map((b, i) =>
      i === blockIdx
        ? { ...b, sets: b.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s) }
        : b
    ));
  }

  function removeSkillBlock(idx: number) {
    setSkillBlocks(prev => prev.filter((_, i) => i !== idx));
  }

  // --- WOD блоки ---
  function addWodBlock() {
    setWodBlocks(prev => [...prev, {
      wodType: 'FOR_TIME',
      level: 'RX',
      timeCapSeconds: '',
      isLadder: false,
      resultDisplay: '',
      resultSeconds: '',
      resultTotalReps: '',
      exercises: [{ exerciseName: '', reps: '', weight: '' }],
    }]);
  }

  function updateWodBlock(idx: number, updates: Partial<WodBlockForm>) {
    setWodBlocks(prev => prev.map((b, i) => i === idx ? { ...b, ...updates } : b));
  }

  function addWodExercise(blockIdx: number) {
    setWodBlocks(prev => prev.map((b, i) =>
      i === blockIdx ? { ...b, exercises: [...b.exercises, { exerciseName: '', reps: '', weight: '' }] } : b
    ));
  }

  function updateWodExercise(blockIdx: number, exIdx: number, field: keyof WodExerciseForm, value: string) {
    setWodBlocks(prev => prev.map((b, i) =>
      i === blockIdx
        ? { ...b, exercises: b.exercises.map((e, j) => j === exIdx ? { ...e, [field]: value } : e) }
        : b
    ));
  }

  function removeWodExercise(blockIdx: number, exIdx: number) {
    setWodBlocks(prev => prev.map((b, i) =>
      i === blockIdx ? { ...b, exercises: b.exercises.filter((_, j) => j !== exIdx) } : b
    ));
  }

  function removeWodBlock(idx: number) {
    setWodBlocks(prev => prev.filter((_, i) => i !== idx));
  }

  // --- Отправка формы ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (skillBlocks.length === 0 && wodBlocks.length === 0) {
      setError('Добавьте хотя бы один блок (Skill или WOD)');
      return;
    }

    setLoading(true);

    try {
      const payload: WorkoutInput = {
        date,
        comment: comment.trim() || undefined,
        skillBlocks: skillBlocks.length > 0
          ? skillBlocks.map(b => ({
              exerciseName: b.exerciseName,
              sets: b.sets.map(s => ({
                reps: parseInt(s.reps),
                weight: parseFloat(s.weight),
              })),
            }))
          : undefined,
        wodBlocks: wodBlocks.length > 0
          ? wodBlocks.map(b => ({
              wodType: b.wodType,
              level: b.level,
              timeCapSeconds: b.timeCapSeconds ? parseInt(b.timeCapSeconds) * 60 : undefined,
              isLadder: b.isLadder,
              resultType: b.wodType === 'FOR_TIME' ? 'TIME' : b.wodType === 'AMRAP' ? 'REPS' : 'TIME',
              resultDisplay: b.resultDisplay,
              resultSeconds: b.wodType === 'FOR_TIME' && b.resultSeconds ? parseInt(b.resultSeconds) : undefined,
              resultTotalReps: b.wodType === 'AMRAP' && b.resultTotalReps ? parseInt(b.resultTotalReps) : undefined,
              exercises: b.exercises.map(ex => ({
                exerciseName: ex.exerciseName,
                reps: parseInt(ex.reps),
                weight: ex.weight ? parseFloat(ex.weight) : undefined,
              })),
            }))
          : undefined,
      };

      await workoutsApi.create(payload);
      router.push('/dashboard/workouts');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.length) {
          setError(err.details.map(d => d.message).join('; '));
        } else {
          setError(err.message);
        }
      } else {
        setError('Ошибка при сохранении');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Новая тренировка</h1>
      </div>

      <form onSubmit={handleSubmit} className="workout-form">
        {/* Дата и комментарий */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Дата</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="form-input"
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Комментарий</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="form-input"
            placeholder="Заметки к тренировке..."
            rows={2}
            maxLength={500}
          />
        </div>

        {/* Skill блоки */}
        {skillBlocks.map((block, bi) => (
          <div key={bi} className="block-card block-skill">
            <div className="block-card-header">
              <span className="workout-type skill">Skill #{bi + 1}</span>
              <button type="button" onClick={() => removeSkillBlock(bi)} className="btn-remove">✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Упражнение</label>
              <ExerciseAutocomplete
                value={block.exerciseName}
                onChange={v => updateSkillBlock(bi, 'exerciseName', v)}
                placeholder="Приседания, жим лёжа..."
              />
            </div>

            <div className="sets-list">
              {block.sets.map((set, si) => (
                <div key={si} className="set-row">
                  <span className="set-num">{si + 1}</span>
                  <input
                    type="number"
                    value={set.reps}
                    onChange={e => updateSkillSet(bi, si, 'reps', e.target.value)}
                    className="form-input set-input"
                    placeholder="Повт."
                    min="1"
                    required
                  />
                  <input
                    type="number"
                    value={set.weight}
                    onChange={e => updateSkillSet(bi, si, 'weight', e.target.value)}
                    className="form-input set-input"
                    placeholder="Кг"
                    min="0.5"
                    step="0.5"
                    required
                  />
                  {block.sets.length > 1 && (
                    <button type="button" onClick={() => removeSkillSet(bi, si)} className="btn-remove">✕</button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" onClick={() => addSkillSet(bi)} className="btn btn-outline btn-sm">
              + Подход
            </button>
          </div>
        ))}

        {/* WOD блоки */}
        {wodBlocks.map((block, bi) => (
          <div key={bi} className="block-card block-wod">
            <div className="block-card-header">
              <span className="workout-type wod">WOD #{bi + 1}</span>
              <button type="button" onClick={() => removeWodBlock(bi)} className="btn-remove">✕</button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Тип</label>
                <select
                  value={block.wodType}
                  onChange={e => updateWodBlock(bi, { wodType: e.target.value as WodType })}
                  className="form-input"
                >
                  <option value="FOR_TIME">FOR TIME</option>
                  <option value="AMRAP">AMRAP</option>
                  <option value="EMOM">EMOM</option>
                  <option value="TABATA">TABATA</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Уровень</label>
                <select
                  value={block.level}
                  onChange={e => updateWodBlock(bi, { level: e.target.value as WodLevel })}
                  className="form-input"
                >
                  <option value="RX">RX</option>
                  <option value="SCALED">Scaled</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Тайм-кап (мин)</label>
                <input
                  type="number"
                  value={block.timeCapSeconds}
                  onChange={e => updateWodBlock(bi, { timeCapSeconds: e.target.value })}
                  className="form-input"
                  placeholder="20"
                  min="1"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Результат (отображение)</label>
                <input
                  type="text"
                  value={block.resultDisplay}
                  onChange={e => updateWodBlock(bi, { resultDisplay: e.target.value })}
                  className="form-input"
                  placeholder={block.wodType === 'FOR_TIME' ? '12:34' : block.wodType === 'AMRAP' ? '150 повт.' : ''}
                  required
                />
              </div>

              {block.wodType === 'FOR_TIME' && (
                <div className="form-group">
                  <label className="form-label">Время (сек)</label>
                  <input
                    type="number"
                    value={block.resultSeconds}
                    onChange={e => updateWodBlock(bi, { resultSeconds: e.target.value })}
                    className="form-input"
                    placeholder="754"
                    min="0"
                    required
                  />
                </div>
              )}

              {block.wodType === 'AMRAP' && (
                <div className="form-group">
                  <label className="form-label">Всего повторений</label>
                  <input
                    type="number"
                    value={block.resultTotalReps}
                    onChange={e => updateWodBlock(bi, { resultTotalReps: e.target.value })}
                    className="form-input"
                    placeholder="150"
                    min="0"
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={block.isLadder}
                  onChange={e => updateWodBlock(bi, { isLadder: e.target.checked })}
                />
                {' '}Лесенка (Ladder)
              </label>
            </div>

            {/* Упражнения WOD */}
            <div className="wod-exercises-builder">
              <label className="form-label">Упражнения</label>
              {block.exercises.map((ex, ei) => (
                <div key={ei} className="wod-exercise-row">
                  <input
                    type="number"
                    value={ex.reps}
                    onChange={e => updateWodExercise(bi, ei, 'reps', e.target.value)}
                    className="form-input"
                    placeholder="Повт."
                    style={{ width: '80px' }}
                    min="1"
                    required
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>×</span>
                  <ExerciseAutocomplete
                    value={ex.exerciseName}
                    onChange={v => updateWodExercise(bi, ei, 'exerciseName', v)}
                    placeholder="Бёрпи, box jump..."
                  />
                  <input
                    type="number"
                    value={ex.weight}
                    onChange={e => updateWodExercise(bi, ei, 'weight', e.target.value)}
                    className="form-input"
                    placeholder="Кг (опц.)"
                    style={{ width: '100px' }}
                    min="0.5"
                    step="0.5"
                  />
                  {block.exercises.length > 1 && (
                    <button type="button" onClick={() => removeWodExercise(bi, ei)} className="btn-remove">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => addWodExercise(bi)} className="btn btn-outline btn-sm">
                + Упражнение
              </button>
            </div>
          </div>
        ))}

        {/* Кнопки добавления блоков */}
        <div className="add-blocks-row">
          <button type="button" onClick={addSkillBlock} className="btn btn-outline">
            + Skill блок
          </button>
          <button type="button" onClick={addWodBlock} className="btn btn-outline">
            + WOD блок
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить тренировку'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-outline"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
