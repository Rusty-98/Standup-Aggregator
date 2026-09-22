import { describe, it, expect } from 'vitest';
import {
  friendlyError,
  leaveTypeLabel,
  severityLabel,
  standupStatusLabel,
  jobStatusLabel,
  jobStatusBadgeClass
} from './labels.js';
import { formatDisplayDate, formatHumanTime, formatSubmittedClock, addDays } from './dateUtils.js';
import { htmlHasContent } from './htmlContent.js';

describe('labels', () => {
  it('maps standup statuses to human copy', () => {
    expect(standupStatusLabel('submitted')).toBe('Submitted');
    expect(standupStatusLabel('missing')).toBe('Missing');
    expect(standupStatusLabel('on_leave')).toBe('On leave');
    expect(standupStatusLabel('not submitted')).toBe('Not submitted');
  });

  it('maps leave types and severities', () => {
    expect(leaveTypeLabel('sick')).toBe('Sick');
    expect(leaveTypeLabel('holiday')).toBe('Holiday');
    expect(severityLabel('critical')).toBe('Critical');
    expect(severityLabel('medium')).toBe('Medium');
  });

  it('maps job statuses to badge classes', () => {
    expect(jobStatusLabel('sent')).toBe('Sent');
    expect(jobStatusBadgeClass('failed')).toContain('badge-danger');
    expect(jobStatusBadgeClass('skipped')).toContain('badge-warning');
  });

  it('maps rate-limit and smtp failures to next steps', () => {
    expect(friendlyError(new Error('Too many requests / rate limit'))).toMatch(/Wait a few minutes/i);
    expect(friendlyError(new Error('SMTP connection failed'))).toMatch(/mail/i);
    expect(friendlyError(new Error('500 Internal Server Error'))).toMatch(/Try again/i);
    expect(friendlyError(new Error('Name is required'))).toBe('Name is required');
  });
});

describe('htmlHasContent', () => {
  it('rejects empty task-list shells', () => {
    expect(htmlHasContent('<ul data-type="taskList"><li data-type="taskItem"><p></p></li></ul>')).toBe(false);
    expect(htmlHasContent('<p></p>')).toBe(false);
    expect(htmlHasContent('<p>&nbsp;</p>')).toBe(false);
  });

  it('accepts visible text', () => {
    expect(htmlHasContent('<p>Ship the fix</p>')).toBe(true);
    expect(htmlHasContent('<ul data-type="taskList"><li><p>Do work</p></li></ul>')).toBe(true);
  });
});

describe('dateUtils', () => {
  it('formats display dates and clocks', () => {
    expect(formatDisplayDate('2026-09-22')).toMatch(/Sep/);
    expect(formatSubmittedClock('2026-09-22 19:30:00')).toBe('19:30');
    expect(addDays('2026-09-22', 1)).toBe('2026-09-23');
  });

  it('formats human times with timezone abbrev', () => {
    const out = formatHumanTime('20:00', 'Asia/Kolkata');
    expect(out).toMatch(/8:00\s*PM/i);
    expect(out.length).toBeGreaterThan(5);
  });
});
