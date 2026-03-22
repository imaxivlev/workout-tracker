'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminClub } from '@/lib/api/client';

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<AdminClub[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name?: string; city?: string; description?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { clubs: c, pagination } = await adminApi.getClubs({ page, search });
      setClubs(c);
      setTotalPages(pagination.totalPages);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleSave(id: string) {
    await adminApi.updateClub(id, editData);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить клуб "${name}" и всех его участников?`)) return;
    await adminApi.deleteClub(id);
    load();
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="admin-search-bar">
        <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
          placeholder="Поиск по названию, городу..." className="admin-search-input" />
        <button type="submit" className="btn btn-primary btn-sm">Найти</button>
      </form>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Название</th><th>Город</th><th>Участники</th><th>Создан</th><th>Действия</th></tr>
              </thead>
              <tbody>
                {clubs.map(c => (
                  <tr key={c.id}>
                    {editingId === c.id ? (
                      <>
                        <td><input className="admin-edit-input" value={editData.name ?? c.name}
                          onChange={e => setEditData({ ...editData, name: e.target.value })} /></td>
                        <td><input className="admin-edit-input" value={editData.city ?? c.city ?? ''}
                          onChange={e => setEditData({ ...editData, city: e.target.value })} /></td>
                        <td>{c.membersCount}</td>
                        <td>{new Date(c.createdAt).toLocaleDateString('ru')}</td>
                        <td className="admin-actions">
                          <button onClick={() => handleSave(c.id)} className="admin-btn save">Сохр.</button>
                          <button onClick={() => setEditingId(null)} className="admin-btn cancel">Отм.</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{c.name}</td>
                        <td>{c.city || '—'}</td>
                        <td>{c.membersCount}</td>
                        <td>{new Date(c.createdAt).toLocaleDateString('ru')}</td>
                        <td className="admin-actions">
                          <button onClick={() => { setEditingId(c.id); setEditData({}); }} className="admin-btn edit">Ред.</button>
                          <button onClick={() => handleDelete(c.id, c.name)} className="admin-btn delete">Уд.</button>
                        </td>
                      </>
                    )}
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
