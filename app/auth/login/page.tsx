'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api/client';

type Tab = 'login' | 'register' | 'reset';

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Reset
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await authApi.login(loginEmail, loginPassword);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setLoginError('Неверный email или пароль');
        else if (err.status === 429) setLoginError('Слишком много попыток. Подождите 15 минут.');
        else setLoginError(err.message);
      } else {
        setLoginError('Ошибка соединения с сервером');
      }
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegError('');
    if (regPassword !== regConfirm) {
      setRegError('Пароли не совпадают');
      return;
    }
    setRegLoading(true);
    try {
      await authApi.register(regEmail, regPassword);
      setRegSuccess('Аккаунт создан! Проверьте почту для подтверждения email.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setRegError('Пользователь с таким email уже существует');
        else if (err.details?.length) setRegError(err.details[0].message);
        else setRegError(err.message);
      } else {
        setRegError('Ошибка соединения с сервером');
      }
    } finally {
      setRegLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setResetLoading(true);
    try {
      await authApi.requestPasswordReset(resetEmail);
      setResetSuccess('Письмо со ссылкой для восстановления отправлено на ваш email.');
    } catch (err) {
      if (err instanceof ApiError) setResetError(err.message);
      else setResetError('Ошибка соединения с сервером');
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-logo-wrapper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/workout-tracker/images/logo.png"
          alt="CrossFit Tracker"
          className="auth-logo-img"
        />
      </div>

      <div className="auth-card">
        {/* Табы — не показываем при сбросе пароля */}
        {tab !== 'reset' && (
          <div className="auth-tabs">
            <button
              className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => setTab('login')}
              type="button"
            >
              Вход
            </button>
            <button
              className={`auth-tab${tab === 'register' ? ' active' : ''}`}
              onClick={() => setTab('register')}
              type="button"
            >
              Регистрация
            </button>
          </div>
        )}

        {/* Форма входа */}
        <form
          onSubmit={handleLogin}
          className={`auth-form${tab === 'login' ? ' active' : ''}`}
        >
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              className="form-input"
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
            {loginError && <div className="form-error-msg">{loginError}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Пароль</label>
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="auth-actions">
            <span />
            <button
              type="button"
              className="forgot-password"
              onClick={() => setTab('reset')}
            >
              Забыли пароль?
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '1.5rem' }}
            disabled={loginLoading}
          >
            {loginLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {/* Форма регистрации */}
        <form
          onSubmit={handleRegister}
          className={`auth-form${tab === 'register' ? ' active' : ''}`}
        >
          {regSuccess ? (
            <div className="form-success" style={{ textAlign: 'center', padding: '1rem 0' }}>
              {regSuccess}
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Имя</label>
                  <input
                    type="text"
                    value={regFirstName}
                    onChange={e => setRegFirstName(e.target.value)}
                    className="form-input"
                    placeholder="Иван"
                    autoComplete="given-name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Фамилия</label>
                  <input
                    type="text"
                    value={regLastName}
                    onChange={e => setRegLastName(e.target.value)}
                    className="form-input"
                    placeholder="Иванов"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className="form-input"
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Пароль</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  className="form-input"
                  placeholder="Минимум 8 символов"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Подтверждение пароля</label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  className="form-input"
                  placeholder="Повторите пароль"
                  required
                  autoComplete="new-password"
                />
              </div>

              {regError && <div className="form-error-msg">{regError}</div>}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                style={{ marginTop: '1.5rem' }}
                disabled={regLoading}
              >
                {regLoading ? 'Создание...' : 'Создать аккаунт'}
              </button>
            </>
          )}
        </form>

        {/* Форма сброса пароля */}
        <form
          onSubmit={handleReset}
          className={`auth-form${tab === 'reset' ? ' active' : ''}`}
        >
          <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Введите ваш email, и мы отправим ссылку для восстановления пароля.
          </p>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              className="form-input"
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          {resetError && <div className="form-error-msg">{resetError}</div>}
          {resetSuccess && <div className="form-success">{resetSuccess}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '1.5rem', marginBottom: '1rem' }}
            disabled={resetLoading}
          >
            {resetLoading ? 'Отправка...' : 'Восстановить пароль'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              className="forgot-password"
              onClick={() => setTab('login')}
            >
              Вернуться ко входу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
