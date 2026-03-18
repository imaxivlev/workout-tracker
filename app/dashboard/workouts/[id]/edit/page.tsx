'use client';

import { useState, FormEvent, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { workoutsApi, exercisesApi, ApiError, WorkoutInput, Workout } from '@/lib/api/client';
import { ExerciseAutocomplete } from '@/app/components/ExerciseAutocomplete';

type WodType = 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA';
type WodLevel = 'RX' | 'SCALED';

interface SkillSetForm { reps: string; weight: string; }
interface SkillBlockForm {
  exerciseName: string;
  sets: SkillSetForm[];
  maxWeight: string;
}

interface WodExerciseForm {
  exerciseName: string;
  reps: string;
  weight: string;
  ladderRepsPerRound: string[];
}
interface WodBlockForm {
  wodType: WodType;
  level: WodLevel;
  timeCapSeconds: string;
  isLadder: boolean;
  ladderRounds: number;
  resultDisplay: string;
  resultSeconds: string;
  resultTotalReps: string;
  exercises: WodExerciseForm[];
}

type BlockItem =
  | { type: 'skill'; data: SkillBlockForm }
  | { type: 'wod'; data: WodBlockForm };

const CARDIO_TERMS = ['bike', 'row', 'run', 'skierg'];
function isCardio(name: string): boolean {
  const lower = name.toLowerCase();
  return CARDIO_TERMS.some(t => lower.includes(t));
}

function parseMmSs(value: string): number {
  const parts = value.split(':');
  if (parts.length === 2) {
    const mm = parseInt(parts[0]) || 0;
    const ss = parseInt(parts[1]) || 0;
    return mm * 60 + ss;
  }
  return parseInt(value) || 0;
}

function SkillHint({ exerciseName }: { exerciseName: string }) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciseName.trim()) {
      setHint(null);
      return;
    }
    exercisesApi.getLastHistory(exerciseName)
      .then(data => {
        if (data.lastWeight && data.lastDate) {
          const dateStr = new Date(data.lastDate).toLocaleDateString('ru-RU');
          setHint(`В прошлый раз: ${data.lastWeight} кг (${dateStr})`);
        } else {
          setHint(null);
        }
      })
      .catch(() => setHint(null));
  }, [exerciseName]);

  if (!hint) return null;
  return (
    <div className="form-hint history-hint" style={{ color: 'var(--color-secondary)' }}>
      ℹ️ {hint}
    </div>
  );
}

function Toast({ message, onHide }: { message: string; onHide: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onHide, 2500);
    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div className="toast-warning">
      {message}
    </div>
  );
}

function workoutToBlocks(workout: Workout): BlockItem[] {
  const blocks: BlockItem[] = [];

  for (const sb of workout.skillBlocks) {
    blocks.push({
      type: 'skill',
      data: {
        exerciseName: sb.exercise.name,
        sets: sb.sets.map(s => ({
          reps: String(s.reps),
          weight: s.weight > 0 ? String(s.weight) : '',
        })),
        maxWeight: '',
      },
    });
  }

  for (const wb of workout.wodBlocks) {
    blocks.push({
      type: 'wod',
      data: {
        wodType: wb.wodType,
        level: wb.level,
        timeCapSeconds: wb.timeCapSeconds ? String(Math.floor(wb.timeCapSeconds / 60)) : '',
        isLadder: wb.isLadder,
        ladderRounds: 5,
        resultDisplay: wb.resultDisplay || '',
        resultSeconds: wb.resultDisplay || '',
        resultTotalReps: wb.resultTotalReps ? String(wb.resultTotalReps) : '',
        exercises: wb.exercises.map(ex => ({
          exerciseName: ex.exercise.name,
          reps: ex.reps ? String(ex.reps) : '',
          weight: ex.weight ? String(ex.weight) : '',
          ladderRepsPerRound: [],
        })),
      },
    });
  }

  return blocks;
}

export default function EditWorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [date, setDate] = useState('');
  const [comment, setComment] = useState('');
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const hideToast = useCallback(() => setToast(''), []);

  useEffect(() => {
    workoutsApi.getById(id)
      .then(data => {
        const w = data.workout;
        setDate(w.date);
        setComment(w.comment || '');
        setBlocks(workoutToBlocks(w));
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

  // --- Добавление блоков ---
  function addSkillBlock() {
    const defaultSets = Array.from({ length: 5 }, () => ({ reps: '', weight: '' }));
    setBlocks(prev => [...prev, { type: 'skill', data: { exerciseName: '', sets: defaultSets, maxWeight: '' } }]);
  }

  function addWodBlock() {
    setBlocks(prev => [...prev, {
      type: 'wod',
      data: {
        wodType: 'FOR_TIME',
        level: 'RX',
        timeCapSeconds: '',
        isLadder: false,
        ladderRounds: 5,
        resultDisplay: '',
        resultSeconds: '',
        resultTotalReps: '',
        exercises: [{ exerciseName: '', reps: '', weight: '', ladderRepsPerRound: [] }],
      },
    }]);
  }

  function removeBlock(idx: number) {
    setBlocks(prev => prev.filter((_, i) => i !== idx));
  }

  // --- Skill helpers ---
  function updateSkillData(idx: number, updater: (b: SkillBlockForm) => SkillBlockForm) {
    setBlocks(prev => prev.map((block, i) => {
      if (i !== idx || block.type !== 'skill') return block;
      return { ...block, data: updater(block.data) };
    }));
  }

  function updateSkillExercise(idx: number, value: string) {
    updateSkillData(idx, b => ({ ...b, exerciseName: value }));
  }

  function updateSkillSetsCount(idx: number, count: number) {
    updateSkillData(idx, b => {
      const current = b.sets;
      if (count > current.length) {
        const extra = Array.from({ length: count - current.length }, () => ({ reps: '', weight: '' }));
        return { ...b, sets: [...current, ...extra] };
      } else {
        return { ...b, sets: current.slice(0, count) };
      }
    });
  }

  function updateSkillSet(idx: number, setIdx: number, field: keyof SkillSetForm, value: string) {
    updateSkillData(idx, b => ({
      ...b,
      sets: b.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s),
    }));
  }

  function updateSkillMaxWeight(idx: number, value: string) {
    updateSkillData(idx, b => ({ ...b, maxWeight: value }));
  }

  // --- WOD helpers ---
  function updateWodData(idx: number, updater: (b: WodBlockForm) => WodBlockForm) {
    setBlocks(prev => prev.map((block, i) => {
      if (i !== idx || block.type !== 'wod') return block;
      return { ...block, data: updater(block.data) };
    }));
  }

  function updateWodBlock(idx: number, updates: Partial<WodBlockForm>) {
    updateWodData(idx, b => ({ ...b, ...updates }));
  }

  function addWodExercise(idx: number) {
    updateWodData(idx, b => ({
      ...b,
      exercises: [...b.exercises, { exerciseName: '', reps: '', weight: '', ladderRepsPerRound: [] }],
    }));
  }

  function updateWodExercise(idx: number, exIdx: number, field: keyof WodExerciseForm, value: string) {
    updateWodData(idx, b => ({
      ...b,
      exercises: b.exercises.map((e, j) => j === exIdx ? { ...e, [field]: value } : e),
    }));
  }

  function updateWodLadderRep(idx: number, exIdx: number, roundIdx: number, value: string) {
    updateWodData(idx, b => ({
      ...b,
      exercises: b.exercises.map((e, j) => {
        if (j !== exIdx) return e;
        const arr = [...(e.ladderRepsPerRound || [])];
        arr[roundIdx] = value;
        return { ...e, ladderRepsPerRound: arr };
      }),
    }));
  }

  function removeWodExercise(idx: number, exIdx: number) {
    const block = blocks[idx];
    if (block?.type === 'wod' && block.data.exercises.length <= 1) {
      setToast('Нельзя удалить единственное упражнение');
      return;
    }
    updateWodData(idx, b => ({
      ...b,
      exercises: b.exercises.filter((_, j) => j !== exIdx),
    }));
  }

  // --- Отправка формы ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (blocks.length === 0) {
      setError('Добавьте хотя бы один блок (Skill или WOD)');
      return;
    }

    setLoading(true);
    try {
      const skillBlocks = blocks.filter((b): b is { type: 'skill'; data: SkillBlockForm } => b.type === 'skill').map(b => b.data);
      const wodBlocks = blocks.filter((b): b is { type: 'wod'; data: WodBlockForm } => b.type === 'wod').map(b => b.data);

      const payload: WorkoutInput = {
        date,
        comment: comment.trim() || undefined,
        skillBlocks: skillBlocks.map(b => ({
          exerciseName: b.exerciseName,
          sets: b.sets.map(s => ({
            reps: parseInt(s.reps),
            weight: s.weight ? parseFloat(s.weight) : 0,
          })),
        })),
        wodBlocks: wodBlocks.length > 0
          ? wodBlocks.map(b => ({
              wodType: b.wodType,
              level: b.level,
              timeCapSeconds: b.timeCapSeconds ? parseInt(b.timeCapSeconds) * 60 : undefined,
              isLadder: b.isLadder,
              resultType: b.wodType === 'FOR_TIME' ? 'TIME' as const : b.wodType === 'AMRAP' ? 'REPS' as const : 'TIME' as const,
              resultDisplay: b.resultDisplay,
              resultSeconds: b.wodType === 'FOR_TIME' && b.resultSeconds ? parseMmSs(b.resultSeconds) : undefined,
              resultTotalReps: b.wodType === 'AMRAP' && b.resultTotalReps ? parseInt(b.resultTotalReps) : undefined,
              exercises: b.exercises.map(ex => {
                let reps = parseInt(ex.reps) || 0;
                if (b.isLadder && ex.ladderRepsPerRound.length > 0) {
                  const vals = ex.ladderRepsPerRound.filter(v => v).map(v => parseInt(v) || 0);
                  reps = vals.length > 0 ? vals[0] : reps;
                }
                return {
                  exerciseName: ex.exerciseName,
                  reps,
                  weight: ex.weight && !isCardio(ex.exerciseName) ? parseFloat(ex.weight) : undefined,
                };
              }),
            }))
          : undefined,
      };

      await workoutsApi.update(id, payload);
      router.push(`/dashboard/workouts/${id}`);
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

  if (loadingData) {
    return (
      <div className="container">
        <div className="loading-state"><div className="spinner" /></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container">
        <div className="form-error">{loadError}</div>
        <button type="button" className="btn-secondary" onClick={() => router.push('/dashboard/workouts')} style={{ marginTop: '1rem' }}>
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">Редактировать тренировку</h1>

      {toast && <Toast message={toast} onHide={hideToast} />}

      <form onSubmit={handleSubmit}>
        {/* Дата */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Дата тренировки</label>
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

        {/* Блоки тренировки — в порядке добавления */}
        <div className="added-blocks-list">
          {blocks.length === 0 && (
            <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
              Пока пусто. Добавьте блок Skill или WOD.
            </div>
          )}

          {blocks.map((block, bi) => {
            if (block.type === 'skill') {
              const skill = block.data;
              return (
                <div key={`block-${bi}`} className="added-block skill-block">
                  <button type="button" className="remove-block" onClick={() => removeBlock(bi)}>❌</button>
                  <h3 className="block-title" style={{ color: 'var(--color-secondary)' }}>🏋️ Skill</h3>

                  <div className="form-group">
                    <label>Упражнение</label>
                    <ExerciseAutocomplete
                      value={skill.exerciseName}
                      onChange={v => updateSkillExercise(bi, v)}
                      placeholder="Начните вводить или кликните для списка"
                      inputClassName="form-input exercise-search"
                    />
                    <SkillHint exerciseName={skill.exerciseName} />
                  </div>

                  <div className="form-group">
                    <label>Количество подходов</label>
                    <select
                      className="form-select sets-selector"
                      value={skill.sets.length}
                      onChange={e => updateSkillSetsCount(bi, parseInt(e.target.value))}
                    >
                      <option value="1">1 подход</option>
                      <option value="2">2 подхода</option>
                      <option value="3">3 подхода</option>
                      <option value="4">4 подхода</option>
                      <option value="5">5 подходов</option>
                      <option value="6">6 подходов</option>
                      <option value="7">7 подходов</option>
                      <option value="8">8 подходов</option>
                      <option value="9">9 подходов</option>
                      <option value="10">10 подходов</option>
                      <option value="11">11 подходов</option>
                      <option value="12">12 подходов</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Повторения в подходах</label>
                    <div className="sets-inputs-container sets-container">
                      {skill.sets.map((set, si) => (
                        <input
                          key={si}
                          type="number"
                          value={set.reps}
                          onChange={e => updateSkillSet(bi, si, 'reps', e.target.value)}
                          className="form-input set-input"
                          placeholder={`${si + 1}`}
                          min="1"
                          required
                        />
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Вес для каждого подхода (кг, необязательно)</label>
                    <div className="sets-inputs-container sets-container weight-inputs-container">
                      {skill.sets.map((set, si) => (
                        <input
                          key={si}
                          type="number"
                          value={set.weight}
                          onChange={e => updateSkillSet(bi, si, 'weight', e.target.value)}
                          className="form-input set-input"
                          placeholder={`${si + 1}`}
                          min="0.5"
                          step="0.5"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Максимальный вес (кг)</label>
                    <input
                      type="number"
                      value={skill.maxWeight}
                      onChange={e => updateSkillMaxWeight(bi, e.target.value)}
                      className="form-input"
                      style={{ width: '150px' }}
                      placeholder="120"
                      min="0.5"
                      step="0.5"
                    />
                  </div>
                </div>
              );
            }

            // WOD block
            const wod = block.data;
            return (
              <div key={`block-${bi}`} className="added-block wod-block">
                <button type="button" className="remove-block" onClick={() => removeBlock(bi)}>❌</button>
                <h3 className="block-title" style={{ color: 'var(--color-primary)' }}>⚡ WOD</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Тип</label>
                    <select
                      value={wod.wodType}
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
                    <label>Уровень</label>
                    <select
                      value={wod.level}
                      onChange={e => updateWodBlock(bi, { level: e.target.value as WodLevel })}
                      className="form-select"
                    >
                      <option value="RX">Rx</option>
                      <option value="SCALED">Sc</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Огр. времени, мин</label>
                    <input
                      type="number"
                      value={wod.timeCapSeconds}
                      onChange={e => updateWodBlock(bi, { timeCapSeconds: e.target.value })}
                      className="form-input"
                      placeholder="20"
                      min="1"
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                    <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={wod.isLadder}
                        onChange={e => updateWodBlock(bi, { isLadder: e.target.checked })}
                        style={{ width: '20px', height: '20px', marginRight: '10px' }}
                      />
                      <span style={{ fontWeight: 600 }}>Лесенка</span>
                    </label>
                  </div>
                </div>

                {wod.isLadder && (
                  <div className="form-group ladder-rounds-container">
                    <label>Количество раундов</label>
                    <select
                      className="form-select"
                      value={wod.ladderRounds}
                      onChange={e => updateWodBlock(bi, { ladderRounds: parseInt(e.target.value) })}
                    >
                      <option value="1">1 раунд</option>
                      <option value="2">2 раунда</option>
                      <option value="3">3 раунда</option>
                      <option value="4">4 раунда</option>
                      <option value="5">5 раундов</option>
                      <option value="6">6 раундов</option>
                      <option value="7">7 раундов</option>
                      <option value="8">8 раундов</option>
                      <option value="9">9 раундов</option>
                      <option value="10">10 раундов</option>
                      <option value="11">11 раундов</option>
                      <option value="12">12 раундов</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Упражнения</label>
                  <div className="wod-exercises-container">
                    {wod.exercises.map((ex, ei) => (
                      <div key={ei} className={`wod-exercise-row${wod.isLadder ? ' ladder-mode' : ''}${isCardio(ex.exerciseName) ? ' no-weight' : ''}`}>
                        <div className="wod-row-scroller">
                          <ExerciseAutocomplete
                            value={ex.exerciseName}
                            onChange={v => updateWodExercise(bi, ei, 'exerciseName', v)}
                            placeholder="Упражнение"
                            inputClassName="form-input-sm"
                            wrapperClassName="wod-exercise-name"
                          />
                          <div className="wod-fields-scroll">
                            {wod.isLadder ? (
                              <>
                                <div className="single-reps-container" style={{ display: 'none' }}>
                                  <input type="number" className="form-input-sm" placeholder="Повт." />
                                </div>
                                <div className="ladder-reps-container" style={{ display: 'flex', gap: '0.5rem' }}>
                                  {Array.from({ length: wod.ladderRounds }, (_, ri) => (
                                    <input
                                      key={ri}
                                      type="number"
                                      value={ex.ladderRepsPerRound[ri] || ''}
                                      onChange={e => updateWodLadderRep(bi, ei, ri, e.target.value)}
                                      className="form-input-sm"
                                      placeholder={`R${ri + 1}`}
                                      min="1"
                                      required
                                    />
                                  ))}
                                </div>
                              </>
                            ) : (
                              <>
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
                                <div className="ladder-reps-container" style={{ display: 'none' }} />
                              </>
                            )}
                            {!isCardio(ex.exerciseName) && (
                              <input
                                type="number"
                                value={ex.weight}
                                onChange={e => updateWodExercise(bi, ei, 'weight', e.target.value)}
                                className="form-input-sm wod-weight"
                                placeholder="Вес, кг"
                                min="0.5"
                                step="0.5"
                              />
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeWodExercise(bi, ei)}
                        >❌</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addWodExercise(bi)} className="btn-add">
                    + Добавить упражнение
                  </button>
                </div>

                <div className="form-group" style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <label>Результат</label>
                  <div className="form-row" style={{ gap: '0.5rem' }}>
                    <select
                      className="form-select"
                      value={wod.wodType === 'AMRAP' ? 'reps' : 'time'}
                      onChange={e => {
                        const isReps = e.target.value === 'reps';
                        updateWodBlock(bi, {
                          wodType: isReps ? 'AMRAP' : 'FOR_TIME',
                        });
                      }}
                    >
                      <option value="time">Время</option>
                      <option value="reps">Количество повторений</option>
                    </select>
                    <input
                      type="text"
                      value={wod.wodType === 'AMRAP' ? wod.resultTotalReps : wod.resultDisplay}
                      onChange={e => {
                        if (wod.wodType === 'AMRAP') {
                          updateWodBlock(bi, { resultTotalReps: e.target.value, resultDisplay: e.target.value });
                        } else {
                          updateWodBlock(bi, { resultDisplay: e.target.value, resultSeconds: e.target.value });
                        }
                      }}
                      className="form-input result-input"
                      placeholder={wod.wodType === 'AMRAP' ? '420' : '04:20'}
                      required
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Комментарий */}
        <div className="form-group" style={{ marginTop: '2rem' }}>
          <label>Комментарий к тренировке (необязательно)</label>
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
          <button type="button" onClick={() => router.push(`/dashboard/workouts/${id}`)} className="btn-secondary">
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
