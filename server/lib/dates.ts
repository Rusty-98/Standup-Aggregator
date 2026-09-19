import { db } from '../db/client.js';

export const ORG_TIMEZONE = process.env.ORG_TIMEZONE || 'Asia/Kolkata';
export const DIGEST_TIME = process.env.DIGEST_TIME || '20:00';

export function getOrgDateParts(d: Date = new Date()): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  // Weekday index (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = days.indexOf(partMap['weekday']);

  return {
    year: parseInt(partMap['year'], 10),
    month: parseInt(partMap['month'], 10),
    day: parseInt(partMap['day'], 10),
    hour: parseInt(partMap['hour'], 10),
    minute: parseInt(partMap['minute'], 10),
    weekday
  };
}

export function getOrgDate(d: Date = new Date()): string {
  const { year, month, day } = getOrgDateParts(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getOrgTime(d: Date = new Date()): string {
  const { hour, minute } = getOrgDateParts(d);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isPastCutoff(cutoff: string = DIGEST_TIME): boolean {
  const currentTime = getOrgTime();
  return currentTime >= cutoff;
}

export function isWorkingDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = dt.getUTCDay(); // 0 = Sun, 6 = Sat

  // Weekend check
  if (day === 0 || day === 6) return false;

  // Holiday check
  const holiday = db.prepare('SELECT date FROM holidays WHERE date = ?').get(dateStr);
  return !holiday;
}

export function getPreviousWorkingDay(dateStr: string): string {
  let [y, m, d] = dateStr.split('-').map(Number);
  let dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  for (let i = 0; i < 14; i++) {
    dt.setUTCDate(dt.getUTCDate() - 1);
    const prevDateStr = dt.toISOString().slice(0, 10);
    if (isWorkingDay(prevDateStr)) {
      return prevDateStr;
    }
  }
  return dateStr;
}
