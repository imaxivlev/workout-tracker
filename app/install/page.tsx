'use client';

import { useRouter } from 'next/navigation';

export default function InstallPage() {
  const router = useRouter();

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => router.back()}
        style={{ marginBottom: '1.5rem' }}
      >
        &larr; Назад
      </button>

      <h1 className="page-title" style={{ marginBottom: '2rem' }}>
        Установка приложения
      </h1>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
        CrossFit Tracker можно установить как приложение на телефон.
        Оно будет открываться в полноэкранном режиме, работать без интернета
        и запускаться с иконки на домашнем экране.
      </p>

      {/* iPhone */}
      <div className="install-section">
        <h2 className="section-title">iPhone / iPad (Safari)</h2>
        <ol className="install-steps">
          <li>
            Откройте сайт в браузере <strong>Safari</strong>
          </li>
          <li>
            Нажмите кнопку <strong>«Поделиться»</strong> внизу экрана
            <span className="install-icon">&#x2B06;&#xFE0F;</span>
            (квадрат со стрелкой вверх)
          </li>
          <li>
            Пролистайте вниз и выберите <strong>«На экран Домой»</strong>
          </li>
          <li>
            Нажмите <strong>«Добавить»</strong> в правом верхнем углу
          </li>
        </ol>
      </div>

      {/* Android */}
      <div className="install-section">
        <h2 className="section-title">Android (Chrome)</h2>
        <ol className="install-steps">
          <li>
            Откройте сайт в браузере <strong>Chrome</strong>
          </li>
          <li>
            Нажмите <strong>три точки</strong> (&#8942;) в правом верхнем углу
          </li>
          <li>
            Выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>
          </li>
          <li>
            Подтвердите установку
          </li>
        </ol>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
          После установки приложение будет доступно на домашнем экране как обычное приложение.
          Тренировки, созданные без интернета, автоматически синхронизируются при восстановлении связи.
        </p>
      </div>
    </div>
  );
}
