import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api.js';
import { User, JobRun, Holiday } from '@shared/types.js';
import { UserPlus, Play } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'member' | 'lead' | 'admin'>('member');
  const [userError, setUserError] = useState<string | null>(null);

  // New holiday form state
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');

  // Job run state
  const [jobActionMsg, setJobActionMsg] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [u, h, j] = await Promise.all([
        fetchApi<User[]>('/api/admin/users'),
        fetchApi<Holiday[]>('/api/admin/holidays'),
        fetchApi<JobRun[]>('/api/admin/jobs')
      ]);
      setUsers(u);
      setHolidays(h);
      setJobRuns(j);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    try {
      await fetchApi('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          name: newName.trim(),
          role: newRole
        })
      });

      setNewEmail('');
      setNewName('');
      loadAdminData();
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await fetchApi(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !user.is_active })
      });
      loadAdminData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/admin/holidays', {
        method: 'POST',
        body: JSON.stringify({ date: newHolidayDate, name: newHolidayName.trim() })
      });
      setNewHolidayDate('');
      setNewHolidayName('');
      loadAdminData();
    } catch (err: any) {
      alert(`Could not add holiday: ${err.message}`);
    }
  };

  const handleDeleteHoliday = async (dateStr: string) => {
    try {
      await fetchApi(`/api/admin/holidays/${dateStr}`, { method: 'DELETE' });
      setHolidays(prev => prev.filter(h => h.date !== dateStr));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleTriggerJob = async (kind: string) => {
    try {
      setJobActionMsg(`Triggering ${kind}…`);
      const res = await fetchApi<any>(`/api/admin/jobs/${kind}/run`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setJobActionMsg(res.message || 'Job run triggered');
      loadAdminData();
      setTimeout(() => setJobActionMsg(null), 4000);
    } catch (err: any) {
      setJobActionMsg(`Job failed: ${err.message}`);
    }
  };

  if (loading) {
    return <div style={{ maxWidth: '860px', margin: '32px auto', padding: '0 16px', color: 'var(--text-muted)' }}>Loading admin panel…</div>;
  }

  return (
    <main style={{ maxWidth: '860px', margin: '24px auto', padding: '0 16px 80px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '4px' }}>
          Admin Console
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Manage user roster, corporate holiday calendar, and monitor automated scheduled jobs.
        </p>
      </div>

      {/* 1. User Management */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
          Team Roster ({users.length} members)
        </h2>

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Add team member</h3>
          {userError && (
            <div style={{ padding: '8px 12px', border: '1px solid var(--semantic-danger)', borderRadius: 'var(--radius-control)', color: 'var(--semantic-danger)', fontSize: '12.5px', marginBottom: '12px' }}>
              {userError}
            </div>
          )}
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr auto', gap: '10px' }}>
            <input
              type="text"
              required
              placeholder="Full name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              type="email"
              required
              placeholder="work.email@company.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as any)}
            >
              <option value="member">Member</option>
              <option value="lead">Lead</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn-primary">
              <UserPlus size={13} />
              <span>Add</span>
            </button>
          </form>
        </div>

        <div className="ledger-list">
          {users.map(u => (
            <div key={u.id} className="ledger-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  <span className="badge badge-neutral">{u.role}</span>
                  {!u.is_active && <span className="badge badge-danger">deactivated</span>}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{u.email}</div>
              </div>

              <button
                type="button"
                className={`btn-compact ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleToggleActive(u)}
              >
                {u.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Holiday Calendar */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
          Holiday Calendar (Non-working Days)
        </h2>

        <div className="card" style={{ marginBottom: '16px' }}>
          <form onSubmit={handleAddHoliday} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr auto', gap: '10px' }}>
            <input
              type="date"
              required
              value={newHolidayDate}
              onChange={e => setNewHolidayDate(e.target.value)}
            />
            <input
              type="text"
              required
              placeholder="Holiday name (e.g. Diwali)"
              value={newHolidayName}
              onChange={e => setNewHolidayName(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              <span>Add holiday</span>
            </button>
          </form>
        </div>

        <div className="ledger-list">
          {holidays.map(h => (
            <div key={h.date} className="ledger-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="tabular-nums" style={{ fontWeight: 600, marginRight: '10px' }}>{h.date}</span>
                <span>{h.name}</span>
              </div>
              <button
                type="button"
                className="btn-danger btn-compact"
                onClick={() => handleDeleteHoliday(h.date)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Job Run History & Manual Triggers */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Scheduled Jobs & Digest History</h2>
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => handleTriggerJob('daily_digest')}
          >
            <Play size={12} />
            <span>Force Run 20:00 Digest Now</span>
          </button>
        </div>

        {jobActionMsg && (
          <div style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-control)', marginBottom: '12px', fontSize: '12.5px' }}>
            {jobActionMsg}
          </div>
        )}

        <div className="ledger-list">
          {jobRuns.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No cron jobs have run yet.
            </div>
          ) : (
            jobRuns.map(run => (
              <div key={run.id} className="ledger-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600 }}>{run.kind}</span>
                    <span className={`badge ${run.status === 'sent' ? 'badge-ok' : run.status === 'failed' ? 'badge-danger' : 'badge-neutral'}`}>
                      {run.status}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Date: {run.run_date}
                    </span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Started: {run.started_at} · Recipients: {run.recipients}
                    {run.error && <span style={{ color: 'var(--semantic-danger)', marginLeft: '8px' }}>Error: {run.error}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
};
