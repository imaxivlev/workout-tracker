'use client';

import { useState, useRef, useEffect } from 'react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDisplay(ymd: string): string {
  if (!ymd) return 'Выберите дату';
  const [y, m, d] = ymd.split('-');
  return `${d}.${m}.${y}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

interface Props {
  value: string;        // YYYY-MM-DD
  onChange: (ymd: string) => void;
  maxDate?: string;     // YYYY-MM-DD, default = today
  allowFuture?: boolean;
  className?: string;
  markedDates?: Record<string, { hasSkill: boolean; hasWod: boolean }>;
}

export function SingleDatePicker({ value, onChange, maxDate, allowFuture, className, markedDates }: Props) {
  const now = new Date();
  const today = toYMD(now);
  const farFuture = `${now.getFullYear() + 2}-12-31`;
  const max = maxDate || (allowFuture ? farFuture : today);

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => value ? parseInt(value.split('-')[0]) : now.getFullYear());
  const [month, setMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : now.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync month/year when value changes externally
  useEffect(() => {
    if (value) {
      setYear(parseInt(value.split('-')[0]));
      setMonth(parseInt(value.split('-')[1]) - 1);
    }
  }, [value]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    const nextY = month === 11 ? year + 1 : year;
    const nextM = month === 11 ? 0 : month + 1;
    const firstOfNext = `${nextY}-${String(nextM + 1).padStart(2, '0')}-01`;
    if (firstOfNext > max) return; // don't go past max
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function handleDayClick(ymd: string) {
    if (ymd > max) return;
    onChange(ymd);
    setOpen(false);
  }

  const days = getDaysInMonth(year, month);
  const firstWd = getFirstWeekday(year, month);
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const maxMonth = max.substring(0, 7);
  const canGoNext = monthStr < maxMonth;

  return (
    <div ref={containerRef} className={`sdp-container${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="sdp-trigger"
        onClick={() => setOpen(o => !o)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {formatDisplay(value)}
      </button>

      {open && (
        <div className="sdp-dropdown">
          <div className="sdp-nav">
            <button type="button" className="sdp-nav-btn" onClick={prevMonth}>‹</button>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{MONTHS_RU[month]} {year}</span>
            <button type="button" className="sdp-nav-btn" onClick={nextMonth} disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.3 }}>›</button>
          </div>
          <div className="calendar-header">
            {WEEKDAYS.map(w => <div key={w} className="weekday-label">{w}</div>)}
          </div>
          <div className="calendar-days-grid">
            {cells.map((ymd, i) => {
              if (!ymd) return <div key={i} className="day-cell empty" />;
              const isFuture = ymd > max;
              const isSelected = ymd === value;
              const isToday = ymd === today;
              const mark = markedDates?.[ymd];
              let cls = 'day-cell';
              if (isFuture) cls += ' empty';
              else if (isSelected) cls += ' selected';
              return (
                <div
                  key={ymd}
                  className={cls}
                  onClick={() => !isFuture && handleDayClick(ymd)}
                  style={isToday && !isSelected ? { fontWeight: 700, color: 'var(--color-primary)' } : undefined}
                >
                  {parseInt(ymd.split('-')[2])}
                  {mark && (mark.hasSkill || mark.hasWod) && (
                    <div className="workout-dots">
                      {mark.hasWod && <div className="dot dot-wod" />}
                      {mark.hasSkill && <div className="dot dot-skill" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
