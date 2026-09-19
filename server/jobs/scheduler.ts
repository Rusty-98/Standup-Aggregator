import cron from 'node-cron';
import { db } from '../db/client.js';
import { sendDailyDigest } from '../services/digestService.js';
import { renderReminderEmail } from '../emails/reminderEmail.js';
import { sendEmail } from '../lib/mailer.js';
import { getOrgDate, isWorkingDay, ORG_TIMEZONE, DIGEST_TIME } from '../lib/dates.js';
import { isUserOnLeave } from '../services/leaveService.js';
import { logger } from '../lib/logger.js';

export function startScheduler() {
  if (process.env.ENABLE_CRON !== 'true') {
    logger.info('Background scheduler disabled via ENABLE_CRON=false');
    return;
  }

  logger.info({ timezone: ORG_TIMEZONE }, 'Starting SyncPulse background cron scheduler');

  // 1. Daily Digest at 20:00 Mon-Fri (0 20 * * 1-5)
  cron.schedule('0 20 * * 1-5', async () => {
    const todayStr = getOrgDate();
    logger.info({ todayStr }, 'Running 20:00 daily digest cron job');

    const teams = db.prepare('SELECT id FROM teams').all() as Array<{ id: number }>;
    for (const t of teams) {
      try {
        await sendDailyDigest(t.id, todayStr);
      } catch (err: any) {
        logger.error({ teamId: t.id, err: err.message }, 'Error in daily digest cron run');
      }
    }
  }, { timezone: ORG_TIMEZONE });

  // 2. Morning prompt at 09:30 Mon-Fri (30 9 * * 1-5)
  cron.schedule('30 9 * * 1-5', async () => {
    const todayStr = getOrgDate();
    if (!isWorkingDay(todayStr)) return;

    logger.info({ todayStr }, 'Running 09:30 morning prompt cron job');
    const users = db.prepare(`SELECT * FROM users WHERE is_active = 1`).all() as any[];
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    for (const u of users) {
      const prefs = JSON.parse(u.notification_prefs || '{}');
      if (prefs.morning === false) continue;
      if (isUserOnLeave(u.id, todayStr)) continue;

      // Check if already has entry
      const existing = db.prepare('SELECT id FROM standups WHERE user_id = ? AND standup_date = ?').get(u.id, todayStr);
      if (!existing) {
        const { html, text, subject } = renderReminderEmail({
          type: 'morning',
          userName: u.name,
          cutoffTime: DIGEST_TIME,
          submitUrl: `${appUrl}/today`
        });
        await sendEmail({ to: u.email, subject, html, text });
      }
    }
  }, { timezone: ORG_TIMEZONE });

  // 3. Cutoff reminder at 19:15 Mon-Fri (15 19 * * 1-5)
  cron.schedule('15 19 * * 1-5', async () => {
    const todayStr = getOrgDate();
    if (!isWorkingDay(todayStr)) return;

    logger.info({ todayStr }, 'Running 19:15 cutoff reminder cron job');
    const users = db.prepare(`SELECT * FROM users WHERE is_active = 1`).all() as any[];
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    for (const u of users) {
      const prefs = JSON.parse(u.notification_prefs || '{}');
      if (prefs.cutoff === false) continue;
      if (isUserOnLeave(u.id, todayStr)) continue;

      // Check if submitted
      const submitted = db.prepare(`SELECT id FROM standups WHERE user_id = ? AND standup_date = ? AND status = 'submitted'`).get(u.id, todayStr);
      if (!submitted) {
        const { html, text, subject } = renderReminderEmail({
          type: 'cutoff',
          userName: u.name,
          cutoffTime: DIGEST_TIME,
          submitUrl: `${appUrl}/today`
        });
        await sendEmail({ to: u.email, subject, html, text });
      }
    }
  }, { timezone: ORG_TIMEZONE });

  // 4. Nightly Cleanup at 03:00 (0 3 * * *)
  cron.schedule('0 3 * * *', () => {
    logger.info('Running nightly cleanup job');
    db.prepare(`DELETE FROM auth_codes WHERE expires_at < datetime('now')`).run();
    db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
  });
}
