'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';

const navItems = [
  { href: '/dashboard', label: 'Главная', icon: '🏠' },
  { href: '/dashboard/workouts', label: 'Тренировки', icon: '📋' },
  { href: '/dashboard/workouts/new', label: 'Добавить', icon: '➕' },
  { href: '/dashboard/profile', label: 'Профиль', icon: '👤' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      router.push('/auth/login');
      router.refresh();
    }
  }

  return (
    <div className="app-shell">
      {/* Верхняя навигация (десктоп) */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-icon">🏋️</span>
            <span>CrossFit Tracker</span>
          </div>
          <div className="nav-links">
            <Link
              href="/dashboard"
              className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
            >
              Главная
            </Link>
            <Link
              href="/dashboard/workouts"
              className={`nav-link ${pathname.startsWith('/dashboard/workouts') && pathname !== '/dashboard/workouts/new' ? 'active' : ''}`}
            >
              Тренировки
            </Link>
            <Link
              href="/dashboard/workouts/new"
              className={`nav-link ${pathname === '/dashboard/workouts/new' ? 'active' : ''}`}
            >
              + Добавить
            </Link>
            <Link
              href="/dashboard/profile"
              className={`nav-link ${pathname === '/dashboard/profile' ? 'active' : ''}`}
            >
              Профиль
            </Link>
          </div>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            Выйти
          </button>
        </div>
      </nav>

      {/* Контент */}
      <main className="main-content">
        {children}
      </main>

      {/* Нижняя мобильная навигация */}
      <nav className="mobile-nav">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
