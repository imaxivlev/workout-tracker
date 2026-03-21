'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { exercisesApi, Exercise } from '@/lib/api/client';
import { formatForDropdown, enToRuName } from '@/lib/exercise-names';

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
      const dropdownName = formatForDropdown(ex.name).toLowerCase();
      return dropdownName.includes(lower) || ex.name.toLowerCase().includes(lower);
    });
    setFiltered(result);
  }

  function handleInput(v: string) {
    onChange(v);
    filterList(v);
    setOpen(true);
  }

  function selectSuggestion(ex: Exercise) {
    // Сохраняем русское название (для глобальных), или как есть (для пользовательских)
    const ruName = enToRuName(ex.name);
    onChange(ruName);
    setOpen(false);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setOpen(false), 200);
  }

  function handleMouseDownItem() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
  }

  useEffect(() => {
    if (loaded && open) {
      filterList(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <div ref={wrapperRef} className={wrapperClassName} style={{ position: 'relative', flex: 1 }}>
      <div style={{ position: 'relative' }}>
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
          style={value ? { paddingRight: '2.2rem' } : undefined}
        />
        {value && (
          <button
            type="button"
            className="autocomplete-clear-btn"
            onMouseDown={e => { e.preventDefault(); onChange(''); filterList(''); }}
            tabIndex={-1}
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="autocomplete-dropdown active">
          {filtered.map(ex => (
            <div
              key={ex.id}
              onMouseDown={handleMouseDownItem}
              onClick={() => selectSuggestion(ex)}
              className="autocomplete-item"
            >
              {formatForDropdown(ex.name)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
