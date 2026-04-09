'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminClub } from '@/lib/api/client';

interface ClubMember {
  userId: string;
  role: string;
  user: { email: string; firstName: string | null; lastName: string | null };
}

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<AdminClub[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name?: string; city?: string; description?: string }>({});

  // Управление участниками
  const [membersClub, setMembersClub] = useState<AdminClub | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('ATHLETE');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

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

  async function openMembers(club: AdminClub) {
    setMembersClub(club);
    setAddEmail('');
    setAddRole('ATHLETE');
    setAddError('');
    setMembersLoading(true);
    try {
      const { club: detail } = await adminApi.getClub(club.id) as { club: { members: ClubMember[] } };
      setMembers(detail.members);
    } catch { setMembers([]); }
    setMembersLoading(false);
  }

  async function handleAddMember() {
    if (!membersClub || !addEmail.trim()) return;
    setAddError('');
    setAddLoading(true);
    try {
      const { users } = await adminApi.getUsers({ search: addEmail.trim() });
      const found = users.find(u => u.email.toLowerCase() === addEmail.trim().toLowerCase());
      if (!found) {
        setAddError('Пользователь с таким email не найден');
        setAddLoading(false);
        return;
      }
      await adminApi.addUserToClub(found.id, membersClub.id, addRole);
      setAddEmail('');
      // Обновить список участников
      const { club: detail } = await adminApi.getClub(membersClub.id) as { club: { members: ClubMember[] } };
      setMembers(detail.members);
      load();
    } catch (e: unknown) {
      setAddError((e instanceof Error ? e.message : null) || 'Ошибка при добавлении');
    }
    setAddLoading(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!membersClub) return;
    await adminApi.removeUserFromClub(userId, membersClub.id);
    const { club: detail } = await adminApi.getClub(membersClub.id) as { club: { members: ClubMember[] } };
    setMembers(detail.members);
    load();
  }

  const roleLabel: Record<string, string> = { OWNER: 'Владелец', COACH: 'Тренер', ATHLETE: 'Атлет' };

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
                          <button onClick={() => openMembers(c)} className="admin-btn edit">Участники</button>
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

      {membersClub && (
        <div className="admin-modal-overlay" onClick={() => setMembersClub(null)}>
          <div className="admin-modal" style={{ minWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Участники: {membersClub.name}</h3>

            {/* Добавить участника */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <input
                type="email"
                value={addEmail}
                onChange={e => { setAddEmail(e.target.value); setAddError(''); }}
                placeholder="Email пользователя"
                className="admin-edit-input"
                style={{ flex: 1 }}
              />
              <select value={addRole} onChange={e => setAddRole(e.target.value)}
                className="admin-edit-input" style={{ width: '120px' }}>
                <option value="OWNER">Владелец</option>
                <option value="COACH">Тренер</option>
                <option value="ATHLETE">Атлет</option>
              </select>
              <button onClick={handleAddMember} disabled={addLoading || !addEmail.trim()}
                className="admin-btn save" style={{ whiteSpace: 'nowrap' }}>
                {addLoading ? '...' : 'Добавить'}
              </button>
            </div>
            {addError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{addError}</div>}

            {/* Список участников */}
            {membersLoading ? (
              <div className="loading-container"><div className="loading-spinner" /></div>
            ) : members.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '1rem 0' }}>Нет участников</div>
            ) : (
              <table className="admin-table" style={{ marginTop: '0.5rem' }}>
                <thead>
                  <tr><th>Email</th><th>Имя</th><th>Роль</th><th></th></tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.userId}>
                      <td style={{ fontSize: '0.85rem' }}>{m.user.email}</td>
                      <td style={{ fontSize: '0.85rem' }}>{[m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || '—'}</td>
                      <td><span className="admin-badge blue">{roleLabel[m.role] ?? m.role}</span></td>
                      <td>
                        <button onClick={() => handleRemoveMember(m.userId)} className="admin-btn delete"
                          style={{ fontSize: '0.75rem', padding: '2px 6px' }}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button onClick={() => setMembersClub(null)} className="admin-btn cancel">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
