import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Smoke: migrations apply and digest eligibility reads the same tables the scheduler uses.
 * Uses a throwaway SQLite file so the developer DB is untouched.
 */
const tmpDb = path.join(os.tmpdir(), `dailies-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = tmpDb;
process.env.ORG_TIMEZONE = 'Asia/Kolkata';
process.env.WORK_DAYS = '1,2,3,4,5';

const { runMigrations, db } = await import('../db/client.js');
const { getDigestEligibility } = await import('../services/digestService.js');
const { isWorkingDay } = await import('../lib/dates.js');

describe('db + digest wiring', () => {
  it('applies migrations and evaluates eligibility from standups', () => {
    runMigrations();

    db.prepare(`
      INSERT INTO teams (name, slug, digest_time, reminder_morning_time)
      VALUES ('Test Team', 'test-team', '20:00', '09:30')
    `).run();
    const team = db.prepare('SELECT id FROM teams WHERE slug = ?').get('test-team') as { id: number };

    db.prepare(`
      INSERT INTO users (email, name, role, team_id, is_active)
      VALUES
        ('a@example.com', 'A', 'member', ?, 1),
        ('b@example.com', 'B', 'member', ?, 1)
    `).run(team.id, team.id);

    const users = db.prepare('SELECT id FROM users WHERE team_id = ? ORDER BY id').all(team.id) as Array<{ id: number }>;
    const dateStr = '2026-09-22';

    let elig = getDigestEligibility(team.id, dateStr);
    assert.equal(elig.activeMemberCount, 2);
    assert.equal(elig.needed, 2);
    assert.equal(elig.eligible, false);

    db.prepare(`
      INSERT INTO standups (user_id, team_id, standup_date, status, today_html, today_text)
      VALUES (?, ?, ?, 'submitted', '<p>x</p>', 'x')
    `).run(users[0].id, team.id, dateStr);

    elig = getDigestEligibility(team.id, dateStr);
    assert.equal(elig.submittedCount, 1);
    assert.equal(elig.eligible, false);

    db.prepare(`
      INSERT INTO standups (user_id, team_id, standup_date, status, today_html, today_text)
      VALUES (?, ?, ?, 'submitted', '<p>y</p>', 'y')
    `).run(users[1].id, team.id, dateStr);

    elig = getDigestEligibility(team.id, dateStr);
    assert.equal(elig.submittedCount, 2);
    assert.equal(elig.eligible, true);
  });

  it('treats holidays as non-working days', () => {
    runMigrations();
    const holiday = '2026-09-21'; // Monday
    db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)').run(holiday, 'Test');
    assert.equal(isWorkingDay(holiday), false);
  });
});

describe('cleanup', () => {
  it('removes the temp database', () => {
    try {
      db.close?.();
    } catch {
      /* ignore */
    }
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const p = tmpDb + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    assert.ok(true);
  });
});
