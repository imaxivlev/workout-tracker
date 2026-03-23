'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api/client';

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading-state"><div className="spinner" /></div>
        </div>
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}

function VerifyForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Токен подтверждения не найден');
      return;
    }

    authApi.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Email успешно подтверждён!');
      })
      .catch(err => {
        setStatus('error');
        if (err instanceof ApiError && err.status === 400) {
          setMessage('Ссылка для подтверждения устарела или уже использована');
        } else {
          setMessage('Ошибка подтверждения email');
        }
      });
  }, [token]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🏋️</span>
          <span className="auth-logo-text">CrossFit Tracker</span>
        </div>

        <h1 className="auth-title">Подтверждение email</h1>

        {status === 'loading' && (
          <div className="auth-status">
            <div className="spinner" />
            <p>Проверяем токен...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-status">
            <div className="status-icon status-success">✓</div>
            <p className="form-success">{message}</p>
            <Link href="/auth/login" className="btn btn-primary">
              Войти
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="auth-status">
            <div className="status-icon status-error">✗</div>
            <p className="form-error">{message}</p>
            <Link href="/auth/login" className="auth-link">
              Вернуться к входу
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
