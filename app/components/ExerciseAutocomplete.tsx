'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { exercisesApi, Exercise } from '@/lib/api/client';

// Русские названия для глобальных упражнений
const EXERCISE_RU_NAMES: Record<string, string> = {
  'Back Squat': 'Приседания со штангой на спине (Back Squat)',
  'Front Squat': 'Фронтальные приседания (Front Squat)',
  'Deadlift': 'Становая тяга (Deadlift)',
  'Bench Press': 'Жим лежа (Bench Press)',
  'Overhead Press': 'Жим стоя (Overhead Press)',
  'Snatch': 'Рывок (Snatch)',
  'Clean & Jerk': 'Толчок (Clean & Jerk)',
  'Clean': 'Взятие на грудь (Clean)',
  'Pull-ups': 'Подтягивания (Pull-ups)',
  'Push-ups': 'Отжимания (Push-ups)',
  'Burpees': 'Берпи (Burpees)',
  'Box Jumps': 'Запрыгивания на коробку (Box Jumps)',
  'Kettlebell Swing': 'Махи гирей (Kettlebell Swing)',
  'Thruster': 'Трастеры (Thrusters)',
  'Wall Balls': 'Броски мяча (Wall Balls)',
  'Rope Climbs': 'Лазание по канату (Rope Climbs)',
  'Row': 'Гребля (Row)',
  'Bike': 'Велотренажер (Bike)',
  'Run': 'Бег (Run)',
  'SkiErg': 'Лыжный тренажер (SkiErg)',
  'Ring Muscle-ups': 'Выходы на кольцах (Ring Muscle-ups)',
  'Bar Muscle-ups': 'Выходы на перекладине (Bar Muscle-ups)',
  'Squats': 'Приседания (Squats)',
};

function formatExerciseName(name: string): string {
  return EXERCISE_RU_NAMES[name] || name;
}

interface ExerciseAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
  wrapperClassName?: string;
}

export function ExerciseAutocomplete({ value, onChange, placeholder, inputClassName, wrapperClassName }: ExerciseAutocompleteProps) {
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [filtered, setFiltered] = useState<Exercise[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Загрузить все упражнения один раз
  const loadExercises = useCallback(async () => {
    if (loaded) return;
    try {
      const data = await exercisesApi.search('', 200);
      setAllExercises(data.exercises);
      setLoaded(true);
    } catch {
      // ignore
    }
  }, [loaded]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleFocus() {
    loadExercises().then(() => {
      // При фокусе — показать все или отфильтрованные
      filterList(value);
      setOpen(true);
    });
  }

  function filterList(query: string) {
    if (!query.trim()) {
      setFiltered(allExercises);
      return;
    }
    const lower = query.toLowerCase();
    const result = allExercises.filter(ex => {
      const ruName = formatExerciseName(ex.name).toLowerCase();
      return ruName.includes(lower) || ex.name.toLowerCase().includes(lower);
    });
    setFiltered(result);
  }

  function handleInput(v: string) {
    onChange(v);
    filterList(v);
    setOpen(true);
  }

  function selectSuggestion(name: string) {
    onChange(name);
    setOpen(false);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setOpen(false), 200);
  }

  function handleMouseDownItem() {
    // Предотвратить закрытие от blur
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
  }

  // Обновить фильтр когда загрузятся упражнения
  useEffect(() => {
    if (loaded && open) {
      filterList(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <div ref={wrapperRef} className={wrapperClassName} style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={inputClassName || "form-input"}
        placeholder={placeholder || 'Начните вводить или кликните для списка'}
        autoComplete="off"
        required
      />
      {open && filtered.length > 0 && (
        <div className="autocomplete-dropdown active">
          {filtered.map(ex => (
            <div
              key={ex.id}
              onMouseDown={handleMouseDownItem}
              onClick={() => selectSuggestion(ex.name)}
              className="autocomplete-item"
            >
              {formatExerciseName(ex.name)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
