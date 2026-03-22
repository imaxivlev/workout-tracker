'use client';

import { useEffect, useState } from 'react';
import { adminApi, AdminStats } from '@/lib/api/client';
import Link from 'next/link';

export default function AdminDashboard() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getStats().then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="admin-error">{error}</div>;
  if (!data) return <div className="loading-container"><div className="loading-spinner" /></div>;

  const { stats, recentUsers } = data;
  const cards = [
    { label: 'Пользователи', value: stats.usersCount, href: '/dashboard/admin/users', color: '#60a5fa' },
    { label: 'Клубы', value: stats.clubsCount, href: '/dashboard/admin/clubs', color: '#4ade80' },
    { label: 'Тренировки', value: stats.workoutsCount, href: '/dashboard/admin/workouts', color: '#f97316' },
    { label: 'Упражнения', value: stats.exercisesCount, href: '/dashboard/admin/exercises', color: '#a78bfa' },
    { label: 'Согласия', value: stats.consentsCount, href: '/dashboard/admin/consents', color: '#fbbf24' },
  ];

  return (
    <div>
      <div className="admin-stats-grid">
        {cards.map(c => (
          <Link key={c.label} href={c.href} className="admin-stat-card" style={{ borderTopColor: c.color }}>
            <div className="admin-stat-value" style={{ color: c.color }}>{c.value}</div>
            <div className="admin-stat-label">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Последние регистрации</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Имя</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map(u => (
                <tr key={u.id}>
                  <td><Link href={`/dashboard/admin/users`} className="admin-link">{u.email}</Link></td>
                  <td>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString('ru')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
