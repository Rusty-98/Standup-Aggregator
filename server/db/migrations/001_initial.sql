-- 001_initial.sql: Initial Dailies Schema

CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id                      INTEGER PRIMARY KEY,
  name                    TEXT NOT NULL,
  slug                    TEXT NOT NULL UNIQUE,
  extra_digest_recipients TEXT NOT NULL DEFAULT '[]',
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name               TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'member'
                     CHECK (role IN ('member','lead','admin')),
  team_id            INTEGER REFERENCES teams(id),
  is_active          INTEGER NOT NULL DEFAULT 1,
  notification_prefs TEXT NOT NULL DEFAULT '{"morning":true,"cutoff":true}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS standups (
  id                  INTEGER PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  team_id             INTEGER NOT NULL REFERENCES teams(id),
  standup_date        TEXT NOT NULL,                    -- YYYY-MM-DD, org timezone
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','submitted')),
  yesterday_html      TEXT NOT NULL DEFAULT '',
  yesterday_text      TEXT NOT NULL DEFAULT '',
  today_html          TEXT NOT NULL DEFAULT '',
  today_text          TEXT NOT NULL DEFAULT '',
  has_blockers        INTEGER NOT NULL DEFAULT 0,
  blocker_html        TEXT NOT NULL DEFAULT '',
  blocker_text        TEXT NOT NULL DEFAULT '',
  blocker_severity    TEXT CHECK (blocker_severity IN ('low','medium','critical')),
  blocked_on_user_id  INTEGER REFERENCES users(id),
  submitted_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, standup_date)
);

CREATE INDEX IF NOT EXISTS idx_standups_team_date ON standups(team_id, standup_date);
CREATE INDEX IF NOT EXISTS idx_standups_user_date ON standups(user_id, standup_date DESC);

CREATE TABLE IF NOT EXISTS leaves (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,                            -- inclusive
  type        TEXT NOT NULL DEFAULT 'leave'
              CHECK (type IN ('leave','sick','holiday','travel','other')),
  note        TEXT NOT NULL DEFAULT '',
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leaves_user_range ON leaves(user_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS holidays (
  date TEXT PRIMARY KEY,                                -- YYYY-MM-DD
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id          INTEGER PRIMARY KEY,
  email       TEXT NOT NULL COLLATE NOCASE,
  code_hash   TEXT NOT NULL,                            -- bcrypt
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,                        -- uuid
  user_id      INTEGER NOT NULL REFERENCES users(id),
  token_hash   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  user_agent   TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS digest_runs (
  id           INTEGER PRIMARY KEY,
  kind         TEXT NOT NULL
               CHECK (kind IN ('daily_digest','weekly_recap','morning','cutoff')),
  team_id      INTEGER REFERENCES teams(id),
  run_date     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running'
               CHECK (status IN ('running','sent','failed','skipped')),
  recipients   INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at  TEXT,
  UNIQUE (kind, team_id, run_date)
);
