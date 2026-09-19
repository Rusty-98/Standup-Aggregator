import { db } from '../db/client.js';
import { renderDigestEmail, DigestEmailData } from '../emails/digestEmail.js';
import { sendEmail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';
import { isWorkingDay } from '../lib/dates.js';

export function getTeamDigestData(teamId: number, dateStr: string): DigestEmailData {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as unknown as { id: number; name: string; extra_digest_recipients: string } | undefined;
  if (!team) throw new Error('Team not found');

  const users = db.prepare(`
    SELECT * FROM users
    WHERE team_id = ? AND is_active = 1
    ORDER BY name ASC
  `).all(teamId) as Array<{ id: number; name: string; email: string }>;

  // Standups for the date
  const standups = db.prepare(`
    SELECT s.*, u.name as user_name, b.name as blocked_on_name
    FROM standups s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN users b ON b.id = s.blocked_on_user_id
    WHERE s.team_id = ? AND s.standup_date = ? AND s.status = 'submitted'
  `).all(teamId, dateStr) as Array<any>;

  const standupMap = new Map<number, any>();
  for (const s of standups) {
    standupMap.set(s.user_id, s);
  }

  // Leaves for the date
  const leaves = db.prepare(`
    SELECT l.*, u.name as user_name
    FROM leaves l
    JOIN users u ON u.id = l.user_id
    WHERE u.team_id = ? AND l.start_date <= ? AND l.end_date >= ?
  `).all(teamId, dateStr, dateStr) as Array<any>;

  const leaveMap = new Map<number, any>();
  for (const l of leaves) {
    leaveMap.set(l.user_id, l);
  }

  // Build categories
  const blockers: DigestEmailData['blockers'] = [];
  const updates: DigestEmailData['updates'] = [];
  const notSubmittedNames: string[] = [];
  const onLeave: DigestEmailData['onLeave'] = [];

  for (const u of users) {
    const standup = standupMap.get(u.id);
    const leave = leaveMap.get(u.id);

    if (standup) {
      // Formatted submitted time
      const subTime = standup.submitted_at ? standup.submitted_at.slice(11, 16) : '—';
      updates.push({
        name: u.name,
        submittedAtTime: subTime,
        yesterdayHtml: standup.yesterday_html,
        yesterdayText: standup.yesterday_text,
        todayHtml: standup.today_html,
        todayText: standup.today_text
      });

      if (standup.has_blockers && standup.blocker_text) {
        blockers.push({
          name: u.name,
          severity: standup.blocker_severity || 'medium',
          blockedOnName: standup.blocked_on_name,
          text: standup.blocker_text,
          html: standup.blocker_html
        });
      }
    } else if (leave) {
      onLeave.push({
        name: u.name,
        dateRange: `${leave.start_date.slice(5)} to ${leave.end_date.slice(5)}`
      });
    } else {
      notSubmittedNames.push(u.name);
    }
  }

  // Sort blockers: critical first
  blockers.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return a.name.localeCompare(b.name);
  });

  const total = users.length;
  const submittedCount = updates.length;
  const onLeaveCount = onLeave.length;
  const notSubmittedCount = notSubmittedNames.length;
  const blockerCount = blockers.length;

  const summaryLine = `${submittedCount} of ${total} submitted · ${onLeaveCount} on leave · ${notSubmittedCount} not submitted · ${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`;

  // Format date nicely: e.g. "Tue 12 Mar 2026"
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dateFormatted = dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const teamPageUrl = `${appUrl}/team?date=${dateStr}`;

  return {
    teamName: team.name,
    dateFormatted,
    summaryLine,
    blockers,
    updates,
    notSubmittedNames,
    onLeave,
    teamPageUrl
  };
}

export async function sendDailyDigest(teamId: number, dateStr: string, force: boolean = false): Promise<boolean> {
  // Check working day
  if (!isWorkingDay(dateStr) && !force) {
    logger.info({ dateStr }, 'Skipping daily digest — non-working day');
    return false;
  }

  // Idempotency check in digest_runs
  const existingRun = db.prepare(`
    SELECT * FROM digest_runs
    WHERE kind = 'daily_digest' AND team_id = ? AND run_date = ?
  `).get(teamId, dateStr) as { id: number; status: string; attempts: number } | undefined;

  if (existingRun && existingRun.status === 'sent' && !force) {
    logger.info({ teamId, dateStr }, 'Daily digest already sent for this date');
    return true;
  }

  let runId = existingRun?.id;
  if (!runId) {
    const claim = db.prepare(`
      INSERT INTO digest_runs (kind, team_id, run_date, status, started_at)
      VALUES ('daily_digest', ?, ?, 'running', datetime('now'))
    `).run(teamId, dateStr);
    runId = Number(claim.lastInsertRowid);
  } else {
    db.prepare(`UPDATE digest_runs SET status = 'running', attempts = attempts + 1 WHERE id = ?`).run(runId);
  }

  try {
    const data = getTeamDigestData(teamId, dateStr);
    const { html, text, subject } = renderDigestEmail(data);

    // Separate recipients into TO (team members) and CC (leads, admins, and extra stakeholders)
    const teamUsers = db.prepare(`SELECT email, role, name FROM users WHERE team_id = ? AND is_active = 1`).all(teamId) as Array<{ email: string; role: string; name: string }>;
    const team = db.prepare('SELECT extra_digest_recipients FROM teams WHERE id = ?').get(teamId) as unknown as { extra_digest_recipients: string };
    const extra: string[] = JSON.parse(team.extra_digest_recipients || '[]');

    const memberUsers = teamUsers.filter(u => u.role === 'member');
    const leadUsers = teamUsers.filter(u => u.role === 'lead' || u.role === 'admin');

    const toList = memberUsers.length > 0 ? memberUsers.map(u => u.email) : teamUsers.map(u => u.email);
    const ccList = Array.from(new Set([
      ...(memberUsers.length > 0 ? leadUsers.map(u => u.email) : []),
      ...extra
    ]));

    const totalRecipients = Array.from(new Set([...toList, ...ccList]));

    if (totalRecipients.length === 0) {
      db.prepare(`UPDATE digest_runs SET status = 'skipped', finished_at = datetime('now') WHERE id = ?`).run(runId);
      return true;
    }

    await sendEmail({
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      subject,
      html,
      text
    });

    db.prepare(`
      UPDATE digest_runs
      SET status = 'sent', recipients = ?, finished_at = datetime('now'), error = NULL
      WHERE id = ?
    `).run(totalRecipients.length, runId);

    logger.info({ teamId, dateStr, recipientsCount: totalRecipients.length }, 'Daily digest successfully dispatched');
    return true;
  } catch (err: any) {
    db.prepare(`
      UPDATE digest_runs
      SET status = 'failed', error = ?, finished_at = datetime('now')
      WHERE id = ?
    `).run(err.message, runId);
    logger.error({ err: err.message, teamId, dateStr }, 'Failed to dispatch daily digest');
    throw err;
  }
}
