import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api.js';
import { LeaveRecord, LeaveType, User } from '@shared/types.js';
import { getOrgToday } from '../lib/dateUtils.js';
import { leaveTypeLabel, friendlyError } from '../lib/labels.js';
import { ConfirmDialog } from '../components/ui/Modal.js';
import { ToastStack } from '../components/ui/Toast.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Plus, Trash2 } from 'lucide-react';

interface LeavePageProps {
  currentUser: User;
}

export const LeavePage: React.FC<LeavePageProps> = ({ currentUser }) => {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [teammates, setTeammates] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const orgToday = getOrgToday();
  const [startDate, setStartDate] = useState(orgToday);
  const [endDate, setEndDate] = useState(orgToday);
  const [type, setType] = useState<LeaveType>('leave');
  const [note, setNote] = useState('');
  const [targetUserId, setTargetUserId] = useState<number>(currentUser.id);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewScope, setViewScope] = useState<'all' | 'mine'>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isAdmin = currentUser.role === 'admin';

  const loadLeaves = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchApi<LeaveRecord[]>('/api/leave');
      setLeaves(res);

      if (isAdmin) {
        const teamRes = await fetchApi<any>('/api/team/' + getOrgToday());
        if (teamRes?.members) {
          setTeammates(teamRes.members.map((m: any) => ({ id: m.user.id, name: m.user.name })));
        }
      }
    } catch (err: unknown) {
      setLoadError(friendlyError(err, 'Could not load leave records. Try again.'));
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
          userId: isAdmin ? targetUserId : currentUser.id
        })
      });

      setNote('');
      setNotice({ type: 'ok', text: 'Time off recorded. You will show as on leave for those dates.' });
      loadLeaves();
    } catch (err: unknown) {
      setError(friendlyError(err, 'Could not record time off. Check the dates and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (pendingDeleteId == null) return;
    setDeleting(true);
    try {
      await fetchApi(`/api/leave/${pendingDeleteId}`, { method: 'DELETE' });
      setLeaves(prev => prev.filter(l => l.id !== pendingDeleteId));
      setNotice({ type: 'ok', text: 'Leave record removed.' });
      setPendingDeleteId(null);
    } catch (err: unknown) {
      setNotice({ type: 'err', text: friendlyError(err, 'Could not delete this leave record.') });
    } finally {
      setDeleting(false);
    }
  };

  const displayedLeaves = (!isAdmin || viewScope === 'all')
    ? leaves
    : leaves.filter(l => l.user_id === currentUser.id);

  return (
    <main className="page-enter" style={{ maxWidth: '780px', margin: '24px auto', padding: '0 16px 80px' }}>
      <ToastStack notice={notice} onClear={() => setNotice(null)} />

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '4px' }}>
          Leave & Out-of-Office
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Record planned time off so you are not listed as missing on the digest.
        </p>
      </div>

      {loadError && (
        <div className="alert alert-err" style={{ marginBottom: '16px' }}>
          {loadError}{' '}
          <button type="button" className="btn-secondary btn-compact" onClick={loadLeaves}>
            Retry
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Record time off</h2>

        {error && <div className="alert alert-err" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleRecordLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isAdmin && teammates.length > 0 && (
            <label className="field">
              <span className="field-label">Team member</span>
              <select
                value={targetUserId}
                onChange={e => setTargetUserId(Number(e.target.value))}
              >
                {teammates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.id === currentUser.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <label className="field">
              <span className="field-label">Start date</span>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">End date (inclusive)</span>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Type</span>
              <select
                value={type}
                onChange={e => setType(e.target.value as LeaveType)}
              >
                <option value="leave">Vacation / Leave</option>
                <option value="sick">Sick leave</option>
                <option value="travel">Work travel</option>
                <option value="holiday">Optional holiday</option>
                <option value="other">Other OOTO</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Optional note</span>
            <input
              type="text"
              placeholder="e.g., Attending conference in Delhi"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <Plus size={13} />
              <span>{submitting ? 'Saving…' : 'Record time off'}</span>
            </button>
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Scheduled time off</h2>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn-compact ${viewScope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11.5px', padding: '2px 8px' }}
              onClick={() => setViewScope('all')}
            >
              Team ({leaves.length})
            </button>
            <button
              type="button"
              className={`btn-compact ${viewScope === 'mine' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11.5px', padding: '2px 8px' }}
              onClick={() => setViewScope('mine')}
            >
              My leaves ({leaves.filter(l => l.user_id === currentUser.id).length})
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-card)' }} />
      ) : displayedLeaves.length === 0 ? (
        <EmptyState
          title="No leave recorded"
          description="Add planned time off above so digests skip you as missing."
        />
      ) : (
        <div className="ledger-list">
          {displayedLeaves.map(l => (
            <div key={l.id} className="ledger-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600 }}>{l.user_name || 'Member'}</span>
                  <span className="badge badge-warning">{leaveTypeLabel(l.type)}</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {l.start_date} to {l.end_date} {l.note && `· ${l.note}`}
                </div>
              </div>

              {(l.user_id === currentUser.id || isAdmin) && (
                <button
                  type="button"
                  className="btn-danger btn-compact"
                  onClick={() => setPendingDeleteId(l.id)}
                  title="Cancel / Delete leave record"
                  aria-label="Delete leave record"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Delete leave record?"
        message="This person will show as missing on those dates unless they submit a standup."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </main>
  );
};
