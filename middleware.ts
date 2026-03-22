import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/verify', '/auth/reset-password', '/install', '/legal'];
const AUTH_PATHS = ['/auth/login', '/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пропускаем API routes, статику, сервис-воркер и публичные файлы
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/workout-tracker/') ||
    pathname === '/manifest.json' ||
    pathname === '/service-worker.js' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  const isAuthenticated = !!token;

  // Корневой путь — редирект на dashboard или login
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  // Аутентифицированный пользователь не должен видеть страницы входа/регистрации
  if (isAuthenticated && AUTH_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Неаутентифицированный пользователь не должен попасть на защищённые маршруты
  if (!isAuthenticated && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|service-worker.js|icons/).*)',
  ],
};
