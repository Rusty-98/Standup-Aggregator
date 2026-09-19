import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../lib/api.js';
import { TeamSummary, User } from '@shared/types.js';
import { Download, Mail, Send, Bell, Search, Copy, Check } from 'lucide-react';

interface TeamPageProps {
  currentUser: User;
}

export const TeamPage: React.FC<TeamPageProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState<string>(dateParam);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'blockers' | 'missing'>('all');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTeamData = async (targetDate: string) => {
    try {
      setLoading(true);
      const res = await fetchApi<TeamSummary>(`/api/team/${targetDate}`);
      setSummary(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData(date);
    setSearchParams({ date });
  }, [date]);

  const handleNudge = async (userId: number, name: string) => {
    try {
      await fetchApi(`/api/team/${date}/nudge`, {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      setActionMessage(`Nudge sent to ${name}`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      alert(`Nudge failed: ${err.message}`);
    }
  };

  const handlePreviewDigest = async () => {
    try {
      const html = await fetchApi<string>(`/api/digest/${date}/preview`);
      setPreviewHtml(html);
    } catch (err: any) {
      alert('Could not generate preview');
    }
  };

  const handleCopyForOutlook = async () => {
    try {
      const html = await fetchApi<string>(`/api/digest/${date}/preview`);
      const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      setCopied(true);
      setActionMessage('✓ Copied rich formatted standup! Paste directly into an Outlook email message.');
      setTimeout(() => setCopied(false), 2500);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert('Clipboard copy failed: ' + err.message);
    }
  };

  const handleTestSendDigest = async () => {
    try {
      await fetchApi(`/api/digest/${date}/test-send`, { method: 'POST' });
      setActionMessage(`Test digest dispatched to ${currentUser.email}`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(`Test send failed: ${err.message}`);
    }
  };

  const handleExportExcel = () => {
    window.location.href = `/api/export.xlsx?from=${date}&to=${date}&teamId=${currentUser.team_id}`;
  };

  const filteredMembers = (summary?.members || []).filter(m => {
    const matchesSearch = m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.user.email.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterMode === 'blockers') return m.has_blockers;
    if (filterMode === 'missing') return m.status === 'not_submitted';
    return true;
  });

  const isLeadOrAdmin = currentUser.role === 'lead' || currentUser.role === 'admin';

  return (
    <main style={{ maxWidth: '860px', margin: '24px auto', padding: '0 16px 80px' }}>
      {/* Header telemetry and actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '4px' }}>
              Team Standup Feed
            </h1>
            {summary && (
              <div className="tabular-nums" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {summary.submittedCount} of {summary.totalMembers} submitted · {summary.onLeaveCount} on leave · {summary.notSubmittedCount} not submitted · {summary.blockerCount} blocker{summary.blockerCount === 1 ? '' : 's'}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setDate(e.target.value)}
              style={{ height: '32px', fontSize: '12px' }}
            />

            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={handleCopyForOutlook}
              title="Copy rich text formatted standup to paste directly into Outlook"
            >
              {copied ? <Check size={13} color="var(--semantic-ok)" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy for Outlook'}</span>
            </button>

            {isLeadOrAdmin && (
              <>
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={handleExportExcel}
                  title="Export day's updates to Excel"
                >
                  <Download size={13} />
                  <span>.xlsx</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={handlePreviewDigest}
                  title="Preview rendered 20:00 email digest"
                >
                  <Mail size={13} />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={handleTestSendDigest}
                  title="Send test digest to my inbox"
                >
                  <Send size={13} />
                  <span>Test send</span>
                </button>
              </>
            )}
          </div>
        </div>

        {actionMessage && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-primary)',
              fontSize: '12.5px'
            }}
          >
            {actionMessage}
          </div>
        )}

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search member by name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '30px', height: '32px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn-compact ${filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterMode('all')}
            >
              All members
            </button>
            <button
              type="button"
              className={`btn-compact ${filterMode === 'blockers' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterMode('blockers')}
            >
              Blockers only
            </button>
            <button
              type="button"
              className={`btn-compact ${filterMode === 'missing' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterMode('missing')}
            >
              Not submitted
            </button>
          </div>
        </div>
      </div>

      {/* Unified Data Ledger Feed (Merged 1px Borders) */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Loading team standup feed…</div>
      ) : filteredMembers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
          No members matched the current filter.
        </div>
      ) : (
        <div className="ledger-list">
          {filteredMembers.map(m => {
            const isCrit = m.has_blockers && m.blocker_severity === 'critical';

            return (
              <div key={m.user.id} className="ledger-row" style={{ flexDirection: 'column', gap: '10px' }}>
                {/* Member row top bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {m.user.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13.5px' }}>{m.user.name}</span>
                        {m.status === 'submitted' && (
                          <span className="badge badge-ok">submitted</span>
                        )}
                        {m.status === 'on_leave' && (
                          <span className="badge badge-warning">on leave</span>
                        )}
                        {m.status === 'not_submitted' && (
                          <span className="badge badge-neutral">not submitted</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Telemetry or Nudge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {m.status === 'submitted' && m.submitted_at && (
                      <span className="tabular-nums" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {m.submitted_at.slice(11, 16)}
                      </span>
                    )}

                    {m.status === 'not_submitted' && isLeadOrAdmin && (
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={() => handleNudge(m.user.id, m.user.name)}
                        title="Send reminder nudge to member"
                      >
                        <Bell size={12} />
                        <span>Nudge</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Blockers Callout (Critical or regular) */}
                {m.has_blockers && (
                  <div
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      borderLeft: `3px solid ${isCrit ? 'var(--semantic-danger)' : 'var(--semantic-warning)'}`,
                      borderRadius: '0 var(--radius-control) var(--radius-control) 0',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span className={`badge ${isCrit ? 'badge-danger' : 'badge-warning'}`}>
                        {isCrit ? 'Critical Blocker' : 'Blocked'}
                      </span>
                      {m.blocked_on_user && (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          · Waiting on {m.blocked_on_user.name}
                        </span>
                      )}
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: m.blocker_html }} />
                  </div>
                )}

                {/* Standup Content (Yesterday & Today) */}
                {m.status === 'submitted' && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                    {m.yesterday_html && (
                      <div>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Yesterday
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: m.yesterday_html }} style={{ fontSize: '13px', color: 'var(--text-primary)' }} />
                      </div>
                    )}
                    {m.today_html && (
                      <div>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                          Today
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: m.today_html }} style={{ fontSize: '13px', color: 'var(--text-primary)' }} />
                      </div>
                    )}
                  </div>
                )}

                {/* On leave details */}
                {m.status === 'on_leave' && m.leave && (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>
                    Out of office ({m.leave.type}) from {m.leave.start_date} to {m.leave.end_date}
                    {m.leave.note && ` — "${m.leave.note}"`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Email Preview Modal */}
      {previewHtml && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Digest Email Preview</span>
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => setPreviewHtml(null)}
              >
                Close preview
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
              <iframe
                title="Digest Preview"
                srcDoc={previewHtml}
                style={{ width: '100%', height: '540px', border: 'none', background: '#FFFFFF' }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
