import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi } from '../lib/api.js';
import { TodayResponse, DaySummary, BlockerSeverity, User } from '@shared/types.js';
import { TiptapEditor } from '../components/editor/TiptapEditor.js';
import { DayStrip } from '../components/ui/DayStrip.js';
import { CarryOverItem } from '../components/editor/CarryOverItem.js';
import { ConfirmDialog } from '../components/ui/Modal.js';
import { formatDisplayDate, getOrgToday, isMacPlatform } from '../lib/dateUtils.js';
import { friendlyError, leaveTypeLabel, severityLabel, standupStatusLabel } from '../lib/labels.js';
import { htmlHasContent } from '../lib/htmlContent.js';
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
  const [livePastCutoff, setLivePastCutoff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; text: string } | null>(null);
  const editSnapshot = useRef<{
    yesterday: string;
    today: string;
    hasBlockers: boolean;
    blocker: string;
    severity: BlockerSeverity;
    blockedOn: number | null;
  } | null>(null);
  const modKey = isMacPlatform() ? '⌘' : 'Ctrl';

  const handleRemoveCarryItem = (id: string, text: string) => {
    setCarryItems(prev => prev.filter(c => c.id !== id));
    setTodayHtml(prevHtml => {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`<li[^>]*>.*?${escaped}.*?<\\/li>`, 'gi');
      const updated = prevHtml.replace(regex, '');
      if (updated.replace(/<ul[^>]*>|<\/ul>|\s/gi, '') === '') {
        return '';
      }
      return updated;
    });
  };

  const debounceTimer = useRef<any>(null);

  // Load Today & Rolling History
  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [todayRes, historyRes, teamRes] = await Promise.all([
        fetchApi<TodayResponse>('/api/standups/today'),
        fetchApi<DaySummary[]>('/api/standups/mine?days=7'),
        fetchApi<any>('/api/team/' + getOrgToday())
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
        if (todayRes.entry.status !== 'submitted' && todayRes.carryOver?.length) {
          setCarryItems(todayRes.carryOver);
        } else {
          setCarryItems([]);
        }
      } else {
        setIsSubmitted(false);
        if (todayRes.carryOver && todayRes.carryOver.length > 0) {
          setCarryItems(todayRes.carryOver);
          let listHtml = '<ul data-type="taskList">';
          for (const item of todayRes.carryOver) {
            listHtml += `<li data-type="taskItem" data-checked="false"><p>${item.text}</p></li>`;
          }
          listHtml += '</ul>';
          setTodayHtml(listHtml);
        } else {
          setCarryItems([]);
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

  useEffect(() => {
    if (!data?.cutoffTime) return;
    const tick = () => {
      const [targetH, targetM] = data.cutoffTime.split(':').map(Number);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: data.orgTimezone || 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      let curH = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      if (curH === 24) curH = 0;
      const curM = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      setLivePastCutoff(curH * 60 + curM >= targetH * 60 + targetM);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [data?.cutoffTime, data?.orgTimezone]);

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
      setSaveStatus('Save failed — retry');
    }
  }, [data, yesterdayHtml, todayHtml, hasBlockers, blockerHtml, blockerSeverity, blockedOnUserId, isSubmitted, isEditing]);

  // Debounced autosave
  const triggerDebouncedSave = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveDraft();
    }, 800);
  };

  const startEditing = () => {
    editSnapshot.current = {
      yesterday: yesterdayHtml,
      today: todayHtml,
      hasBlockers,
      blocker: blockerHtml,
      severity: blockerSeverity,
      blockedOn: blockedOnUserId
    };
    setIsEditing(true);
    setFormError(null);
  };

  const cancelEditing = () => {
    if (editSnapshot.current) {
      setYesterdayHtml(editSnapshot.current.yesterday);
      setTodayHtml(editSnapshot.current.today);
      setHasBlockers(editSnapshot.current.hasBlockers);
      setBlockerHtml(editSnapshot.current.blocker);
      setBlockerSeverity(editSnapshot.current.severity);
      setBlockedOnUserId(editSnapshot.current.blockedOn);
    }
    setIsEditing(false);
    setFormError(null);
  };

  // Submit Standup
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!data || isSubmitting) return;
    setFormError(null);
    setError(null);

    if (!htmlHasContent(todayHtml)) {
      setFormError('Add at least one item under “What are you doing today?” before submitting.');
      return;
    }
    if (hasBlockers && !htmlHasContent(blockerHtml)) {
      setFormError('Describe the blocker, or turn off “I’m blocked”.');
      return;
    }

    setIsSubmitting(true);
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
      editSnapshot.current = null;

      const updatedDays = await fetchApi<DaySummary[]>('/api/standups/mine?days=7');
      setDays(updatedDays);
    } catch (err: any) {
      setFormError(friendlyError(err, 'Could not submit. Check your connection and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (isSubmitting) return;
        if (!isSubmitted || isEditing) {
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isSubmitted, isEditing, isSubmitting]);

  if (loading) {
    return (
      <div style={{ maxWidth: '780px', margin: '32px auto', padding: '0 16px', color: 'var(--text-muted)' }}>
        Loading standup…
      </div>
    );
  }

  const isPastCutoff = data?.windowState === 'past_cutoff' || livePastCutoff;
  const isReadOnly = (isSubmitted && !isEditing) || isPastCutoff;

  const selectedDay = days.find(d => d.date === selectedDate);
  const isViewingPast = Boolean(selectedDate && selectedDate !== data?.currentOrgDate);

  return (
    <main className="page-enter" style={{ maxWidth: '780px', margin: '24px auto', padding: '0 16px 60px' }}>
      {(formError || error) && (
        <div className="alert alert-err" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{formError || error}</span>
          {error && !formError && (
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={loadInitialData}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Rolling 7-day strip */}
      {days.length > 0 && (
        <DayStrip
          days={days}
          selectedDate={selectedDate}
          onSelectDate={date => setSelectedDate(date)}
        />
      )}

      {/* Read-only Past Standup View (PRD §4.2) */}
      {isViewingPast && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Past standup · {standupStatusLabel(selectedDay?.status)}
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginTop: '2px' }}>
                {formatDisplayDate(selectedDate)}
              </h2>
            </div>
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => setSelectedDate(data?.currentOrgDate || '')}
            >
              ← Back to Today
            </button>
          </div>

          {selectedDay?.standup ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {selectedDay.standup.yesterday_html && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Yesterday
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: selectedDay.standup.yesterday_html }} style={{ fontSize: '13.5px', color: 'var(--text-primary)' }} />
                </div>
              )}
              {selectedDay.standup.today_html && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Today
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: selectedDay.standup.today_html }} style={{ fontSize: '13.5px', color: 'var(--text-primary)' }} />
                </div>
              )}
              {selectedDay.standup.has_blockers && selectedDay.standup.blocker_html && (
                <div style={{ padding: '12px', background: 'var(--semantic-danger-bg)', borderLeft: '3px solid var(--semantic-danger)', borderRadius: 'var(--radius-control)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--semantic-danger)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Blocker ({severityLabel(selectedDay.standup.blocker_severity || 'medium')})
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: selectedDay.standup.blocker_html }} style={{ fontSize: '13px', color: 'var(--text-primary)' }} />
                </div>
              )}
            </div>
          ) : selectedDay?.leaveInfo ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Out of office · {leaveTypeLabel(selectedDay.leaveInfo.type)} {selectedDay.leaveInfo.note ? `— "${selectedDay.leaveInfo.note}"` : ''}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {selectedDay?.status === 'weekend' || selectedDay?.status === 'holiday'
                ? `Non-working day (${selectedDay.status})`
                : 'No standup was submitted for this date.'}
            </div>
          )}
        </div>
      )}

      {isPastCutoff && !isViewingPast && (
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

      {data?.leaveToday && !isViewingPast && !isSubmitted && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>You’re marked off today</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            You won’t be listed as missing on the team digest. You can still submit an update if you want.
          </p>
          <a href="/leave" className="btn-secondary btn-compact" style={{ textDecoration: 'none' }}>
            Manage leave
          </a>
        </div>
      )}

      {/* Submitted Summary Card (When submitted and not editing) */}
      {isSubmitted && !isEditing && !isViewingPast && (
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
                onClick={startEditing}
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
                    {severityLabel(blockerSeverity)} blocker
                  </span>
                </div>
                <div dangerouslySetInnerHTML={{ __html: blockerHtml }} style={{ fontSize: '13.5px' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submission Form (Shown when draft or in edit mode) */}
      {(!isViewingPast && (!isSubmitted || isEditing)) && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div className="alert alert-err">
              {error}
            </div>
          )}

          {/* Carried over chips */}
          {carryItems.length > 0 && !isSubmitted && (
            <div style={{ padding: '12px', background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Carried over from yesterday's priorities:
              </div>
              <div>
                {carryItems.map(item => (
                  <CarryOverItem
                    key={item.id}
                    item={item}
                    onRemove={() => setPendingRemove(item)}
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

          {/* Sticky Action Bar (PRD §4.6) */}
          <div
            style={{
              position: 'sticky',
              bottom: '12px',
              zIndex: 20,
              background: 'var(--surface-1)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-card)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-sticky)'
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
                  onClick={cancelEditing}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={isReadOnly || isSubmitting}
              >
                <span>{isSubmitting ? 'Submitting…' : 'Submit standup'}</span>
                <kbd style={{ marginLeft: '4px' }}>{modKey} + Enter</kbd>
              </button>
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={pendingRemove != null}
        title="Remove carried-over item?"
        message={pendingRemove ? `“${pendingRemove.text}” will be dropped from today’s list.` : ''}
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) {
            setCarryItems(prev => prev.filter(c => c.id !== pendingRemove.id));
          }
          setPendingRemove(null);
        }}
      />
    </main>
  );
};
