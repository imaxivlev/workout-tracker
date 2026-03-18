'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { statisticsApi, exercisesApi, StatsData, Exercise, ApiError } from '@/lib/api/client';
import CustomSelect from '@/app/components/CustomSelect';

type Period = 'week' | 'month' | 'year' | 'all';
type DetailLevel = 'day' | 'week' | 'month';

interface ProgressPoint {
  date: string;
  weight: number;
  reps: number;
  estimated1RM: number;
}

interface ChartData {
  labels: string[];
  values: number[];
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
  all: 'Всё время',
};

const EXERCISE_RU_NAMES: Record<string, string> = {
  'Back Squat': 'Приседания на спине',
  'Front Squat': 'Фронтальные приседания',
  'Deadlift': 'Становая тяга',
  'Bench Press': 'Жим лежа',
  'Overhead Press': 'Жим стоя',
  'Snatch': 'Рывок',
  'Clean & Jerk': 'Толчок',
  'Pull-ups': 'Подтягивания',
  'Push-ups': 'Отжимания',
  'Burpees': 'Бёрпи',
  'Box Jumps': 'Прыжки на тумбу',
  'Kettlebell Swing': 'Махи гирей',
  'Thruster': 'Трастеры',
  'Wall Balls': 'Броски мяча',
  'Rope Climbs': 'Лазание по канату',
};

function formatExerciseName(name: string): string {
  const ruName = EXERCISE_RU_NAMES[name];
  return ruName ? `${ruName} (${name})` : name;
}

function groupProgressData(data: ProgressPoint[], detail: DetailLevel): ChartData {
  if (data.length === 0) return { labels: [], values: [] };

  const grouped = new Map<string, number[]>();
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
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(point.estimated1RM);
  }

  const sorted = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const labels = sorted.map(([k]) => {
    if (detail === 'month') {
      const [year, mon] = k.split('-');
      return `${months[parseInt(mon) - 1]} ${year}`;
    }
    return new Date(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  });
  const values = sorted.map(([, vals]) => Math.max(...vals));
  return { labels, values };
}

function ProgressChart({ chartData, loading }: { chartData: ChartData; loading: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    if (values.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Нет данных для отображения', W / 2, H / 2);
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

    // Gradient fill under line
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    gradient.addColorStop(0, 'rgba(220,38,38,0.35)');
    gradient.addColorStop(1, 'rgba(220,38,38,0)');
    ctx.beginPath();
    values.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v)); else ctx.lineTo(toX(i), toY(v));
    });
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
    values.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v)); else ctx.lineTo(toX(i), toY(v));
    });
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

    // X labels (max 8 visible)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach((label, i) => {
      if (i % step === 0 || i === labels.length - 1) {
        ctx.fillText(label, toX(i), padT + chartH + 18);
      }
    });
  }, [chartData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '400px' }}>
      {loading && (
        <div className="loading-state" style={{ position: 'absolute', inset: 0 }}>
          <div className="spinner" />
        </div>
      )}
      <canvas ref={canvasRef} style={{ width: '100%', height: '400px', display: 'block' }} />
    </div>
  );
}

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [detail, setDetail] = useState<DetailLevel>('month');
  const [chartData, setChartData] = useState<ChartData>({ labels: [], values: [] });
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    setStatsLoading(true);
    setStatsError('');
    statisticsApi.getStats(period)
      .then(setStats)
      .catch(err => {
        setStatsError(err instanceof ApiError ? err.message : 'Ошибка загрузки статистики');
      })
      .finally(() => setStatsLoading(false));
  }, [period]);

  useEffect(() => {
    exercisesApi.search('', 200).then(data => {
      setExercises(data.exercises);
      if (data.exercises.length > 0) setSelectedExerciseId(data.exercises[0].id);
    }).catch(() => {});
  }, []);

  const loadChart = useCallback(async (exerciseId: string, detailLevel: DetailLevel) => {
    if (!exerciseId) return;
    setChartLoading(true);
    try {
      const data = await statisticsApi.getExerciseStats(exerciseId);
      setChartData(groupProgressData(data.progressHistory, detailLevel));
    } catch {
      setChartData({ labels: [], values: [] });
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChart(selectedExerciseId, detail);
  }, [selectedExerciseId, detail, loadChart]);

  return (
    <div className="container">
      <h1 className="page-title">Статистика</h1>

      {/* Период */}
      <div className="period-selector" style={{ marginBottom: '1.5rem' }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            className={`period-btn${period === p ? ' active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

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
                      <div className="pr-name">{pr.exerciseName}</div>
                      <div className="pr-date">
                        {new Date(pr.date).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
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
                : exercises.map(ex => ({ value: ex.id, label: formatExerciseName(ex.name) }))
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
  );
}
