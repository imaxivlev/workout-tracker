'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const tabs = [
  { href: '/dashboard/admin', label: 'Обзор', exact: true },
  { href: '/dashboard/admin/users', label: 'Пользователи' },
  { href: '/dashboard/admin/clubs', label: 'Клубы' },
  { href: '/dashboard/admin/workouts', label: 'Тренировки' },
  { href: '/dashboard/admin/exercises', label: 'Упражнения' },
  { href: '/dashboard/admin/consents', label: 'Согласия' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [access, setAccess] = useState<'loading' | 'granted' | 'denied'>('loading');

  useEffect(() => {
    fetch('/api/admin', { credentials: 'include' })
      .then(r => setAccess(r.ok ? 'granted' : 'denied'))
      .catch(() => setAccess('denied'));
  }, []);

  if (access === 'loading') {
    return <div className="loading-container"><div className="loading-spinner" /></div>;
  }

  if (access === 'denied') {
    return (
      <div className="admin-page">
        <div className="admin-access-denied">
          <div className="admin-access-denied-icon">&#128274;</div>
          <h2>Доступ запрещён</h2>
          <p>У вас нет прав для просмотра админ-панели</p>
          <Link href="/dashboard" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Админ-панель</h1>
      </div>
      <div className="admin-tabs">
        {tabs.map(t => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={`admin-tab ${active ? 'active' : ''}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="admin-content">
        {children}
      </div>
    </div>
  );
}
