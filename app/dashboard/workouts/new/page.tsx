'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { workoutsApi, ApiError, WorkoutInput } from '@/lib/api/client';
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
    setSkillBlocks(prev => [...prev, { exerciseName: '', sets: [{ reps: '', weight: '' }] }]);
  }

  function removeSkillBlock(idx: number) {
    setSkillBlocks(prev => prev.filter((_, i) => i !== idx));
  }

  function updateSkillExercise(idx: number, value: string) {
    setSkillBlocks(prev => prev.map((b, i) => i === idx ? { ...b, exerciseName: value } : b));
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

  function removeWodBlock(idx: number) {
    setWodBlocks(prev => prev.filter((_, i) => i !== idx));
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
          setError(err.details.map((d: { message: string }) => d.message).join('; '));
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

  const totalBlocks = skillBlocks.length + wodBlocks.length;

  return (
    <div className="container">
      <h1 className="page-title">Новая тренировка</h1>

      <form onSubmit={handleSubmit}>
        {/* Дата */}
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

        {/* Блоки тренировки */}
        <div className="added-blocks-list">
          {totalBlocks === 0 && (
            <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
              Пока пусто. Добавьте блок Skill или WOD.
            </div>
          )}

          {/* Skill блоки */}
          {skillBlocks.map((block, bi) => (
            <div key={`skill-${bi}`} className="added-block skill-block">
              <button type="button" className="remove-block" onClick={() => removeSkillBlock(bi)}>
                ✕
              </button>
              <h3 className="block-title" style={{ color: 'var(--color-secondary)' }}>
                🏋️ Skill
              </h3>

              <div className="form-group">
                <label className="form-label">Упражнение</label>
                <ExerciseAutocomplete
                  value={block.exerciseName}
                  onChange={v => updateSkillExercise(bi, v)}
                  placeholder="Начните вводить или выберите..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Подходы (повторения × вес кг)</label>
                <div className="sets-container">
                  {block.sets.map((set, si) => (
                    <div key={si} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>#{si + 1}</span>
                      <input
                        type="number"
                        value={set.reps}
                        onChange={e => updateSkillSet(bi, si, 'reps', e.target.value)}
                        className="form-input set-input"
                        placeholder="Повт"
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
                        <button
                          type="button"
                          onClick={() => removeSkillSet(bi, si)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.1rem' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => addSkillSet(bi)} className="btn-add">
                + Добавить подход
              </button>
            </div>
          ))}

          {/* WOD блоки */}
          {wodBlocks.map((block, bi) => (
            <div key={`wod-${bi}`} className="added-block wod-block">
              <button type="button" className="remove-block" onClick={() => removeWodBlock(bi)}>
                ✕
              </button>
              <h3 className="block-title" style={{ color: 'var(--color-primary)' }}>
                ⚡ WOD
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Тип</label>
                  <select
                    value={block.wodType}
                    onChange={e => updateWodBlock(bi, { wodType: e.target.value as WodType })}
                    className="form-select"
                  >
                    <option value="FOR_TIME">For Time</option>
                    <option value="AMRAP">AMRAP</option>
                    <option value="EMOM">EMOM</option>
                    <option value="TABATA">Tabata</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Уровень</label>
                  <select
                    value={block.level}
                    onChange={e => updateWodBlock(bi, { level: e.target.value as WodLevel })}
                    className="form-select"
                  >
                    <option value="RX">Rx</option>
                    <option value="SCALED">Scaled</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Огр. времени, мин</label>
                  <input
                    type="number"
                    value={block.timeCapSeconds}
                    onChange={e => updateWodBlock(bi, { timeCapSeconds: e.target.value })}
                    className="form-input"
                    placeholder="20"
                    min="1"
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={block.isLadder}
                      onChange={e => updateWodBlock(bi, { isLadder: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                    Лесенка
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Упражнения</label>
                <div className="wod-exercises-container">
                  {block.exercises.map((ex, ei) => (
                    <div key={ei} className="wod-exercise-row">
                      <div className="wod-row-scroller">
                        <ExerciseAutocomplete
                          value={ex.exerciseName}
                          onChange={v => updateWodExercise(bi, ei, 'exerciseName', v)}
                          placeholder="Упражнение"
                        />
                        <div className="wod-fields-scroll">
                          <div className="single-reps-container" style={{ display: 'flex' }}>
                            <input
                              type="number"
                              value={ex.reps}
                              onChange={e => updateWodExercise(bi, ei, 'reps', e.target.value)}
                              className="form-input-sm"
                              placeholder="Повт."
                              min="1"
                              required
                            />
                          </div>
                          <input
                            type="number"
                            value={ex.weight}
                            onChange={e => updateWodExercise(bi, ei, 'weight', e.target.value)}
                            className="form-input-sm wod-weight"
                            placeholder="Вес, кг"
                            min="0.5"
                            step="0.5"
                          />
                        </div>
                      </div>
                      {block.exercises.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeWodExercise(bi, ei)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addWodExercise(bi)} className="btn-add">
                  + Добавить упражнение
                </button>
              </div>

              <div className="form-group" style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <label className="form-label">Результат</label>
                <div className="form-row" style={{ gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={block.resultDisplay}
                    onChange={e => updateWodBlock(bi, { resultDisplay: e.target.value })}
                    className="form-input"
                    placeholder={block.wodType === 'FOR_TIME' ? '12:34' : block.wodType === 'AMRAP' ? '150 повт.' : 'результат'}
                    required
                  />
                  {block.wodType === 'FOR_TIME' && (
                    <input
                      type="number"
                      value={block.resultSeconds}
                      onChange={e => updateWodBlock(bi, { resultSeconds: e.target.value })}
                      className="form-input"
                      placeholder="Сек (напр. 754)"
                      min="0"
                      required
                    />
                  )}
                  {block.wodType === 'AMRAP' && (
                    <input
                      type="number"
                      value={block.resultTotalReps}
                      onChange={e => updateWodBlock(bi, { resultTotalReps: e.target.value })}
                      className="form-input"
                      placeholder="Всего повторений"
                      min="0"
                      required
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Комментарий */}
        <div className="form-group" style={{ marginTop: '2rem' }}>
          <label className="form-label">Комментарий к тренировке (необязательно)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="form-input"
            rows={3}
            placeholder="Как прошло? Самочувствие, нюансы..."
            maxLength={500}
          />
        </div>

        {/* Кнопки добавления блоков */}
        <div className="builder-actions">
          <button type="button" className="btn-add-block" onClick={addSkillBlock}>
            <span style={{ fontSize: '2rem' }}>🏋️</span>
            Добавить Skill
          </button>
          <button type="button" className="btn-add-block" onClick={addWodBlock}>
            <span style={{ fontSize: '2rem' }}>⚡</span>
            Добавить WOD
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить тренировку'}
          </button>
        </div>
      </form>
    </div>
  );
}
