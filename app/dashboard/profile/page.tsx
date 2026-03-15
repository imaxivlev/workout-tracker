'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { userApi, UserProfile, ApiError, getCsrfToken, authApi } from '@/lib/api/client';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    userApi.getProfile()
      .then(data => {
        setProfile(data.user);
        setFirstName(data.user.firstName || '');
        setLastName(data.user.lastName || '');
      })
      .catch(err => {
        if (err instanceof ApiError) setError(err.message);
        else setError('Ошибка загрузки профиля');
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      router.push('/auth/login');
      router.refresh();
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await userApi.updateProfile({ firstName, lastName });
      setProfile(data.user);
      setSuccess('Профиль обновлён');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeEmail(e: FormEvent) {
    e.preventDefault();
    setEmailMsg('');
    try {
      await userApi.changeEmail(newEmail);
      setEmailMsg('Письмо с подтверждением отправлено на ' + newEmail);
      setNewEmail('');
    } catch (err) {
      if (err instanceof ApiError) setEmailMsg('Ошибка: ' + err.message);
      else setEmailMsg('Ошибка отправки');
    }
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError('');
    setDeleting(true);
    try {
      const csrfToken = await getCsrfToken();
      await userApi.deleteAccount(deletePassword, csrfToken);
      router.push('/auth/login');
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.status === 401 ? 'Неверный пароль' : err.message);
      } else {
        setDeleteError('Ошибка удаления аккаунта');
      }
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state"><div className="spinner" /></div>
      </div>
    );
  }

  const initials = ((profile?.firstName || '') + ' ' + (profile?.lastName || '')).trim()
    || profile?.email?.[0]?.toUpperCase()
    || '?';
  const displayInitials = initials.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || initials[0]?.toUpperCase() || '?';

  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.email || '';

  const joinDate = profile
    ? new Date(profile.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="container">
      <h1 className="page-title">Профиль</h1>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {profile?.avatar
              ? <img src={profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              : displayInitials
            }
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{displayName}</h2>
            <div className="profile-email">{profile?.email}</div>
            {joinDate && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                В системе с {joinDate}
              </div>
            )}
          </div>
          <button type="button" onClick={handleLogout} className="btn-danger">
            Выйти
          </button>
        </div>

        <div className="profile-form">
          <form onSubmit={handleSaveProfile}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Имя</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="form-input"
                  placeholder="Иван"
                  maxLength={50}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Фамилия</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="form-input"
                  placeholder="Иванов"
                  maxLength={50}
                />
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

          <div className="account-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
            <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Смена email</h3>
            <form onSubmit={handleChangeEmail}>
              <div className="form-group">
                <label className="form-label">Новый email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="form-input"
                  placeholder="new@example.com"
                  required
                />
              </div>
              {emailMsg && (
                <div className={emailMsg.startsWith('Ошибка') ? 'form-error' : 'form-success'}>
                  {emailMsg}
                </div>
              )}
              <button type="submit" className="btn-secondary">
                Отправить подтверждение
              </button>
            </form>
          </div>

          <div className="account-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
            <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>
              Опасная зона
            </h3>
            {!showDelete ? (
              <button type="button" onClick={() => setShowDelete(true)} className="btn-danger">
                Удалить аккаунт
              </button>
            ) : (
              <form onSubmit={handleDeleteAccount}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Все ваши тренировки и данные будут удалены безвозвратно.
                  Введите пароль для подтверждения.
                </p>
                <div className="form-group">
                  <label className="form-label">Пароль</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    className="form-input"
                    placeholder="Ваш пароль"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {deleteError && <div className="form-error">{deleteError}</div>}
                <div className="account-actions">
                  <button type="submit" className="btn-danger" disabled={deleting}>
                    {deleting ? 'Удаление...' : 'Удалить аккаунт'}
                  </button>
                  <button type="button" onClick={() => setShowDelete(false)} className="btn-secondary">
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
