import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api.js';
import { Standup, User } from '@shared/types.js';
import { formatDisplayDate } from '../lib/dateUtils.js';
import { Download } from 'lucide-react';

interface WeeklyRecapPageProps {
  currentUser: User;
}

export const WeeklyRecapPage: React.FC<WeeklyRecapPageProps> = ({ currentUser }) => {
  const [entries, setEntries] = useState<Standup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecap = async () => {
      try {
        setLoading(true);
        const res = await fetchApi<{ entries: Standup[] }>('/api/recap/week');
        setEntries(res.entries || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadRecap();
  }, []);

  const totalTasks = entries.reduce((acc, curr) => {
    const matches = (curr.today_html || '').match(/<li/g) || [];
    return acc + matches.length;
  }, 0);

  const completedTasks = entries.reduce((acc, curr) => {
    const matches = (curr.today_html || '').match(/data-checked="true"/g) || [];
    return acc + matches.length;
  }, 0);

  const blockersRaised = entries.filter(e => e.has_blockers).length;

  return (
    <main style={{ maxWidth: '780px', margin: '24px auto', padding: '0 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '4px' }}>
            Weekly Work Recap
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Personal summary of your submissions and achievements this week.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary btn-compact"
          onClick={() => window.location.href = `/api/export.xlsx?teamId=${currentUser.team_id}`}
        >
          <Download size={13} />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Telemetry Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Standup Submissions
          </div>
          <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 600 }}>
            {entries.length} days
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Tasks Completed
          </div>
          <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--semantic-ok)' }}>
            {completedTasks} / {totalTasks}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Blockers Logged
          </div>
          <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 600, color: blockersRaised > 0 ? 'var(--semantic-warning)' : 'var(--text-primary)' }}>
            {blockersRaised}
          </div>
        </div>
      </div>

      {/* Chronological Entries */}
      <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Daily Log</h2>
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading weekly recap…</div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
          No standups submitted for this period yet.
        </div>
      ) : (
        <div className="ledger-list">
          {entries.map(e => (
            <div key={e.id} className="ledger-row" style={{ flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 600, fontSize: '13.5px' }}>
                  {formatDisplayDate(e.standup_date)}
                </span>
                <span className="badge badge-ok">submitted</span>
              </div>

              {e.today_html && (
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Accomplishments & Tasks
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: e.today_html }} style={{ fontSize: '13px' }} />
                </div>
              )}

              {e.has_blockers && (
                <div style={{ width: '100%', padding: '6px 10px', background: 'var(--surface-2)', borderLeft: '3px solid var(--semantic-warning)', borderRadius: '0 4px 4px 0', fontSize: '12.5px' }}>
                  <span className="badge badge-warning" style={{ marginRight: '6px' }}>{e.blocker_severity || 'blocker'}</span>
                  <span dangerouslySetInnerHTML={{ __html: e.blocker_html }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
