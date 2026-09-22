export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
}

export function getOrgTimezone(): string {
  if (typeof localStorage === 'undefined') return 'Asia/Kolkata';
  return localStorage.getItem('dailies_org_tz') || 'Asia/Kolkata';
}

export function getOrgToday(timeZone: string = getOrgTimezone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function formatSubmittedClock(submittedAt: string | null | undefined): string {
  if (!submittedAt) return '';
  const match = submittedAt.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function formatHumanTime(hhmm: string, timeZone: string = getOrgTimezone()): string {
  const match = hhmm?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return hhmm || '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const probe = new Date(Date.UTC(2024, 0, 1, hour, minute));
  const clock = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  }).format(probe);
  const tz = timezoneAbbrev(timeZone);
  return tz ? `${clock} ${tz}` : clock;
}

export function timezoneAbbrev(timeZone: string = getOrgTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short'
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || timeZone;
  } catch {
    return timeZone;
  }
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}
