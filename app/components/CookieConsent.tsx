'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = document.cookie.split(';').some(c => c.trim().startsWith('cookie_consent='));
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  function accept() {
    // Set cookie for 1 year
    document.cookie = 'cookie_consent=accepted; path=/; max-age=31536000; SameSite=Lax';
    setVisible(false);

    // Try to save consent to DB (fire-and-forget)
    fetch('/api/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consentType: 'cookies', accepted: true }),
      credentials: 'include',
    }).catch(() => {});
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <div className="cookie-banner-content">
        <p>
          Мы используем файлы куки для корректной работы сайта и аналитики.
          Продолжая пользоваться сайтом, вы соглашаетесь с{' '}
          <Link href="/legal/privacy">политикой конфиденциальности</Link>.
        </p>
        <button onClick={accept} className="btn btn-primary btn-sm">
          Принять
        </button>
      </div>
    </div>
  );
}
