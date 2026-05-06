'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clubsApi } from '@/lib/api/client';

function ClubJoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'choose' | 'join' | 'create'>('choose');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setInviteCode(code.toUpperCase());
      setMode('join');
    }
  }, []);
  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      await clubsApi.join(inviteCode.trim().toUpperCase());
      router.push('/dashboard/club');
    } catch (err: any) {
      setError(err.message || 'Не удалось вступить в клуб');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!clubName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await clubsApi.create({
        name: clubName.trim(),
        city: clubCity.trim() || undefined,
        description: clubDescription.trim() || undefined,
      });
      router.push('/dashboard/club');
    } catch (err: any) {
      setError(err.message || 'Не удалось создать клуб');
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'choose') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Клуб</h1>
          <p className="auth-subtitle">Вы пока не состоите ни в одном клубе</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            <button onClick={() => setMode('join')} className="btn btn-primary" style={{ width: '100%' }}>
              Вступить по приглашению
            </button>
            <button onClick={() => setMode('create')} className="btn btn-secondary" style={{ width: '100%' }}>
              Создать свой клуб
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Вступить в клуб</h1>
          <p className="auth-subtitle">Введите код приглашения от тренера или владельца клуба</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleJoin} style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Код приглашения</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="form-input"
                placeholder="ABCD1234"
                maxLength={20}
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.2em' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !inviteCode.trim()}>
              {loading ? 'Вступаем...' : 'Вступить'}
            </button>
          </form>

          <button onClick={() => { setMode('choose'); setError(''); }} className="btn btn-link" style={{ marginTop: '1rem', width: '100%' }}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  // create
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Создать клуб</h1>
        <p className="auth-subtitle">Вы станете владельцем нового клуба</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleCreate} style={{ marginTop: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Название клуба *</label>
            <input
              type="text"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className="form-input"
              placeholder="CrossFit Kazan"
              maxLength={200}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Город</label>
            <input
              type="text"
              value={clubCity}
              onChange={(e) => setClubCity(e.target.value)}
              className="form-input"
              placeholder="Казань"
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea
              value={clubDescription}
              onChange={(e) => setClubDescription(e.target.value)}
              className="form-input"
              placeholder="Краткое описание клуба..."
              maxLength={1000}
              rows={3}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !clubName.trim()}>
            {loading ? 'Создаём...' : 'Создать клуб'}
          </button>
        </form>

        <button onClick={() => { setMode('choose'); setError(''); }} className="btn btn-link" style={{ marginTop: '1rem', width: '100%' }}>
          Назад
        </button>
      </div>
    </div>
  );
}

export default function ClubJoinPage() {
  return (
    <Suspense fallback={<div className="loading-container"><div className="loading-spinner" /></div>}>
      <ClubJoinPageInner />
    </Suspense>
  );
}
