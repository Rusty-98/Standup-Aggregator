import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api.js';
import { Standup, User } from '@shared/types.js';
import { formatDisplayDate } from '../lib/dateUtils.js';
import { severityLabel, standupStatusLabel, friendlyError } from '../lib/labels.js';
import { EmptyState } from '../components/ui/EmptyState.js';

interface RecapDay {
  date: string;
  standup: Standup | null;
}

interface RecapAnalysis {
  available: boolean;
  summary: string;
  shipped: string;
  blockers: string;
  unfinished: string;
  reason?: string;
}

interface WeeklyRecapPageProps {
  currentUser: User;
}

export const WeeklyRecapPage: React.FC<WeeklyRecapPageProps> = () => {
  const [days, setDays] = useState<RecapDay[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RecapAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const loadWeek = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchApi<{ days: RecapDay[]; from: string; to: string }>('/api/recap/week');
      setDays(res.days || []);
      setFrom(res.from);
      setTo(res.to);
    } catch (err: unknown) {
      setLoadError(friendlyError(err, 'Could not load this week. Try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalysis = useCallback(async () => {
    try {
      setAnalysisLoading(true);
      setAnalysisError(null);
      const res = await fetchApi<RecapAnalysis>('/api/recap/analysis', { method: 'POST', timeoutMs: 25000 });
      setAnalysis(res);
      if (!res.available && res.reason && res.reason !== 'OPENAI_API_KEY is not set') {
        setAnalysisError("Couldn't generate a summary. Try again.");
      }
    } catch {
      setAnalysis(null);
      setAnalysisError("Couldn't generate a summary. Try again.");
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  const submitted = days.filter(d => d.standup?.status === 'submitted');
  const blockersRaised = submitted.filter(d => d.standup?.has_blockers).length;
  const emptyWeek = !loading && !loadError && days.length > 0 && submitted.length === 0;

  return (
    <main className="page-enter" style={{ maxWidth: '780px', margin: '24px auto', padding: '0 16px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Recap</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Last 7 days
          {from && to ? ` · ${formatDisplayDate(from)} – ${formatDisplayDate(to)}` : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Submitted</div>
          <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 600 }}>{submitted.length} / {days.length || 7}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Blockers</div>
          <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 600 }}>{blockersRaised}</div>
        </div>
      </div>

      {analysisLoading && (
        <div className="card" style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>Writing your weekly analysis…</div>
      )}
      {analysis?.available && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            AI analysis
          </div>
          <p style={{ fontSize: '13.5px', lineHeight: 1.55, marginBottom: '12px' }}>{analysis.summary}</p>
          {analysis.shipped && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>Shipped</div>
              <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{analysis.shipped}</div>
            </div>
          )}
          {analysis.blockers && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>Blockers</div>
              <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{analysis.blockers}</div>
            </div>
          )}
          {analysis.unfinished && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>Unfinished</div>
              <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{analysis.unfinished}</div>
            </div>
          )}
        </div>
      )}
      {analysisError && !analysisLoading && (
        <div className="alert alert-err" style={{ marginBottom: '20px' }}>
          {analysisError}{' '}
          <button type="button" className="btn-secondary btn-compact" onClick={loadAnalysis}>
            Retry
          </button>
        </div>
      )}

      {loadError && (
        <div className="alert alert-err" style={{ marginBottom: '16px' }}>
          {loadError}{' '}
          <button type="button" className="btn-secondary btn-compact" onClick={loadWeek}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-card)' }} />
      ) : emptyWeek ? (
        <EmptyState
          title="No updates this week"
          description="Submit today’s standup to start filling your recap."
          action={
            <Link to="/today" className="btn-primary" style={{ marginTop: 12 }}>
              Go to Today
            </Link>
          }
        />
      ) : (
        <div className="ledger-list">
          {days.map(d => (
            <div key={d.date} className="ledger-row" style={{ flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 600 }}>{formatDisplayDate(d.date)}</span>
                <span className={`badge ${d.standup?.status === 'submitted' ? 'badge-ok' : 'badge-neutral'}`}>
                  {d.standup?.status === 'submitted'
                    ? standupStatusLabel('submitted')
                    : d.standup
                      ? standupStatusLabel('draft')
                      : 'No update'}
                </span>
              </div>
              {d.standup?.today_html && (
                <div className="standup-html" dangerouslySetInnerHTML={{ __html: d.standup.today_html }} />
              )}
              {d.standup?.has_blockers && (
                <div style={{ borderLeft: '3px solid var(--semantic-warning)', paddingLeft: '8px', fontSize: '13px' }}>
                  <span className="badge badge-warning">{severityLabel(d.standup.blocker_severity || 'medium')}</span>
                  <div className="standup-html" dangerouslySetInnerHTML={{ __html: d.standup.blocker_html }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
