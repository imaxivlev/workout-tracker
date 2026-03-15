'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.login(email, password);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Неверный email или пароль');
        } else if (err.status === 429) {
          setError('Слишком много попыток. Подождите 15 минут.');
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

        <h1 className="auth-title">Вход</h1>

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
            <label htmlFor="password" className="form-label">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/auth/reset-password" className="auth-link">
            Забыли пароль?
          </Link>
          <span className="auth-link-sep">·</span>
          <Link href="/auth/register" className="auth-link">
            Регистрация
          </Link>
        </div>
      </div>
    </div>
  );
}
