import { db } from '../db/client.js';
import { sanitizeStandupHtml } from '../lib/sanitize.js';
import { isPastCutoff, isWorkingDay, getOrgDate, getOrgDateTime, DIGEST_TIME } from '../lib/dates.js';
import { getUserLeaveForDate } from './leaveService.js';
import { CarryOverItem, Standup, DaySummary, DayStatus, BlockerSeverity } from '../../shared/types.js';

export function extractUncheckedItems(html: string): CarryOverItem[] {
  if (!html) return [];
  const items: CarryOverItem[] = [];

  // Match <li> tags with data-checked="false" or task items that aren't checked
  const regex = /<li[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  let idx = 1;
  while ((match = regex.exec(html)) !== null) {
    const rawContent = match[1].replace(/<[^>]+>/g, '').trim();
    if (rawContent) {
      items.push({
        id: `carry-${idx++}`,
        text: rawContent
      });
    }
  }

  // Fallback if standard <li> bullet list was used without data-checked attribute
  if (items.length === 0) {
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    while ((match = liRegex.exec(html)) !== null) {
      if (!match[0].includes('data-checked="true"')) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text && !text.startsWith('✓') && !text.startsWith('[x]')) {
          items.push({
            id: `carry-${idx++}`,
            text
          });
        }
      }
    }
  }

  return items;
}

export function getCarryOverItems(userId: number, currentDateStr: string): CarryOverItem[] {
  const prevStandup = db.prepare(`
    SELECT today_html FROM standups
    WHERE user_id = ? AND standup_date < ? AND status = 'submitted'
    ORDER BY standup_date DESC
    LIMIT 1
  `).get(userId, currentDateStr) as unknown as { today_html: string } | undefined;

  if (!prevStandup || !prevStandup.today_html) return [];
  return extractUncheckedItems(prevStandup.today_html);
}

export function getStandup(userId: number, dateStr: string): Standup | null {
  const row = db.prepare(`
    SELECT * FROM standups
    WHERE user_id = ? AND standup_date = ?
  `).get(userId, dateStr);

  return (row as unknown as Standup) || null;
}

export function saveStandupDraft(
  userId: number,
  teamId: number,
  dateStr: string,
  data: {
    yesterday_html?: string;
    today_html?: string;
    has_blockers?: boolean;
    blocker_html?: string;
    blocker_severity?: BlockerSeverity | null;
    blocked_on_user_id?: number | null;
  }
): Standup {
  const todayOrg = getOrgDate();

  // If editing today's entry past team cutoff, reject
  const team = db.prepare('SELECT digest_time FROM teams WHERE id = ?').get(teamId) as any;
  const cutoff = team?.digest_time || DIGEST_TIME;
  if (dateStr === todayOrg && isPastCutoff(cutoff)) {
    throw new Error(`Cutoff time (${cutoff}) has passed. Today’s standup is locked.`);
  }

  // Past dates cannot be edited
  if (dateStr < todayOrg) {
    throw new Error('Past standups cannot be edited.');
  }

  const yClean = sanitizeStandupHtml(data.yesterday_html || '');
  const tClean = sanitizeStandupHtml(data.today_html || '');
  const bClean = sanitizeStandupHtml(data.blocker_html || '');

  const hasBlockers = data.has_blockers ? 1 : 0;
  const severity = hasBlockers && data.blocker_severity ? data.blocker_severity : null;
  const blockedOn = hasBlockers && data.blocked_on_user_id ? data.blocked_on_user_id : null;

  const stmt = db.prepare(`
    INSERT INTO standups (
      user_id, team_id, standup_date, status,
      yesterday_html, yesterday_text,
      today_html, today_text,
      has_blockers, blocker_html, blocker_text,
      blocker_severity, blocked_on_user_id,
      updated_at
    ) VALUES (
      ?, ?, ?, 'draft',
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      datetime('now')
    )
    ON CONFLICT(user_id, standup_date) DO UPDATE SET
      yesterday_html = excluded.yesterday_html,
      yesterday_text = excluded.yesterday_text,
      today_html = excluded.today_html,
      today_text = excluded.today_text,
      has_blockers = excluded.has_blockers,
      blocker_html = excluded.blocker_html,
      blocker_text = excluded.blocker_text,
      blocker_severity = excluded.blocker_severity,
      blocked_on_user_id = excluded.blocked_on_user_id,
      updated_at = datetime('now')
  `);

  stmt.run(
    userId,
    teamId,
    dateStr,
    yClean.html,
    yClean.text,
    tClean.html,
    tClean.text,
    hasBlockers,
    bClean.html,
    bClean.text,
    severity,
    blockedOn
  );

  return getStandup(userId, dateStr)!;
}

export function submitStandup(
  userId: number,
  teamId: number,
  dateStr: string,
  data: {
    yesterday_html?: string;
    today_html: string;
    has_blockers?: boolean;
    blocker_html?: string;
    blocker_severity?: BlockerSeverity | null;
    blocked_on_user_id?: number | null;
  }
): Standup {
  const todayOrg = getOrgDate();
  const team = db.prepare('SELECT digest_time FROM teams WHERE id = ?').get(teamId) as any;
  const cutoff = team?.digest_time || DIGEST_TIME;
  if (dateStr === todayOrg && isPastCutoff(cutoff)) {
    throw new Error(`Cutoff time (${cutoff}) has passed. Submissions are now closed.`);
  }

  const tClean = sanitizeStandupHtml(data.today_html || '');
  if (!tClean.text || !tClean.text.trim()) {
    throw new Error('Today section requires at least one task.');
  }

  // Save draft values first
  saveStandupDraft(userId, teamId, dateStr, data);

  db.prepare(`
    UPDATE standups
    SET status = 'submitted', submitted_at = ?
    WHERE user_id = ? AND standup_date = ?
  `).run(getOrgDateTime(), userId, dateStr);

  return getStandup(userId, dateStr)!;
}

export function getRollingDays(userId: number, totalDays: number = 7): DaySummary[] {
  const summaries: DaySummary[] = [];
  const todayStr = getOrgDate();
  const [y, m, d] = todayStr.split('-').map(Number);
  const baseDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = totalDays - 1; i >= 0; i--) {
    const cur = new Date(baseDate);
    cur.setUTCDate(cur.getUTCDate() - i);
    const dateStr = cur.toISOString().slice(0, 10);
    const dayOfWeek = dayNames[cur.getUTCDay()];

    const standup = getStandup(userId, dateStr);
    const leave = getUserLeaveForDate(userId, dateStr);
    const isWeekend = cur.getUTCDay() === 0 || cur.getUTCDay() === 6;
    const isHoliday = !isWorkingDay(dateStr) && !isWeekend;

    let status: DayStatus = 'not submitted';
    if (isWeekend) {
      status = 'weekend';
    } else if (isHoliday) {
      status = 'holiday';
    } else if (leave) {
      status = 'on leave';
    } else if (standup && standup.status === 'submitted') {
      status = 'submitted';
    }

    // Counts from today_html
    let plannedCount = 0;
    let doneCount = 0;
    if (standup && standup.today_html) {
      plannedCount = (standup.today_html.match(/<li/g) || []).length;
      doneCount = (standup.today_html.match(/data-checked="true"/g) || []).length;
    }

    summaries.push({
      date: dateStr,
      dayOfWeek,
      status,
      plannedCount,
      doneCount,
      hasBlocker: !!standup && !!standup.has_blockers,
      standup,
      leaveInfo: leave ? { type: leave.type, note: leave.note } : null
    });
  }

  return summaries;
}
