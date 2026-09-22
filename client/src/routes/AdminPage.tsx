import React, { useEffect, useState } from 'react';
import { fetchApi, downloadExport } from '../lib/api.js';
import { Team, User, JobRun, Holiday } from '@shared/types.js';
import { getOrgToday, addDays, formatHumanTime, getOrgTimezone, timezoneAbbrev } from '../lib/dateUtils.js';
import { friendlyError, jobStatusBadgeClass, jobStatusLabel } from '../lib/labels.js';
import { useToasts, ToastHost } from '../components/ui/Toast.js';
import { ConfirmDialog, Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Plus, Play, Trash2, Send, Download, Mail, ShieldCheck } from 'lucide-react';

type ConfirmState =
  | { kind: 'deactivate'; user: User }
  | { kind: 'activate'; user: User }
  | { kind: 'makeAdmin'; user: User }
  | { kind: 'makeMember'; user: User }
  | { kind: 'runDigest' }
  | { kind: 'deleteHoliday'; date: string; name: string }
  | { kind: 'preset'; team: Team; reminder: string; digest: string; label: string }
  | null;

const PRESETS = {
  short: {
    reminder: 'Hi {{name}}, {{team}} standup is due by {{time}}. Submit here: {{link}}',
    digest: '{{team}} standup for {{date}}. Digest is ready. {{link}}'
  },
  standard: {
    reminder: 'Hi {{name}}, please share yesterday, today, and any blockers for {{team}} before {{time}}. {{link}}',
    digest: '{{team}} daily digest for {{date}} is out. Open the team page: {{link}}'
  },
  blockers: {
    reminder: "Hi {{name}}, if you are blocked on {{team}}, say so before {{time}}. Otherwise send today's plan. {{link}}",
    digest: '{{team}} blockers and updates for {{date}}: {{link}}'
  }
};

export const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<'teams' | 'holidays' | 'jobs'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toasts, notify, dismiss } = useToasts();
  const [fieldStatus, setFieldStatus] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});

  const [teamName, setTeamName] = useState('');
  const [digestTime, setDigestTime] = useState('20:00');
  const [creating, setCreating] = useState(false);

  const [addFor, setAddFor] = useState<Team | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [adding, setAdding] = useState(false);

  const [newCc, setNewCc] = useState<Record<number, string>>({});
  const [ccError, setCcError] = useState<Record<number, string>>({});

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);

  const [runTeamId, setRunTeamId] = useState<number | ''>('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [jobBusy, setJobBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const orgToday = getOrgToday();
  const orgTz = getOrgTimezone();
  const tzLabel = timezoneAbbrev(orgTz);

  const setStatus = (key: string, text: string) => {
    setFieldStatus(prev => ({ ...prev, [key]: text }));
    if (text === 'Saved') {
      window.setTimeout(() => {
        setFieldStatus(prev => (prev[key] === 'Saved' ? { ...prev, [key]: '' } : prev));
      }, 2000);
    }
  };

  const refresh = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      const [t, h, j] = await Promise.all([
        fetchApi<Team[]>('/api/admin/teams'),
        fetchApi<Holiday[]>('/api/admin/holidays'),
        fetchApi<JobRun[]>('/api/admin/jobs')
      ]);
      setTeams(t);
      setHolidays(h);
      setJobs(j);
      setRunTeamId(prev => (prev === '' && t[0] ? t[0].id : prev));
    } catch (err) {
      const msg = friendlyError(err, 'Could not load admin data. Try again.');
      setLoadError(msg);
      if (silent) notify('err', msg);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await fetchApi('/api/admin/teams', {
        method: 'POST',
        body: JSON.stringify({ name: teamName, digest_time: digestTime })
      });
      setTeamName('');
      notify('ok', 'Team created');
      await refresh({ silent: true });
    } catch (err) {
      notify('err', friendlyError(err, 'Could not create team.'));
    } finally {
      setCreating(false);
    }
  };

  const saveTeamSettings = async (team: Team, patch: Record<string, unknown>, statusKey: string) => {
    if (savingKeys[statusKey]) return;
    if (typeof patch.webhook_url === 'string') {
      const url = patch.webhook_url.trim();
      if (url && !url.startsWith('https://')) {
        setStatus(statusKey, 'Must start with https://');
        notify('err', 'Webhook URL must start with https://');
        return;
      }
      patch.webhook_url = url;
    }
    setSavingKeys(prev => ({ ...prev, [statusKey]: true }));
    setStatus(statusKey, 'Saving…');
    try {
      const updated = await fetchApi<Team>(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setTeams(prev => prev.map(t => (t.id === team.id ? { ...t, ...updated, members: updated.members || t.members } : t)));
      setStatus(statusKey, 'Saved');
    } catch (err) {
      setStatus(statusKey, 'Save failed');
      notify('err', friendlyError(err, 'Could not save team settings.'));
    } finally {
      setSavingKeys(prev => ({ ...prev, [statusKey]: false }));
    }
  };

  const saveCc = async (team: Team, emails: string[]) => {
    const key = `cc-${team.id}`;
    setSavingKeys(prev => ({ ...prev, [key]: true }));
    try {
      const updated = await fetchApi<Team>(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ extra_digest_recipients: emails })
      });
      setTeams(prev => prev.map(t => (t.id === team.id ? { ...t, ...updated, members: updated.members || t.members } : t)));
      notify('ok', 'Digest Cc saved');
    } catch (err) {
      notify('err', friendlyError(err, 'Could not save Digest Cc.'));
    } finally {
      setSavingKeys(prev => ({ ...prev, [key]: false }));
    }
  };

  const openAddMember = (team: Team) => {
    setAddFor(team);
    setMemberName('');
    setMemberEmail('');
    setSendInvite(true);
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFor) return;
    setAdding(true);
    try {
      await fetchApi(`/api/admin/teams/${addFor.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ name: memberName, email: memberEmail, sendInvite })
      });
      notify('ok', `${memberName} added to ${addFor.name}`);
      setAddFor(null);
      await refresh({ silent: true });
    } catch (err) {
      notify('err', friendlyError(err, 'Could not add member.'));
    } finally {
      setAdding(false);
    }
  };

  const patchUser = async (id: number, body: Record<string, unknown>, ok: string) => {
    try {
      await fetchApi(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      notify('ok', ok);
      await refresh({ silent: true });
    } catch (err) {
      notify('err', friendlyError(err, 'Could not update that person.'));
    }
  };

  const resendInvite = async (user: User) => {
    try {
      await fetchApi(`/api/admin/users/${user.id}/resend-invite`, { method: 'POST' });
      notify('ok', `Invite sent to ${user.email}`);
    } catch (err) {
      notify('err', friendlyError(err, 'Could not send invite.'));
    }
  };

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingHoliday(true);
    try {
      await fetchApi('/api/admin/holidays', {
        method: 'POST',
        body: JSON.stringify({ date: holidayDate, name: holidayName })
      });
      setHolidayDate('');
      setHolidayName('');
      notify('ok', 'Holiday added');
      await refresh({ silent: true });
    } catch (err) {
      notify('err', friendlyError(err, 'Could not add holiday.'));
    } finally {
      setAddingHoliday(false);
    }
  };

  const runDigest = async () => {
    if (!runTeamId) {
      notify('err', 'Select a team first');
      return;
    }
    setJobBusy(true);
    try {
      await fetchApi('/api/admin/jobs/daily_digest/run', {
        method: 'POST',
        body: JSON.stringify({ teamId: runTeamId, date: orgToday })
      });
      notify('ok', 'Digest run finished');
      await refresh({ silent: true });
    } catch (err) {
      notify('err', friendlyError(err, 'Could not run digest.'));
    } finally {
      setJobBusy(false);
    }
  };

  const testSend = async () => {
    if (!runTeamId) {
      notify('err', 'Select a team first');
      return;
    }
    setJobBusy(true);
    try {
      await fetchApi(`/api/team/${orgToday}/test-send`, {
        method: 'POST',
        body: JSON.stringify({ teamId: runTeamId })
      });
      notify('ok', 'Test digest sent to you');
    } catch (err) {
      notify('err', friendlyError(err, 'Could not send test digest.'));
    } finally {
      setJobBusy(false);
    }
  };

  const preview = async () => {
    if (!runTeamId) {
      notify('err', 'Select a team first');
      return;
    }
    setJobBusy(true);
    try {
      const html = await fetchApi<string>(`/api/team/${orgToday}/preview?teamId=${runTeamId}`);
      setPreviewHtml(html);
    } catch (err) {
      notify('err', friendlyError(err, 'Could not load preview.'));
    } finally {
      setJobBusy(false);
    }
  };

  const exportWeek = async () => {
    if (!runTeamId) {
      notify('err', 'Select a team first');
      return;
    }
    setJobBusy(true);
    try {
      await downloadExport(addDays(orgToday, -6), orgToday, Number(runTeamId));
      notify('ok', 'Export downloaded');
    } catch (err) {
      notify('err', friendlyError(err, 'Could not download export.'));
    } finally {
      setJobBusy(false);
    }
  };

  const memberEmails = (team: Team) =>
    (team.members || []).filter(m => m.is_active).map(m => m.email.toLowerCase());

  const teamNameById = (id: number | null | undefined) =>
    teams.find(t => t.id === id)?.name || (id == null ? '—' : `Team ${id}`);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === 'deactivate') {
        await patchUser(confirm.user.id, { is_active: false }, `${confirm.user.name} deactivated`);
      } else if (confirm.kind === 'activate') {
        await patchUser(confirm.user.id, { is_active: true }, `${confirm.user.name} activated`);
      } else if (confirm.kind === 'makeAdmin') {
        await patchUser(confirm.user.id, { role: 'admin' }, `${confirm.user.name} is now an admin`);
      } else if (confirm.kind === 'makeMember') {
        await patchUser(confirm.user.id, { role: 'member' }, `${confirm.user.name} is now a member`);
      } else if (confirm.kind === 'runDigest') {
        await runDigest();
      } else if (confirm.kind === 'deleteHoliday') {
        await fetchApi(`/api/admin/holidays/${confirm.date}`, { method: 'DELETE' });
        notify('ok', 'Holiday removed');
        await refresh({ silent: true });
      } else if (confirm.kind === 'preset') {
        await saveTeamSettings(
          confirm.team,
          { reminder_template: confirm.reminder, digest_template: confirm.digest },
          `tpl-${confirm.team.id}`
        );
      }
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmCopy = (): { title: string; message: string; confirmLabel: string; danger?: boolean } => {
    if (!confirm) return { title: '', message: '', confirmLabel: 'Confirm' };
    switch (confirm.kind) {
      case 'deactivate':
        return {
          title: `Deactivate ${confirm.user.name}?`,
          message: 'They will leave the digest To list and cannot sign in until activated again.',
          confirmLabel: 'Deactivate',
          danger: true
        };
      case 'activate':
        return {
          title: `Activate ${confirm.user.name}?`,
          message: 'They can sign in again and will appear on digest To if they are a member.',
          confirmLabel: 'Activate'
        };
      case 'makeAdmin':
        return {
          title: `Make ${confirm.user.name} an admin?`,
          message: 'Admins can open /admin and change team settings.',
          confirmLabel: 'Make admin'
        };
      case 'makeMember':
        return {
          title: `Make ${confirm.user.name} a member?`,
          message: 'They will lose access to /admin. The last admin cannot be demoted.',
          confirmLabel: 'Make member',
          danger: true
        };
      case 'runDigest':
        return {
          title: 'Run digest now?',
          message: 'This emails the real daily digest for the selected team (subject to the quiet-day rule).',
          confirmLabel: 'Send digest',
          danger: true
        };
      case 'deleteHoliday':
        return {
          title: `Remove ${confirm.name}?`,
          message: `${confirm.date} will be treated as a normal working day again.`,
          confirmLabel: 'Remove',
          danger: true
        };
      case 'preset':
        return {
          title: `Apply ${confirm.label} template?`,
          message: 'This replaces the reminder and digest message text for this team.',
          confirmLabel: 'Apply template'
        };
    }
  };

  const copy = confirmCopy();

  return (
    <main className="page-enter" style={{ maxWidth: '960px', margin: '24px auto', padding: '0 16px 80px' }}>
      <ToastHost toasts={toasts} onDismiss={dismiss} />
      <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Admin setup</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Send this URL to whoever configures the team. Members who submit updates use the main app. Times use {tzLabel}.
      </p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {(['teams', 'holidays', 'jobs'] as const).map(id => (
          <button key={id} type="button" className={`btn-compact ${tab === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(id)}>
            {id === 'teams' ? 'Teams & members' : id === 'holidays' ? 'Holidays' : 'Digest jobs'}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && loadError && (
        <div className="alert alert-err" style={{ marginBottom: 16 }}>
          {loadError}{' '}
          <button type="button" className="btn-secondary btn-compact" onClick={() => refresh()}>Retry</button>
        </div>
      )}

      {tab === 'teams' && !loading && !loadError && (
        <>
          <form className="card" onSubmit={createTeam} style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="field" style={{ flex: 1, minWidth: '180px' }}>
              <label className="field-label" htmlFor="new-team-name">New team</label>
              <input id="new-team-name" value={teamName} onChange={e => setTeamName(e.target.value)} required placeholder="Engineering" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-team-digest">Digest time ({tzLabel})</label>
              <input id="new-team-digest" type="time" value={digestTime} onChange={e => setDigestTime(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" disabled={creating || !teamName.trim()}>
              <Plus size={13} /> {creating ? 'Creating…' : 'Create'}
            </button>
          </form>

          {teams.length === 0 ? (
            <EmptyState
              title="Create your first team"
              description="Add a team name and digest time above, then invite members."
            />
          ) : null}

          {teams.map(team => {
            const cc = (team.extra_digest_recipients || []).map(e => e.toLowerCase());
            const emails = memberEmails(team);
            return (
              <div key={team.id} className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>{team.name}</h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Members go in To · Reminder {formatHumanTime(team.reminder_morning_time || '09:30', orgTz)} · Digest {formatHumanTime(team.digest_time, orgTz)}
                    </div>
                  </div>
                  <button type="button" className="btn-secondary btn-compact" onClick={() => openAddMember(team)}>
                    <Plus size={12} /> Add member
                  </button>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 8 }}>Schedule</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div className="field">
                    <label className="field-label">Reminder time ({tzLabel})</label>
                    <input
                      type="time"
                      defaultValue={team.reminder_morning_time || '09:30'}
                      onBlur={e => saveTeamSettings(team, { reminder_time: e.target.value }, `rem-${team.id}`)}
                    />
                    <div className={`save-status ${fieldStatus[`rem-${team.id}`] === 'Saved' ? 'save-status-ok' : fieldStatus[`rem-${team.id}`]?.includes('fail') || fieldStatus[`rem-${team.id}`]?.includes('Must') ? 'save-status-err' : ''}`}>
                      {fieldStatus[`rem-${team.id}`] || ' '}
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Digest time ({tzLabel})</label>
                    <input
                      type="time"
                      defaultValue={team.digest_time}
                      onBlur={e => saveTeamSettings(team, { digest_time: e.target.value }, `dig-${team.id}`)}
                    />
                    <div className={`save-status ${fieldStatus[`dig-${team.id}`] === 'Saved' ? 'save-status-ok' : ''}`}>
                      {fieldStatus[`dig-${team.id}`] || ' '}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 8 }}>Messages</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary btn-compact" onClick={() => setConfirm({ kind: 'preset', team, ...PRESETS.short, label: 'Short' })}>Short</button>
                  <button type="button" className="btn-secondary btn-compact" onClick={() => setConfirm({ kind: 'preset', team, ...PRESETS.standard, label: 'Standard' })}>Standard</button>
                  <button type="button" className="btn-secondary btn-compact" onClick={() => setConfirm({ kind: 'preset', team, ...PRESETS.blockers, label: 'Blockers first' })}>Blockers first</button>
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label className="field-label">Reminder message</label>
                  <textarea
                    key={`${team.id}-r-${team.reminder_template}`}
                    defaultValue={team.reminder_template || ''}
                    rows={3}
                    onBlur={e => saveTeamSettings(team, { reminder_template: e.target.value }, `rt-${team.id}`)}
                  />
                  <div className="save-status">{fieldStatus[`rt-${team.id}`] || ' '}</div>
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label className="field-label">Digest webhook message</label>
                  <textarea
                    key={`${team.id}-d-${team.digest_template}`}
                    defaultValue={team.digest_template || ''}
                    rows={3}
                    onBlur={e => saveTeamSettings(team, { digest_template: e.target.value }, `dt-${team.id}`)}
                  />
                  <div className="save-status">{fieldStatus[`dt-${team.id}`] || ' '}</div>
                </div>
                <p className="field-hint" style={{ marginBottom: 12 }}>
                  Placeholders: {'{{name}} {{team}} {{date}} {{time}} {{link}}'}
                </p>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label className="field-label">Teams webhook</label>
                  <input
                    type="url"
                    defaultValue={team.webhook_url || ''}
                    placeholder="https://outlook.office.com/webhook/..."
                    onBlur={e => saveTeamSettings(team, { webhook_url: e.target.value.trim() }, `wh-${team.id}`)}
                  />
                  <p className="field-hint">HTTPS only. Email still sends if the webhook fails.</p>
                  <div className={`save-status ${fieldStatus[`wh-${team.id}`]?.includes('Must') || fieldStatus[`wh-${team.id}`]?.includes('fail') ? 'save-status-err' : fieldStatus[`wh-${team.id}`] === 'Saved' ? 'save-status-ok' : ''}`}>
                    {fieldStatus[`wh-${team.id}`] || ' '}
                  </div>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Members (digest To)</div>
                {(team.members || []).length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12 }}>No submitters yet.</p>
                ) : (
                  <div className="table-scroll" style={{ marginBottom: 12 }}>
                    <table className="standup-table">
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
                      </thead>
                      <tbody>
                        {(team.members || []).map(m => (
                          <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.55 }}>
                            <td>
                              {m.name}{' '}
                              {!m.is_active ? <span className="badge badge-warning">Inactive</span> : null}
                            </td>
                            <td>{m.email}</td>
                            <td>{m.role === 'admin' ? 'Admin' : 'Member'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button type="button" className="btn-secondary btn-compact" onClick={() => resendInvite(m)}>Invite</button>
                              {m.role !== 'admin' ? (
                                <button type="button" className="btn-secondary btn-compact" onClick={() => setConfirm({ kind: 'makeAdmin', user: m })}>
                                  <ShieldCheck size={12} /> Make admin
                                </button>
                              ) : (
                                <button type="button" className="btn-secondary btn-compact" onClick={() => setConfirm({ kind: 'makeMember', user: m })}>
                                  Make member
                                </button>
                              )}
                              <button
                                type="button"
                                className={`btn-compact ${m.is_active ? 'btn-danger' : 'btn-secondary'}`}
                                onClick={() => setConfirm({ kind: m.is_active ? 'deactivate' : 'activate', user: m })}
                              >
                                {m.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Digest Cc</div>
                <p className="field-hint" style={{ marginBottom: '8px' }}>
                  Pick people who should also be copied, or add someone who does not log in. Addresses already on To are skipped.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {emails.map(email => {
                    const checked = cc.includes(email);
                    return (
                      <label key={email} style={{ fontSize: '12.5px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={Boolean(savingKeys[`cc-${team.id}`])}
                          onChange={() => {
                            const next = checked ? cc.filter(e => e !== email) : [...cc, email];
                            saveCc(team, next);
                          }}
                        />
                        {email}
                      </label>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field-label" htmlFor={`cc-${team.id}`}>Add email</label>
                    <input
                      id={`cc-${team.id}`}
                      type="email"
                      placeholder="observer@company.com"
                      value={newCc[team.id] || ''}
                      aria-invalid={Boolean(ccError[team.id])}
                      onChange={e => {
                        setNewCc(prev => ({ ...prev, [team.id]: e.target.value }));
                        setCcError(prev => ({ ...prev, [team.id]: '' }));
                      }}
                    />
                    {ccError[team.id] ? <div className="field-error">{ccError[team.id]}</div> : null}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    style={{ marginTop: 22 }}
                    onClick={() => {
                      const email = (newCc[team.id] || '').trim().toLowerCase();
                      if (!email || !email.includes('@')) {
                        setCcError(prev => ({ ...prev, [team.id]: 'Enter a valid email' }));
                        return;
                      }
                      saveCc(team, Array.from(new Set([...cc, email])));
                      setNewCc(prev => ({ ...prev, [team.id]: '' }));
                    }}
                  >
                    Add Cc
                  </button>
                </div>
                {cc.filter(e => !emails.includes(e)).length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {cc.filter(e => !emails.includes(e)).map(email => (
                      <span key={email} className="badge badge-neutral">
                        {email}
                        <button
                          type="button"
                          aria-label={`Remove ${email}`}
                          onClick={() => saveCc(team, cc.filter(x => x !== email))}
                          style={{ marginLeft: 4, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'holidays' && !loading && !loadError && (
        <div>
          <form className="card" onSubmit={addHoliday} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="field">
              <label className="field-label" htmlFor="holiday-date">Date</label>
              <input id="holiday-date" type="date" required value={holidayDate} onChange={e => setHolidayDate(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label" htmlFor="holiday-name">Name</label>
              <input id="holiday-name" required placeholder="Holiday name" value={holidayName} onChange={e => setHolidayName(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={addingHoliday}>{addingHoliday ? 'Adding…' : 'Add holiday'}</button>
          </form>
          {holidays.length === 0 ? (
            <EmptyState
              title="No holidays yet"
              description="Quiet days with fewer than two updates also skip the digest."
            />
          ) : (
            holidays.map(h => (
              <div key={h.date} className="ledger-row" style={{ justifyContent: 'space-between' }}>
                <span>{h.date} · {h.name}</span>
                <button
                  type="button"
                  className="btn-danger btn-compact"
                  aria-label={`Remove ${h.name}`}
                  onClick={() => setConfirm({ kind: 'deleteHoliday', date: h.date, name: h.name })}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'jobs' && !loading && !loadError && (
        <div>
          <div className="card" style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={runTeamId} onChange={e => setRunTeamId(e.target.value ? Number(e.target.value) : '')} aria-label="Team">
              <option value="">Select team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" className="btn-secondary btn-compact" onClick={preview} disabled={jobBusy}><Mail size={12} /> Preview</button>
            <button type="button" className="btn-secondary btn-compact" onClick={testSend} disabled={jobBusy}><Send size={12} /> Test send to me</button>
            <button type="button" className="btn-secondary btn-compact" onClick={exportWeek} disabled={jobBusy}><Download size={12} /> Export 7 days</button>
            <button type="button" className="btn-primary btn-compact" onClick={() => setConfirm({ kind: 'runDigest' })} disabled={jobBusy}>
              <Play size={12} /> {jobBusy ? 'Working…' : 'Run digest now'}
            </button>
          </div>
          {jobs.length === 0 ? (
            <EmptyState title="No digest runs yet" description="After the first scheduled or manual run, history appears here." />
          ) : (
            <div className="table-scroll">
              <table className="standup-table">
                <thead>
                  <tr><th>Date</th><th>Kind</th><th>Team</th><th>Status</th><th>Recipients</th><th>Error</th></tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id}>
                      <td>{j.run_date}</td>
                      <td>{j.kind === 'morning' ? 'Reminder' : j.kind === 'daily_digest' ? 'Digest' : j.kind}</td>
                      <td>{teamNameById(j.team_id)}</td>
                      <td><span className={jobStatusBadgeClass(j.status)}>{jobStatusLabel(j.status)}</span></td>
                      <td>{j.recipients}</td>
                      <td style={{ fontSize: '12px', color: j.error ? 'var(--semantic-danger)' : 'var(--text-muted)' }}>{j.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(addFor)}
        title={addFor ? `Add member to ${addFor.name}` : 'Add member'}
        onClose={() => setAddFor(null)}
      >
        <p className="modal-body">People added here submit daily updates and are on the digest To list.</p>
        <form onSubmit={addMember} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="member-name">Full name</label>
            <input id="member-name" required value={memberName} onChange={e => setMemberName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="member-email">Work email</label>
            <input id="member-email" required type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} />
          </div>
          <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} />
            Send invite email
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setAddFor(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={adding || !memberName.trim() || !memberEmail.trim()}>
              {adding ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(previewHtml)} title="Digest preview" onClose={() => setPreviewHtml(null)} wide>
        <p className="field-hint" style={{ marginBottom: 8 }}>Email preview uses a light layout so it matches what recipients see.</p>
        <div style={{ borderRadius: 'var(--radius-control)', overflow: 'hidden', border: '1px solid var(--border-default)', background: '#fff' }}>
          <iframe title="Digest preview" srcDoc={previewHtml || ''} style={{ width: '100%', height: 480, border: 'none', background: '#fff' }} />
        </div>
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={() => setPreviewHtml(null)}>Close</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={copy.title}
        message={copy.message}
        confirmLabel={copy.confirmLabel}
        danger={copy.danger}
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </main>
  );
};
