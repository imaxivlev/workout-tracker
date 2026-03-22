'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminWorkout } from '@/lib/api/client';

export default function AdminWorkoutsPage() {
  const [workouts, setWorkouts] = useState<AdminWorkout[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { workouts: w, pagination } = await adminApi.getWorkouts({
        page,
        userId: filterUserId || undefined,
        date: filterDate || undefined,
      });
      setWorkouts(w);
      setTotalPages(pagination.totalPages);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, filterUserId, filterDate]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Удалить эту тренировку?')) return;
    await adminApi.deleteWorkout(id);
    load();
  }

  return (
    <div>
      <div className="admin-search-bar">
        <input type="text" value={filterUserId} onChange={e => { setFilterUserId(e.target.value); setPage(1); }}
          placeholder="User ID" className="admin-search-input" style={{ maxWidth: '280px' }} />
        <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1); }}
          className="admin-search-input" style={{ maxWidth: '180px', colorScheme: 'dark' }} />
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Дата</th><th>Пользователь</th><th>Скилл</th><th>ВОД</th><th>Шаблон</th><th>Создано</th><th>Действия</th></tr>
              </thead>
              <tbody>
                {workouts.map(w => (
                  <tr key={w.id}>
                    <td>{w.date}</td>
                    <td>{w.user.email}</td>
                    <td>{w.skillBlocksCount}</td>
                    <td>{w.wodBlocksCount}</td>
                    <td>{w.isClubTemplate ? <span className="admin-badge blue">Да</span> : '—'}</td>
                    <td>{new Date(w.createdAt).toLocaleDateString('ru')}</td>
                    <td className="admin-actions">
                      <button onClick={() => handleDelete(w.id)} className="admin-btn delete">Уд.</button>
                    </td>
                  </tr>
                ))}
                {workouts.length === 0 && <tr><td colSpan={7} className="admin-empty-cell">Нет тренировок</td></tr>}
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
