import { db } from '../db/client.js';
import { renderDigestEmail, DigestEmailData } from '../emails/digestEmail.js';
import { sendEmail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';
import { isWorkingDay, formatOrgClock } from '../lib/dates.js';
import { computeDigestEligibility } from '../lib/digestEligibility.js';
import { archiveTeamStandupExcel } from './excelArchiveService.js';
import { fillTemplate, presetOrStored, TEMPLATE_PRESETS } from '../lib/messageTemplates.js';
import { postTeamWebhook } from './webhookService.js';

const MAX_DIGEST_ATTEMPTS = 3;

export function getTeamDigestData(teamId: number, dateStr: string): DigestEmailData {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as unknown as { id: number; name: string; extra_digest_recipients: string } | undefined;
  if (!team) throw new Error('Team not found');

  const users = db.prepare(`
    SELECT * FROM users
    WHERE team_id = ? AND is_active = 1
    ORDER BY name ASC
  `).all(teamId) as Array<{ id: number; name: string; email: string; role: string }>;

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

  const blockers: DigestEmailData['blockers'] = [];
  const updates: DigestEmailData['updates'] = [];
  const notSubmittedNames: string[] = [];
  const onLeave: DigestEmailData['onLeave'] = [];

  for (const u of users) {
    const standup = standupMap.get(u.id);
    const leave = leaveMap.get(u.id);

    if (standup) {
      updates.push({
        name: u.name,
        submittedAtTime: formatOrgClock(standup.submitted_at),
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
    } else if (u.role !== 'admin') {
      notSubmittedNames.push(u.name);
    }
  }

  blockers.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return a.name.localeCompare(b.name);
  });

  const submitters = users.filter(u => u.role !== 'admin');
  const total = submitters.length;
  const submittedCount = updates.length;
  const onLeaveCount = onLeave.length;
  const notSubmittedCount = notSubmittedNames.length;
  const blockerCount = blockers.length;

  const summaryLine = `${submittedCount} of ${total} submitted · ${onLeaveCount} on leave · ${notSubmittedCount} not submitted · ${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`;

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

export function getDigestEligibility(teamId: number, dateStr: string): {
  activeMemberCount: number;
  submittedCount: number;
  needed: number;
  eligible: boolean;
} {
  const activeMemberCount = (db.prepare(`
    SELECT COUNT(*) as count FROM users
    WHERE team_id = ? AND is_active = 1 AND role = 'member'
  `).get(teamId) as { count: number }).count;

  const submittedCount = (db.prepare(`
    SELECT COUNT(*) as count
    FROM standups s
    JOIN users u ON u.id = s.user_id
    WHERE s.team_id = ? AND s.standup_date = ? AND s.status = 'submitted' AND u.role = 'member'
  `).get(teamId, dateStr) as { count: number }).count;

  const { needed, eligible } = computeDigestEligibility(activeMemberCount, submittedCount);
  return {
    activeMemberCount,
    submittedCount,
    needed,
    eligible
  };
}

function markDigestRun(
  runId: number,
  status: 'sent' | 'failed' | 'skipped',
  extra: { recipients?: number; error?: string | null } = {}
) {
  db.prepare(`
    UPDATE digest_runs
    SET status = ?, recipients = ?, error = ?, finished_at = datetime('now')
    WHERE id = ?
  `).run(status, extra.recipients ?? 0, extra.error ?? null, runId);
}

export async function sendDailyDigest(teamId: number, dateStr: string, force: boolean = false): Promise<boolean> {
  if (!isWorkingDay(dateStr) && !force) {
    logger.info({ dateStr }, 'Skipping daily digest — non-working day');
    return false;
  }

  const existingRun = db.prepare(`
    SELECT * FROM digest_runs
    WHERE kind = 'daily_digest' AND team_id = ? AND run_date = ?
  `).get(teamId, dateStr) as { id: number; status: string; attempts: number } | undefined;

  if (existingRun && (existingRun.status === 'sent' || existingRun.status === 'skipped') && !force) {
    logger.info({ teamId, dateStr, status: existingRun.status }, 'Daily digest already finished for this date');
    return existingRun.status === 'sent';
  }

  if (existingRun && existingRun.status === 'failed' && existingRun.attempts >= MAX_DIGEST_ATTEMPTS && !force) {
    logger.error({ teamId, dateStr, attempts: existingRun.attempts }, 'Daily digest failed too many times; not retrying');
    return false;
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

  const eligibility = getDigestEligibility(teamId, dateStr);
  if (!force && !eligibility.eligible) {
    const reason = `Skipped: ${eligibility.submittedCount} of ${eligibility.needed} required member update(s) submitted (likely a quiet/holiday day)`;
    markDigestRun(runId, 'skipped', { error: reason });
    logger.info({ teamId, dateStr, ...eligibility }, reason);
    return false;
  }

  try {
    const data = getTeamDigestData(teamId, dateStr);
    const { html, text, subject } = renderDigestEmail(data);

    const teamUsers = db.prepare(`SELECT email, role, name FROM users WHERE team_id = ? AND is_active = 1`).all(teamId) as Array<{ email: string; role: string; name: string }>;
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;

    let extra: string[] = [];
    try {
      extra = JSON.parse(team.extra_digest_recipients || '[]');
    } catch {
      extra = [];
    }

    const submitters = teamUsers.filter(u => u.role === 'member');
    const toSet = new Set(submitters.map(u => u.email.toLowerCase()));
    const toList = submitters.map(u => u.email);
    const ccList = Array.from(new Set(
      extra.map(e => e.trim().toLowerCase()).filter(e => e && !toSet.has(e))
    ));

    const testOverrideTo = process.env.TEST_EMAIL_OVERRIDE_TO?.trim();
    const testOverrideCc = process.env.TEST_EMAIL_OVERRIDE_CC?.trim();

    let finalTo = toList;
    let finalCc: string[] | undefined = ccList.length > 0 ? ccList : undefined;

    if (testOverrideTo) {
      finalTo = [testOverrideTo];
      finalCc = testOverrideCc ? [testOverrideCc] : undefined;
      logger.info({ testOverrideTo, testOverrideCc }, 'Using test email overrides for daily digest');
    }

    const totalRecipients = Array.from(new Set([...finalTo, ...(finalCc || [])]));

    if (totalRecipients.length === 0) {
      markDigestRun(runId, 'skipped', { error: 'No digest recipients' });
      return true;
    }

    await sendEmail({
      to: finalTo,
      cc: finalCc,
      subject,
      html,
      text
    });

    const digestText = fillTemplate(
      presetOrStored(team.digest_template, TEMPLATE_PRESETS.standard.digest),
      {
        name: team.name,
        team: team.name,
        date: dateStr,
        time: team.digest_time || '',
        link: data.teamPageUrl
      }
    );
    try {
      await postTeamWebhook(team.webhook_url, digestText);
    } catch (hookErr: any) {
      logger.error({ teamId, err: hookErr.message }, 'Digest webhook failed');
    }

    markDigestRun(runId, 'sent', { recipients: totalRecipients.length });
    logger.info({ teamId, dateStr, recipientsCount: totalRecipients.length }, 'Daily digest successfully dispatched');

    try {
      await archiveTeamStandupExcel(teamId, dateStr);
    } catch (archiveErr: any) {
      logger.error({ teamId, dateStr, err: archiveErr.message }, 'Failed to write nightly Excel archive');
    }

    return true;
  } catch (err: any) {
    markDigestRun(runId, 'failed', { error: err.message });
    logger.error({ err: err.message, teamId, dateStr }, 'Failed to dispatch daily digest');
    throw err;
  }
}
