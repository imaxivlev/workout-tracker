'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminExercise } from '@/lib/api/client';

export default function AdminExercisesPage() {
  const [exercises, setExercises] = useState<AdminExercise[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { exercises: e, pagination } = await adminApi.getExercises({ page, search, filter, limit: 50 });
      setExercises(e);
      setTotalPages(pagination.totalPages);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await adminApi.createExercise(newName.trim());
    setNewName('');
    load();
  }

  async function handleSave(id: string) {
    await adminApi.updateExercise(id, { name: editName });
    setEditingId(null);
    load();
  }

  async function handleToggleGlobal(id: string, current: boolean) {
    await adminApi.updateExercise(id, { isGlobal: !current });
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить упражнение "${name}"?`)) return;
    await adminApi.deleteExercise(id);
    load();
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="admin-search-bar" style={{ marginBottom: '0.75rem' }}>
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Новое глобальное упражнение..." className="admin-search-input" />
        <button type="submit" className="btn btn-primary btn-sm">Добавить</button>
      </form>

      <div className="admin-search-bar">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск..." className="admin-search-input" />
          <button type="submit" className="btn btn-primary btn-sm">Найти</button>
        </form>
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="admin-search-input" style={{ maxWidth: '160px' }}>
          <option value="all">Все</option>
          <option value="global">Глобальные</option>
          <option value="user">Пользовательские</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Название</th><th>Тип</th><th>Автор</th><th>Действия</th></tr>
              </thead>
              <tbody>
                {exercises.map(ex => (
                  <tr key={ex.id}>
                    {editingId === ex.id ? (
                      <>
                        <td><input className="admin-edit-input" value={editName} onChange={e => setEditName(e.target.value)} /></td>
                        <td colSpan={2} />
                        <td className="admin-actions">
                          <button onClick={() => handleSave(ex.id)} className="admin-btn save">Сохр.</button>
                          <button onClick={() => setEditingId(null)} className="admin-btn cancel">Отм.</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{ex.name}</td>
                        <td>
                          <button onClick={() => handleToggleGlobal(ex.id, ex.isGlobal)}
                            className={`admin-badge clickable ${ex.isGlobal ? 'green' : 'gray'}`}>
                            {ex.isGlobal ? 'Глобальное' : 'Польз.'}
                          </button>
                        </td>
                        <td>{ex.user ? ex.user.email : '—'}</td>
                        <td className="admin-actions">
                          <button onClick={() => { setEditingId(ex.id); setEditName(ex.name); }} className="admin-btn edit">Ред.</button>
                          <button onClick={() => handleDelete(ex.id, ex.name)} className="admin-btn delete">Уд.</button>
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
