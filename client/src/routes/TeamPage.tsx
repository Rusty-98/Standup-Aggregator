import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api.js';
import { TeamSummary, User } from '@shared/types.js';
import { getOrgToday, formatSubmittedClock } from '../lib/dateUtils.js';
import { severityLabel, standupStatusLabel } from '../lib/labels.js';
import { Copy, Check } from 'lucide-react';

interface TeamPageProps {
  currentUser: User;
}

export const TeamPage: React.FC<TeamPageProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const orgToday = getOrgToday();
  const dateParam = searchParams.get('date') || orgToday;

  const [date, setDate] = useState<string>(dateParam);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadTeamData = async (targetDate: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchApi<TeamSummary>(`/api/team/${targetDate}`);
      setSummary(res);
    } catch (err: any) {
      setLoadError(err.message || 'Could not load the team board. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData(date);
    setSearchParams({ date });
  }, [date]);

  const handleCopyForOutlook = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const html = await fetchApi<string>(`/api/team/${date}/preview`);
      const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      setCopied(true);
      setActionMessage('Copied for email. Paste into Outlook or Gmail.');
      setTimeout(() => setCopied(false), 2500);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage('Copy failed. Allow clipboard access and try again.');
    } finally {
      setCopying(false);
    }
  };

  const rows = (summary?.members || []).filter(m =>
    m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusLabel = (status: string) => standupStatusLabel(status === 'on_leave' ? 'on leave' : status);

  return (
    <main className="page-enter" style={{ maxWidth: '1100px', margin: '24px auto', padding: '0 16px 80px' }}>
      {loadError && (
        <div className="alert alert-err" style={{ marginBottom: '16px' }}>
          {loadError}{' '}
          <button type="button" className="btn-secondary btn-compact" onClick={() => loadTeamData(date)}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Team</h1>
          {summary && (
            <div className="tabular-nums" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {summary.submittedCount} submitted · {summary.notSubmittedCount} missing · {summary.onLeaveCount} on leave · {summary.blockerCount} blockers
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Date</span>
            <input
              type="date"
              value={date}
              max={orgToday}
              onChange={e => setDate(e.target.value)}
            />
          </label>
          <button type="button" className="btn-secondary btn-compact" onClick={handleCopyForOutlook} disabled={copying || loading}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : copying ? 'Copying…' : 'Copy for email'}</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="card" style={{ marginBottom: '12px', fontSize: '13px' }}>{actionMessage}</div>
      )}

      <input
        type="text"
        placeholder="Search by name…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{ width: '100%', maxWidth: '320px', marginBottom: '12px' }}
      />

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading team…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          {summary?.totalMembers ? 'No members matched.' : 'No members on this team yet.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
          <table className="standup-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Yesterday</th>
                <th>Today</th>
                <th>Blockers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.user.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.user.name}</div>
                    {m.status === 'submitted' && m.submitted_at && (
                      <div className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatSubmittedClock(m.submitted_at)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${m.status === 'submitted' ? 'badge-ok' : m.status === 'on_leave' ? 'badge-warning' : 'badge-neutral'}`}>
                      {statusLabel(m.status)}
                    </span>
                    {m.user.id === currentUser.id && (
                      <span className="badge badge-neutral" style={{ marginLeft: '4px' }}>you</span>
                    )}
                  </td>
                  <td>
                    {m.yesterday_html
                      ? <div className="standup-html" dangerouslySetInnerHTML={{ __html: m.yesterday_html }} />
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {m.today_html
                      ? <div className="standup-html" dangerouslySetInnerHTML={{ __html: m.today_html }} />
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {m.has_blockers
                      ? (
                        <div>
                          <span className={`badge ${m.blocker_severity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                            {severityLabel(m.blocker_severity || 'medium')}
                          </span>
                          {m.blocked_on_user && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              waiting on {m.blocked_on_user.name}
                            </div>
                          )}
                          <div className="standup-html" dangerouslySetInnerHTML={{ __html: m.blocker_html }} />
                        </div>
                      )
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};
