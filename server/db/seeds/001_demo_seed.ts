import { db, runMigrations } from '../client.js';

export function seedDemoData() {
  runMigrations();

  // Create Default Team
  const insertTeam = db.prepare(`
    INSERT OR IGNORE INTO teams (id, name, slug, extra_digest_recipients)
    VALUES (1, 'Engineering', 'engineering', '[]')
  `);
  insertTeam.run();

  // Seed Users
  const defaultRoster = [
    { name: 'Sumit Singh', email: 'sumit.singh@company.com', role: 'admin' },
    { name: 'Aishwarya Kokate', email: 'aishwarya.kokate@company.com', role: 'lead' },
    { name: 'Abhishek K', email: 'abhishek.k@company.com', role: 'member' },
    { name: 'Anusha Hadimani', email: 'anusha.hadimani@company.com', role: 'member' },
    { name: 'Anushka Gupta', email: 'anushka.gupta@company.com', role: 'member' },
    { name: 'Dhruba Seal', email: 'dhruba.seal@company.com', role: 'member' },
    { name: 'Eshwari S', email: 'eshwari.s@company.com', role: 'member' },
    { name: 'Komal Singh', email: 'komal.singh@company.com', role: 'member' },
    { name: 'Kusuma BR', email: 'kusuma.br@company.com', role: 'member' },
    { name: 'Manjunath KG', email: 'manjunath.kg@company.com', role: 'member' },
    { name: 'Nikhil Saini', email: 'nikhil.saini@company.com', role: 'member' },
    { name: 'Pooja TB', email: 'pooja.tb@company.com', role: 'member' },
    { name: 'Priyanka S', email: 'priyanka.s@company.com', role: 'member' },
    { name: 'Varun Methwani', email: 'varun.methwani@company.com', role: 'member' },
    { name: 'Vedant Patil', email: 'vedant.patil@company.com', role: 'member' }
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (email, name, role, team_id, is_active)
    VALUES (?, ?, ?, 1, 1)
  `);

  for (const u of defaultRoster) {
    insertUser.run(u.email, u.name, u.role);
  }

  // Seed sample holidays
  const insertHoliday = db.prepare(`
    INSERT OR IGNORE INTO holidays (date, name)
    VALUES (?, ?)
  `);

  const holidays = [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-12-25', name: 'Christmas Day' }
  ];

  for (const h of holidays) {
    insertHoliday.run(h.date, h.name);
  }

  console.log('[Seed] Database seeded with default engineering team, 15 users, and holidays.');
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('seed')) {
  seedDemoData();
}
