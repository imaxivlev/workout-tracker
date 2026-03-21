'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { workoutsApi, statisticsApi, exercisesApi, WorkoutsResponse, StatsData, Exercise, ApiError } from '@/lib/api/client';
import { CustomDatePicker } from '@/app/components/CustomDatePicker';
import type { WorkoutDateMarker } from '@/app/components/CustomDatePicker';
import { enToRuName, formatForDropdown } from '@/lib/exercise-names';
import { WorkoutCard } from '@/app/components/WorkoutCard';
import CustomSelect from '@/app/components/CustomSelect';

// ─── Types ───

type Tab = 'history' | 'stats';
type TypeFilter = 'all' | 'skill' | 'wod';
type DetailLevel = 'day' | 'week' | 'month';

interface ProgressPoint {
  date: string;
  weight: number;
  reps: number;
  estimated1RM: number;
}

interface ChartDataPoint {
  label: string;
  value: number;
  date: string;
  weight: number;
}

interface ChartData {
  labels: string[];
  values: number[];
  points: ChartDataPoint[];
}

// ─── Helpers ───

function buildPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (current - 1 > 2) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) add(p);
  if (current + 1 < total - 1) pages.push('...');
  add(total);
  return pages;
}

function groupProgressData(data: ProgressPoint[], detail: DetailLevel): ChartData {
  if (data.length === 0) return { labels: [], values: [], points: [] };

  const grouped = new Map<string, ProgressPoint>();
  for (const point of data) {
    const d = new Date(point.date);
    let key: string;
    if (detail === 'day') {
      key = point.date.slice(0, 10);
    } else if (detail === 'week') {
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + 1);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    grouped.set(key, point);
  }

  const sorted = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  const points: ChartDataPoint[] = sorted.map(([k, point]) => {
    let label: string;
    if (detail === 'month') {
      const [year, mon] = k.split('-');
      label = `${monthNames[parseInt(mon) - 1]} ${year}`;
    } else {
      label = new Date(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
    return { label, value: point.weight, date: point.date.slice(0, 10), weight: point.weight };
  });

  return { labels: points.map(p => p.label), values: points.map(p => p.value), points };
}

// ─── ProgressChart component ───

function ProgressChart({ chartData, loading }: { chartData: ChartData; loading: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: ChartDataPoint } | null>(null);
  const pointCoordsRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { labels, values } = chartData;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 400;
    const H = 400;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    setTooltip(null);

    if (values.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Нет данных для отображения', W / 2, H / 2);
      pointCoordsRef.current = [];
      return;
    }

    const padL = 55, padR = 20, padT = 20, padB = 45;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const minVal = Math.min(...values) * 0.92;
    const maxVal = Math.max(...values) * 1.05;
    const range = maxVal - minVal || 1;
    const toX = (i: number) => padL + (values.length > 1 ? (i / (values.length - 1)) * chartW : chartW / 2);
    const toY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

    pointCoordsRef.current = values.map((v, i) => ({ x: toX(i), y: toY(v) }));

    // Grid
    const gridLines = 4;
    for (let g = 0; g <= gridLines; g++) {
      const y = padT + (chartH / gridLines) * g;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
      const val = maxVal - (range / gridLines) * g;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(0), padL - 7, y + 4);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('кг', padL - 30, padT - 4);

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    gradient.addColorStop(0, 'rgba(220,38,38,0.35)');
    gradient.addColorStop(1, 'rgba(220,38,38,0)');
    ctx.beginPath();
    values.forEach((v, i) => { if (i === 0) ctx.moveTo(toX(i), toY(v)); else ctx.lineTo(toX(i), toY(v)); });
    ctx.lineTo(toX(values.length - 1), padT + chartH);
    ctx.lineTo(toX(0), padT + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    values.forEach((v, i) => { if (i === 0) ctx.moveTo(toX(i), toY(v)); else ctx.lineTo(toX(i), toY(v)); });
    ctx.stroke();

    // Points
    values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(v), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#DC2626';
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // X labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach((label, i) => {
      if (i % step === 0 || i === labels.length - 1) ctx.fillText(label, toX(i), padT + chartH + 18);
    });
  }, [chartData]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || chartData.points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let closest = -1;
    let minDist = 20;
    for (let i = 0; i < pointCoordsRef.current.length; i++) {
      const { x, y } = pointCoordsRef.current[i];
      const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    if (closest >= 0) {
      const { x, y } = pointCoordsRef.current[closest];
      setTooltip({ x, y, point: chartData.points[closest] });
    } else {
      setTooltip(null);
    }
  }

  const formatDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}.${m}.${y}`; };

  return (
    <div style={{ position: 'relative', width: '100%', height: '400px' }}>
      {loading && (
        <div className="loading-state" style={{ position: 'absolute', inset: 0 }}>
          <div className="spinner" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '400px', display: 'block', cursor: chartData.points.length > 0 ? 'pointer' : 'default' }}
        onClick={handleCanvasClick}
      />
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{ position: 'absolute', left: tooltip.x, top: tooltip.y - 50, transform: 'translateX(-50%)', pointerEvents: 'none' }}
        >
          <div>{formatDate(tooltip.point.date)}</div>
          <div style={{ fontWeight: 700 }}>{tooltip.point.weight} кг</div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───

export default function WorkoutsPage() {
  const [tab, setTab] = useState<Tab>('history');

  // Shared date filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workoutDates, setWorkoutDates] = useState<Record<string, WorkoutDateMarker>>({});
  const datesLoaded = useRef(false);

  // History state
  const [data, setData] = useState<WorkoutsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [exerciseFilter, setExerciseFilter] = useState('');

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [detail, setDetail] = useState<DetailLevel>('month');
  const [chartData, setChartData] = useState<ChartData>({ labels: [], values: [], points: [] });
  const [chartLoading, setChartLoading] = useState(false);
  const statsInitialized = useRef(false);

  // ─── Data loading ───

  const loadWorkouts = useCallback(async (p: number, start: string, end: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await workoutsApi.getAll({
        page: p,
        limit: 10,
        startDate: start || undefined,
        endDate: end || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка загрузки тренировок');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkouts(page, startDate, endDate);
  }, [page, loadWorkouts, startDate, endDate]);

  useEffect(() => {
    if (datesLoaded.current) return;
    datesLoaded.current = true;
    workoutsApi.getDates().then(res => setWorkoutDates(res.dates)).catch(() => {});
  }, []);

  // Stats: load on first tab switch
  const loadStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError('');
    statisticsApi.getStats('all')
      .then(setStats)
      .catch(err => setStatsError(err instanceof ApiError ? err.message : 'Ошибка загрузки статистики'))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'stats' && !statsInitialized.current) {
      statsInitialized.current = true;
      loadStats();
      exercisesApi.search('', 200, true).then(data => {
        setExercises(data.exercises);
        if (data.exercises.length > 0) setSelectedExerciseId(data.exercises[0].id);
      }).catch(() => {});
    }
  }, [tab, loadStats]);

  const loadChart = useCallback(async (exerciseId: string, detailLevel: DetailLevel) => {
    if (!exerciseId) return;
    setChartLoading(true);
    try {
      const data = await statisticsApi.getExerciseStats(exerciseId);
      setChartData(groupProgressData(data.progressHistory, detailLevel));
    } catch {
      setChartData({ labels: [], values: [], points: [] });
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'stats' && selectedExerciseId) loadChart(selectedExerciseId, detail);
  }, [selectedExerciseId, detail, loadChart, tab]);

  // ─── Handlers ───

  function handleDateChange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  function handleDateApply() {
    setPage(1);
  }

  function handleDateReset() {
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить тренировку?')) return;
    try {
      await workoutsApi.delete(id);
      loadWorkouts(page, startDate, endDate);
    } catch {
      alert('Ошибка при удалении');
    }
  }

  // ─── Derived ───

  const totalPages = data?.pagination.totalPages ?? 1;
  const filteredWorkouts = (data?.workouts ?? []).filter(w => {
    if (typeFilter === 'skill' && w.skillBlocks.length === 0) return false;
    if (typeFilter === 'wod' && w.wodBlocks.length === 0) return false;
    if (exerciseFilter.trim()) {
      const term = exerciseFilter.trim().toLowerCase();
      const hasSkillMatch = w.skillBlocks.some(b =>
        b.exercise.name.toLowerCase().includes(term) || enToRuName(b.exercise.name).toLowerCase().includes(term)
      );
      const hasWodMatch = w.wodBlocks.some(b =>
        b.exercises.some(e => e.exercise.name.toLowerCase().includes(term) || enToRuName(e.exercise.name).toLowerCase().includes(term))
      );
      if (!hasSkillMatch && !hasWodMatch) return false;
    }
    return true;
  });
  const paginationPages = buildPaginationPages(page, totalPages);

  // ─── Render ───

  return (
    <div className="container">
      <h1 className="page-title">Тренировки</h1>

      {/* Общий календарь */}
      <div className="filters-section" style={{ marginBottom: '1.5rem' }}>
        <CustomDatePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          onApply={handleDateApply}
          onReset={handleDateReset}
          workoutDates={workoutDates}
        />
      </div>

      {/* Табы */}
      <div className="period-selector" style={{ marginBottom: '2rem' }}>
        <button className={`period-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          История
        </button>
        <button className={`period-btn${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>
          Статистика
        </button>
      </div>

      {/* ═══ TAB: HISTORY ═══ */}
      {tab === 'history' && (
        <div>
          {/* Фильтры */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
              <label>Фильтр по упражнению</label>
              <input
                type="text"
                className="form-input"
                placeholder="Все упражнения"
                value={exerciseFilter}
                onChange={e => setExerciseFilter(e.target.value)}
              />
            </div>
            <div className="period-selector" style={{ marginBottom: 0 }}>
              <button className={`period-btn${typeFilter === 'all' ? ' active' : ''}`} onClick={() => setTypeFilter('all')}>Все</button>
              <button className={`period-btn${typeFilter === 'skill' ? ' active' : ''}`} onClick={() => setTypeFilter('skill')}>Skill</button>
              <button className={`period-btn${typeFilter === 'wod' ? ' active' : ''}`} onClick={() => setTypeFilter('wod')}>WOD</button>
            </div>
          </div>

          {loading && (
            <div className="loading-state"><div className="spinner" /></div>
          )}

          {error && <div className="form-error">{error}</div>}

          {!loading && !error && (
            <>
              {filteredWorkouts.length === 0 ? (
                <div className="empty-state">
                  <p>{data?.workouts.length === 0 ? 'Нет тренировок. Добавьте первую!' : 'Нет тренировок по выбранному фильтру.'}</p>
                </div>
              ) : (
                <div className="workout-list">
                  {filteredWorkouts.map(workout => (
                    <WorkoutCard key={workout.id} workout={workout} onDelete={handleDelete} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="pagination-container" style={{ marginTop: '2rem' }}>
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ←
                  </button>
                  {paginationPages.map((p, i) =>
                    p === '...'
                      ? <span key={`ellipsis-${i}`} className="pagination-btn" style={{ cursor: 'default' }}>…</span>
                      : (
                        <button
                          key={p}
                          className={`pagination-btn${p === page ? ' active' : ''}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      )
                  )}
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ TAB: STATS ═══ */}
      {tab === 'stats' && (
        <div>
          {/* Карточки */}
          {statsLoading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : statsError ? (
            <div className="form-error">{statsError}</div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">💪</div>
                  <div className="stat-value">{stats?.workoutsCount ?? 0}</div>
                  <div className="stat-label">Тренировок</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🏋️</div>
                  <div className="stat-value">{stats?.skillSessions ?? 0}</div>
                  <div className="stat-label">Skill сессий</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⚡</div>
                  <div className="stat-value">{stats?.wodSessions ?? 0}</div>
                  <div className="stat-label">WOD сессий</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-value">{stats?.newPRs ?? 0}</div>
                  <div className="stat-label">Новых PR</div>
                  {(stats?.newPRs ?? 0) > 0 && (
                    <div className="stat-trend up">Отличный прогресс!</div>
                  )}
                </div>
              </div>

              {/* Личные рекорды */}
              {(stats?.personalRecords?.length ?? 0) > 0 && (
                <div className="pr-section">
                  <h2 className="section-title">Личные рекорды</h2>
                  <div className="pr-list">
                    {stats!.personalRecords.map((pr, i) => (
                      <div key={i} className="pr-item">
                        <div className="pr-exercise">
                          <div className="pr-name">{enToRuName(pr.exerciseName)}</div>
                          <div className="pr-date">
                            {new Date(pr.date).toLocaleDateString('ru-RU', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </div>
                        </div>
                        <div className="pr-value">{pr.weight} кг</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(stats?.personalRecords?.length ?? 0) === 0 && (
                <div className="empty-state" style={{ marginTop: '1.5rem' }}>
                  <p>Нет данных за выбранный период.</p>
                </div>
              )}
            </>
          )}

          {/* График прогресса */}
          <div className="chart-section">
            <h2 className="section-title">Прогресс по упражнению</h2>
            <div className="chart-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <CustomSelect
                value={selectedExerciseId}
                onChange={setSelectedExerciseId}
                style={{ flex: 1, minWidth: '250px', maxWidth: '300px' }}
                options={
                  exercises.length === 0
                    ? [{ value: '', label: 'Нет упражнений' }]
                    : exercises.map(ex => ({ value: ex.id, label: formatForDropdown(ex.name) }))
                }
              />
              <CustomSelect
                value={detail}
                onChange={v => setDetail(v as DetailLevel)}
                style={{ flex: 1, minWidth: '150px', maxWidth: '200px' }}
                options={[
                  { value: 'day', label: 'По дням' },
                  { value: 'week', label: 'По неделям' },
                  { value: 'month', label: 'По месяцам' },
                ]}
              />
            </div>
            <div className="chart-container" style={{ position: 'relative', height: '400px', width: '100%' }}>
              <ProgressChart chartData={chartData} loading={chartLoading} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
