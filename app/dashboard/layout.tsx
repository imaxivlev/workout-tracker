'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import { InstallBanner } from '@/app/components/InstallBanner';

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
      <InstallBanner />
      {/* Верхняя навигация (десктоп) */}
      <nav className="navbar">
        <div className="nav-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link href="/dashboard" className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/workout-tracker/images/logo.png" alt="CrossFit Tracker" />
            </Link>
            <div className="nav-links">
              <Link
                href="/dashboard/workouts"
                className={`nav-link ${pathname.startsWith('/dashboard/workouts') && pathname !== '/dashboard/workouts/new' ? 'active' : ''}`}
              >
                Тренировки
              </Link>
              <Link
                href="/dashboard/club"
                className={`nav-link ${pathname.startsWith('/dashboard/club') ? 'active' : ''}`}
              >
                Клуб
              </Link>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard/workouts/new" className="btn btn-primary btn-sm">
              Новая тренировка
            </Link>
            {/* TEMPORARILY HIDDEN: "Предложить идею" link
            <Link href="/dashboard/ideas" className="user-avatar" title="Предложить идею">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
              </svg>
            </Link>
            */}
            <Link href="/dashboard/profile" className="user-avatar" title="Профиль">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* Мобильная лого-полоса */}
      <div className="mobile-logo-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/workout-tracker/images/logo.png" alt="CrossFit Tracker" className="mobile-logo-img" />
      </div>

      {/* Контент */}
      <main className="main-content">
        {children}
      </main>

      {/* Нижняя мобильная навигация */}
      <nav className="mobile-nav">
        <Link
          href="/dashboard"
          className={`mobile-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
        >
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="mobile-nav-label">Главная</span>
        </Link>
        <Link
          href="/dashboard/workouts"
          className={`mobile-nav-item ${pathname.startsWith('/dashboard/workouts') && pathname !== '/dashboard/workouts/new' ? 'active' : ''}`}
        >
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="mobile-nav-label">Тренировки</span>
        </Link>
        <Link
          href="/dashboard/club"
          className={`mobile-nav-item ${pathname.startsWith('/dashboard/club') ? 'active' : ''}`}
        >
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="mobile-nav-label">Клуб</span>
        </Link>
        <Link
          href="/dashboard/workouts/new"
          className={`mobile-nav-item ${pathname === '/dashboard/workouts/new' ? 'active' : ''}`}
        >
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="mobile-nav-label">Создать</span>
        </Link>
        {/* TEMPORARILY HIDDEN: "+идея" mobile link
        <Link
          href="/dashboard/ideas"
          className={`mobile-nav-item ${pathname === '/dashboard/ideas' ? 'active' : ''}`}
        >
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
          </svg>
          <span className="mobile-nav-label">+идея</span>
        </Link>
        */}
        <Link
          href="/dashboard/profile"
          className={`mobile-nav-item ${pathname === '/dashboard/profile' ? 'active' : ''}`}
        >
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="mobile-nav-label">Профиль</span>
        </Link>
      </nav>
    </div>
  );
}
