'use client';

import React, { useState, FormEvent, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { workoutsApi, exercisesApi, clubsApi, userApi, ApiError, WorkoutInput, Exercise } from '@/lib/api/client';
import { ExerciseAutocomplete } from '@/app/components/ExerciseAutocomplete';
import { SingleDatePicker } from '@/app/components/SingleDatePicker';
import { NewExerciseModal, MeasureUnit } from '@/app/components/NewExerciseModal';
import { enToRuName } from '@/lib/exercise-names';

type WodType = 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA';
type WodLevel = 'RX' | 'SCALED';

interface SkillSetForm { reps: string; weight: string; percentHint?: number; }
interface SkillBlockForm {
  exerciseName: string;
  weightIsPercent: boolean;
  sets: SkillSetForm[];
}

interface WodExerciseForm {
  exerciseName: string;
  reps: string;
  weight: string;
  ladderRepsPerRound: string[];
  exerciseNameFemale: string;
  repsFemale: string;
  weightFemale: string;
  ladderRepsPerRoundFemale: string[];
  durationSeconds: string;
}
interface WodBlockForm {
  wodType: WodType;
  level: WodLevel;
  timeCapSeconds: string;
  isLadder: boolean;
  ladderRounds: number;
  restBetweenRounds: string;
  resultDisplay: string;
  resultSeconds: string;
  resultTotalReps: string;
  exercises: WodExerciseForm[];
  // Раздельные планы Rx/Sc
  hasSeparateScaled: boolean;
  scaledExercises: WodExerciseForm[];
  // Раздельные М/Ж
  hasGenderSplit: boolean;
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
  // "Подтягивания с весом" / "Weighted Pull-ups" — НЕ bodyweight
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

/** Маска ввода MM:SS — только цифры, автоподстановка двоеточия */
function formatMmSsInput(raw: string, prev: string): string {
  // Оставляем только цифры
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  // Автоматически вставляем двоеточие после 2 цифр
  const mm = digits.slice(0, 2);
  const ss = digits.slice(2, 4);
  return `${mm}:${ss}`;
}

function secondsToMmSs(s: number): string {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function isValidMmSs(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value);
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

export default function NewWorkoutPageWrapper() {
  return (
    <Suspense fallback={<div className="loading-container"><div className="loading-spinner" /></div>}>
      <NewWorkoutPage />
    </Suspense>
  );
}

function NewWorkoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('');
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const newBlockRef = useRef<boolean>(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [templateApplied, setTemplateApplied] = useState(false);
  const hasClubTemplateParam = !!searchParams.get('clubTemplate');
  const [fromClubTemplate, setFromClubTemplate] = useState(hasClubTemplateParam);

  // Club template
  const [hasClub, setHasClub] = useState(false);
  const [clubRole, setClubRole] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [saveAsClubTemplate, setSaveAsClubTemplate] = useState(!hasClubTemplateParam);
  const [showTemplateTooltip, setShowTemplateTooltip] = useState(false);
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);
  const [showAthleteTemplateConfirm, setShowAthleteTemplateConfirm] = useState(false);
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

  // Тренер/владелец может не заполнять результат при создании шаблона для клуба
  const canSkipResult = hasClub && saveAsClubTemplate && !fromClubTemplate && (clubRole === 'OWNER' || clubRole === 'COACH');

  // Проверка членства в клубе
  useEffect(() => {
    clubsApi.getMy().then(({ club }) => {
      if (club) {
        setHasClub(true);
        setClubRole(club.myRole);
        setClubId(club.id);
        if (!hasClubTemplateParam) {
          setSaveAsClubTemplate(club.myRole === 'OWNER' || club.myRole === 'COACH');
        }
      }
    }).catch(() => {});
  }, []);

  // Предзаполнение из шаблона клуба
  useEffect(() => {
    if (templateApplied) return;

    // Параметр date
    const dateParam = searchParams.get('date');
    if (dateParam) setDate(dateParam);

    // Параметр clubTemplate — JSON из страницы клуба
    const clubTemplate = searchParams.get('clubTemplate');
    if (clubTemplate) {
      (async () => {
        try {
          const tmpl = JSON.parse(clubTemplate);
          if (tmpl.date) setDate(tmpl.date);

          // Получаем пол атлета для gender-aware загрузки
          let athleteGender: string | null = null;
          try {
            const profile = await userApi.getProfile();
            athleteGender = profile.user?.gender || null;
          } catch {}
          const isFemale = athleteGender === 'FEMALE';

          const newBlocks: BlockItem[] = [];

          // Skill блоки
          if (tmpl.skillBlocks) {
            for (const sb of tmpl.skillBlocks) {
              const hasPercent = sb.sets?.some((s: any) => s.weightIsPercent);
              const sets = sb.sets?.length > 0
                ? sb.sets.map((s: any) => ({
                    reps: String(s.reps || ''),
                    weight: s.weightIsPercent ? '' : String(s.weight || ''),
                    percentHint: s.weightIsPercent ? Number(s.weight) : undefined,
                  }))
                : Array.from({ length: 5 }, () => ({ reps: '', weight: '' }));
              // Атлет всегда вводит кг; проценты показываются как подсказка
              newBlocks.push({
                type: 'skill',
                data: { exerciseName: sb.exerciseName || '', weightIsPercent: false, sets },
              });
            }
          }

          // WOD блоки (поддержка объединённых RX/SC из шаблона клуба)
          if (tmpl.wodBlocks) {
            for (const wb of tmpl.wodBlocks) {
              const isLadder = wb.isLadder || false;
              const rounds = wb.ladderRounds || 5;
              const genderSplit = wb.hasGenderSplit || false;

              const mapExercises = (exs: any[]) => (exs || []).map((ex: any) => {
                // Если раздельные М/Ж и атлет — женщина, подставляем женские значения
                const useF = genderSplit && isFemale;
                const reps = useF && ex.repsFemale ? ex.repsFemale : ex.reps;
                const weight = useF && ex.weightFemale != null ? ex.weightFemale : ex.weight;
                return {
                  exerciseName: ex.exerciseName || '',
                  reps: String(reps || ''),
                  weight: weight ? String(weight) : '',
                  ladderRepsPerRound: isLadder
                    ? Array.from({ length: rounds }, () => String(reps || ''))
                    : [],
                  repsFemale: '',
                  weightFemale: '',
                  ladderRepsPerRoundFemale: [],
                  durationSeconds: ex.durationSeconds ? secondsToMmSs(ex.durationSeconds) : '',
                };
              });

              const hasScaled = wb._hasScaled === true;

              newBlocks.push({
                type: 'wod',
                data: {
                  wodType: wb.wodType || 'FOR_TIME',
                  level: wb.level || 'RX',
                  timeCapSeconds: wb.timeCapSeconds ? String(Math.floor(wb.timeCapSeconds / 60)) : '',
                  isLadder,
                  ladderRounds: rounds,
                  restBetweenRounds: wb.restBetweenRoundsSeconds ? secondsToMmSs(wb.restBetweenRoundsSeconds) : '',
                  resultDisplay: '',
                  resultSeconds: '',
                  resultTotalReps: '',
                  exercises: mapExercises(wb.exercises),
                  hasSeparateScaled: false,
                  scaledExercises: hasScaled
                    ? mapExercises(wb._scaledExercises)
                    : [emptyWodExercise()],
                  hasGenderSplit: false,
                  _templateRxExercises: hasScaled ? mapExercises(wb.exercises) : undefined,
                  _templateScExercises: hasScaled ? mapExercises(wb._scaledExercises) : undefined,
                } as any,
              });
            }
          }

          if (newBlocks.length > 0) {
            setBlocks(newBlocks);
            // Populate exerciseSettings for REST exercises from template
            const restSettings: Record<string, { hasWeight: boolean; measureUnit: string }> = {};
            for (const b of newBlocks) {
              if (b.type === 'wod') {
                for (const ex of [...b.data.exercises, ...b.data.scaledExercises]) {
                  if (ex.durationSeconds) restSettings[ex.exerciseName] = { hasWeight: false, measureUnit: 'time' };
                }
              }
            }
            if (Object.keys(restSettings).length > 0) setExerciseSettings(prev => ({ ...prev, ...restSettings }));
            setFromClubTemplate(true);
            setSaveAsClubTemplate(false);
            setToast('Шаблон тренировки загружен — заполните свой результат');
          }
        } catch {
          // Невалидный JSON — игнорируем
        }
      })();
    }
    setTemplateApplied(true);
  }, [searchParams, templateApplied]);

  // Скролл к новому блоку после добавления
  useEffect(() => {
    if (!newBlockRef.current) return;
    newBlockRef.current = false;
    requestAnimationFrame(() => {
      const allBlocks = document.querySelectorAll('.added-block');
      const last = allBlocks[allBlocks.length - 1];
      last?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [blocks.length]);

  // --- Добавление блоков ---
  function addSkillBlock() {
    const defaultSets = Array.from({ length: 5 }, () => ({ reps: '', weight: '' }));
    setBlocks(prev => [...prev, { type: 'skill', data: { exerciseName: '', weightIsPercent: false, sets: defaultSets } }]);
    newBlockRef.current = true;
  }

  const emptyWodExercise = (): WodExerciseForm => ({
    exerciseName: '', reps: '', weight: '', ladderRepsPerRound: [],
    exerciseNameFemale: '', repsFemale: '', weightFemale: '', ladderRepsPerRoundFemale: [],
    durationSeconds: '',
  });

  function addWodBlock() {
    newBlockRef.current = true;
    setBlocks(prev => [...prev, {
      type: 'wod',
      data: {
        wodType: 'FOR_TIME',
        level: 'RX',
        timeCapSeconds: '',
        isLadder: false,
        ladderRounds: 5,
        restBetweenRounds: '',
        resultDisplay: '',
        resultSeconds: '',
        resultTotalReps: '',
        exercises: [emptyWodExercise()],
        hasSeparateScaled: false,
        scaledExercises: [emptyWodExercise()],
        hasGenderSplit: false,
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
    updateSkillData(idx, b => {
      const prevValue = b.sets[0]?.[field] ?? '';
      return {
        ...b,
        sets: b.sets.map((s, j) => {
          if (j === setIdx) return { ...s, [field]: value };
          // При вводе в первый подход — синхронизировать подходы, которые совпадали со старым значением
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
      const newEx = emptyWodExercise();
      const result = { ...b, exercises: [...b.exercises, newEx] };
      // Синхронизация: добавить упражнение и в Sc
      if (b.hasSeparateScaled) {
        result.scaledExercises = [...b.scaledExercises, { ...newEx }];
      }
      return result;
    });
  }

  function updateWodExercise(idx: number, exIdx: number, field: keyof WodExerciseForm, value: string) {
    updateWodData(idx, b => {
      const oldMaleVal = b.exercises[exIdx]?.[field] ?? '';
      const newExercises = b.exercises.map((e, j) => j === exIdx ? { ...e, [field]: value } : e);
      const result = { ...b, exercises: newExercises };

      const femaleFieldMap: Partial<Record<string, keyof WodExerciseForm>> = {
        exerciseName: 'exerciseNameFemale',
        reps: 'repsFemale',
        weight: 'weightFemale',
      };
      const femaleField = femaleFieldMap[field as string];

      // Синхронизация Rx/Ж при гендерном сплите
      if (b.hasGenderSplit && femaleField) {
        const currentFemaleVal = b.exercises[exIdx]?.[femaleField] ?? '';
        if (!currentFemaleVal || currentFemaleVal === oldMaleVal) {
          result.exercises = result.exercises.map((e, j) =>
            j === exIdx ? { ...e, [femaleField]: value } : e
          );
        }
      }

      // Синхронизация Sc/М
      if (b.hasSeparateScaled && b.scaledExercises[exIdx]) {
        const scVal = b.scaledExercises[exIdx][field];
        if (scVal === oldMaleVal || scVal === '') {
          result.scaledExercises = b.scaledExercises.map((e, j) =>
            j === exIdx ? { ...e, [field]: value } : e
          );
        }
      }

      // Синхронизация Sc/Ж (если оба сплита включены)
      if (b.hasSeparateScaled && b.hasGenderSplit && femaleField && b.scaledExercises[exIdx]) {
        const scExercises = result.scaledExercises ?? b.scaledExercises;
        const currentScFemaleVal = b.scaledExercises[exIdx]?.[femaleField] ?? '';
        if (!currentScFemaleVal || currentScFemaleVal === oldMaleVal) {
          result.scaledExercises = scExercises.map((e, j) =>
            j === exIdx ? { ...e, [femaleField]: value } : e
          );
        }
      }

      return result;
    });
  }

  function updateWodLadderRep(idx: number, exIdx: number, roundIdx: number, value: string) {
    updateWodData(idx, b => {
      const oldRep = b.exercises[exIdx]?.ladderRepsPerRound?.[roundIdx] ?? '';

      function applyLadder(arr: string[]): string[] {
        const newArr = [...arr];
        const prevValue = newArr[0] ?? '';
        newArr[roundIdx] = value;
        if (roundIdx === 0) {
          for (let r = 1; r < newArr.length; r++) {
            if (!newArr[r] || newArr[r] === prevValue) newArr[r] = value;
          }
        }
        return newArr;
      }

      const newExercises = b.exercises.map((e, j) => {
        if (j !== exIdx) return e;
        const arr = Array.from({ length: b.ladderRounds }, (_, i) => (e.ladderRepsPerRound || [])[i] || '');
        return { ...e, ladderRepsPerRound: applyLadder(arr) };
      });
      const result: WodBlockForm = { ...b, exercises: newExercises };

      // Синхронизация Rx/Ж
      if (b.hasGenderSplit) {
        const currentFemaleRep = b.exercises[exIdx]?.ladderRepsPerRoundFemale?.[roundIdx] ?? '';
        if (!currentFemaleRep || currentFemaleRep === oldRep) {
          result.exercises = result.exercises.map((e, j) => {
            if (j !== exIdx) return e;
            const arr = Array.from({ length: b.ladderRounds }, (_, i) => (e.ladderRepsPerRoundFemale || [])[i] || '');
            return { ...e, ladderRepsPerRoundFemale: applyLadder(arr) };
          });
        }
      }

      // Синхронизация Sc/М
      if (b.hasSeparateScaled && b.scaledExercises[exIdx]) {
        const scRep = b.scaledExercises[exIdx]?.ladderRepsPerRound?.[roundIdx] ?? '';
        if (scRep === oldRep || scRep === '') {
          result.scaledExercises = b.scaledExercises.map((e, j) => {
            if (j !== exIdx) return e;
            const arr = Array.from({ length: b.ladderRounds }, (_, i) => (e.ladderRepsPerRound || [])[i] || '');
            return { ...e, ladderRepsPerRound: applyLadder(arr) };
          });
        }
      }

      // Синхронизация Sc/Ж
      if (b.hasSeparateScaled && b.hasGenderSplit && b.scaledExercises[exIdx]) {
        const scExercises = result.scaledExercises ?? b.scaledExercises;
        const currentScFemaleRep = b.scaledExercises[exIdx]?.ladderRepsPerRoundFemale?.[roundIdx] ?? '';
        if (!currentScFemaleRep || currentScFemaleRep === oldRep) {
          result.scaledExercises = scExercises.map((e, j) => {
            if (j !== exIdx) return e;
            const arr = Array.from({ length: b.ladderRounds }, (_, i) => (e.ladderRepsPerRoundFemale || [])[i] || '');
            return { ...e, ladderRepsPerRoundFemale: applyLadder(arr) };
          });
        }
      }

      return result;
    });
  }

  // --- Scaled WOD helpers ---
  function addScaledExercise(idx: number) {
    updateWodData(idx, b => ({
      ...b,
      scaledExercises: [...b.scaledExercises, emptyWodExercise()],
    }));
  }

  function updateScaledExercise(idx: number, exIdx: number, field: keyof WodExerciseForm, value: string) {
    updateWodData(idx, b => ({
      ...b,
      scaledExercises: b.scaledExercises.map((e, j) => j === exIdx ? { ...e, [field]: value } : e),
    }));
  }

  function removeScaledExercise(idx: number, exIdx: number) {
    const block = blocks[idx];
    if (block?.type === 'wod' && block.data.scaledExercises.length <= 1) {
      setToast('Нельзя удалить единственное упражнение');
      return;
    }
    updateWodData(idx, b => ({
      ...b,
      scaledExercises: b.scaledExercises.filter((_, j) => j !== exIdx),
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

  function copyRxToScaled(idx: number) {
    updateWodData(idx, b => ({
      ...b,
      scaledExercises: b.exercises.map(ex => ({ ...ex, ladderRepsPerRound: [...(ex.ladderRepsPerRound || [])], ladderRepsPerRoundFemale: [...(ex.ladderRepsPerRoundFemale || [])] })),
    }));
  }

  // --- Обновление женских полей (М/Ж) ---
  function updateFemaleField(blockIdx: number, exIdx: number, field: 'exerciseNameFemale' | 'repsFemale' | 'weightFemale', value: string, listKey: 'exercises' | 'scaledExercises' = 'exercises') {
    updateWodData(blockIdx, b => ({
      ...b,
      [listKey]: (b as any)[listKey].map((e: WodExerciseForm, j: number) => j === exIdx ? { ...e, [field]: value } : e),
    }));
  }

  function updateFemaleLadderRep(blockIdx: number, exIdx: number, roundIdx: number, value: string, listKey: 'exercises' | 'scaledExercises' = 'exercises') {
    updateWodData(blockIdx, b => ({
      ...b,
      [listKey]: (b as any)[listKey].map((e: WodExerciseForm, j: number) => {
        if (j !== exIdx) return e;
        const arr = [...(e.ladderRepsPerRoundFemale || [])];
        const prevValue = arr[0] ?? '';
        arr[roundIdx] = value;
        if (roundIdx === 0) {
          for (let r = 1; r < arr.length; r++) {
            if (!arr[r] || arr[r] === prevValue) arr[r] = value;
          }
        }
        return { ...e, ladderRepsPerRoundFemale: arr };
      }),
    }));
  }

  // Рендер суб-строки Ж
  function renderFemaleSubRow(wod: WodBlockForm, ex: WodExerciseForm, bi: number, ei: number, listKey: 'exercises' | 'scaledExercises' = 'exercises') {
    if (!wod.hasGenderSplit) return null;
    return (
      <div className={`wod-exercise-row-female${wod.isLadder ? ' ladder-mode' : ''}`}>
        <span className="gender-label">Ж:</span>
        <div className="wod-row-scroller">
          <ExerciseAutocomplete
            value={ex.exerciseNameFemale || ex.exerciseName}
            onChange={v => updateFemaleField(bi, ei, 'exerciseNameFemale', v === ex.exerciseName ? '' : v, listKey)}
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
                    value={ex.ladderRepsPerRoundFemale?.[ri] || ''}
                    onChange={e => updateFemaleLadderRep(bi, ei, ri, e.target.value, listKey)}
                    className="form-input-sm"
                    placeholder={`R${ri + 1}`}
                    min="1"
                  />
                ))}
              </div>
            ) : (
              <div className="single-reps-container" style={{ display: 'flex' }}>
                <input
                  type="number"
                  value={ex.repsFemale}
                  onChange={e => updateFemaleField(bi, ei, 'repsFemale', e.target.value, listKey)}
                  className="form-input-sm"
                  placeholder={getMeasureUnit(ex.exerciseName) === 'calories' ? 'Cal' : getMeasureUnit(ex.exerciseName) === 'meters' ? 'м' : 'Повт'}
                  min="1"
                />
              </div>
            )}
            {!getHideWeight(ex.exerciseName) && (
              <input
                type="number"
                value={ex.weightFemale}
                onChange={e => updateFemaleField(bi, ei, 'weightFemale', e.target.value, listKey)}
                className="form-input-sm wod-weight"
                placeholder="Вес, кг"
                min="0.5"
                step="0.5"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  function removeWodExercise(idx: number, exIdx: number) {
    const block = blocks[idx];
    if (block?.type === 'wod' && block.data.exercises.length <= 1) {
      setToast('Нельзя удалить единственное упражнение');
      return;
    }
    updateWodData(idx, b => {
      const result = { ...b, exercises: b.exercises.filter((_, j) => j !== exIdx) };
      // Синхронизация: удалить и из Sc если длины совпадали
      if (b.hasSeparateScaled && b.scaledExercises.length === b.exercises.length) {
        result.scaledExercises = b.scaledExercises.filter((_, j) => j !== exIdx);
      }
      return result;
    });
  }

  // --- Отправка формы ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (blocks.length === 0) {
      setError('Добавьте хотя бы один блок (Скилл или ВОД)');
      return;
    }

    // Валидация формата времени в WOD FOR_TIME
    const wodBlocks_ = blocks.filter((b): b is { type: 'wod'; data: WodBlockForm } => b.type === 'wod').map(b => b.data);
    for (const w of wodBlocks_) {
      const hasResult = w.resultDisplay.trim() !== '';
      if (w.wodType === 'FOR_TIME' && hasResult && !isValidMmSs(w.resultDisplay)) {
        setError('Время результата должно быть в формате ММ:СС (например, 04:20)');
        return;
      }
      // Если не тренер/владелец — результат обязателен
      if (!canSkipResult && w.wodType === 'FOR_TIME' && !hasResult) {
        setError('Заполните результат WOD');
        return;
      }
      if (!canSkipResult && w.wodType === 'AMRAP' && !w.resultTotalReps.trim()) {
        setError('Заполните результат WOD');
        return;
      }
    }

    // Попап подтверждения для атлета, который хочет сохранить как шаблон клуба
    if (hasClub && saveAsClubTemplate && !fromClubTemplate && clubRole === 'ATHLETE' && !showAthleteTemplateConfirm) {
      setShowAthleteTemplateConfirm(true);
      return;
    }
    setShowAthleteTemplateConfirm(false);

    setLoading(true);
    try {
      const skillBlocks = blocks.filter((b): b is { type: 'skill'; data: SkillBlockForm } => b.type === 'skill').map(b => b.data);
      const wodBlocks = wodBlocks_;

      // Определяем, является ли это шаблоном без результата (тренер/владелец создаёт шаблон)
      const noWodResults = wodBlocks.every(b => !b.resultDisplay.trim() && !b.resultTotalReps.trim());
      const isTemplateOnly = canSkipResult && noWodResults;

      const payload: WorkoutInput = {
        date,
        comment: comment.trim() || undefined,
        isClubTemplate: hasClub && saveAsClubTemplate && !fromClubTemplate ? true : undefined,
        isTemplateOnly: isTemplateOnly || undefined,
        showInLeaderboard: showInLeaderboard,
        skillBlocks: skillBlocks.length > 0
          ? skillBlocks.map(b => ({
              exerciseName: b.exerciseName,
              sets: b.sets.map(s => ({
                reps: parseInt(s.reps),
                weight: s.weight ? parseFloat(s.weight) : undefined,
                weightIsPercent: b.weightIsPercent || undefined,
              })),
            }))
          : undefined,
        newExercises: Object.entries(exerciseSettings).map(([name, s]) => ({ name, ...s })),
        wodBlocks: wodBlocks.length > 0
          ? wodBlocks.flatMap(b => {
              const hasResultValue = b.resultDisplay.trim() !== '' || b.resultTotalReps.trim() !== '';

              function buildWodPayload(exercises: WodExerciseForm[], level: 'RX' | 'SCALED') {
                return {
                  wodType: b.wodType,
                  level,
                  timeCapSeconds: b.timeCapSeconds ? parseInt(b.timeCapSeconds) * 60 : undefined,
                  isLadder: b.isLadder,
                  ladderRounds: b.isLadder ? b.ladderRounds : undefined,
                  restBetweenRoundsSeconds: b.isLadder && b.restBetweenRounds ? parseMmSs(b.restBetweenRounds) : undefined,
                  resultType: b.wodType === 'FOR_TIME' ? 'TIME' as const : b.wodType === 'AMRAP' ? 'REPS' as const : 'TIME' as const,
                  resultDisplay: (b.wodType === 'EMOM' || b.wodType === 'TABATA')
                    ? (b.timeCapSeconds ? `${b.timeCapSeconds} мин` : b.wodType)
                    : (hasResultValue ? b.resultDisplay : (canSkipResult ? '' : b.resultDisplay)),
                  resultSeconds: b.wodType === 'FOR_TIME' && b.resultSeconds ? parseMmSs(b.resultSeconds) : undefined,
                  resultTotalReps: b.wodType === 'AMRAP' && b.resultTotalReps ? parseInt(b.resultTotalReps) : undefined,
                  hasGenderSplit: b.hasGenderSplit || undefined,
                  exercises: exercises.map(ex => {
                    let reps = parseInt(ex.reps) || 0;
                    if (b.isLadder && ex.ladderRepsPerRound.length > 0) {
                      const vals = ex.ladderRepsPerRound.filter(v => v).map(v => parseInt(v) || 0);
                      reps = vals.length > 0 ? vals[0] : reps;
                    }
                    let repsFemale: number | undefined;
                    let weightFemale: number | undefined;
                    if (b.hasGenderSplit) {
                      if (b.isLadder && ex.ladderRepsPerRoundFemale?.length > 0) {
                        const fVals = ex.ladderRepsPerRoundFemale.filter(v => v).map(v => parseInt(v) || 0);
                        repsFemale = fVals.length > 0 ? fVals[0] : (parseInt(ex.repsFemale) || undefined);
                      } else if (ex.repsFemale) {
                        repsFemale = parseInt(ex.repsFemale) || undefined;
                      }
                      if (ex.weightFemale && !getHideWeight(ex.exerciseName)) {
                        weightFemale = parseFloat(ex.weightFemale) || undefined;
                      }
                    }
                    const exerciseNameFemale = b.hasGenderSplit && ex.exerciseNameFemale && ex.exerciseNameFemale !== ex.exerciseName
                      ? ex.exerciseNameFemale
                      : undefined;
                    return {
                      exerciseName: ex.exerciseName,
                      reps,
                      weight: ex.weight && !getHideWeight(ex.exerciseName) ? parseFloat(ex.weight) : undefined,
                      repsFemale,
                      weightFemale,
                      exerciseNameFemale,
                      durationSeconds: getMeasureUnit(ex.exerciseName) === 'time' ? parseMmSs(ex.durationSeconds) : undefined,
                    };
                  }),
                };
              }

              if (b.hasSeparateScaled && canSkipResult) {
                // Два блока: Rx + Scaled с разными упражнениями
                return [
                  buildWodPayload(b.exercises, 'RX'),
                  buildWodPayload(b.scaledExercises, 'SCALED'),
                ];
              }
              return [buildWodPayload(b.exercises, b.level)];
            })
          : undefined,
      };

      await workoutsApi.create(payload);
      if (saveAsClubTemplate && !fromClubTemplate && clubId) {
        router.push('/dashboard/club');
      } else {
        router.push('/dashboard/workouts');
      }
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

  return (
    <div className="container">
      <h1 className="page-title">Новая тренировка</h1>

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

                  {!getHideWeight(skill.exerciseName) && <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <label style={{ margin: 0 }}>{skill.weightIsPercent ? '% от 1RM для каждого подхода' : 'Вес для каждого подхода (кг, необязательно)'}</label>
                      {canSkipResult && (
                        <div className="unit-toggle">
                          <button
                            type="button"
                            className={`unit-toggle-btn${!skill.weightIsPercent ? ' active' : ''}`}
                            onClick={() => {
                              if (skill.weightIsPercent) setBlocks(prev => prev.map((b, i) => {
                                if (i !== bi || b.type !== 'skill') return b;
                                return { ...b, data: { ...b.data, weightIsPercent: false, sets: b.data.sets.map(s => ({ ...s, weight: '' })) } };
                              }));
                            }}
                          >кг</button>
                          <button
                            type="button"
                            className={`unit-toggle-btn${skill.weightIsPercent ? ' active' : ''}`}
                            onClick={() => {
                              if (!skill.weightIsPercent) setBlocks(prev => prev.map((b, i) => {
                                if (i !== bi || b.type !== 'skill') return b;
                                return { ...b, data: { ...b.data, weightIsPercent: true, sets: b.data.sets.map(s => ({ ...s, weight: '' })) } };
                              }));
                            }}
                          >%</button>
                        </div>
                      )}
                    </div>
                    <div className="sets-inputs-container sets-container weight-inputs-container">
                      {skill.sets.map((set, si) => (
                        <div key={si} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {set.percentHint != null && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 500, marginBottom: '2px' }}>
                              {set.percentHint}%
                            </span>
                          )}
                          <input
                            type="number"
                            value={set.weight}
                            onChange={e => updateSkillSet(bi, si, 'weight', e.target.value)}
                            className="form-input set-input"
                            placeholder={skill.weightIsPercent ? '%' : `${si + 1}`}
                            min={skill.weightIsPercent ? '1' : '0.5'}
                            step={skill.weightIsPercent ? '1' : '0.5'}
                            max={skill.weightIsPercent ? '100' : undefined}
                          />
                        </div>
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

                {/* Переключатели режимов — только для тренера/владельца */}
                {canSkipResult && (
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
                            exercises: b.exercises.map(ex => ({
                              ...ex,
                              repsFemale: ex.reps,
                              weightFemale: ex.weight,
                              ladderRepsPerRoundFemale: [...(ex.ladderRepsPerRound || [])],
                            })),
                            scaledExercises: b.scaledExercises.map(ex => ({
                              ...ex,
                              repsFemale: ex.reps,
                              weightFemale: ex.weight,
                              ladderRepsPerRoundFemale: [...(ex.ladderRepsPerRound || [])],
                            })),
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
                        onChange={e => {
                          const newLevel = e.target.value as WodLevel;
                          const data = wod as any;
                          // Подгружаем упражнения из шаблона при переключении RX/SC
                          if (data._templateRxExercises && data._templateScExercises) {
                            const exercises = newLevel === 'RX' ? data._templateRxExercises : data._templateScExercises;
                            updateWodBlock(bi, { level: newLevel, exercises: exercises.map((ex: any) => ({ ...ex })) });
                          } else {
                            updateWodBlock(bi, { level: newLevel });
                          }
                        }}
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
                  <div className="form-row">
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
                    <div className="form-group">
                      <label>Отдых между раундами</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="02:00"
                        value={wod.restBetweenRounds}
                        onChange={e => updateWodBlock(bi, { restBetweenRounds: formatMmSsInput(e.target.value, wod.restBetweenRounds) })}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>{wod.hasSeparateScaled ? <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.05rem' }}>Rx план</span> : 'Упражнения'}</label>
                  <div className="wod-exercises-container">
                    {wod.exercises.map((ex, ei) => (
                      <React.Fragment key={ei}>
                        <div className={wod.hasGenderSplit ? 'wod-exercise-gender-group' : undefined}>
                          <div className={wod.hasGenderSplit ? 'wod-exercise-gender-rows' : undefined}>
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
                                          value={ex.reps ?? ''}
                                          onChange={e => updateWodExercise(bi, ei, 'reps', e.target.value)}
                                          className="form-input-sm"
                                          placeholder={getMeasureUnit(ex.exerciseName) === 'calories' ? 'Cal' : getMeasureUnit(ex.exerciseName) === 'meters' ? 'м' : 'Повт'}
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
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => removeWodExercise(bi, ei)}
                                >❌</button>
                              )}
                            </div>
                            {renderFemaleSubRow(wod, ex, bi, ei, 'exercises')}
                          </div>
                          {wod.hasGenderSplit && (
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => removeWodExercise(bi, ei)}
                            >❌</button>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <button type="button" onClick={() => addWodExercise(bi)} className="btn-add">
                    + Добавить упражнение
                  </button>
                </div>

                {/* Sc план — отдельный набор упражнений */}
                {wod.hasSeparateScaled && (
                  <div className="form-group" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px dashed var(--border-color)' }}>
                    <label><span style={{ color: 'var(--color-secondary)', fontWeight: 700, fontSize: '1.05rem' }}>Sc план</span></label>
                    <div className="wod-exercises-container">
                      {wod.scaledExercises.map((ex, ei) => (
                        <React.Fragment key={ei}>
                          <div className={wod.hasGenderSplit ? 'wod-exercise-gender-group' : undefined}>
                            <div className={wod.hasGenderSplit ? 'wod-exercise-gender-rows' : undefined}>
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
                                              onChange={e => updateScaledLadderRep(bi, ei, ri, e.target.value)}
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
                                          value={ex.reps ?? ''}
                                          onChange={e => updateScaledExercise(bi, ei, 'reps', e.target.value)}
                                          className="form-input-sm"
                                          placeholder={getMeasureUnit(ex.exerciseName) === 'calories' ? 'Cal' : getMeasureUnit(ex.exerciseName) === 'meters' ? 'м' : 'Повт'}
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
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => removeScaledExercise(bi, ei)}
                                  >❌</button>
                                )}
                              </div>
                              {renderFemaleSubRow(wod, ex, bi, ei, 'scaledExercises')}
                            </div>
                            {wod.hasGenderSplit && (
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => removeScaledExercise(bi, ei)}
                              >❌</button>
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    <button type="button" onClick={() => addScaledExercise(bi)} className="btn-add">
                      + Добавить упражнение
                    </button>
                  </div>
                )}

                {wod.wodType !== 'EMOM' && wod.wodType !== 'TABATA' && !saveAsClubTemplate && (
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
                      required={!canSkipResult}
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
                      pattern={canSkipResult ? undefined : "\\d{1,2}:\\d{2}"}
                      required={!canSkipResult}
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

        {/* Чекбокс "Сохранить как шаблон в клубе" — скрыт при записи результата по шаблону тренера */}
        {hasClub && !fromClubTemplate && (
          <div className="club-template-checkbox" style={{ marginTop: '2rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={saveAsClubTemplate}
                onChange={e => setSaveAsClubTemplate(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <span>Сохранить как шаблон в моем клубе</span>
              <span
                className="template-info-icon"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', position: 'relative' }}
                onClick={(e) => { e.preventDefault(); setShowTemplateTooltip(!showTemplateTooltip); }}
              >
                i
              </span>
            </label>
            {showTemplateTooltip && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Атлеты из вашего клуба смогут тоже записать результаты этой тренировки
              </div>
            )}
          </div>
        )}

        {/* Чекбокс "Учитывать в лидерборде" */}
        {hasClub && !saveAsClubTemplate && (
          <div style={{ marginTop: '1rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={showInLeaderboard}
                onChange={e => setShowInLeaderboard(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <span>Учитывать тренировку в лидерборде клуба</span>
            </label>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {showAthleteTemplateConfirm && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
          }}>
            <div style={{
              background: 'var(--bg-card, #fff)', borderRadius: '12px', padding: '1.5rem',
              maxWidth: '400px', width: '100%', textAlign: 'center'
            }}>
              <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: 1.5, color: '#000' }}>
                Вы уверены, что хотите сохранить тренировку как шаблон клуба? Эта тренировка появится на странице «ВОД дня» для всех атлетов.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAthleteTemplateConfirm(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Да, сохранить
                </button>
              </div>
            </div>
          </div>
        )}

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
