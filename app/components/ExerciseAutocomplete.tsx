'use client';

import { useState, useRef, useEffect } from 'react';
import { exercisesApi, Exercise } from '@/lib/api/client';

interface ExerciseAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
  wrapperClassName?: string;
}

export function ExerciseAutocomplete({ value, onChange, placeholder, inputClassName, wrapperClassName }: ExerciseAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Exercise[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInput(v: string) {
    onChange(v);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (v.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setSearching(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await exercisesApi.search(v);
        setSuggestions(data.exercises);
        setOpen(data.exercises.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectSuggestion(name: string) {
    onChange(name);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapperRef} className={wrapperClassName} style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        className={inputClassName || "form-input"}
        placeholder={placeholder || 'Название упражнения'}
        autoComplete="off"
        required
      />
      {searching && (
        <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
          ...
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown active">
          {suggestions.map(ex => (
            <li
              key={ex.id}
              onClick={() => selectSuggestion(ex.name)}
              className="autocomplete-item"
            >
              {ex.name}
              {ex.isGlobal && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  глобальное
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
