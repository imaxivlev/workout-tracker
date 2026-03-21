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

  // Загрузка данных при смене таба
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

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner" /></div>;
  }

  if (!club) return null;

  const isOwnerOrCoach = club.myRole === 'OWNER' || club.myRole === 'COACH';

  return (
    <div>
      {/* Заголовок клуба */}
      <div className="club-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">{club.name}</h1>
            {club.city && <p className="club-city">{club.city}</p>}
            <p className="club-meta">{club.memberCount} участник(ов)</p>
          </div>
          {isOwnerOrCoach && (
            <Link href="/dashboard/club/settings" className="btn btn-secondary btn-sm">
              Настройки
            </Link>
          )}
        </div>
      </div>

      {/* Табы */}
      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        <button
          className={`tab-btn ${tab === 'feed' ? 'active' : ''}`}
          onClick={() => setTab('feed')}
        >
          Тренировки дня
        </button>
        <button
          className={`tab-btn ${tab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setTab('leaderboard')}
        >
          Лидерборд
        </button>
        <button
          className={`tab-btn ${tab === 'members' ? 'active' : ''}`}
          onClick={() => setTab('members')}
        >
          Участники
        </button>
      </div>

      {/* === Тренировки дня === */}
      {tab === 'feed' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="date"
              value={feedDate}
              onChange={(e) => setFeedDate(e.target.value)}
              className="form-input"
              style={{ maxWidth: '200px' }}
            />
          </div>

          {templates.length === 0 ? (
            <div className="empty-state">
              <p>На эту дату пока нет тренировок в клубе</p>
            </div>
          ) : (
            <div className="club-feed">
              {templates.map((tmpl) => (
                <div key={tmpl.signature} className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="badge badge-info">
                        {tmpl.athleteCount} атлет(ов)
                      </span>
                      <Link
                        href={`/dashboard/workouts/new?template=${tmpl.firstWorkoutId}&date=${tmpl.date}`}
                        className="btn btn-primary btn-sm"
                      >
                        Взять шаблон
                      </Link>
                    </div>

                    {/* SKILL блоки */}
                    {tmpl.skillBlocks.map((sb, i) => (
                      <div key={i} className="workout-block skill-block">
                        <div className="block-header">
                          <span className="block-type-badge skill">SKILL</span>
                          <span className="exercise-name">{sb.exerciseName}</span>
                        </div>
                      </div>
                    ))}

                    {/* WOD блоки */}
                    {tmpl.wodBlocks.map((wb, i) => (
                      <div key={i} className="workout-block wod-block">
                        <div className="block-header">
                          <span className="block-type-badge wod">{wb.wodType}</span>
                          {wb.timeCapSeconds && (
                            <span className="time-cap">{Math.floor(wb.timeCapSeconds / 60)} мин</span>
                          )}
                        </div>
                        <div className="wod-exercises-list">
                          {wb.exercises.map((ex, j) => (
                            <div key={j} className="wod-exercise-item">
                              {ex.reps} {ex.exerciseName}
                              {ex.weight ? ` (${ex.weight} кг)` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="club-athletes-list">
                      {tmpl.athletes.map(a => (
                        <span key={a.userId} className="athlete-chip">{a.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === Лидерборд === */}
      {tab === 'leaderboard' && (
        <div>
          <div className="tabs-container" style={{ marginBottom: '1rem' }}>
            <button
              className={`tab-btn ${lbType === 'monthly' ? 'active' : ''}`}
              onClick={() => setLbType('monthly')}
            >
              За месяц
            </button>
            <button
              className={`tab-btn ${lbType === 'wod' ? 'active' : ''}`}
              onClick={() => setLbType('wod')}
            >
              WOD дня
            </button>
          </div>

          {lbType === 'monthly' ? (
            <div className="leaderboard">
              {monthlyEntries.length === 0 ? (
                <div className="empty-state"><p>Нет данных за этот месяц</p></div>
              ) : (
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Атлет</th>
                      <th>Тренировок</th>
                      <th>Тоннаж</th>
                      <th>Дней</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyEntries.map((e, i) => (
                      <tr key={e.userId} className={i < 3 ? 'top-three' : ''}>
                        <td className="rank-cell">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td>{e.name}</td>
                        <td>{e.workoutCount}</td>
                        <td>{e.tonnage > 1000 ? `${(e.tonnage / 1000).toFixed(1)}т` : `${e.tonnage}кг`}</td>
                        <td>{e.activeDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="date"
                  value={wodDate}
                  onChange={(e) => setWodDate(e.target.value)}
                  className="form-input"
                  style={{ maxWidth: '200px' }}
                />
              </div>
              {wodEntries.length === 0 ? (
                <div className="empty-state"><p>Нет результатов WOD за эту дату</p></div>
              ) : (
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Атлет</th>
                      <th>Уровень</th>
                      <th>Результат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wodEntries.map((e, i) => (
                      <tr key={`${e.userId}-${e.workoutId}`} className={i < 3 ? 'top-three' : ''}>
                        <td className="rank-cell">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (e.rank || i + 1)}
                        </td>
                        <td>{e.name}</td>
                        <td>
                          <span className={`badge ${e.level === 'RX' ? 'badge-rx' : 'badge-scaled'}`}>
                            {e.level}
                          </span>
                        </td>
                        <td>{e.resultDisplay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* === Участники === */}
      {tab === 'members' && (
        <div>
          {isOwnerOrCoach && (
            <div className="invite-section" style={{ marginBottom: '1.5rem' }}>
              <button onClick={handleCreateInvite} className="btn btn-primary btn-sm">
                Создать приглашение
              </button>
              {inviteCode && (
                <div className="invite-code-display" style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code className="invite-code">{inviteCode}</code>
                    <button onClick={copyInviteCode} className="btn btn-secondary btn-sm">
                      {inviteCopied ? 'Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                  <p className="hint-text" style={{ marginTop: '0.25rem' }}>
                    Отправьте этот код атлетам для вступления в клуб
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="members-list">
            {members.map(m => (
              <div key={m.userId} className="member-card">
                <div className="member-info">
                  <span className="member-name">
                    {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                  </span>
                  <span className={`badge badge-role badge-${m.role.toLowerCase()}`}>
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
