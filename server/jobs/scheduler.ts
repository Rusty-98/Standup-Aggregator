import cron from 'node-cron';
import { db } from '../db/client.js';
import { sendDailyDigest } from '../services/digestService.js';
import { sendTeamReminder } from '../services/reminderService.js';
import { getOrgDate, getOrgTime, isWorkingDay, isTimePastOrEqual, ORG_TIMEZONE, DIGEST_TIME } from '../lib/dates.js';
import { logger } from '../lib/logger.js';

export function startScheduler() {
  if (process.env.ENABLE_CRON !== 'true') {
    logger.info('Background scheduler disabled via ENABLE_CRON=false');
    return;
  }

  const defaultDigest = process.env.DIGEST_TIME || DIGEST_TIME || '20:00';
  const workDays = process.env.WORK_DAYS?.trim() || '1,2,3,4,5';

  logger.info({
    timezone: ORG_TIMEZONE,
    workDays,
    defaultDigest
  }, 'Starting Dailies digest scheduler (catch-up ticker)');

  cron.schedule('* * * * *', async () => {
    const dateStr = getOrgDate();
    const timeStr = getOrgTime();

    if (!isWorkingDay(dateStr)) {
      return;
    }

    const teams = db.prepare(`
      SELECT id, name,
             coalesce(reminder_morning_time, '09:30') as reminder_time,
             coalesce(digest_time, ?) as digest_time
      FROM teams
    `).all(defaultDigest) as Array<{ id: number; name: string; reminder_time: string; digest_time: string }>;

    for (const team of teams) {
      if (isTimePastOrEqual(timeStr, team.reminder_time)) {
        try {
          await sendTeamReminder(team.id, dateStr);
        } catch (err: any) {
          logger.error({ teamId: team.id, err: err.message }, 'Scheduled reminder error');
        }
      }

      if (!isTimePastOrEqual(timeStr, team.digest_time)) {
        continue;
      }

      try {
        await sendDailyDigest(team.id, dateStr);
      } catch (err: any) {
        logger.error({ teamId: team.id, err: err.message }, 'Scheduled daily digest error');
      }
    }
  }, { timezone: ORG_TIMEZONE });

  cron.schedule('0 3 * * *', () => {
    logger.info('Running nightly cleanup job');
    db.prepare(`DELETE FROM auth_codes WHERE expires_at < datetime('now')`).run();
    db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
  });
}
