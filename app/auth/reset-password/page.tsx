'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api/client';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Шаг 1: Запрос сброса — ввод email
  async function handleRequestReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.requestPasswordReset(email);
      setSuccess('Инструкции по сбросу пароля отправлены на ваш email');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ошибка соединения с сервером');
      }
    } finally {
      setLoading(false);
    }
  }

  // Шаг 2: Подтверждение сброса — ввод нового пароля
  async function handleConfirmReset(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      await authApi.confirmPasswordReset(token!, password);
      setSuccess('Пароль успешно изменён!');
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError('Ссылка для сброса пароля устарела. Запросите новую.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Ошибка соединения с сервером');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🏋️</span>
          <span className="auth-logo-text">CrossFit Tracker</span>
        </div>

        <h1 className="auth-title">
          {token ? 'Новый пароль' : 'Сброс пароля'}
        </h1>

        {success ? (
          <div className="form-success">{success}</div>
        ) : token ? (
          // Шаг 2: Форма нового пароля
          <form onSubmit={handleConfirmReset} className="auth-form">
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Новый пароль <span className="form-hint">(мин. 8 символов, 1 буква, 1 цифра)</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm" className="form-label">Повторите пароль</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить пароль'}
            </button>
          </form>
        ) : (
          // Шаг 1: Форма email
          <form onSubmit={handleRequestReset} className="auth-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить инструкции'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link href="/auth/login" className="auth-link">
            Вернуться к входу
          </Link>
        </div>
      </div>
    </div>
  );
}
