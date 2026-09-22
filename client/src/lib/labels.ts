export function titleCase(value: string): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function standupStatusLabel(status: string | null | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'submitted': return 'Submitted';
    case 'draft': return 'Draft';
    case 'missing': return 'Missing';
    case 'on_leave':
    case 'on leave':
    case 'leave': return 'On leave';
    case 'weekend': return 'Weekend';
    case 'holiday': return 'Holiday';
    case 'not submitted': return 'Not submitted';
    default: return titleCase(status || 'Unknown');
  }
}

export function leaveTypeLabel(type: string | null | undefined): string {
  switch ((type || '').toLowerCase()) {
    case 'leave': return 'Leave';
    case 'sick': return 'Sick';
    case 'vacation': return 'Vacation';
    case 'travel': return 'Travel';
    case 'holiday': return 'Holiday';
    case 'wfh': return 'Work from home';
    case 'other': return 'Other';
    default: return titleCase(type || 'Leave');
  }
}

export function severityLabel(severity: string | null | undefined): string {
  switch ((severity || '').toLowerCase()) {
    case 'low': return 'Low';
    case 'medium': return 'Medium';
    case 'high': return 'High';
    case 'critical': return 'Critical';
    default: return titleCase(severity || '');
  }
}

export function jobStatusLabel(status: string | null | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'sent': return 'Sent';
    case 'failed': return 'Failed';
    case 'skipped': return 'Skipped';
    case 'running': return 'Running';
    default: return titleCase(status || '');
  }
}

export function jobStatusBadgeClass(status: string | null | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'sent': return 'badge badge-ok';
    case 'failed': return 'badge badge-danger';
    case 'skipped': return 'badge badge-warning';
    case 'running': return 'badge badge-neutral';
    default: return 'badge badge-neutral';
  }
}

export function friendlyError(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const lower = message.toLowerCase();
  if (!message) return fallback;
  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (lower.includes('mail') || lower.includes('smtp')) {
    return 'Could not send email. Check your inbox later or ask an admin to verify mail settings.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network problem. Check your connection and try again.';
  }
  if (/^\d{3}\b/.test(message) || lower.includes('internal server') || lower.includes('stack')) {
    return fallback;
  }
  return message;
}
