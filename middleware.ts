import { NextRequest, NextResponse } from 'next/server';
import { applySecurityHeaders } from '@/lib/middleware/security-headers';
import { isTrustedOrigin, requiresCsrfCheck } from '@/lib/middleware/csrf-protection';

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/verify', '/auth/reset-password', '/install', '/legal'];
const AUTH_PATHS = ['/auth/login', '/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Статику и сервис-воркер пропускаем без изменений (заголовки не нужны).
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/workout-tracker/') ||
    pathname === '/manifest.json' ||
    pathname === '/service-worker.js' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // API routes: CSRF-проверка Origin для мутаций + security-заголовки.
  if (pathname.startsWith('/api/')) {
    if (requiresCsrfCheck(request.method) && !isTrustedOrigin(request)) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Запрос с недоверенного источника' }, { status: 403 }),
        request
      );
    }
    return applySecurityHeaders(NextResponse.next(), request);
  }

  const token = request.cookies.get('auth-token')?.value;
  const isAuthenticated = !!token;

  // Корневой путь — редирект на dashboard или login
  if (pathname === '/') {
    const dest = isAuthenticated ? '/dashboard' : '/auth/login';
    return applySecurityHeaders(NextResponse.redirect(new URL(dest, request.url)), request);
  }

  // Аутентифицированный пользователь не должен видеть страницы входа/регистрации
  if (isAuthenticated && AUTH_PATHS.some(p => pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), request);
  }

  // Неаутентифицированный пользователь не должен попасть на защищённые маршруты
  if (!isAuthenticated && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/auth/login', request.url)), request);
  }

  return applySecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|service-worker.js|icons/).*)',
  ],
};
