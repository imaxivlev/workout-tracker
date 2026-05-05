'use client';

import { useState, FormEvent, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { workoutsApi, exercisesApi, ApiError, WorkoutInput, Workout, Exercise } from '@/lib/api/client';
import { ExerciseAutocomplete } from '@/app/components/ExerciseAutocomplete';
import { enToRuName } from '@/lib/exercise-names';
import { SingleDatePicker } from '@/app/components/SingleDatePicker';
import { NewExerciseModal, MeasureUnit } from '@/app/components/NewExerciseModal';

type WodType = 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA';
type WodLevel = 'RX' | 'SCALED';

interface SkillSetForm { reps: string; weight: string; }
interface SkillBlockForm {
  exerciseName: string;
  weightIsPercent: boolean;
  sets: SkillSetForm[];
}

interface WodExerciseForm {
  exerciseName: string;
  reps: string;
  weight: string;
  durationSeconds: string;
  ladderRepsPerRound: string[];
  repsFemale: string;
  weightFemale: string;
  exerciseNameFemale: string;
  ladderRepsPerRoundFemale: string[];
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
  hasGenderSplit: boolean;
  hasSeparateScaled: boolean;
  exercises: WodExerciseForm[];
  scaledExercises: WodExerciseForm[];
}

type BlockItem =
  | { type: 'skill'; data: SkillBlockForm }
  | { type: 'wod'; data: WodBlockForm };

const CARDIO_TERMS = ['bike', 'row', 'run', 'skierg', 'assault bike', 'гребля', 'велотренажер', 'бег', 'лыжный тренажер'];
function isCardio(name: string): boolean {
  const lower = name.toLowerCase();
  return CARDIO_TERMS.some(t => lower.includes(t));
}

const BODYWEIGHT_TERMS = [
  'pull-ups', 'подтягивания', 'push-ups', 'отжимания',
  'burpees', 'берпи', 'box jumps', 'запрыгивания на коробку',
  'rope climbs', 'лазание по канату',
  'ring muscle-ups', 'выходы на кольцах',
  'bar muscle-ups', 'выходы на перекладине',
  'double unders', 'двойные прыжки на скакалке',
  'single unders', 'прыжки на скакалке',
];
function isBodyweight(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes('с весом') || lower.includes('weighted')) return false;
  return BODYWEIGHT_TERMS.some(t => lower.includes(t));
}

function shouldHideWeight(name: string): boolean {
  return isCardio(name) || isBodyweight(name);
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

function formatMmSsInput(raw: string, prev: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  const mm = digits.slice(0, 2);
  const ss = digits.slice(2, 4);
  return `${mm}:${ss}`;
}

function isValidMmSs(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value);
}

function SkillHint({ exerciseName, excludeWorkoutId }: { exerciseName: string; excludeWorkoutId?: string }) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciseName.trim()) {
      setHint(null);
      return;
    }
    exercisesApi.getLastHistory(exerciseName, excludeWorkoutId)
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

function secondsToMmSs(s: number): string {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function mapWodExercises(exercises: any[]): WodExerciseForm[] {
  return exercises.map(ex => ({
    exerciseName: enToRuName(ex.exercise.name),
    reps: ex.reps ? String(ex.reps) : '',
    weight: ex.weight ? String(ex.weight) : '',
    ladderRepsPerRound: [],
    repsFemale: ex.repsFemale ? String(ex.repsFemale) : '',
    weightFemale: ex.weightFemale ? String(ex.weightFemale) : '',
    exerciseNameFemale: ex.exerciseNameFemale ? enToRuName(ex.exerciseNameFemale) : '',
    ladderRepsPerRoundFemale: [],
    durationSeconds: ex.durationSeconds ? secondsToMmSs(ex.durationSeconds) : '',
  }));
}

function emptyWodExercise(): WodExerciseForm {
  return { exerciseName: '', reps: '', weight: '', ladderRepsPerRound: [], repsFemale: '', weightFemale: '', exerciseNameFemale: '', ladderRepsPerRoundFemale: [], durationSeconds: '' };
}

function workoutToBlocks(workout: Workout): BlockItem[] {
  const blocks: BlockItem[] = [];

  for (const sb of workout.skillBlocks) {
    const weightIsPercent = sb.sets.some(s => s.weightIsPercent);
    blocks.push({
      type: 'skill',
      data: {
        exerciseName: enToRuName(sb.exercise.name),
        weightIsPercent,
        sets: sb.sets.map(s => ({
          reps: String(s.reps),
          weight: s.weight > 0 ? String(s.weight) : '',
        })),
      },
    });
  }

  // Объединяем парные RX+SCALED блоки в один с hasSeparateScaled
  const used = new Set<number>();
  for (let i = 0; i < workout.wodBlocks.length; i++) {
    if (used.has(i)) continue;
    const wb = workout.wodBlocks[i];
    let pairedIdx = -1;
    for (let j = i + 1; j < workout.wodBlocks.length; j++) {
      if (used.has(j)) continue;
      const other = workout.wodBlocks[j];
      if (other.wodType === wb.wodType && other.level !== wb.level) { pairedIdx = j; break; }
    }

    let hasSeparateScaled = false;
    let rxBlock = wb;
    let scBlock: typeof wb | null = null;

    if (pairedIdx >= 0) {
      used.add(pairedIdx);
      hasSeparateScaled = true;
      const paired = workout.wodBlocks[pairedIdx];
      rxBlock = wb.level === 'RX' ? wb : paired;
      scBlock = wb.level === 'SCALED' ? wb : paired;
    }
    used.add(i);

    const rounds = rxBlock.ladderRounds || 5;
    blocks.push({
      type: 'wod',
      data: {
        wodType: rxBlock.wodType,
        level: rxBlock.level,
        timeCapSeconds: rxBlock.timeCapSeconds ? String(Math.floor(rxBlock.timeCapSeconds / 60)) : '',
        isLadder: rxBlock.isLadder,
        ladderRounds: rounds,
        resultDisplay: rxBlock.resultDisplay || '',
        resultSeconds: rxBlock.resultDisplay || '',
        resultTotalReps: rxBlock.resultTotalReps ? String(rxBlock.resultTotalReps) : '',
        hasGenderSplit: rxBlock.hasGenderSplit || false,
        hasSeparateScaled,
        exercises: mapWodExercises(rxBlock.exercises).map(ex => ({
          ...ex,
          ladderRepsPerRound: rxBlock.isLadder
            ? Array.from({ length: rounds }, () => ex.reps)
            : [],
        })),
        scaledExercises: scBlock
          ? mapWodExercises(scBlock.exercises).map(ex => ({
              ...ex,
              ladderRepsPerRound: scBlock.isLadder
                ? Array.from({ length: rounds }, () => ex.reps)
                : [],
            }))
          : [emptyWodExercise()],
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
  const [isClubTemplate, setIsClubTemplate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [exerciseSettings, setExerciseSettings] = useState<Record<string, { hasWeight: boolean; measureUnit: string }>>({});
  const [pendingExerciseName, setPendingExerciseName] = useState<string | null>(null);

  const hideToast = useCallback(() => setToast(''), []);

  function getHideWeight(name: string): boolean {
    if (exerciseSettings[name] !== undefined) return !exerciseSettings[name].hasWeight;
    return shouldHideWeight(name);
  }

  function getMeasureUnit(name: string): string {
    return exerciseSettings[name]?.measureUnit ?? 'reps';
  }

  function handleExerciseSelect(ex: Exercise) {
    const ruName = enToRuName(ex.name);
    setExerciseSettings(prev => ({ ...prev, [ruName]: { hasWeight: ex.hasWeight, measureUnit: ex.measureUnit } }));
  }

  function handleNewExercise(name: string) {
    setPendingExerciseName(name);
  }

  function handleNewExerciseConfirm(settings: { hasWeight: boolean; measureUnit: MeasureUnit }) {
    if (pendingExerciseName) {
      setExerciseSettings(prev => ({ ...prev, [pendingExerciseName]: settings }));
    }
    setPendingExerciseName(null);
  }

  useEffect(() => {
    workoutsApi.getById(id)
      .then(data => {
        const w = data.workout;
        setDate(w.date);
        setComment(w.comment || '');
        setIsClubTemplate(w.isClubTemplate || false);
        setBlocks(workoutToBlocks(w));
        // Populate exerciseSettings for REST exercises
        const restSettings: Record<string, { hasWeight: boolean; measureUnit: string }> = {};
        for (const wb of w.wodBlocks) {
          for (const ex of wb.exercises) {
            if ((ex as any).durationSeconds) {
              const name = enToRuName(ex.exercise.name);
              restSettings[name] = { hasWeight: false, measureUnit: 'time' };
            }
          }
        }
        if (Object.keys(restSettings).length > 0) setExerciseSettings(prev => ({ ...prev, ...restSettings }));
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
    setBlocks(prev => [...prev, { type: 'skill', data: { exerciseName: '', weightIsPercent: false, sets: defaultSets } }]);
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
        hasGenderSplit: false,
        hasSeparateScaled: false,
        exercises: [emptyWodExercise()],
        scaledExercises: [emptyWodExercise()],
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
      }
      return { ...b, sets: current.slice(0, count) };
    });
  }

  function updateSkillSet(idx: number, setIdx: number, field: keyof SkillSetForm, value: string) {
    updateSkillData(idx, b => {
      const prevValue = b.sets[0]?.[field] ?? '';
      return {
        ...b,
        sets: b.sets.map((s, j) => {
          if (j === setIdx) return { ...s, [field]: value };
          if (setIdx === 0 && (s[field] === prevValue || !s[field])) return { ...s, [field]: value };
          return s;
        }),
      };
    });
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
    updateWodData(idx, b => {
      const result = { ...b, exercises: [...b.exercises, emptyWodExercise()] };
      if (b.hasSeparateScaled) result.scaledExercises = [...b.scaledExercises, emptyWodExercise()];
      return result;
    });
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
        const prevValue = arr[0] ?? '';
        arr[roundIdx] = value;
        if (roundIdx === 0) {
          for (let r = 1; r < arr.length; r++) {
            if (!arr[r] || arr[r] === prevValue) arr[r] = value;
          }
        }
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

  // --- Scaled WOD helpers ---
  function addScaledExercise(idx: number) {
    updateWodData(idx, b => ({ ...b, scaledExercises: [...b.scaledExercises, emptyWodExercise()] }));
  }

  function updateScaledExercise(idx: number, exIdx: number, field: keyof WodExerciseForm, value: string) {
    updateWodData(idx, b => ({
      ...b,
      scaledExercises: b.scaledExercises.map((e, j) => j === exIdx ? { ...e, [field]: value } : e),
    }));
  }

  function updateScaledLadderRep(idx: number, exIdx: number, roundIdx: number, value: string) {
    updateWodData(idx, b => ({
      ...b,
      scaledExercises: b.scaledExercises.map((e, j) => {
        if (j !== exIdx) return e;
        const arr = [...(e.ladderRepsPerRound || [])];
        const prevValue = arr[0] ?? '';
        arr[roundIdx] = value;
        if (roundIdx === 0) {
          for (let r = 1; r < arr.length; r++) {
            if (!arr[r] || arr[r] === prevValue) arr[r] = value;
          }
        }
        return { ...e, ladderRepsPerRound: arr };
      }),
    }));
  }

  function removeScaledExercise(idx: number, exIdx: number) {
    const block = blocks[idx];
    if (block?.type === 'wod' && block.data.scaledExercises.length <= 1) {
      setToast('Нельзя удалить единственное упражнение');
      return;
    }
    updateWodData(idx, b => ({ ...b, scaledExercises: b.scaledExercises.filter((_, j) => j !== exIdx) }));
  }

  function copyRxToScaled(idx: number) {
    updateWodData(idx, b => ({
      ...b,
      scaledExercises: b.exercises.map(ex => ({ ...ex, ladderRepsPerRound: [...(ex.ladderRepsPerRound || [])] })),
    }));
  }

  // --- Отправка формы ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (blocks.length === 0) {
      setError('Добавьте хотя бы один блок (Скилл или ВОД)');
      return;
    }

    const wodBlocks_ = blocks.filter((b): b is { type: 'wod'; data: WodBlockForm } => b.type === 'wod').map(b => b.data);
    if (!isClubTemplate) {
      for (const w of wodBlocks_) {
        if (w.wodType === 'FOR_TIME' && !isValidMmSs(w.resultDisplay)) {
          setError('Время результата должно быть в формате ММ:СС (например, 04:20)');
          return;
        }
      }
    }

    setLoading(true);
    try {
      const skillBlocks = blocks.filter((b): b is { type: 'skill'; data: SkillBlockForm } => b.type === 'skill').map(b => b.data);
      const wodBlocks = wodBlocks_;

      const payload: WorkoutInput = {
        date,
        comment: comment.trim() || undefined,
        isClubTemplate: isClubTemplate || undefined,
        skillBlocks: skillBlocks.map(b => ({
          exerciseName: b.exerciseName,
          weightIsPercent: b.weightIsPercent || undefined,
          sets: b.sets.map(s => ({
            reps: parseInt(s.reps),
            weight: s.weight ? parseFloat(s.weight) : undefined,
            weightIsPercent: b.weightIsPercent || undefined,
          })),
        })),
        newExercises: Object.entries(exerciseSettings).map(([name, s]) => ({ name, ...s })),
        wodBlocks: wodBlocks.length > 0
          ? wodBlocks.flatMap(b => {
              function buildWodPayload(exercises: WodExerciseForm[], level: 'RX' | 'SCALED') {
                return {
                  wodType: b.wodType,
                  level,
                  timeCapSeconds: b.timeCapSeconds ? parseInt(b.timeCapSeconds) * 60 : undefined,
                  isLadder: b.isLadder,
                  hasGenderSplit: b.hasGenderSplit || undefined,
                  resultType: b.wodType === 'FOR_TIME' ? 'TIME' as const : b.wodType === 'AMRAP' ? 'REPS' as const : 'TIME' as const,
                  resultDisplay: (b.wodType === 'EMOM' || b.wodType === 'TABATA')
                    ? (b.timeCapSeconds ? `${b.timeCapSeconds} мин` : b.wodType)
                    : b.resultDisplay,
                  resultSeconds: b.wodType === 'FOR_TIME' && b.resultSeconds ? parseMmSs(b.resultSeconds) : undefined,
                  resultTotalReps: b.wodType === 'AMRAP' && b.resultTotalReps ? parseInt(b.resultTotalReps) : undefined,
                  exercises: exercises.map(ex => {
                    let reps = parseInt(ex.reps) || 0;
                    if (b.isLadder && ex.ladderRepsPerRound.length > 0) {
                      const vals = ex.ladderRepsPerRound.filter(v => v).map(v => parseInt(v) || 0);
                      reps = vals.length > 0 ? vals[0] : reps;
                    }
                    return {
                      exerciseName: ex.exerciseName,
                      reps,
                      weight: ex.weight && !getHideWeight(ex.exerciseName) ? parseFloat(ex.weight) : undefined,
                      repsFemale: b.hasGenderSplit && ex.repsFemale ? parseInt(ex.repsFemale) : undefined,
                      weightFemale: b.hasGenderSplit && ex.weightFemale && !getHideWeight(ex.exerciseName) ? parseFloat(ex.weightFemale) : undefined,
                      exerciseNameFemale: b.hasGenderSplit && ex.exerciseNameFemale && ex.exerciseNameFemale !== ex.exerciseName ? ex.exerciseNameFemale : undefined,
                      durationSeconds: getMeasureUnit(ex.exerciseName) === 'time' ? parseMmSs(ex.durationSeconds) : undefined,
                    };
                  }),
                };
              }
              if (b.hasSeparateScaled && isClubTemplate) {
                return [buildWodPayload(b.exercises, 'RX'), buildWodPayload(b.scaledExercises, 'SCALED')];
              }
              return [buildWodPayload(b.exercises, b.level)];
            })
          : undefined,
      };

      await workoutsApi.update(id, payload);
      router.push(`/dashboard/workouts/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.length) {
          setError([...new Set(err.details.map((d: { message: string }) => d.message))].join('; '));
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

      {pendingExerciseName && (
        <NewExerciseModal
          exerciseName={pendingExerciseName}
          onConfirm={handleNewExerciseConfirm}
          onCancel={() => setPendingExerciseName(null)}
        />
      )}

      {toast && <Toast message={toast} onHide={hideToast} />}

      <form onSubmit={handleSubmit}>
        {/* Дата */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Дата тренировки</label>
          <SingleDatePicker value={date} onChange={setDate} />
        </div>

        {/* Блоки тренировки — в порядке добавления */}
        <div className="added-blocks-list">
          {blocks.length === 0 && (
            <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
              Пока пусто. Добавьте блок Скилл или ВОД.
            </div>
          )}

          {blocks.map((block, bi) => {
            if (block.type === 'skill') {
              const skill = block.data;
              return (
                <div key={`block-${bi}`} className="added-block skill-block">
                  <button type="button" className="remove-block" onClick={() => removeBlock(bi)}>❌</button>
                  <h3 className="block-title" style={{ color: 'var(--color-secondary)' }}>🏋️ Скилл</h3>

                  <div className="form-group">
                    <label>Упражнение</label>
                    <ExerciseAutocomplete
                      value={skill.exerciseName}
                      onChange={v => updateSkillExercise(bi, v)}
                      onExerciseSelect={handleExerciseSelect}
                      onNewExercise={handleNewExercise}
                      placeholder="Начните вводить или кликните для списка"
                      inputClassName="form-input exercise-search"
                    />
                    <SkillHint exerciseName={skill.exerciseName} excludeWorkoutId={id} />
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

                  {!getHideWeight(skill.exerciseName) && <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label style={{ margin: 0 }}>{skill.weightIsPercent ? '% от 1RM для каждого подхода' : 'Вес для каждого подхода (кг, необязательно)'}</label>
                      <div className="unit-toggle">
                        <button type="button" className={`unit-toggle-btn${!skill.weightIsPercent ? ' active' : ''}`}
                          onClick={() => { if (skill.weightIsPercent) updateSkillData(bi, b => ({ ...b, weightIsPercent: false, sets: b.sets.map(s => ({ ...s, weight: '' })) })); }}>
                          кг
                        </button>
                        <button type="button" className={`unit-toggle-btn${skill.weightIsPercent ? ' active' : ''}`}
                          onClick={() => { if (!skill.weightIsPercent) updateSkillData(bi, b => ({ ...b, weightIsPercent: true, sets: b.sets.map(s => ({ ...s, weight: '' })) })); }}>
                          %
                        </button>
                      </div>
                    </div>
                    <div className="sets-inputs-container sets-container weight-inputs-container">
                      {skill.sets.map((set, si) => (
                        <input
                          key={si}
                          type="number"
                          value={set.weight}
                          onChange={e => updateSkillSet(bi, si, 'weight', e.target.value)}
                          className="form-input set-input"
                          placeholder={skill.weightIsPercent ? '%' : `${si + 1}`}
                          min={skill.weightIsPercent ? '1' : '0.5'}
                          step={skill.weightIsPercent ? '1' : '0.5'}
                          max={skill.weightIsPercent ? '100' : undefined}
                        />
                      ))}
                    </div>
                  </div>}

                </div>
              );
            }

            // WOD block
            const wod = block.data;
            return (
              <div key={`block-${bi}`} className="added-block wod-block">
                <button type="button" className="remove-block" onClick={() => removeBlock(bi)}>❌</button>
                <h3 className="block-title" style={{ color: 'var(--color-primary)' }}>⚡ ВОД</h3>

                {/* Переключатели режимов — только для шаблонов клуба */}
                {isClubTemplate && (
                  <div className="wod-mode-toggles">
                    <div
                      className="wod-toggle-row"
                      onClick={() => {
                        const checked = !wod.hasSeparateScaled;
                        updateWodBlock(bi, { hasSeparateScaled: checked });
                        if (checked) copyRxToScaled(bi);
                      }}
                    >
                      <span className="wod-toggle-label-text">Разные планы Rx / Sc</span>
                      <div className={`wod-toggle-switch${wod.hasSeparateScaled ? ' on' : ''}`}>
                        <div className="wod-toggle-knob" />
                      </div>
                    </div>
                    <div
                      className="wod-toggle-row"
                      onClick={() => {
                        const checked = !wod.hasGenderSplit;
                        if (checked) {
                          updateWodData(bi, b => ({
                            ...b,
                            hasGenderSplit: true,
                            exercises: b.exercises.map(ex => ({ ...ex, repsFemale: ex.reps, weightFemale: ex.weight })),
                            scaledExercises: b.scaledExercises.map(ex => ({ ...ex, repsFemale: ex.reps, weightFemale: ex.weight })),
                          }));
                        } else {
                          updateWodBlock(bi, { hasGenderSplit: false });
                        }
                      }}
                    >
                      <span className="wod-toggle-label-text">Раздельные М / Ж</span>
                      <div className={`wod-toggle-switch${wod.hasGenderSplit ? ' on' : ''}`}>
                        <div className="wod-toggle-knob" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Тип</label>
                    <select
                      value={wod.wodType}
                      onChange={e => updateWodBlock(bi, { wodType: e.target.value as WodType })}
                      className="form-select"
                    >
                      <option value="FOR_TIME">На время</option>
                      <option value="AMRAP">КМБР</option>
                      <option value="EMOM">EMOM</option>
                      <option value="TABATA">Табата</option>
                    </select>
                  </div>
                  {!wod.hasSeparateScaled && (
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
                  )}
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
                  <label>{wod.hasSeparateScaled ? <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Rx план</span> : (wod.hasGenderSplit ? <><span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>М:</span> Упражнения</> : 'Упражнения')}</label>
                  <div className="wod-exercises-container">
                    {wod.exercises.map((ex, ei) => (
                      <div key={ei}>
                        <div className={`wod-exercise-row${wod.isLadder ? ' ladder-mode' : ''}${getHideWeight(ex.exerciseName) ? ' no-weight' : ''}${wod.hasGenderSplit ? ' has-gender-split' : ''}`}>
                          {wod.hasGenderSplit && <span className="gender-label">М:</span>}
                          <div className="wod-row-scroller">
                            <ExerciseAutocomplete
                              value={ex.exerciseName}
                              onChange={v => updateWodExercise(bi, ei, 'exerciseName', v)}
                              onExerciseSelect={handleExerciseSelect}
                              onNewExercise={handleNewExercise}
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
                              ) : getMeasureUnit(ex.exerciseName) === 'time' ? (
                                <div className="single-reps-container" style={{ display: 'flex' }}>
                                  <input
                                    type="text"
                                    value={ex.durationSeconds}
                                    onChange={e => updateWodExercise(bi, ei, 'durationSeconds', formatMmSsInput(e.target.value, ex.durationSeconds))}
                                    className="form-input-sm"
                                    placeholder="ММ:СС"
                                    maxLength={5}
                                    required
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="single-reps-container" style={{ display: 'flex' }}>
                                    <input
                                      type="number"
                                      value={ex.reps}
                                      onChange={e => updateWodExercise(bi, ei, 'reps', e.target.value)}
                                      className="form-input-sm"
                                      placeholder={getMeasureUnit(ex.exerciseName) === 'calories' ? 'Cal' : getMeasureUnit(ex.exerciseName) === 'meters' ? 'м' : 'Повт.'}
                                      min="1"
                                      required
                                    />
                                  </div>
                                  <div className="ladder-reps-container" style={{ display: 'none' }} />
                                </>
                              )}
                              {!getHideWeight(ex.exerciseName) && (
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
                          {!wod.hasGenderSplit && (
                            <button type="button" className="btn-icon" onClick={() => removeWodExercise(bi, ei)}>❌</button>
                          )}
                        </div>
                        {wod.hasGenderSplit && (
                          <div className={`wod-exercise-row-female${wod.isLadder ? ' ladder-mode' : ''}`}>
                            <span className="gender-label">Ж:</span>
                            <div className="wod-row-scroller">
                              <ExerciseAutocomplete
                                value={ex.exerciseNameFemale || ex.exerciseName}
                                onChange={v => updateWodExercise(bi, ei, 'exerciseNameFemale', v === ex.exerciseName ? '' : v)}
                                onExerciseSelect={handleExerciseSelect}
                                onNewExercise={handleNewExercise}
                                placeholder="Упражнение"
                                inputClassName="form-input-sm"
                                wrapperClassName="wod-exercise-name"
                              />
                              <div className="wod-fields-scroll">
                                <div className="single-reps-container" style={{ display: 'flex' }}>
                                  <input
                                    type="number"
                                    value={ex.repsFemale}
                                    onChange={e => updateWodExercise(bi, ei, 'repsFemale', e.target.value)}
                                    className="form-input-sm"
                                    placeholder={getMeasureUnit(ex.exerciseName) === 'calories' ? 'Cal' : getMeasureUnit(ex.exerciseName) === 'meters' ? 'м' : 'Повт.'}
                                    min="1"
                                  />
                                </div>
                                {!getHideWeight(ex.exerciseName) && (
                                  <input
                                    type="number"
                                    value={ex.weightFemale}
                                    onChange={e => updateWodExercise(bi, ei, 'weightFemale', e.target.value)}
                                    className="form-input-sm wod-weight"
                                    placeholder="Вес, кг"
                                    min="0.5"
                                    step="0.5"
                                  />
                                )}
                              </div>
                            </div>
                            <button type="button" className="btn-icon" onClick={() => removeWodExercise(bi, ei)}>❌</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addWodExercise(bi)} className="btn-add">
                    + Добавить упражнение
                  </button>
                </div>

                {/* Sc план — отдельный набор упражнений */}
                {wod.hasSeparateScaled && (
                  <div className="form-group" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px dashed var(--border-color)' }}>
                    <label><span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>Sc план</span></label>
                    <div className="wod-exercises-container">
                      {wod.scaledExercises.map((ex, ei) => (
                        <div key={ei}>
                          <div className={`wod-exercise-row${wod.isLadder ? ' ladder-mode' : ''}${getHideWeight(ex.exerciseName) ? ' no-weight' : ''}${wod.hasGenderSplit ? ' has-gender-split' : ''}`}>
                            {wod.hasGenderSplit && <span className="gender-label">М:</span>}
                            <div className="wod-row-scroller">
                              <ExerciseAutocomplete
                                value={ex.exerciseName}
                                onChange={v => updateScaledExercise(bi, ei, 'exerciseName', v)}
                                onExerciseSelect={handleExerciseSelect}
                                onNewExercise={handleNewExercise}
                                placeholder="Упражнение"
                                inputClassName="form-input-sm"
                                wrapperClassName="wod-exercise-name"
                              />
                              <div className="wod-fields-scroll">
                                {wod.isLadder ? (
                                  <div className="ladder-reps-container" style={{ display: 'flex', gap: '0.5rem' }}>
                                    {Array.from({ length: wod.ladderRounds }, (_, ri) => (
                                      <input
                                        key={ri}
                                        type="number"
                                        value={ex.ladderRepsPerRound[ri] || ''}
                                        onChange={e => updateScaledLadderRep(bi, ei, ri, e.target.value)}
                                        className="form-input-sm"
                                        placeholder={`R${ri + 1}`}
                                        min="1"
                                        required
                                      />
                                    ))}
                                  </div>
                                ) : getMeasureUnit(ex.exerciseName) === 'time' ? (
                                  <div className="single-reps-container" style={{ display: 'flex' }}>
                                    <input
                                      type="text"
                                      value={ex.durationSeconds}
                                      onChange={e => updateScaledExercise(bi, ei, 'durationSeconds', formatMmSsInput(e.target.value, ex.durationSeconds))}
                                      className="form-input-sm"
                                      placeholder="ММ:СС"
                                      maxLength={5}
                                      required
                                    />
                                  </div>
                                ) : (
                                  <div className="single-reps-container" style={{ display: 'flex' }}>
                                    <input
                                      type="number"
                                      value={ex.reps}
                                      onChange={e => updateScaledExercise(bi, ei, 'reps', e.target.value)}
                                      className="form-input-sm"
                                      placeholder={getMeasureUnit(ex.exerciseName) === 'calories' ? 'Cal' : getMeasureUnit(ex.exerciseName) === 'meters' ? 'м' : 'Повт.'}
                                      min="1"
                                      required
                                    />
                                  </div>
                                )}
                                {!getHideWeight(ex.exerciseName) && (
                                  <input
                                    type="number"
                                    value={ex.weight}
                                    onChange={e => updateScaledExercise(bi, ei, 'weight', e.target.value)}
                                    className="form-input-sm wod-weight"
                                    placeholder="Вес, кг"
                                    min="0.5"
                                    step="0.5"
                                  />
                                )}
                              </div>
                            </div>
                            {!wod.hasGenderSplit && (
                              <button type="button" className="btn-icon" onClick={() => removeScaledExercise(bi, ei)}>❌</button>
                            )}
                          </div>
                          {wod.hasGenderSplit && (
                            <div className={`wod-exercise-row-female${wod.isLadder ? ' ladder-mode' : ''}`}>
                              <span className="gender-label">Ж:</span>
                              <div className="wod-row-scroller">
                                <ExerciseAutocomplete
                                  value={ex.exerciseNameFemale || ex.exerciseName}
                                  onChange={v => updateScaledExercise(bi, ei, 'exerciseNameFemale', v === ex.exerciseName ? '' : v)}
                                  onExerciseSelect={handleExerciseSelect}
                                  onNewExercise={handleNewExercise}
                                  placeholder="Упражнение"
                                  inputClassName="form-input-sm"
                                  wrapperClassName="wod-exercise-name"
                                />
                                <div className="wod-fields-scroll">
                                  <div className="single-reps-container" style={{ display: 'flex' }}>
                                    <input
                                      type="number"
                                      value={ex.repsFemale}
                                      onChange={e => updateScaledExercise(bi, ei, 'repsFemale', e.target.value)}
                                      className="form-input-sm"
                                      placeholder={getMeasureUnit(ex.exerciseName) === 'calories' ? 'Cal' : getMeasureUnit(ex.exerciseName) === 'meters' ? 'м' : 'Повт.'}
                                      min="1"
                                    />
                                  </div>
                                  {!getHideWeight(ex.exerciseName) && (
                                    <input
                                      type="number"
                                      value={ex.weightFemale}
                                      onChange={e => updateScaledExercise(bi, ei, 'weightFemale', e.target.value)}
                                      className="form-input-sm wod-weight"
                                      placeholder="Вес, кг"
                                      min="0.5"
                                      step="0.5"
                                    />
                                  )}
                                </div>
                              </div>
                              <button type="button" className="btn-icon" onClick={() => removeScaledExercise(bi, ei)}>❌</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => addScaledExercise(bi)} className="btn-add">
                      + Добавить упражнение
                    </button>
                  </div>
                )}

                {wod.wodType !== 'EMOM' && wod.wodType !== 'TABATA' && (
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
                    {wod.wodType === 'AMRAP' ? (
                    <input
                      type="number"
                      value={wod.resultTotalReps}
                      onChange={e => updateWodBlock(bi, { resultTotalReps: e.target.value, resultDisplay: e.target.value })}
                      className="form-input result-input"
                      placeholder="420"
                      min="1"
                      required={!isClubTemplate}
                    />
                    ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={wod.resultDisplay}
                      onChange={e => {
                        const formatted = formatMmSsInput(e.target.value, wod.resultDisplay);
                        updateWodBlock(bi, { resultDisplay: formatted, resultSeconds: formatted });
                      }}
                      className="form-input result-input"
                      placeholder="ММ:СС"
                      maxLength={5}
                      pattern={isClubTemplate ? undefined : "\\d{1,2}:\\d{2}"}
                      required={!isClubTemplate}
                    />
                    )}
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Кнопки добавления блоков */}
        <div className="builder-actions">
          <button type="button" className="btn-add-block" onClick={addSkillBlock}>
            <span style={{ fontSize: '2rem' }}>🏋️</span>
            Добавить Скилл
          </button>
          <button type="button" className="btn-add-block" onClick={addWodBlock}>
            <span style={{ fontSize: '2rem' }}>⚡</span>
            Добавить ВОД
          </button>
        </div>

        {/* Комментарий */}
        <div className="form-group" style={{ marginTop: '2rem' }}>
          <label>Комментарий к тренировке (необязательно)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="form-input"
            rows={3}
            placeholder="пример: чудесная тренировка, пульс 198"
            maxLength={500}
          />
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
