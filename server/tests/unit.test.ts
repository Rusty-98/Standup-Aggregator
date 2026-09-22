import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDigestEligibility } from '../lib/digestEligibility.js';
import { assertWebhook } from '../lib/webhook.js';
import { fillTemplate, presetOrStored, TEMPLATE_PRESETS } from '../lib/messageTemplates.js';
import { formatOrgClock, isTimePastOrEqual } from '../lib/dates.js';
import { sanitizeStandupHtml } from '../lib/sanitize.js';

describe('computeDigestEligibility', () => {
  it('needs 1 submit for a one-person team', () => {
    assert.deepEqual(computeDigestEligibility(1, 0), { needed: 1, eligible: false });
    assert.deepEqual(computeDigestEligibility(1, 1), { needed: 1, eligible: true });
  });

  it('needs 2 submits when the team has 2+ members', () => {
    assert.deepEqual(computeDigestEligibility(2, 1), { needed: 2, eligible: false });
    assert.deepEqual(computeDigestEligibility(5, 2), { needed: 2, eligible: true });
  });

  it('is never eligible with zero active members', () => {
    assert.deepEqual(computeDigestEligibility(0, 0), { needed: 0, eligible: false });
  });
});

describe('assertWebhook', () => {
  it('allows empty and https URLs', () => {
    assert.equal(assertWebhook(undefined), '');
    assert.equal(assertWebhook(''), '');
    assert.equal(assertWebhook('  '), '');
    assert.equal(assertWebhook('https://outlook.office.com/webhook/x'), 'https://outlook.office.com/webhook/x');
  });

  it('rejects http and other schemes', () => {
    assert.throws(() => assertWebhook('http://evil.example'), /https:\/\//);
    assert.throws(() => assertWebhook('ftp://x'), /https:\/\//);
  });
});

describe('messageTemplates', () => {
  it('fills known placeholders', () => {
    const out = fillTemplate('Hi {{name}} on {{team}} by {{time}} {{link}}', {
      name: 'Ada',
      team: 'Eng',
      time: '8:00 PM',
      link: 'https://app.example/today'
    });
    assert.equal(out, 'Hi Ada on Eng by 8:00 PM https://app.example/today');
  });

  it('falls back when stored template is blank', () => {
    assert.equal(presetOrStored('  ', 'fallback'), 'fallback');
    assert.equal(presetOrStored('custom', 'fallback'), 'custom');
  });

  it('exposes Short / Standard / Blockers presets', () => {
    assert.ok(TEMPLATE_PRESETS.short.reminder.includes('{{link}}'));
    assert.ok(TEMPLATE_PRESETS.standard.digest.includes('{{date}}'));
    assert.ok(TEMPLATE_PRESETS.blockers.reminder.toLowerCase().includes('blocked'));
  });
});

describe('dates helpers', () => {
  it('compares HH:MM lexicographically for past-or-equal', () => {
    assert.equal(isTimePastOrEqual('09:30', '09:30'), true);
    assert.equal(isTimePastOrEqual('09:31', '09:30'), true);
    assert.equal(isTimePastOrEqual('09:29', '09:30'), false);
  });

  it('extracts clock from org datetime strings', () => {
    assert.equal(formatOrgClock('2026-09-22 19:30:00'), '19:30');
    assert.equal(formatOrgClock(null), '—');
  });
});

describe('sanitizeStandupHtml', () => {
  it('keeps safe markup and strips scripts', () => {
    const { html, text } = sanitizeStandupHtml('<p>Hello <strong>world</strong></p><script>alert(1)</script>');
    assert.match(html, /Hello/);
    assert.doesNotMatch(html, /script/i);
    assert.equal(text.includes('Hello'), true);
  });

  it('forces safe link attributes', () => {
    const { html } = sanitizeStandupHtml('<a href="https://example.com">x</a>');
    assert.match(html, /rel="noopener noreferrer nofollow"/);
    assert.match(html, /target="_blank"/);
  });
});
