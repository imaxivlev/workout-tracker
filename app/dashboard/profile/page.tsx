'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { userApi, ApiError, authApi, clubsApi } from '@/lib/api/client';
import CustomSelect from '@/app/components/CustomSelect';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('male');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Club leaderboard visibility
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [clubRole, setClubRole] = useState<string | null>(null);
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);

  useEffect(() => {
    // Load club membership
    clubsApi.getMy().then(({ club }) => {
      if (club) {
        setClubId(club.id);
        setClubName(club.name);
        setClubRole(club.myRole);
        // Load current visibility
        clubsApi.getMembers(club.id).then(({ members }) => {
          userApi.getProfile().then(({ user }) => {
            const me = members.find(m => m.userId === user.id);
            if (me) setShowInLeaderboard(me.showInLeaderboard);
          }).catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  async function toggleLeaderboardVisibility() {
    if (!clubId) return;
    const newVal = !showInLeaderboard;
    try {
      await clubsApi.updateLeaderboardVisibility(clubId, newVal);
      setShowInLeaderboard(newVal);
    } catch {}
  }

  useEffect(() => {
    userApi.getProfile()
      .then((data) => {
        const user = data.user;
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '';
        setDisplayName(name || user.email);
        setEmail(user.email);
        setAvatar(user.avatar || null);
        setFirstName(user.firstName || '');
        setLastName(user.lastName || '');
        setGender(user.gender || '');
      })
      .catch(err => {
        if (err instanceof ApiError) setError(err.message);
        else setError('Ошибка загрузки профиля');
      })
      .finally(() => setLoading(false));
  }, []);

  const displayInitials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || email?.[0]?.toUpperCase() || '?';

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      router.push('/auth/login');
      router.refresh();
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await userApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), gender: gender || undefined });
      const user = data.user;
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '';
      setDisplayName(name || user.email);
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');

      if (newPassword || confirmPassword) {
        if (!currentPassword) {
          setError('Введите текущий пароль');
          setSaving(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError('Пароли не совпадают');
          setSaving(false);
          return;
        }
        try {
          await userApi.changePassword(currentPassword, newPassword, confirmPassword);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } catch (err) {
          if (err instanceof ApiError) {
            setError(err.message);
            setSaving(false);
            return;
          }
        }
      }

      setSuccess('Профиль обновлён');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">Профиль</h1>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              : displayInitials
            }
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{displayName}</h2>
            <div className="profile-email">{email}</div>
            {clubName && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {clubName} · {clubRole === 'OWNER' ? 'Владелец' : clubRole === 'COACH' ? 'Тренер' : 'Атлет'}
              </div>
            )}
          </div>
          <button type="button" onClick={handleLogout} className="btn-danger">
            Выйти
          </button>
        </div>

        <div className="profile-form">
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label>Имя</label>
                <input
                  type="text"
                  className="form-input"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Иван"
                  maxLength={50}
                />
              </div>
              <div className="form-group">
                <label>Фамилия</label>
                <input
                  type="text"
                  className="form-input"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Иванов"
                  maxLength={50}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Пол</label>
              <CustomSelect
                options={[
                  { value: 'MALE', label: 'Мужской' },
                  { value: 'FEMALE', label: 'Женский' },
                ]}
                value={gender}
                onChange={setGender}
              />
            </div>

            {clubId && (
              <div className="account-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Клуб</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={showInLeaderboard}
                    onChange={toggleLeaderboardVisibility}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                  Показывать меня в лидербордах клуба
                </label>
              </div>
            )}

            <div className="account-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Смена пароля</h3>
              <div className="form-group">
                <label>Текущий пароль</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Новый пароль</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label>Подтвердите пароль</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            {success && <div className="form-success">{success}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
