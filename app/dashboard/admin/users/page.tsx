'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminUser } from '@/lib/api/client';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ email?: string; firstName?: string; lastName?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { users: u, pagination } = await adminApi.getUsers({ page, search });
      setUsers(u);
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
    await adminApi.updateUser(id, editData);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Удалить пользователя ${email}?`)) return;
    await adminApi.deleteUser(id);
    load();
  }

  async function toggleAdmin(id: string, current: boolean) {
    await adminApi.updateUser(id, { isAdmin: !current });
    load();
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="admin-search-bar">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Поиск по email, имени..."
          className="admin-search-input"
        />
        <button type="submit" className="btn btn-primary btn-sm">Найти</button>
      </form>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Имя</th>
                  <th>Верифицирован</th>
                  <th>Админ</th>
                  <th>Тренировки</th>
                  <th>Клубы</th>
                  <th>Дата рег.</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    {editingId === u.id ? (
                      <>
                        <td>
                          <input className="admin-edit-input" value={editData.email ?? u.email}
                            onChange={e => setEditData({ ...editData, email: e.target.value })} />
                        </td>
                        <td>
                          <input className="admin-edit-input" value={editData.firstName ?? u.firstName ?? ''}
                            onChange={e => setEditData({ ...editData, firstName: e.target.value })}
                            placeholder="Имя" />
                        </td>
                        <td colSpan={4} />
                        <td className="admin-actions">
                          <button onClick={() => handleSave(u.id)} className="admin-btn save">Сохр.</button>
                          <button onClick={() => setEditingId(null)} className="admin-btn cancel">Отм.</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{u.email}</td>
                        <td>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td><span className={`admin-badge ${u.verified ? 'green' : 'red'}`}>{u.verified ? 'Да' : 'Нет'}</span></td>
                        <td>
                          <button onClick={() => toggleAdmin(u.id, u.isAdmin)}
                            className={`admin-badge clickable ${u.isAdmin ? 'blue' : 'gray'}`}>
                            {u.isAdmin ? 'Да' : 'Нет'}
                          </button>
                        </td>
                        <td>{u.workoutsCount}</td>
                        <td>{u.clubsCount}</td>
                        <td>{new Date(u.createdAt).toLocaleDateString('ru')}</td>
                        <td className="admin-actions">
                          <button onClick={() => { setEditingId(u.id); setEditData({}); }} className="admin-btn edit">Ред.</button>
                          <button onClick={() => handleDelete(u.id, u.email)} className="admin-btn delete">Уд.</button>
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
