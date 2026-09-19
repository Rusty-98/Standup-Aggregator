import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api.js';
import { LeaveRecord, LeaveType, User } from '@shared/types.js';
import { Plus, Trash2 } from 'lucide-react';

interface LeavePageProps {
  currentUser: User;
}

export const LeavePage: React.FC<LeavePageProps> = ({ currentUser }) => {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [teammates, setTeammates] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // New leave form state
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<LeaveType>('leave');
  const [note, setNote] = useState('');
  const [targetUserId, setTargetUserId] = useState<number>(currentUser.id);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLeadOrAdmin = currentUser.role === 'lead' || currentUser.role === 'admin';

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<LeaveRecord[]>('/api/leave');
      setLeaves(res);

      if (isLeadOrAdmin) {
        const teamRes = await fetchApi<any>('/api/team/' + new Date().toISOString().slice(0, 10));
        if (teamRes?.members) {
          setTeammates(teamRes.members.map((m: any) => ({ id: m.user.id, name: m.user.name })));
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await fetchApi('/api/leave', {
        method: 'POST',
        body: JSON.stringify({
          startDate,
          endDate,
          type,
          note: note.trim(),
          userId: isLeadOrAdmin ? targetUserId : currentUser.id
        })
      });

      setNote('');
      loadLeaves();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLeave = async (id: number) => {
    if (!window.confirm('Delete this leave record?')) return;
    try {
      await fetchApi(`/api/leave/${id}`, { method: 'DELETE' });
      setLeaves(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <main style={{ maxWidth: '780px', margin: '24px auto', padding: '0 16px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '4px' }}>
          Leave & Out-of-Office
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Record planned time off. During active leave dates you are excluded from standup digests and daily nudges.
        </p>
      </div>

      {/* Record Leave Form */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Record time off</h2>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              border: '1px solid var(--semantic-danger)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--semantic-danger)',
              fontSize: '12.5px',
              marginBottom: '14px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleRecordLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isLeadOrAdmin && teammates.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Team member
              </label>
              <select
                value={targetUserId}
                onChange={e => setTargetUserId(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                {teammates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.id === currentUser.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Start date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                End date (inclusive)
              </label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Type
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as LeaveType)}
                style={{ width: '100%' }}
              >
                <option value="leave">Vacation / Leave</option>
                <option value="sick">Sick leave</option>
                <option value="travel">Work travel</option>
                <option value="holiday">Optional holiday</option>
                <option value="other">Other OOTO</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Optional note
            </label>
            <input
              type="text"
              placeholder="e.g., Attending conference in Delhi"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <Plus size={13} />
              <span>Record time off</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Leaves List */}
      <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Scheduled time off</h2>
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading leave records…</div>
      ) : leaves.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
          No leave records recorded yet.
        </div>
      ) : (
        <div className="ledger-list">
          {leaves.map(l => (
            <div key={l.id} className="ledger-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600 }}>{l.user_name || 'Member'}</span>
                  <span className="badge badge-warning">{l.type}</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {l.start_date} to {l.end_date} {l.note && `· ${l.note}`}
                </div>
              </div>

              <button
                type="button"
                className="btn-danger btn-compact"
                onClick={() => handleDeleteLeave(l.id)}
                title="Cancel / Delete leave record"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
