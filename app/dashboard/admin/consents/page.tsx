'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminConsent } from '@/lib/api/client';

export default function AdminConsentsPage() {
  const [consents, setConsents] = useState<AdminConsent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { consents: c, pagination } = await adminApi.getConsents({ page, type: typeFilter || undefined });
      setConsents(c);
      setTotalPages(pagination.totalPages);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, typeFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="admin-search-bar">
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="admin-search-input" style={{ maxWidth: '220px' }}>
          <option value="">Все типы</option>
          <option value="cookies">Cookies</option>
          <option value="privacy_policy">Политика конфиденциальности</option>
          <option value="terms">Условия использования</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : consents.length === 0 ? (
        <div className="admin-empty-state">Согласий пока нет</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Пользователь</th><th>Тип</th><th>Принято</th><th>IP</th><th>Дата</th></tr>
              </thead>
              <tbody>
                {consents.map(c => (
                  <tr key={c.id}>
                    <td>{c.user.email}</td>
                    <td>
                      <span className="admin-badge blue">
                        {c.consentType === 'cookies' ? 'Cookies' :
                         c.consentType === 'privacy_policy' ? 'Конф.' :
                         c.consentType === 'terms' ? 'Условия' : c.consentType}
                      </span>
                    </td>
                    <td><span className={`admin-badge ${c.accepted ? 'green' : 'red'}`}>{c.accepted ? 'Да' : 'Нет'}</span></td>
                    <td>{c.ipAddress || '—'}</td>
                    <td>{new Date(c.createdAt).toLocaleString('ru')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="admin-btn">Назад</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn">Вперёд</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
