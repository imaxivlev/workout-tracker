'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clubsApi, Club, ClubWorkoutTemplate, MonthlyLeaderboardEntry, WodLeaderboardEntry, SkillLeaderboardEntry } from '@/lib/api/client';
import Link from 'next/link';
import { SingleDatePicker } from '@/app/components/SingleDatePicker';

type LbType = 'activity' | 'wod' | 'skill';

const wodTypeLabels: Record<string, string> = {
  FOR_TIME: 'На время',
  AMRAP: 'КМБР',
  EMOM: 'EMOM',
  TABATA: 'Табата',
};

type WodBlock = ClubWorkoutTemplate['wodBlocks'][0];
type WodGroup = {
  wodType: string;
  timeCapSeconds: number | null;
  isLadder: boolean;
  ladderRounds: number | null;
  restBetweenRoundsSeconds: number | null;
  rx: WodBlock | null;
  sc: WodBlock | null;
};

function groupWodBlocks(wodBlocks: WodBlock[]): WodGroup[] {
  const groups: WodGroup[] = [];
  const used = new Set<number>();
  for (let i = 0; i < wodBlocks.length; i++) {
    if (used.has(i)) continue;
    const wb = wodBlocks[i];
    let pairedIdx = -1;
    for (let j = i + 1; j < wodBlocks.length; j++) {
      if (used.has(j)) continue;
      const other = wodBlocks[j];
      if (other.wodType === wb.wodType && other.level !== wb.level) { pairedIdx = j; break; }
    }
    if (pairedIdx >= 0) {
      used.add(pairedIdx);
      const paired = wodBlocks[pairedIdx];
      groups.push({
        wodType: wb.wodType,
        timeCapSeconds: wb.timeCapSeconds,
        isLadder: wb.isLadder,
        ladderRounds: wb.ladderRounds,
        restBetweenRoundsSeconds: wb.restBetweenRoundsSeconds ?? null,
        rx: wb.level === 'RX' ? wb : paired,
        sc: wb.level === 'SCALED' ? wb : paired,
      });
    } else {
      groups.push({
        wodType: wb.wodType,
        timeCapSeconds: wb.timeCapSeconds,
        isLadder: wb.isLadder,
        ladderRounds: wb.ladderRounds,
        restBetweenRoundsSeconds: wb.restBetweenRoundsSeconds ?? null,
        rx: wb.level === 'RX' ? wb : null,
        sc: wb.level === 'SCALED' ? wb : null,
      });
    }
    used.add(i);
  }
  return groups;
}

function formatSkillWeights(sets: Array<{ reps: number; weight: number; weightIsPercent?: boolean }>): string {
  const weights = sets.map(s => s.weight).filter(w => w > 0);
  if (weights.length === 0) return '';
  const isPercent = sets.some(s => s.weightIsPercent);
  const unit = isPercent ? '%' : ' кг';
  const allSame = weights.every(w => w === weights[0]);
  if (allSame) return `${weights[0]}${unit}`;
  return weights.join('/') + unit;
}

function formatSkillReps(sets: Array<{ reps: number }>): string {
  const repsList = sets.map(s => s.reps).filter(r => r > 0);
  if (repsList.length === 0) return '';
  const allSame = repsList.every(r => r === repsList[0]);
  if (allSame) return `${repsList[0]}`;
  return repsList.join('/');
}

function safeDisplayName(name: string): string {
  if (!name || !name.includes('@')) return name;
  return name.split('@')[0];
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="cp-rank gold">1</span>;
  if (rank === 2) return <span className="cp-rank silver">2</span>;
  if (rank === 3) return <span className="cp-rank bronze">3</span>;
  return <span className="cp-rank">{rank}</span>;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div className="cp-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconDelete = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconChevron = ({ down }: { down: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {down ? <polyline points="6 9 12 15 18 9" /> : <polyline points="6 15 12 9 18 15" />}
  </svg>
);

export default function ClubPage() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);

  const [lbType, setLbType] = useState<LbType>('wod');
  const [activityPeriod, setActivityPeriod] = useState<'month' | 'all'>('month');
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyLeaderboardEntry[]>([]);
  const [wodEntries, setWodEntries] = useState<WodLeaderboardEntry[]>([]);
  const [skillEntries, setSkillEntries] = useState<SkillLeaderboardEntry[]>([]);
  const [wodDate, setWodDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [wodSignatures, setWodSignatures] = useState<Array<{ signature: string; label: string }>>([]);
  const [selectedWodSignature, setSelectedWodSignature] = useState('');

  const [templates, setTemplates] = useState<ClubWorkoutTemplate[]>([]);
  const [wodGenderView, setWodGenderView] = useState<'M' | 'F'>('M');
  const [deleteConfirm, setDeleteConfirm] = useState<{ tmpl: ClubWorkoutTemplate; msg: string } | null>(null);

  const [members, setMembers] = useState<Array<{ userId: string; email: string; firstName: string | null; lastName: string | null; role: string; showInLeaderboard: boolean; joinedAt: string }>>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const [collapsedTemplates, setCollapsedTemplates] = useState<Set<string>>(new Set());

  const [rmTooltip, setRmTooltip] = useState<{ x: number; y: number } | null>(null);
  const rmHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!rmTooltip) return;
    const close = () => setRmTooltip(null);
    const timer = setTimeout(() => {
      document.addEventListener('click', close, { once: true });
      document.addEventListener('touchstart', close, { once: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('touchstart', close);
    };
  }, [rmTooltip]);

  useEffect(() => { loadClub(); }, []);

  async function loadClub() {
    try {
      const { club: myClub } = await clubsApi.getMy();
      if (!myClub) { router.push('/dashboard/club/join'); return; }
      setClub(myClub);
    } catch {
      router.push('/dashboard/club/join');
    } finally {
      setLoading(false);
    }
  }

  const loadTabData = useCallback(async () => {
    if (!club) return;

    if (lbType === 'activity') {
      try {
        const { entries } = activityPeriod === 'month'
          ? await clubsApi.getMonthlyLeaderboard(club.id)
          : await clubsApi.getAllTimeLeaderboard(club.id);
        setMonthlyEntries(entries);
      } catch { setMonthlyEntries([]); }
    } else if (lbType === 'wod') {
      try {
        const { templates: t } = await clubsApi.getTodayWorkouts(club.id, wodDate);
        setTemplates(t);
        const allWodTypes = new Set<string>();
        for (const tmpl of t) {
          for (const wb of tmpl.wodBlocks) allWodTypes.add(wb.wodType);
        }
        setWodSignatures([...allWodTypes].map(wt => ({
          signature: wt,
          label: wodTypeLabels[wt] || wt,
        })));
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
  }, [club, lbType, wodDate, activityPeriod, selectedWodSignature]);

  useEffect(() => { loadTabData(); }, [loadTabData]);

  useEffect(() => {
    if (showMembers && club && !membersLoaded) {
      loadMembers();
    }
  }, [showMembers, club]);

  async function loadMembers() {
    if (!club) return;
    try {
      const { members: m } = await clubsApi.getMembers(club.id);
      setMembers(m);
      setMembersLoaded(true);
    } catch { setMembers([]); }
  }

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

  function toggleCollapse(sig: string) {
    setCollapsedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(sig)) next.delete(sig); else next.add(sig);
      return next;
    });
  }

  function buildTemplateQuery(tmpl: ClubWorkoutTemplate): string {
    const mergedWodBlocks: Array<any> = [];
    const used = new Set<number>();
    for (let i = 0; i < tmpl.wodBlocks.length; i++) {
      if (used.has(i)) continue;
      const wb = tmpl.wodBlocks[i];
      let paired = -1;
      for (let j = i + 1; j < tmpl.wodBlocks.length; j++) {
        if (used.has(j)) continue;
        const other = tmpl.wodBlocks[j];
        if (other.wodType === wb.wodType && other.level !== wb.level) { paired = j; break; }
      }
      if (paired >= 0) {
        used.add(paired);
        const rxBlock = wb.level === 'RX' ? wb : tmpl.wodBlocks[paired];
        const scBlock = wb.level === 'SCALED' ? wb : tmpl.wodBlocks[paired];
        mergedWodBlocks.push({ ...rxBlock, level: 'RX', _hasScaled: true, _scaledExercises: scBlock.exercises });
      } else {
        mergedWodBlocks.push(wb);
      }
      used.add(i);
    }
    const data = { date: tmpl.date, skillBlocks: tmpl.skillBlocks, wodBlocks: mergedWodBlocks };
    return `/dashboard/workouts/new?clubTemplate=${encodeURIComponent(JSON.stringify(data))}`;
  }

  function handleDeleteTemplate(tmpl: ClubWorkoutTemplate) {
    if (!club) return;
    const hasOtherAthletes = tmpl.athleteCount > 1;
    const msg = hasOtherAthletes
      ? `По этому шаблону уже записаны результаты (${tmpl.athleteCount - 1} атлет(ов)). Шаблон будет убран из ВОД дня, но тренировки атлетов сохранятся.`
      : 'Удалить этот шаблон тренировки?';
    setDeleteConfirm({ tmpl, msg });
  }

  async function confirmDelete() {
    if (!deleteConfirm || !club) return;
    try {
      await clubsApi.deleteClubWorkout(club.id, deleteConfirm.tmpl.firstWorkoutId);
      setTemplates(prev => prev.filter(t => t.signature !== deleteConfirm.tmpl.signature));
      loadTabData();
    } catch (e: any) {
      alert(e.message || 'Ошибка удаления');
    } finally {
      setDeleteConfirm(null);
    }
  }

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner" /></div>;
  }
  if (!club) return null;

  const isOwnerOrCoach = club.myRole === 'OWNER' || club.myRole === 'COACH';
  const visibleTemplates = templates.filter(tmpl => !selectedWodSignature || tmpl.wodBlocks.some(wb => wb.wodType === selectedWodSignature));

  const memberLabel = (() => {
    const n = club.memberCount;
    if (n === 1) return '1 участник';
    if (n < 5) return `${n} участника`;
    return `${n} участников`;
  })();

  return (
    <div className="cp-page">

      {/* ── Шапка клуба ── */}
      <div className="cp-hero">
        <div className="cp-hero-inner">
          <div className="cp-hero-text">
            <h1 className="cp-club-name">{club.name}</h1>
            <div className="cp-club-meta">
              {club.city && <span className="cp-meta-item">{club.city}</span>}
              {club.city && <span className="cp-meta-dot" aria-hidden="true">·</span>}
              <button
                className="cp-members-link"
                onClick={() => setShowMembers(true)}
              >
                {memberLabel}
              </button>
            </div>
          </div>
          {isOwnerOrCoach && (
            <Link href="/dashboard/club/settings" className="cp-settings-btn" aria-label="Настройки клуба">
              <IconSettings />
            </Link>
          )}
        </div>
      </div>

      {/* ── Главные табы ── */}
      <div className="cp-tabs-wrap">
        <div className="cp-tabs">
          {(['wod', 'activity', 'skill'] as LbType[]).map(t => (
            <button key={t} className={`cp-tab ${lbType === t ? 'active' : ''}`} onClick={() => setLbType(t)}>
              {t === 'wod' ? 'Тренировка дня' : t === 'activity' ? 'Активность' : 'Сила'}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-body">
        <div className="cp-section">

          {/* ── Тренировка дня ── */}
          {lbType === 'wod' && (
            <div className="cp-wod-section">

              {/* Строка с датой и кнопкой */}
              <div className="cp-date-row">
                <SingleDatePicker
                  value={wodDate}
                  onChange={(d) => { setWodDate(d); setSelectedWodSignature(''); }}
                />
                {isOwnerOrCoach && (
                  <Link href={`/dashboard/workouts/new?date=${wodDate}`} className="cp-add-btn">
                    + Добавить
                  </Link>
                )}
              </div>

              {/* Фильтр по типу ВОД */}
              {wodSignatures.length > 1 && (
                <div className="cp-chips-row cp-chips-sm">
                  <button className={`cp-chip cp-chip-sm ${!selectedWodSignature ? 'active' : ''}`} onClick={() => setSelectedWodSignature('')}>Все</button>
                  {wodSignatures.map(ws => (
                    <button key={ws.signature} className={`cp-chip cp-chip-sm ${selectedWodSignature === ws.signature ? 'active' : ''}`} onClick={() => setSelectedWodSignature(ws.signature)}>
                      {ws.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Карточки шаблонов */}
              {visibleTemplates.map(tmpl => {
                const wodGroups = groupWodBlocks(tmpl.wodBlocks);
                const isCollapsed = collapsedTemplates.has(tmpl.signature);
                return (
                <div key={tmpl.signature} className="cp-wod-card">

                  {isCollapsed ? (
                    /* ── Свёрнутый вид ── */
                    <div className="cp-wod-summary">
                      <div className="cp-wod-summary-rows">
                        {tmpl.skillBlocks.map((sb, i) => (
                          <div key={`cs${i}`} className="cp-wod-summary-row">
                            <span className="cp-section-label skill">СКИЛЛ</span>
                            <span className="cp-summary-text">{sb.exerciseName}</span>
                          </div>
                        ))}
                        {wodGroups.map((group, gi) => (
                          <div key={`cg${gi}`} className="cp-wod-summary-row">
                            <span className="cp-section-label wod">ВОД</span>
                            <span className="cp-summary-text">
                              {wodTypeLabels[group.wodType] || group.wodType}
                              {group.timeCapSeconds ? ` · ${Math.floor(group.timeCapSeconds / 60)} мин` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button className="cp-collapse-toggle" onClick={() => toggleCollapse(tmpl.signature)} aria-label="Развернуть">
                        <IconChevron down={true} />
                      </button>
                    </div>
                  ) : (
                    /* ── Развёрнутый вид ── */
                    <>
                      {/* Кнопка свернуть */}
                      <button className="cp-collapse-toggle-abs" onClick={() => toggleCollapse(tmpl.signature)} aria-label="Свернуть">
                        <IconChevron down={false} />
                      </button>

                      {/* Скилл-блоки */}
                      {tmpl.skillBlocks.map((sb, i) => (
                        <div key={`s${i}`} className="cp-wod-block">
                          <div className="cp-block-section-header">
                            <span className="cp-section-label skill">СКИЛЛ</span>
                          </div>
                          <div className="cp-wod-exname">{sb.exerciseName}</div>
                          <div className="cp-wod-detail">
                            {sb.sets.length} подх.
                            {(() => {
                              const r = formatSkillReps(sb.sets);
                              return r ? ` × ${r} повт.` : null;
                            })()}
                            {(() => {
                              const w = formatSkillWeights(sb.sets);
                              return w ? ` · ${w}` : null;
                            })()}
                          </div>
                        </div>
                      ))}

                      {/* ВОД-блоки (RX и SC друг за другом) */}
                      {wodGroups.map((group, gi) => {
                        const hasBoth = group.rx !== null && group.sc !== null;
                        const cardHasGenderSplit = group.rx?.hasGenderSplit || group.sc?.hasGenderSplit;
                        const singleBlock = group.rx || group.sc;
                        if (!singleBlock) return null;

                        const renderExercises = (block: typeof singleBlock) => {
                          if (!block) return null;
                          return block.exercises.map((ex, j) => {
                            const showFemale = block.hasGenderSplit && wodGenderView === 'F';
                            const name = showFemale ? (ex.exerciseNameFemale || ex.exerciseName) : ex.exerciseName;
                            const reps = showFemale ? (ex.repsFemale ?? ex.reps) : ex.reps;
                            const weight = showFemale ? (ex.weightFemale ?? ex.weight) : ex.weight;
                            const dur = (ex as any).durationSeconds;
                            if (dur) {
                              const mm = Math.floor(dur / 60);
                              const ss = String(dur % 60).padStart(2, '0');
                              return (
                                <div key={j} className="cp-exercise-row">
                                  <span className="cp-ex-reps">{mm}:{ss}</span>
                                  <span className="cp-ex-name">{name}</span>
                                </div>
                              );
                            }
                            return (
                              <div key={j} className="cp-exercise-row">
                                {reps > 0 && <span className="cp-ex-reps">{reps}</span>}
                                <span className="cp-ex-name">{name}</span>
                                {weight ? <span className="cp-ex-weight">{weight} кг</span> : null}
                              </div>
                            );
                          });
                        };

                        return (
                          <div key={`g${gi}`} className="cp-wod-block">
                            <div className="cp-block-section-header">
                              <span className="cp-section-label wod">ВОД</span>
                              <span className="cp-wod-type-text">{wodTypeLabels[group.wodType] || group.wodType}</span>
                              {group.timeCapSeconds && (
                                <span className="cp-timecap">{Math.floor(group.timeCapSeconds / 60)} мин</span>
                              )}
                              {group.isLadder && (
                                <span className="cp-timecap">Лесенка{group.ladderRounds ? ` ×${group.ladderRounds}` : ''}{group.restBetweenRoundsSeconds ? ` · отдых ${Math.floor(group.restBetweenRoundsSeconds / 60)}:${String(group.restBetweenRoundsSeconds % 60).padStart(2, '0')}` : ''}</span>
                              )}
                              {cardHasGenderSplit && (
                                <div className="cp-gender-toggle" style={{ marginTop: 0, marginBottom: 0 }}>
                                  <button className={`cp-gender-btn ${wodGenderView === 'M' ? 'active' : ''}`} onClick={() => setWodGenderView('M')}>Муж.</button>
                                  <button className={`cp-gender-btn ${wodGenderView === 'F' ? 'active' : ''}`} onClick={() => setWodGenderView('F')}>Жен.</button>
                                </div>
                              )}
                            </div>
                            {hasBoth ? (
                              <div className="cp-level-sections-wrap">
                                <div className="cp-level-section">
                                  <span className="cp-level-badge rx">RX</span>
                                  <div className="cp-exercises">{renderExercises(group.rx!)}</div>
                                </div>
                                <div className="cp-level-section cp-level-section-sc">
                                  <span className="cp-level-badge scaled">SC</span>
                                  <div className="cp-exercises">{renderExercises(group.sc!)}</div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ marginBottom: '0.4rem' }}>
                                  <span className={`cp-level-badge ${singleBlock.level === 'SCALED' ? 'scaled' : 'rx'}`}>
                                    {singleBlock.level === 'SCALED' ? 'SC' : 'RX'}
                                  </span>
                                </div>
                                <div className="cp-exercises">{renderExercises(singleBlock)}</div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Футер карточки */}
                  <div className="cp-wod-footer">
                    <div className="cp-wod-actions">
                      {isOwnerOrCoach && (
                        <>
                          <Link href={`/dashboard/workouts/${tmpl.firstWorkoutId}/edit`} className="cp-icon-btn" title="Редактировать">
                            <IconEdit />
                          </Link>
                          <button type="button" onClick={() => handleDeleteTemplate(tmpl)} className="cp-icon-btn danger" title="Удалить">
                            <IconDelete />
                          </button>
                        </>
                      )}
                      <Link href={buildTemplateQuery(tmpl)} className="cp-cta-btn">
                        Записать →
                      </Link>
                    </div>
                  </div>
                </div>
                );
              })}

              {/* Пустой стейт */}
              {templates.length === 0 && (
                <div className="cp-empty">
                  <div className="cp-empty-icon">🏋️</div>
                  <p>На {wodDate === new Date().toISOString().split('T')[0] ? 'сегодня' : wodDate} пока нет тренировок</p>
                  {isOwnerOrCoach && (
                    <Link href={`/dashboard/workouts/new?date=${wodDate}`} className="cp-cta-btn" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
                      + Добавить тренировку
                    </Link>
                  )}
                </div>
              )}

              {/* Результаты */}
              {wodEntries.length > 0 && (
                <div className="cp-lb-block">
                  <div className="cp-block-title">Результаты</div>
                  <div className="cp-table-wrap">
                    <table className="cp-table">
                      <thead>
                        <tr>
                          <th className="cp-th-rank">#</th>
                          <th>Атлет</th>
                          <th>Ур.</th>
                          <th className="cp-th-result">Результат</th>
                          <th className="cp-th-num">Вес</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wodEntries.map((e, i) => (
                          <tr key={`${e.userId}-${e.workoutId}`} className={i < 3 ? 'top3' : ''}>
                            <td><RankBadge rank={e.rank || i + 1} /></td>
                            <td><span className="cp-lb-name">{safeDisplayName(e.name)}</span></td>
                            <td>
                              <span className={`cp-level-badge ${e.level === 'SCALED' ? 'scaled' : 'rx'}`}>
                                {e.level === 'SCALED' ? 'SC' : 'RX'}
                              </span>
                            </td>
                            <td className="cp-td-result">{e.resultDisplay}</td>
                            <td className="cp-td-num">{e.weightsUsed || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {templates.length > 0 && wodEntries.length === 0 && (
                <div className="cp-empty-sm">Пока никто не записал результат</div>
              )}
            </div>
          )}

          {/* ── Активность ── */}
          {lbType === 'activity' && (
            <div>
              <div className="cp-chips-row">
                <button className={`cp-chip ${activityPeriod === 'month' ? 'active' : ''}`} onClick={() => setActivityPeriod('month')}>
                  Этот месяц
                </button>
                <button className={`cp-chip ${activityPeriod === 'all' ? 'active' : ''}`} onClick={() => setActivityPeriod('all')}>
                  Всё время
                </button>
              </div>

              {monthlyEntries.length === 0 ? (
                <div className="cp-empty">
                  <div className="cp-empty-icon">📊</div>
                  <p>Нет данных за {activityPeriod === 'month' ? 'этот месяц' : 'всё время'}</p>
                </div>
              ) : (
                <div className="cp-table-wrap">
                  <table className="cp-table">
                    <thead>
                      <tr>
                        <th className="cp-th-rank">#</th>
                        <th>Атлет</th>
                        <th className="cp-th-num">Трен.</th>
                        <th className="cp-th-num">Тоннаж</th>
                        <th className="cp-th-num">Дней</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyEntries.map((e, i) => (
                        <tr key={e.userId} className={i < 3 ? 'top3' : ''}>
                          <td><RankBadge rank={i + 1} /></td>
                          <td><span className="cp-lb-name">{safeDisplayName(e.name)}</span></td>
                          <td className="cp-td-num">{e.workoutCount}</td>
                          <td className="cp-td-num">{e.tonnage > 1000 ? `${(e.tonnage / 1000).toFixed(1)}т` : `${Math.round(e.tonnage)}кг`}</td>
                          <td className="cp-td-num">{e.activeDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Сила (Skill PR Board) ── */}
          {lbType === 'skill' && (
            skillEntries.length === 0 ? (
              <div className="cp-empty">
                <div className="cp-empty-icon">🏋️</div>
                <p>Пока нет данных по скилл-упражнениям</p>
              </div>
            ) : (
              <div className="cp-skill-list">
                {skillEntries.map(entry => (
                  <div key={entry.exerciseName} className="cp-skill-block">
                    <div className="cp-skill-exname">{entry.exerciseName}</div>
                    <div className="cp-table-wrap">
                      <table className="cp-table">
                        <thead>
                          <tr>
                            <th className="cp-th-rank">#</th>
                            <th>Атлет</th>
                            <th className="cp-th-num">
                              1RM
                              <span
                                className="th-hint"
                                onMouseEnter={(e) => {
                                  if (rmHideTimer.current) clearTimeout(rmHideTimer.current);
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setRmTooltip({ x: r.left + r.width / 2, y: r.bottom + 4 });
                                }}
                                onMouseLeave={() => {
                                  rmHideTimer.current = setTimeout(() => setRmTooltip(null), 100);
                                }}
                                onTouchEnd={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (rmHideTimer.current) clearTimeout(rmHideTimer.current);
                                  if (rmTooltip) {
                                    setRmTooltip(null);
                                  } else {
                                    const r = e.currentTarget.getBoundingClientRect();
                                    setRmTooltip({ x: r.left + r.width / 2, y: r.bottom + 4 });
                                  }
                                }}
                              >?</span>
                            </th>
                            <th className="cp-th-num">Макс.</th>
                            <th className="cp-th-num">Лучший</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.athletes.slice(0, 5).map((a) => (
                            <tr key={a.userId} className={a.rank <= 3 ? 'top3' : ''}>
                              <td><RankBadge rank={a.rank} /></td>
                              <td><span className="cp-lb-name">{safeDisplayName(a.name)}</span></td>
                              <td className="cp-td-num">{a.best1RM ? `${a.best1RM} кг` : '—'}</td>
                              <td className="cp-td-num">{a.maxWeight} кг</td>
                              <td className="cp-td-num">{a.bestWeightForReps}кг×{a.bestReps}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

        </div>
      </div>

      {/* ── Модал: участники ── */}
      {showMembers && (
        <div className="cp-modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="cp-members-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-members-modal-header">
              <span className="cp-members-modal-title">Участники · {club.memberCount}</span>
              <button className="cp-modal-close" onClick={() => setShowMembers(false)}>✕</button>
            </div>

            {isOwnerOrCoach && (
              <div className="cp-invite-block">
                <button onClick={handleCreateInvite} className="cp-invite-generate-btn">
                  Создать приглашение
                </button>
                {inviteCode && (
                  <div className="cp-invite-card">
                    <div className="cp-invite-row">
                      <code className="cp-invite-code">{inviteCode}</code>
                      <button onClick={copyInviteCode} className={`cp-copy-btn ${inviteCopied ? 'copied' : ''}`}>
                        {inviteCopied ? '✓ Скопировано' : 'Копировать'}
                      </button>
                    </div>
                    <p className="cp-invite-hint">Отправьте этот код атлетам для вступления в клуб</p>
                  </div>
                )}
              </div>
            )}

            <div className="cp-members-list">
              {members.map(m => {
                const displayName = [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Атлет';
                return (
                  <div key={m.userId} className="cp-member-row">
                    <Avatar name={displayName} size={42} />
                    <div className="cp-member-info">
                      <span className="cp-member-name">{displayName}</span>
                      <span className={`cp-role-badge ${m.role.toLowerCase()}`}>
                        {m.role === 'OWNER' ? 'Владелец' : m.role === 'COACH' ? 'Тренер' : 'Атлет'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Модальное подтверждение удаления */}
      {deleteConfirm && (
        <div className="cp-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cp-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-title">Удалить шаблон?</div>
            <p className="cp-modal-msg">{deleteConfirm.msg}</p>
            <div className="cp-modal-actions">
              <button onClick={() => setDeleteConfirm(null)} className="cp-modal-cancel">Отмена</button>
              <button onClick={confirmDelete} className="cp-modal-confirm">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {rmTooltip && (
        <div
          className="th-hint-popup"
          style={{ position: 'fixed', top: rmTooltip.y, left: rmTooltip.x, zIndex: 1000 }}
          onMouseEnter={() => { if (rmHideTimer.current) clearTimeout(rmHideTimer.current); }}
          onMouseLeave={() => setRmTooltip(null)}
        >
          Расчётный максимум для одного повторения.<br />
          Формула Эпли: 1RM = вес × (1 + повт / 30)
        </div>
      )}

    </div>
  );
}
