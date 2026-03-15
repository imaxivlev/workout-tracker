'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api/client';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      await authApi.register(email, password);
      setSuccess('Аккаунт создан! Проверьте почту для подтверждения email.');
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('Пользователь с таким email уже существует');
        } else if (err.details?.length) {
          setError(err.details[0].message);
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

        <h1 className="auth-title">Регистрация</h1>

        {success ? (
          <div className="form-success">{success}</div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
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

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Пароль <span className="form-hint">(мин. 8 символов, 1 буква, 1 цифра)</span>
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
              {loading ? 'Создание аккаунта...' : 'Создать аккаунт'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link href="/auth/login" className="auth-link">
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
