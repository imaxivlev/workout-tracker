'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clubsApi, Club, ClubWorkoutTemplate, MonthlyLeaderboardEntry, WodLeaderboardEntry } from '@/lib/api/client';
import Link from 'next/link';

type Tab = 'feed' | 'leaderboard' | 'members';

export default function ClubPage() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('feed');

  // Feed
  const [templates, setTemplates] = useState<ClubWorkoutTemplate[]>([]);
  const [feedDate, setFeedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Leaderboard
  const [lbType, setLbType] = useState<'wod' | 'monthly'>('monthly');
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyLeaderboardEntry[]>([]);
  const [wodEntries, setWodEntries] = useState<WodLeaderboardEntry[]>([]);
  const [wodDate, setWodDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Members
  const [members, setMembers] = useState<Array<{ userId: string; email: string; firstName: string | null; lastName: string | null; role: string; joinedAt: string }>>([]);

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

    if (tab === 'feed') {
      try {
        const { templates: t } = await clubsApi.getTodayWorkouts(club.id, feedDate);
        setTemplates(t);
      } catch { setTemplates([]); }
    }

    if (tab === 'leaderboard') {
      if (lbType === 'monthly') {
        try {
          const { entries } = await clubsApi.getMonthlyLeaderboard(club.id);
          setMonthlyEntries(entries);
        } catch { setMonthlyEntries([]); }
      } else {
        try {
          const { entries } = await clubsApi.getWodLeaderboard(club.id, wodDate);
          setWodEntries(entries);
        } catch { setWodEntries([]); }
      }
    }

    if (tab === 'members') {
      try {
        const { members: m } = await clubsApi.getMembers(club.id);
        setMembers(m);
      } catch { setMembers([]); }
    }
  }, [club, tab, feedDate, lbType, wodDate]);

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

  /** Собираем query string для предзаполнения формы из шаблона */
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
        {(['feed', 'leaderboard', 'members'] as Tab[]).map(t => (
          <button
            key={t}
            className={`club-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'feed' ? 'WOD дня' : t === 'leaderboard' ? 'Лидерборд' : 'Участники'}
          </button>
        ))}
      </div>

      {/* === Тренировки дня === */}
      {tab === 'feed' && (
        <div className="club-section">
          <div className="club-feed-header">
            <input
              type="date"
              value={feedDate}
              onChange={(e) => setFeedDate(e.target.value)}
              className="club-date-input"
            />
            {isOwnerOrCoach && (
              <Link
                href={`/dashboard/workouts/new?date=${feedDate}`}
                className="btn btn-primary btn-sm"
              >
                + Добавить WOD
              </Link>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="club-empty">
              <div className="club-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p>На {feedDate === new Date().toISOString().split('T')[0] ? 'сегодня' : feedDate} пока нет тренировок</p>
              {isOwnerOrCoach && (
                <Link
                  href={`/dashboard/workouts/new?date=${feedDate}`}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '0.75rem' }}
                >
                  Добавить тренировку
                </Link>
              )}
            </div>
          ) : (
            <div className="club-feed-list">
              {templates.map((tmpl) => (
                <div key={tmpl.signature} className="club-wod-card">
                  {/* Шапка карточки */}
                  <div className="club-wod-header">
                    <span className="club-wod-athletes-count">
                      {tmpl.athleteCount} {tmpl.athleteCount === 1 ? 'атлет' : tmpl.athleteCount < 5 ? 'атлета' : 'атлетов'}
                    </span>
                  </div>

                  {/* Блоки тренировки */}
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
                          {wb.timeCapSeconds && (
                            <span className="club-wod-time">{Math.floor(wb.timeCapSeconds / 60)} мин</span>
                          )}
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

                  {/* Атлеты */}
                  <div className="club-wod-footer">
                    <div className="club-wod-athletes">
                      {tmpl.athletes.slice(0, 5).map(a => (
                        <span key={a.userId} className="club-wod-athlete">{a.name}</span>
                      ))}
                      {tmpl.athletes.length > 5 && (
                        <span className="club-wod-athlete more">+{tmpl.athletes.length - 5}</span>
                      )}
                    </div>
                    <Link
                      href={buildTemplateQuery(tmpl)}
                      className="btn btn-primary btn-sm club-wod-use-btn"
                    >
                      Записать результат
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === Лидерборд === */}
      {tab === 'leaderboard' && (
        <div className="club-section">
          <div className="club-lb-tabs">
            <button
              className={`club-lb-tab ${lbType === 'monthly' ? 'active' : ''}`}
              onClick={() => setLbType('monthly')}
            >
              За месяц
            </button>
            <button
              className={`club-lb-tab ${lbType === 'wod' ? 'active' : ''}`}
              onClick={() => setLbType('wod')}
            >
              WOD дня
            </button>
          </div>

          {lbType === 'monthly' ? (
            monthlyEntries.length === 0 ? (
              <div className="club-empty"><p>Нет данных за этот месяц</p></div>
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
            )
          ) : (
            <div>
              <div className="club-feed-header" style={{ marginBottom: '0.75rem' }}>
                <input
                  type="date"
                  value={wodDate}
                  onChange={(e) => setWodDate(e.target.value)}
                  className="club-date-input"
                />
              </div>
              {wodEntries.length === 0 ? (
                <div className="club-empty"><p>Нет результатов WOD за эту дату</p></div>
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
                        <div className="club-lb-result">{e.resultDisplay}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
