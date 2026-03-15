'use client';

import { useState } from 'react';

interface CustomDatePickerProps {
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  onApply: () => void;
  onReset: () => void;
}

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'all' | 'custom';

const PRESET_LABELS: Record<Preset, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: 'Неделя',
  month: 'Месяц',
  quarter: 'Квартал',
  all: 'За всё время',
  custom: 'Период',
};

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function CustomDatePicker({ startDate, endDate, onChange, onApply, onReset }: CustomDatePickerProps) {
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  function applyPreset(preset: Preset) {
    setActivePreset(preset);
    if (preset === 'custom') {
      // Just show the inputs, don't auto-apply
      return;
    }

    const now = new Date();
    const today = toYMD(now);

    let start = today;
    let end = today;

    if (preset === 'today') {
      start = today;
      end = today;
    } else if (preset === 'yesterday') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      start = toYMD(d);
      end = toYMD(d);
    } else if (preset === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = toYMD(d);
      end = today;
    } else if (preset === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      start = toYMD(d);
      end = today;
    } else if (preset === 'quarter') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      start = toYMD(d);
      end = today;
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    onChange(start, end);
    if (preset === 'all') {
      onReset();
    } else {
      onApply();
    }
  }

  return (
    <div>
      <div className="date-picker-presets">
        {(Object.keys(PRESET_LABELS) as Preset[]).map(p => (
          <button
            key={p}
            type="button"
            className={`preset-btn${activePreset === p ? ' active' : ''}`}
            onClick={() => applyPreset(p)}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {activePreset === 'custom' && (
        <div className="date-range-inputs" style={{ marginTop: '0.75rem' }}>
          <div className="date-input-group">
            <label>От</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={e => onChange(e.target.value, endDate)}
              style={{ width: '150px' }}
            />
          </div>
          <div className="date-input-group">
            <label>До</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={e => onChange(startDate, e.target.value)}
              style={{ width: '150px' }}
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
            Применить
          </button>
          {(startDate || endDate) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onReset(); setActivePreset(null); }}>
              Сбросить
            </button>
          )}
        </div>
      )}
    </div>
  );
}
