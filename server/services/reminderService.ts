import { db } from '../db/client.js';
import { sendEmail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';
import { isWorkingDay } from '../lib/dates.js';
import { isUserOnLeave } from './leaveService.js';
import { fillTemplate, presetOrStored, TEMPLATE_PRESETS } from '../lib/messageTemplates.js';
import { postTeamWebhook } from './webhookService.js';

const MAX_ATTEMPTS = 3;

export async function sendTeamReminder(teamId: number, dateStr: string, force: boolean = false): Promise<number> {
  if (!isWorkingDay(dateStr) && !force) return 0;

  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  if (!team) return 0;

  const existing = db.prepare(`
    SELECT * FROM digest_runs WHERE kind = 'morning' AND team_id = ? AND run_date = ?
  `).get(teamId, dateStr) as { id: number; status: string; attempts: number } | undefined;

  if (existing && (existing.status === 'sent' || existing.status === 'skipped') && !force) return 0;
  if (existing && existing.status === 'failed' && existing.attempts >= MAX_ATTEMPTS && !force) return 0;

  let runId = existing?.id;
  if (!runId) {
    const claim = db.prepare(`
      INSERT INTO digest_runs (kind, team_id, run_date, status, started_at)
      VALUES ('morning', ?, ?, 'running', datetime('now'))
    `).run(teamId, dateStr);
    runId = Number(claim.lastInsertRowid);
  } else {
    db.prepare(`UPDATE digest_runs SET status = 'running', attempts = attempts + 1 WHERE id = ?`).run(runId);
  }

  try {
    const users = db.prepare(`
      SELECT * FROM users WHERE team_id = ? AND is_active = 1 AND role = 'member'
    `).all(teamId) as any[];

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const time = team.reminder_morning_time || '09:30';
    const template = presetOrStored(team.reminder_template, TEMPLATE_PRESETS.short.reminder);
    let dispatched = 0;

    for (const u of users) {
      if (isUserOnLeave(u.id, dateStr)) continue;
      const submitted = db.prepare(`
        SELECT id FROM standups WHERE user_id = ? AND standup_date = ? AND status = 'submitted'
      `).get(u.id, dateStr);
      if (submitted) continue;

      const text = fillTemplate(template, {
        name: u.name,
        team: team.name,
        date: dateStr,
        time,
        link: `${appUrl}/today`
      });
      const safe = text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
      await sendEmail({
        to: u.email,
        subject: `${team.name} standup reminder`,
        html: `<p>${safe.replace(/\n/g, '<br>')}</p>`,
        text
      });
      dispatched++;
    }

    const hookText = fillTemplate(template, {
      name: team.name,
      team: team.name,
      date: dateStr,
      time,
      link: `${appUrl}/today`
    });
    try {
      await postTeamWebhook(team.webhook_url, hookText);
    } catch (hookErr: any) {
      logger.error({ teamId, err: hookErr.message }, 'Reminder webhook failed');
    }

    db.prepare(`
      UPDATE digest_runs SET status = 'sent', recipients = ?, finished_at = datetime('now'), error = NULL WHERE id = ?
    `).run(dispatched, runId);
    return dispatched;
  } catch (err: any) {
    db.prepare(`
      UPDATE digest_runs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?
    `).run(err.message, runId);
    logger.error({ teamId, err: err.message }, 'Reminder run failed');
    throw err;
  }
}
