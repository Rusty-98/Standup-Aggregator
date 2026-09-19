import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'syncpulse.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys as specified in PRD §7
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const candidates = [
    path.resolve(__dirname, 'migrations'),
    path.resolve(process.cwd(), 'server', 'db', 'migrations'),
    path.resolve(process.cwd(), 'db', 'migrations')
  ];

  let migrationsDir = candidates.find(d => fs.existsSync(d));
  if (!migrationsDir) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const isApplied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?');
  const recordMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const file of files) {
    const applied = isApplied.get(file);
    if (!applied) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      db.exec(sql);
      recordMigration.run(file);
      console.log(`[DB] Applied migration: ${file}`);
    }
  }
}
