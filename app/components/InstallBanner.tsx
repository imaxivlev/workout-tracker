'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const COOKIE_NAME = 'pwa_banner_dismissed';
const DISMISS_DAYS = 30;

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Не показываем в PWA (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Не показываем на десктопе — только мобилки
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Проверяем cookie
    if (getCookie(COOKIE_NAME)) return;

    setVisible(true);
  }, []);

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCookie(COOKIE_NAME, '1', DISMISS_DAYS);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Link href="/install" className="install-banner">
      <span className="install-banner-text">
        Установите приложение на телефон для быстрого доступа
      </span>
      <button
        className="install-banner-close"
        onClick={handleDismiss}
        aria-label="Закрыть"
      >
        &times;
      </button>
    </Link>
  );
}
