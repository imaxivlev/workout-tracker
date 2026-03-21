'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clubsApi, Club, ClubMember } from '@/lib/api/client';

export default function ClubSettingsPage() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Форма
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { club: myClub } = await clubsApi.getMy();
      if (!myClub) { router.push('/dashboard/club/join'); return; }
      if (myClub.myRole !== 'OWNER' && myClub.myRole !== 'COACH') {
        router.push('/dashboard/club');
        return;
      }
      setClub(myClub);
      setName(myClub.name);
      setCity(myClub.city || '');
      setDescription(myClub.description || '');

      const { members: m } = await clubsApi.getMembers(myClub.id);
      setMembers(m);
    } catch {
      router.push('/dashboard/club');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!club) return;
    setSaving(true);
    setMessage('');
    try {
      const { club: updated } = await clubsApi.update(club.id, {
        name: name.trim(),
        city: city.trim() || undefined,
        description: description.trim() || undefined,
      });
      setClub(updated);
      setMessage('Сохранено!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (!club) return;
    try {
      await clubsApi.updateMemberRole(club.id, userId, newRole);
      const { members: m } = await clubsApi.getMembers(club.id);
      setMembers(m);
    } catch (err: any) {
      alert(err.message || 'Ошибка');
    }
  }

  async function handleRemoveMember(userId: string, memberName: string) {
    if (!club) return;
    if (!confirm(`Удалить ${memberName} из клуба?`)) return;
    try {
      await clubsApi.removeMember(club.id, userId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (err: any) {
      alert(err.message || 'Ошибка');
    }
  }

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner" /></div>;
  }

  if (!club) return null;

  return (
    <div className="club-page">
      <h1 className="page-title">Настройки клуба</h1>

      {/* Форма редактирования */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <h2 className="section-title">Основная информация</h2>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Название</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="form-input" maxLength={200}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Город</label>
              <input
                type="text" value={city} onChange={(e) => setCity(e.target.value)}
                className="form-input" maxLength={100}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Описание</label>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                className="form-input" maxLength={1000} rows={3}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            {message && <span style={{ marginLeft: '1rem' }}>{message}</span>}
          </form>
        </div>
      </div>

      {/* Управление участниками */}
      {club.myRole === 'OWNER' && (
        <div className="card">
          <div className="card-body">
            <h2 className="section-title">Участники ({members.length})</h2>
            <div className="members-list">
              {members.map(m => (
                <div key={m.userId} className="member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="member-info">
                    <span className="member-name">
                      {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                      className="form-input"
                      style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                      disabled={m.role === 'OWNER'}
                    >
                      <option value="OWNER">Владелец</option>
                      <option value="COACH">Тренер</option>
                      <option value="ATHLETE">Атлет</option>
                    </select>
                    {m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveMember(m.userId, [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.25rem 0.5rem' }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <button onClick={() => router.push('/dashboard/club')} className="btn btn-secondary">
          Назад к клубу
        </button>
      </div>
    </div>
  );
}
