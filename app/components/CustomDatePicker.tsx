'use client';

import { useState, useRef, useEffect } from 'react';

export interface WorkoutDateMarker {
  hasSkill: boolean;
  hasWod: boolean;
}

interface CustomDatePickerProps {
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  onApply: () => void;
  onReset: () => void;
  workoutDates?: Record<string, WorkoutDateMarker>;
}

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'all' | 'custom';

const PRESET_LABELS: Record<Preset, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: 'Неделя',
  month: 'Месяц',
  quarter: 'Квартал',
  all: 'За все время',
  custom: 'Период',
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDisplay(start: string, end: string): string {
  if (!start && !end) return 'Выберите период';
  const fmt = (s: string) => {
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  };
  if (start === end) return fmt(start);
  if (!end) return `с ${fmt(start)}`;
  return `${fmt(start)} — ${fmt(end)}`;
}

function formatDMY(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}.${m}.${y}`;
}

function parseDMY(dmy: string): string {
  // "дд.мм.гггг" → "YYYY-MM-DD"
  const parts = dmy.split('.');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
}

/** Get days in a month (1-based) */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Get weekday (0=Mon … 6=Sun) of first day */
function getFirstWeekday(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7; // Convert Sun=0 to Mon=0
}

interface CalendarMonthProps {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  hoverDate: string;
  today: string;
  onDayClick: (ymd: string) => void;
  onDayHover: (ymd: string) => void;
  workoutDates?: Record<string, WorkoutDateMarker>;
}

function CalendarMonth({
  year, month, startDate, endDate, hoverDate, today,
  onDayClick, onDayHover, workoutDates,
}: CalendarMonthProps) {
  const days = getDaysInMonth(year, month);
  const firstWd = getFirstWeekday(year, month);
  const cells: (string | null)[] = [];

  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }

  // Range end for hover preview
  const rangeEnd = endDate || hoverDate;

  return (
    <div className="calendar-month">
      <div className="month-title">{MONTHS_RU[month]} {year}</div>
      <div className="calendar-header">
        {WEEKDAYS.map(w => (
          <div key={w} className="weekday-label">{w}</div>
        ))}
      </div>
      <div className="calendar-days-grid">
        {cells.map((ymd, i) => {
          if (!ymd) return <div key={i} className="day-cell empty" />;
          const isFuture = ymd > today;
          const isStart = ymd === startDate;
          const isEnd = ymd === rangeEnd && rangeEnd !== startDate;
          const inRange = startDate && rangeEnd && ymd > startDate && ymd < rangeEnd;
          const isToday = ymd === today;

          let cls = 'day-cell';
          if (isFuture) cls += ' empty'; // disable future dates
          else if (isStart && rangeEnd && rangeEnd !== startDate) cls += ' range-start';
          else if (isStart) cls += ' selected';
          else if (isEnd) cls += ' range-end';
          else if (inRange) cls += ' range-between';

          const marker = workoutDates?.[ymd];

          return (
            <div
              key={ymd}
              className={cls}
              onClick={() => !isFuture && onDayClick(ymd)}
              onMouseEnter={() => !isFuture && onDayHover(ymd)}
              style={isToday && !isStart && !isEnd ? { fontWeight: 700, color: 'var(--color-primary)' } : undefined}
              title={ymd}
            >
              {parseInt(ymd.split('-')[2])}
              {marker && (
                <span className="workout-dots">
                  {marker.hasWod && <span className="dot dot-wod" />}
                  {marker.hasSkill && <span className="dot dot-skill" />}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CustomDatePicker({ startDate, endDate, onChange, onApply, onReset, workoutDates }: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [hoverDate, setHoverDate] = useState('');
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [startInput, setStartInput] = useState(formatDMY(startDate));
  const [endInput, setEndInput] = useState(formatDMY(endDate));

  // Month offset: 0 means current month is the rightmost
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0); // negative = going back in time
  const today = toYMD(now);

  // Adaptive month count: 1 on mobile, 2 on tablet, 3 on desktop
  const [monthsToShow, setMonthsToShow] = useState(3);

  useEffect(() => {
    function updateMonthCount() {
      const w = window.innerWidth;
      if (w < 481) setMonthsToShow(1);
      else if (w <= 768) setMonthsToShow(2);
      else setMonthsToShow(3);
    }
    updateMonthCount();
    window.addEventListener('resize', updateMonthCount);
    return () => window.removeEventListener('resize', updateMonthCount);
  }, []);

  const months = Array.from({ length: monthsToShow }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset - (monthsToShow - 1) + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync inputs when props change
  useEffect(() => {
    setStartInput(formatDMY(startDate));
    setEndInput(formatDMY(endDate));
  }, [startDate, endDate]);

  function applyPreset(preset: Preset) {
    setActivePreset(preset);
    if (preset === 'custom') return;

    const d = new Date();
    const todayStr = toYMD(d);
    let start = todayStr, end = todayStr;

    if (preset === 'yesterday') {
      d.setDate(d.getDate() - 1);
      start = end = toYMD(d);
    } else if (preset === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - 7);
      start = toYMD(w); end = todayStr;
    } else if (preset === 'month') {
      start = toYMD(new Date(now.getFullYear(), now.getMonth(), 1));
      end = todayStr;
    } else if (preset === 'quarter') {
      const q = new Date(now); q.setMonth(q.getMonth() - 3);
      start = toYMD(q); end = todayStr;
    } else if (preset === 'all') {
      onChange('', ''); onReset(); setOpen(false); return;
    }

    onChange(start, end);
    setStartInput(formatDMY(start));
    setEndInput(formatDMY(end));
    setSelecting('start');
    onApply();
    setOpen(false);
  }

  function handleDayClick(ymd: string) {
    if (selecting === 'start') {
      onChange(ymd, '');
      setStartInput(formatDMY(ymd));
      setEndInput('');
      setSelecting('end');
    } else {
      if (ymd < startDate) {
        // Clicked before start: swap
        onChange(ymd, startDate);
        setStartInput(formatDMY(ymd));
        setEndInput(formatDMY(startDate));
      } else {
        onChange(startDate, ymd);
        setEndInput(formatDMY(ymd));
      }
      setSelecting('start');
      setActivePreset('custom');
    }
  }

  function handleStartInput(val: string) {
    setStartInput(val);
    const ymd = parseDMY(val);
    if (ymd) onChange(ymd, endDate);
  }

  function handleEndInput(val: string) {
    setEndInput(val);
    const ymd = parseDMY(val);
    if (ymd) onChange(startDate, ymd);
  }

  function handleApply() {
    onApply();
    setOpen(false);
  }

  function handleReset() {
    onReset();
    setActivePreset(null);
    setStartInput('');
    setEndInput('');
    setSelecting('start');
    setOpen(false);
  }

  const displayText = (!startDate && !endDate)
    ? (activePreset && activePreset !== 'custom' ? PRESET_LABELS[activePreset] : 'Выберите период')
    : formatDisplay(startDate, endDate);

  return (
    <div ref={containerRef} className="date-filter-container" style={{ position: 'relative', marginBottom: '1rem' }}>
      {/* Кнопка-триггер */}
      <label>Период</label>
      <button
        type="button"
        className="form-input"
        onClick={() => setOpen(o => !o)}
        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <span>{displayText}</span>
        <span>📅</span>
      </button>

      {/* Модальное окно */}
      {open && (
        <div className="date-picker-modal active">
          {/* Поля ввода дат */}
          <div className="date-range-inputs">
            <div className="date-input-group">
              <label>От</label>
              <input
                type="text"
                className="form-input-sm"
                placeholder="дд.мм.гггг"
                value={startInput}
                onChange={e => handleStartInput(e.target.value)}
                maxLength={10}
                onClick={() => setSelecting('start')}
                style={{ borderColor: selecting === 'start' ? 'var(--color-primary)' : undefined }}
              />
            </div>
            <div className="date-input-group">
              <label>До</label>
              <input
                type="text"
                className="form-input-sm"
                placeholder="дд.мм.гггг"
                value={endInput}
                onChange={e => handleEndInput(e.target.value)}
                maxLength={10}
                onClick={() => setSelecting('end')}
                style={{ borderColor: selecting === 'end' && startDate ? 'var(--color-primary)' : undefined }}
              />
            </div>
          </div>

          {/* Пресеты */}
          <div className="date-presets">
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

          {/* Календарь */}
          <div className="calendar-wrapper">
            <button
              type="button"
              className="nav-arrow"
              onClick={() => setMonthOffset(o => o - 1)}
            >
              ❮
            </button>
            <div className="calendar-grid-container" onMouseLeave={() => setHoverDate('')}>
              {months.map(({ year, month }) => (
                <CalendarMonth
                  key={`${year}-${month}`}
                  year={year}
                  month={month}
                  startDate={startDate}
                  endDate={endDate}
                  hoverDate={selecting === 'end' ? hoverDate : ''}
                  today={today}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                  workoutDates={workoutDates}
                />
              ))}
            </div>
            <button
              type="button"
              className="nav-arrow"
              onClick={() => setMonthOffset(o => o + 1)}
              disabled={monthOffset >= 0}
            >
              ❯
            </button>
          </div>

          {/* Кнопки */}
          <div className="picker-actions">
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Отмена
            </button>
            <button type="button" className="btn-primary" onClick={handleApply}>
              Применить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
