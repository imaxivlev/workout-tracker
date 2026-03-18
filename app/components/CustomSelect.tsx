'use client';

import { useState, useRef, useEffect } from 'react';

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

export default function CustomSelect({ options, value, onChange, style }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
      <div
        className="form-select custom-select-trigger"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
      >
        <span className="custom-select-text">{selectedLabel}</span>
        <span className="custom-select-arrow" style={{ fontSize: '0.8rem' }}>▼</span>
      </div>
      <div
        className={`autocomplete-dropdown custom-select-dropdown${open ? ' active' : ''}`}
        style={{ width: '100%', maxHeight: '200px', overflowY: 'auto', zIndex: 10001 }}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className="autocomplete-item custom-select-item"
            style={opt.value === value ? { backgroundColor: 'var(--bg-secondary)', color: 'var(--color-primary)' } : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt.value);
              setOpen(false);
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}
