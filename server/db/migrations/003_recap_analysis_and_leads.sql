-- Migrate leftover team-lead accounts to members (two-role product: member + admin)
UPDATE users SET role = 'member' WHERE role = 'lead';

CREATE TABLE IF NOT EXISTS recap_analysis (
  user_id INTEGER NOT NULL REFERENCES users(id),
  as_of_date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  shipped TEXT NOT NULL DEFAULT '',
  blockers TEXT NOT NULL DEFAULT '',
  unfinished TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, as_of_date)
);
