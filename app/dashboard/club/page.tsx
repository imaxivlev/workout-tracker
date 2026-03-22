'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clubsApi, Club, ClubWorkoutTemplate, MonthlyLeaderboardEntry, WodLeaderboardEntry, SkillLeaderboardEntry } from '@/lib/api/client';
import Link from 'next/link';

type Tab = 'leaderboard' | 'members';
type LbType = 'activity' | 'wod' | 'skill';

export default function ClubPage() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('leaderboard');

  // Leaderboard
  const [lbType, setLbType] = useState<LbType>('wod');
  const [activityPeriod, setActivityPeriod] = useState<'month' | 'all'>('month');
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyLeaderboardEntry[]>([]);
  const [wodEntries, setWodEntries] = useState<WodLeaderboardEntry[]>([]);
  const [skillEntries, setSkillEntries] = useState<SkillLeaderboardEntry[]>([]);
  const [wodDate, setWodDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [wodSignatures, setWodSignatures] = useState<Array<{ signature: string; label: string }>>([]);
  const [selectedWodSignature, setSelectedWodSignature] = useState('');

  // WOD дня — шаблоны тренировок (теперь внутри лидерборда)
  const [templates, setTemplates] = useState<ClubWorkoutTemplate[]>([]);

  // Members
  const [members, setMembers] = useState<Array<{ userId: string; email: string; firstName: string | null; lastName: string | null; role: string; showInLeaderboard: boolean; joinedAt: string }>>([]);

  // Invite
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    loadClub();
  }, []);

  async function loadClub() {
    try {
      const { club: myClub } = await clubsApi.getMy();
      if (!myClub) {
        router.push('/dashboard/club/join');
        return;
      }
      setClub(myClub);
    } catch {
      router.push('/dashboard/club/join');
    } finally {
      setLoading(false);
    }
  }

  const loadTabData = useCallback(async () => {
    if (!club) return;

    if (tab === 'leaderboard') {
      if (lbType === 'activity') {
        try {
          const { entries } = activityPeriod === 'month'
            ? await clubsApi.getMonthlyLeaderboard(club.id)
            : await clubsApi.getAllTimeLeaderboard(club.id);
          setMonthlyEntries(entries);
        } catch { setMonthlyEntries([]); }
      } else if (lbType === 'wod') {
        // Загружаем и шаблоны тренировок, и результаты лидерборда
        try {
          const { templates: t } = await clubsApi.getTodayWorkouts(club.id, wodDate);
          setTemplates(t);
          setWodSignatures(t.map(tmpl => {
            // Уникальный тип WOD + первые упражнения для читаемости
            const wodTypes = [...new Set(tmpl.wodBlocks.map(wb => wb.wodType))];
            const exNames = tmpl.wodBlocks.flatMap(wb => wb.exercises.map(e => e.exerciseName)).slice(0, 3);
            const label = wodTypes.join('/') + (exNames.length ? ': ' + exNames.join(', ') : '') || tmpl.skillBlocks.map(sb => sb.exerciseName).join(', ') || 'WOD';
            return { signature: tmpl.signature, label };
          }));
        } catch { setTemplates([]); setWodSignatures([]); }
        try {
          const { entries } = await clubsApi.getWodLeaderboard(club.id, wodDate, selectedWodSignature || undefined);
          setWodEntries(entries);
        } catch { setWodEntries([]); }
      } else if (lbType === 'skill') {
        try {
          const { entries } = await clubsApi.getSkillLeaderboard(club.id);
          setSkillEntries(entries);
        } catch { setSkillEntries([]); }
      }
    }

    if (tab === 'members') {
      try {
        const { members: m } = await clubsApi.getMembers(club.id);
        setMembers(m);
      } catch { setMembers([]); }
    }
  }, [club, tab, lbType, wodDate, activityPeriod, selectedWodSignature]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  async function handleCreateInvite() {
    if (!club) return;
    try {
      const { invite } = await clubsApi.createInvite(club.id);
      setInviteCode(invite.code);
      setInviteCopied(false);
    } catch (e: any) {
      alert(e.message || 'Ошибка создания приглашения');
    }
  }

  function copyInviteCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  function buildTemplateQuery(tmpl: ClubWorkoutTemplate): string {
    const data = {
      date: tmpl.date,
      skillBlocks: tmpl.skillBlocks,
      wodBlocks: tmpl.wodBlocks,
    };
    return `/dashboard/workouts/new?clubTemplate=${encodeURIComponent(JSON.stringify(data))}`;
  }

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner" /></div>;
  }

  if (!club) return null;

  const isOwnerOrCoach = club.myRole === 'OWNER' || club.myRole === 'COACH';

  return (
    <div className="container club-page">
      {/* Заголовок клуба */}
      <div className="club-header">
        <div className="club-header-top">
          <div className="club-header-info">
            <h1 className="club-title">{club.name}</h1>
            <div className="club-sub">
              {club.city && <span className="club-city">{club.city}</span>}
              <span className="club-members-count">{club.memberCount} участник(ов)</span>
            </div>
          </div>
          {isOwnerOrCoach && (
            <Link href="/dashboard/club/settings" className="club-settings-btn" title="Настройки">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Табы */}
      <div className="club-tabs">
        {(['leaderboard', 'members'] as Tab[]).map(t => (
          <button
            key={t}
            className={`club-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'leaderboard' ? 'Лидерборд' : 'Участники'}
          </button>
        ))}
      </div>

      {/* === Лидерборд === */}
      {tab === 'leaderboard' && (
        <div className="club-section">
          {/* Подтабы лидерборда: 3 категории */}
          <div className="club-lb-tabs">
            {(['wod', 'activity', 'skill'] as LbType[]).map(t => (
              <button
                key={t}
                className={`club-lb-tab ${lbType === t ? 'active' : ''}`}
                onClick={() => setLbType(t)}
              >
                {t === 'wod' ? 'WOD дня' : t === 'activity' ? 'Активность' : 'Тяжелая атлетика'}
              </button>
            ))}
          </div>

          {/* === WOD дня (объединённый: детали тренировки + результаты) === */}
          {lbType === 'wod' && (
            <div>
              <div className="club-feed-header" style={{ marginBottom: '0.75rem' }}>
                <input
                  type="date"
                  value={wodDate}
                  onChange={(e) => { setWodDate(e.target.value); setSelectedWodSignature(''); }}
                  className="club-date-input"
                />
                {isOwnerOrCoach && (
                  <Link href={`/dashboard/workouts/new?date=${wodDate}`} className="btn btn-primary btn-sm">
                    + Добавить WOD
                  </Link>
                )}
              </div>

              {wodSignatures.length > 1 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <select
                    className="club-date-input"
                    value={selectedWodSignature}
                    onChange={(e) => setSelectedWodSignature(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Все WOD</option>
                    {wodSignatures.map(ws => (
                      <option key={ws.signature} value={ws.signature}>{ws.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Детали тренировки WOD дня */}
              {templates.length > 0 && (
                <div className="club-wod-details">
                  {templates
                    .filter(tmpl => !selectedWodSignature || tmpl.signature === selectedWodSignature)
                    .map((tmpl) => (
                    <div key={tmpl.signature} className="club-wod-card">
                      <div className="club-wod-content">
                        {tmpl.skillBlocks.map((sb, i) => (
                          <div key={`s${i}`} className="club-wod-block">
                            <div className="club-wod-block-badge skill">SKILL</div>
                            <div className="club-wod-block-name">{sb.exerciseName}</div>
                            <div className="club-wod-block-detail">
                              {sb.sets.length} подход(ов)
                              {sb.sets[0]?.weight > 0 && ` · ${sb.sets[0].weight} кг`}
                            </div>
                          </div>
                        ))}

                        {tmpl.wodBlocks.map((wb, i) => (
                          <div key={`w${i}`} className="club-wod-block">
                            <div className="club-wod-block-top">
                              <div className="club-wod-block-badge wod">{wb.wodType}</div>
                              <span className={`club-lb-level ${wb.level.toLowerCase()}`}>{wb.level === 'SCALED' ? 'SC' : wb.level}</span>
                              {wb.timeCapSeconds && <span className="club-wod-time">{Math.floor(wb.timeCapSeconds / 60)} мин</span>}
                            </div>
                            <div className="club-wod-exercises">
                              {wb.exercises.map((ex, j) => (
                                <div key={j} className="club-wod-exercise">
                                  <span className="club-wod-reps">{ex.reps}</span>
                                  <span>{ex.exerciseName}</span>
                                  {ex.weight ? <span className="club-wod-weight">({ex.weight} кг)</span> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="club-wod-footer">
                        <div className="club-wod-athletes">
                          <span className="club-wod-athletes-count">
                            {tmpl.athleteCount} {tmpl.athleteCount === 1 ? 'атлет' : tmpl.athleteCount < 5 ? 'атлета' : 'атлетов'}
                          </span>
                        </div>
                        <Link href={buildTemplateQuery(tmpl)} className="btn btn-primary btn-sm club-wod-use-btn">
                          Записать результат
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Результаты (лидерборд) */}
              {wodEntries.length === 0 && templates.length === 0 ? (
                <div className="club-empty">
                  <p>На {wodDate === new Date().toISOString().split('T')[0] ? 'сегодня' : wodDate} пока нет тренировок</p>
                </div>
              ) : wodEntries.length === 0 && templates.length > 0 ? (
                <div className="club-empty"><p>Пока никто не записал результат</p></div>
              ) : (
                <div className="club-lb-list">
                  {wodEntries.map((e, i) => (
                    <div key={`${e.userId}-${e.workoutId}`} className={`club-lb-row ${i < 3 ? 'top' : ''}`}>
                      <div className="club-lb-rank">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (e.rank || i + 1)}
                      </div>
                      <div className="club-lb-info">
                        <div className="club-lb-name">
                          {e.name}
                          <span className={`club-lb-level ${e.level.toLowerCase()}`}>{e.level}</span>
                        </div>
                        <div className="club-lb-result">
                          {e.resultDisplay}
                          {e.weightsUsed && <span className="club-lb-weights"> · {e.weightsUsed}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === Активность (general leaderboard) === */}
          {lbType === 'activity' && (
            <div>
              <div className="club-activity-period">
                <button
                  className={`club-period-btn ${activityPeriod === 'month' ? 'active' : ''}`}
                  onClick={() => setActivityPeriod('month')}
                >
                  Этот месяц
                </button>
                <button
                  className={`club-period-btn ${activityPeriod === 'all' ? 'active' : ''}`}
                  onClick={() => setActivityPeriod('all')}
                >
                  Всё время
                </button>
              </div>

              {monthlyEntries.length === 0 ? (
                <div className="club-empty"><p>Нет данных за {activityPeriod === 'month' ? 'этот месяц' : 'всё время'}</p></div>
              ) : (
                <div className="club-lb-list">
                  {monthlyEntries.map((e, i) => (
                    <div key={e.userId} className={`club-lb-row ${i < 3 ? 'top' : ''}`}>
                      <div className="club-lb-rank">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </div>
                      <div className="club-lb-info">
                        <div className="club-lb-name">{e.name}</div>
                        <div className="club-lb-stats">
                          <span>{e.workoutCount} трен.</span>
                          <span>{e.tonnage > 1000 ? `${(e.tonnage / 1000).toFixed(1)}т` : `${Math.round(e.tonnage)}кг`}</span>
                          <span>{e.activeDays} дн.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === Тяжелая атлетика (SKILL PR Board) === */}
          {lbType === 'skill' && (
            skillEntries.length === 0 ? (
              <div className="club-empty"><p>Пока нет данных по Skill упражнениям</p></div>
            ) : (
              <div className="club-skill-lb">
                {skillEntries.map(entry => (
                  <div key={entry.exerciseName} className="club-skill-exercise">
                    <div className="club-skill-exercise-name">{entry.exerciseName}</div>
                    <div className="club-skill-athletes">
                      {entry.athletes.slice(0, 5).map(a => (
                        <div key={a.userId} className={`club-lb-row ${a.rank <= 3 ? 'top' : ''}`}>
                          <div className="club-lb-rank">
                            {a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : a.rank === 3 ? '🥉' : a.rank}
                          </div>
                          <div className="club-lb-info">
                            <div className="club-lb-name">{a.name}</div>
                            <div className="club-lb-stats">
                              <span>1RM: {a.best1RM} кг</span>
                              <span>Макс: {a.maxWeight} кг</span>
                              <span>{a.bestWeightForReps}кг x {a.bestReps}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* === Участники === */}
      {tab === 'members' && (
        <div className="club-section">
          {isOwnerOrCoach && (
            <div className="club-invite-section">
              <button onClick={handleCreateInvite} className="btn btn-primary btn-sm">
                Создать приглашение
              </button>
              {inviteCode && (
                <div className="club-invite-result">
                  <div className="club-invite-row">
                    <code className="club-invite-code">{inviteCode}</code>
                    <button onClick={copyInviteCode} className="club-invite-copy">
                      {inviteCopied ? '✓' : 'Копировать'}
                    </button>
                  </div>
                  <p className="club-invite-hint">
                    Отправьте этот код атлетам для вступления в клуб
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="club-members-list">
            {members.map(m => (
              <div key={m.userId} className="club-member-row">
                <div className="club-member-avatar">
                  {(m.firstName?.[0] || m.email[0]).toUpperCase()}
                </div>
                <div className="club-member-info">
                  <span className="club-member-name">
                    {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                  </span>
                  <span className={`club-member-role ${m.role.toLowerCase()}`}>
                    {m.role === 'OWNER' ? 'Владелец' : m.role === 'COACH' ? 'Тренер' : 'Атлет'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
