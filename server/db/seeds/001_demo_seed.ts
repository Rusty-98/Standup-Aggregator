import { db, runMigrations } from '../client.js';

export function seedDemoData() {
  runMigrations();

  db.prepare(`
    INSERT OR IGNORE INTO teams (id, name, slug, extra_digest_recipients, reminder_morning_time, reminder_cutoff_time, digest_time)
    VALUES (1, 'Engineering', 'engineering', '[]', '09:30', '19:15', '20:00')
  `).run();

  db.prepare(`UPDATE users SET role = 'member' WHERE role = 'lead'`).run();

  const holidays = [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-12-25', name: 'Christmas Day' }
  ];

  const insertHoliday = db.prepare(`INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)`);
  for (const h of holidays) {
    insertHoliday.run(h.date, h.name);
  }

  const adminCount = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`).get() as { count: number }).count;
  if (adminCount === 0) {
    console.log('[Seed] No admin user exists yet. Create one in SQLite or use the first-run admin email in ADMIN_EMAIL.');
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail) as { id: number } | undefined;
      if (!existing) {
        db.prepare(`
          INSERT INTO users (email, name, role, team_id, is_active)
          VALUES (?, 'Admin', 'admin', 1, 1)
        `).run(adminEmail);
        console.log(`[Seed] Created admin from ADMIN_EMAIL: ${adminEmail}`);
      } else {
        db.prepare(`UPDATE users SET role = 'admin', is_active = 1 WHERE email = ?`).run(adminEmail);
        console.log(`[Seed] Promoted ADMIN_EMAIL to admin: ${adminEmail}`);
      }
    }
  }

  console.log('[Seed] Ready. Add submitters from the admin console. Seed does not create demo members.');
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('seed')) {
  seedDemoData();
}
