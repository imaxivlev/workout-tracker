'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminUser, AdminClub } from '@/lib/api/client';

interface UserClubInfo {
  role: string;
  club: { id: string; name: string };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ email?: string; firstName?: string; lastName?: string }>({});

  // Club binding
  const [clubModalUserId, setClubModalUserId] = useState<string | null>(null);
  const [clubModalUserEmail, setClubModalUserEmail] = useState('');
  const [userClubs, setUserClubs] = useState<UserClubInfo[]>([]);
  const [allClubs, setAllClubs] = useState<AdminClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedRole, setSelectedRole] = useState('ATHLETE');
  const [clubLoading, setClubLoading] = useState(false);

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

  async function openClubModal(userId: string, email: string) {
    setClubModalUserId(userId);
    setClubModalUserEmail(email);
    setClubLoading(true);
    try {
      const [userData, clubsData] = await Promise.all([
        adminApi.getUser(userId) as Promise<{ user: { clubMemberships: UserClubInfo[] } }>,
        adminApi.getClubs({ limit: 100 }),
      ]);
      setUserClubs(userData.user.clubMemberships || []);
      setAllClubs(clubsData.clubs);
      setSelectedClubId('');
      setSelectedRole('ATHLETE');
    } catch { /* ignore */ }
    setClubLoading(false);
  }

  async function handleAddToClub() {
    if (!clubModalUserId || !selectedClubId) return;
    try {
      await adminApi.addUserToClub(clubModalUserId, selectedClubId, selectedRole);
      openClubModal(clubModalUserId, clubModalUserEmail);
      load();
    } catch (err: any) {
      alert(err?.message || 'Ошибка');
    }
  }

  async function handleRemoveFromClub(clubId: string) {
    if (!clubModalUserId) return;
    if (!confirm('Отвязать пользователя от клуба?')) return;
    await adminApi.removeUserFromClub(clubModalUserId, clubId);
    openClubModal(clubModalUserId, clubModalUserEmail);
    load();
  }

  const availableClubs = allClubs.filter(c => !userClubs.some(uc => uc.club.id === c.id));

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
                        <td>
                          <button onClick={() => openClubModal(u.id, u.email)}
                            className="admin-badge clickable blue" style={{ cursor: 'pointer' }}>
                            {u.clubsCount}
                          </button>
                        </td>
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

      {/* Модалка привязки/отвязки клуба */}
      {clubModalUserId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card, #1a1a2e)', borderRadius: '12px', padding: '1.5rem',
            maxWidth: '480px', width: '100%', maxHeight: '80vh', overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Клубы пользователя {clubModalUserEmail}</h3>

            {clubLoading ? (
              <div className="loading-container"><div className="loading-spinner" /></div>
            ) : (
              <>
                {userClubs.length > 0 ? (
                  <div style={{ marginBottom: '1.5rem' }}>
                    {userClubs.map(uc => (
                      <div key={uc.club.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)'
                      }}>
                        <div>
                          <strong>{uc.club.name}</strong>
                          <span className="admin-badge blue" style={{ marginLeft: '0.5rem' }}>{uc.role}</span>
                        </div>
                        <button onClick={() => handleRemoveFromClub(uc.club.id)} className="admin-btn delete">Отвязать</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Не состоит ни в одном клубе</p>
                )}

                {availableClubs.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={selectedClubId} onChange={e => setSelectedClubId(e.target.value)}
                      className="admin-search-input" style={{ flex: 1, minWidth: '150px' }}>
                      <option value="">Выберите клуб...</option>
                      {availableClubs.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                      className="admin-search-input" style={{ width: '120px' }}>
                      <option value="ATHLETE">Атлет</option>
                      <option value="COACH">Тренер</option>
                      <option value="OWNER">Владелец</option>
                    </select>
                    <button onClick={handleAddToClub} disabled={!selectedClubId}
                      className="btn btn-primary btn-sm">Добавить</button>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button onClick={() => setClubModalUserId(null)} className="btn-secondary">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
