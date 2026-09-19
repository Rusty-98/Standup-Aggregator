import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi } from '../lib/api.js';
import { TodayResponse, DaySummary, BlockerSeverity, User } from '@shared/types.js';
import { TiptapEditor } from '../components/editor/TiptapEditor.js';
import { DayStrip } from '../components/ui/DayStrip.js';
import { CarryOverItem } from '../components/editor/CarryOverItem.js';
import { formatDisplayDate } from '../lib/dateUtils.js';
import { CheckCircle, Edit3, ShieldAlert } from 'lucide-react';

interface TodayPageProps {
  currentUser: User;
}

export const TodayPage: React.FC<TodayPageProps> = ({ currentUser }) => {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Form State
  const [yesterdayHtml, setYesterdayHtml] = useState('');
  const [todayHtml, setTodayHtml] = useState('');
  const [hasBlockers, setHasBlockers] = useState(false);
  const [blockerHtml, setBlockerHtml] = useState('');
  const [blockerSeverity, setBlockerSeverity] = useState<BlockerSeverity>('medium');
  const [blockedOnUserId, setBlockedOnUserId] = useState<number | null>(null);

  // Carried over items
  const [carryItems, setCarryItems] = useState<Array<{ id: string; text: string }>>([]);

  // UI status
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('All changes saved');
  const [error, setError] = useState<string | null>(null);
  const [teammates, setTeammates] = useState<Array<{ id: number; name: string }>>([]);

  const debounceTimer = useRef<any>(null);

  // Load Today & Rolling History
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [todayRes, historyRes, teamRes] = await Promise.all([
        fetchApi<TodayResponse>('/api/standups/today'),
        fetchApi<DaySummary[]>('/api/standups/mine?days=7'),
        fetchApi<any>('/api/team/' + new Date().toISOString().slice(0, 10))
      ]);

      setData(todayRes);
      setDays(historyRes);
      setSelectedDate(todayRes.currentOrgDate);

      if (teamRes?.members) {
        setTeammates(teamRes.members.map((m: any) => ({ id: m.user.id, name: m.user.name })));
      }

      if (todayRes.entry) {
        setYesterdayHtml(todayRes.entry.yesterday_html);
        setTodayHtml(todayRes.entry.today_html);
        setHasBlockers(Boolean(todayRes.entry.has_blockers));
        setBlockerHtml(todayRes.entry.blocker_html);
        setBlockerSeverity(todayRes.entry.blocker_severity || 'medium');
        setBlockedOnUserId(todayRes.entry.blocked_on_user_id);
        setIsSubmitted(todayRes.entry.status === 'submitted');
      } else {
        // Apply carry-over items
        if (todayRes.carryOver && todayRes.carryOver.length > 0) {
          setCarryItems(todayRes.carryOver);
          let listHtml = '<ul data-type="taskList">';
          for (const item of todayRes.carryOver) {
            listHtml += `<li data-type="taskItem" data-checked="false"><p>${item.text}</p></li>`;
          }
          listHtml += '</ul>';
          setTodayHtml(listHtml);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Autosave Draft
  const saveDraft = useCallback(async () => {
    if (!data || isSubmitted && !isEditing) return;
    if (data.windowState === 'past_cutoff') return;

    try {
      setSaveStatus('Saving…');
      await fetchApi(`/api/standups/${data.currentOrgDate}`, {
        method: 'PUT',
        body: JSON.stringify({
          yesterday_html: yesterdayHtml,
          today_html: todayHtml,
          has_blockers: hasBlockers,
          blocker_html: blockerHtml,
          blocker_severity: hasBlockers ? blockerSeverity : null,
          blocked_on_user_id: hasBlockers ? blockedOnUserId : null
        })
      });
      setSaveStatus('Saved just now');
    } catch (err: any) {
      setSaveStatus('Save failed');
    }
  }, [data, yesterdayHtml, todayHtml, hasBlockers, blockerHtml, blockerSeverity, blockedOnUserId, isSubmitted, isEditing]);

  // Debounced autosave
  const triggerDebouncedSave = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveDraft();
    }, 800);
  };

  // Submit Standup
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!data) return;
    setError(null);

    try {
      await fetchApi(`/api/standups/${data.currentOrgDate}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          yesterday_html: yesterdayHtml,
          today_html: todayHtml,
          has_blockers: hasBlockers,
          blocker_html: blockerHtml,
          blocker_severity: hasBlockers ? blockerSeverity : null,
          blocked_on_user_id: hasBlockers ? blockedOnUserId : null
        })
      });

      setIsSubmitted(true);
      setIsEditing(false);
      setSaveStatus('Submitted');

      // Refresh 7-day strip
      const updatedDays = await fetchApi<DaySummary[]>('/api/standups/mine?days=7');
      setDays(updatedDays);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!isSubmitted || isEditing) {
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isSubmitted, isEditing]);

  if (loading) {
    return (
      <div style={{ maxWidth: '780px', margin: '32px auto', padding: '0 16px', color: 'var(--text-muted)' }}>
        Loading standup…
      </div>
    );
  }

  const isPastCutoff = data?.windowState === 'past_cutoff';
  const isReadOnly = (isSubmitted && !isEditing) || isPastCutoff;

  return (
    <main style={{ maxWidth: '780px', margin: '24px auto', padding: '0 16px 60px' }}>
      {/* Rolling 7-day strip */}
      {days.length > 0 && (
        <DayStrip
          days={days}
          selectedDate={selectedDate}
          onSelectDate={date => setSelectedDate(date)}
        />
      )}

      {/* Cutoff warning banner */}
      {isPastCutoff && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-control)',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--text-muted)'
          }}
        >
          <ShieldAlert size={15} color="var(--semantic-warning)" />
          <span>The {data?.cutoffTime} cutoff has passed. Today’s standup is locked and read-only.</span>
        </div>
      )}

      {/* Submitted Summary Card (When submitted and not editing) */}
      {isSubmitted && !isEditing && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color="var(--semantic-ok)" />
              <h2 style={{ fontSize: '15px', fontWeight: 600 }}>
                Standup submitted for {formatDisplayDate(data?.currentOrgDate || '')}
              </h2>
            </div>
            {!isPastCutoff && (
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={13} />
                <span>Edit update</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {yesterdayHtml && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Yesterday
                </div>
                <div dangerouslySetInnerHTML={{ __html: yesterdayHtml }} style={{ fontSize: '13.5px', color: 'var(--text-primary)' }} />
              </div>
            )}

            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Today
              </div>
              <div dangerouslySetInnerHTML={{ __html: todayHtml }} style={{ fontSize: '13.5px', color: 'var(--text-primary)' }} />
            </div>

            {hasBlockers && (
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span className={`badge ${blockerSeverity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                    {blockerSeverity} blocker
                  </span>
                </div>
                <div dangerouslySetInnerHTML={{ __html: blockerHtml }} style={{ fontSize: '13.5px' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submission Form (Shown when draft or in edit mode) */}
      {(!isSubmitted || isEditing) && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                border: '1px solid var(--semantic-danger)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--semantic-danger)',
                fontSize: '13px'
              }}
            >
              {error}
            </div>
          )}

          {/* Carried over chips */}
          {carryItems.length > 0 && (
            <div style={{ padding: '12px', background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Carried over from yesterday's priorities:
              </div>
              <div>
                {carryItems.map(item => (
                  <CarryOverItem
                    key={item.id}
                    item={item}
                    onRemove={id => setCarryItems(prev => prev.filter(c => c.id !== id))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Field 1: Yesterday */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>
                1. What did you do yesterday?
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>optional</span>
            </div>
            <TiptapEditor
              value={yesterdayHtml}
              onChange={val => {
                setYesterdayHtml(val);
                triggerDebouncedSave();
              }}
              onBlur={saveDraft}
              placeholder="List deliverables completed yesterday…"
              disabled={isReadOnly}
            />
          </div>

          {/* Field 2: Today (Required) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>
                2. What are you doing today?
              </label>
              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>required</span>
            </div>
            <TiptapEditor
              value={todayHtml}
              onChange={val => {
                setTodayHtml(val);
                triggerDebouncedSave();
              }}
              onBlur={saveDraft}
              placeholder="Checklist of goals and priorities today…"
              isTaskListDefault={true}
              disabled={isReadOnly}
            />
          </div>

          {/* Field 3: Blockers (Toggle off by default) */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>
                  3. Any blockers?
                </label>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Are you waiting on anyone, code review, or dependencies?
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={hasBlockers}
                  onChange={e => {
                    setHasBlockers(e.target.checked);
                    triggerDebouncedSave();
                  }}
                  disabled={isReadOnly}
                />
                <span>I'm blocked</span>
              </label>
            </div>

            {hasBlockers && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Severity
                    </label>
                    <select
                      value={blockerSeverity}
                      onChange={e => {
                        setBlockerSeverity(e.target.value as BlockerSeverity);
                        triggerDebouncedSave();
                      }}
                      disabled={isReadOnly}
                      style={{ width: '100%' }}
                    >
                      <option value="low">Low · Minor delay</option>
                      <option value="medium">Medium · Needs attention today</option>
                      <option value="critical">Critical · Stop ship / immediate block</option>
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Blocked on teammate (optional)
                    </label>
                    <select
                      value={blockedOnUserId || ''}
                      onChange={e => {
                        setBlockedOnUserId(e.target.value ? Number(e.target.value) : null);
                        triggerDebouncedSave();
                      }}
                      disabled={isReadOnly}
                      style={{ width: '100%' }}
                    >
                      <option value="">None specified</option>
                      {teammates
                        .filter(t => t.id !== currentUser.id)
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Blocker description
                  </label>
                  <TiptapEditor
                    value={blockerHtml}
                    onChange={val => {
                      setBlockerHtml(val);
                      triggerDebouncedSave();
                    }}
                    onBlur={saveDraft}
                    placeholder="Describe what is blocking you and what you need to proceed…"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>{saveStatus}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isEditing && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={isReadOnly}
              >
                <span>Submit standup</span>
                <kbd style={{ marginLeft: '4px' }}>Ctrl + Enter</kbd>
              </button>
            </div>
          </div>
        </form>
      )}
    </main>
  );
};
