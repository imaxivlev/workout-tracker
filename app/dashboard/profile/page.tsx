'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { userApi, ApiError, authApi } from '@/lib/api/client';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('male');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    userApi.getProfile()
      .then((data) => {
        const user = data.user;
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '';
        setDisplayName(name || user.email);
        setEmail(user.email);
        setAvatar(user.avatar || null);
        setFullName(name);
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
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const data = await userApi.updateProfile({ firstName, lastName });
      const user = data.user;
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '';
      setDisplayName(name || user.email);
      setFullName(name);

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setError('Пароли не совпадают');
          setSaving(false);
          return;
        }
        try {
          await userApi.changePassword('', newPassword, confirmPassword);
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
          </div>
          <button type="button" onClick={handleLogout} className="btn-danger">
            Выйти
          </button>
        </div>

        <div className="profile-form">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Имя</label>
              <input
                type="text"
                className="form-input"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Иван Петрович"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>Пол</label>
              <select
                className="form-select"
                value={gender}
                onChange={e => setGender(e.target.value)}
              >
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>

            <div className="account-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Смена пароля</h3>
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
