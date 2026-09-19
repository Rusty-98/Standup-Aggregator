# SyncPulse — Product Requirements Document
**Version 1.0** · **Status:** Ready to build · **Stack:** Vite (React + TS) · Express · SQLite · Docker (single container)

This PRD is the build contract. The companion UI/UX spec governs visual and interaction decisions; this document governs scope, data, APIs, jobs, and delivery. Where the two disagree, the UI spec wins on appearance and this document wins on behaviour.

---

## 0. One-Paragraph Summary
SyncPulse replaces the daily standup meeting with a written one. Every working day each employee writes three things — what they did yesterday, what they are doing today, and whether they are blocked. At 20:00 the system compiles every submission for the team into one formatted email and sends it, reproducing what people wrote verbatim. Anyone who did not submit appears in that email as *Not submitted*; anyone on a recorded leave appears as *On leave*, with dates. Each person can look back at their own last 7 days at any time.

---

## 1. Goals and Non-Goals

### Goals
| # | Goal | Measured by |
|---|------|-------------|
| **G1** | Submitting takes under 60 seconds on a phone | p75 time from screen open to submit < 60s |
| **G2** | The 20:00 digest is complete and on time, every working day | ≥ 99% of runs dispatched within 60s of 20:00 |
| **G3** | A reader finds every blocker without scrolling the whole email | Blockers appear above all other content |
| **G4** | Nobody is wrongly listed as missing | 0 reports of a person on leave shown as *Not submitted* |
| **G5** | Daily participation stays high | ≥ 85% of expected submissions on any given day |

### Non-Goals (v1)
* No AI summarising, rewriting, or scoring of anyone's update. The email prints what was typed verbatim.
* No threads, comments, reactions, or replies inside SyncPulse.
* No task/Jira/GitHub integration, no time tracking, no performance metrics or leaderboards.
* No native mobile apps. Responsive web only (PWA is a nice-to-have, not v1).
* No SSO/SAML in v1.

---

## 2. Users and Roles
| Role | Who | Can do |
|------|-----|--------|
| **Member** | Every employee | Submit and edit own standup until cutoff; view own last 7 days; record own leave; view the team page and receive the digest |
| **Lead** | Team lead / manager | Everything a member can, plus: nudge a member, preview and test-send the digest, export `.xlsx`, record leave on behalf of a team member |
| **Admin** | Ops / IT | Everything a lead can, across all teams, plus: manage users and teams, set holidays and the digest recipient list, re-run a failed job |

Roles are a single column on `users`. No custom permissions, no per-resource ACLs.

---

## 3. Core Concepts
* **Organisation timezone**: The whole product runs on one timezone, set by `ORG_TIMEZONE` (default `Asia/Kolkata`). "Today", "20:00", and the day boundary are all evaluated in it.
* **Standup date**: A `YYYY-MM-DD` date string, never a timestamp. One standup row per user per standup date. Day rolls over at 00:00 org time.
* **Working day**: Monday–Friday, minus any date in the `holidays` table. On non-working days: no standup is expected, no nudges are sent, and no digest runs.
* **Submission window**: 00:00 → 20:00 org time on a working day. Before submit the entry is a draft and autosaves. After submit it is submitted and stays editable until 20:00. At 20:00 the entry is frozen and read-only forever.
* **Expected submitter**: An active user who is not on leave on that standup date. Only expected submitters can appear as *Not submitted*.
* **Verbatim rule**: No stage of the pipeline alters a user's words — no truncation, no auto-capitalisation, no summarisation. Sanitisation strips unsafe markup only.

---

## 4. Feature Requirements

### F1 — Passwordless Email Sign-In (P0)
* User enters their work email. Domain must match `ALLOWED_EMAIL_DOMAINS`, else shows *"That domain isn't set up for SyncPulse."*
* 6-digit numeric code emailed. Valid 10 minutes, single use, max 5 verify attempts, max 3 code requests per email per 15 minutes.
* On success, a signed HTTP-only session cookie is set. *"Stay signed in for 30 days"* extends session TTL from 12 hours to 30 days.
* Account must already exist (created by admin or CSV import). Sign-in never creates a user. Unknown but domain-valid emails get the same "code sent" response to prevent user enumeration.
* Deep links (from nudge/reminder emails) preserve destination through sign-in.

### F2 — Today: The Submission Screen (P0)
Three fields in fixed order:
1. **Yesterday**: Rich text, bullet list by default. (Optional: first day or genuinely nothing).
2. **Today**: Rich text task list — each item has a checkbox. (Required: at least one item).
3. **Blockers**: Off by default. Toggle on reveals rich text + severity (`low` | `medium` | `critical`) + optional teammate picker `blocked_on_user_id`. (Optional).

* **Carry-over**: On open, Today is pre-filled with the unchecked items from the user's previous standup's Today list. Each carried item is tagged *carried over* and can be removed in one tap.
* **Critical blockers**: Surface on the team page immediately upon submit rather than waiting for 20:00.
* **Autosave**: Draft PUT on an 800ms debounce and on blur. Footer shows *"Saved 2m ago"*. Offline: stores draft in IndexedDB and flushes on reconnect (*"Saved on this device · will sync"*).
* **Submit**: `Cmd/Ctrl + Enter` or sticky footer button. Collapses to summary card with an Edit button until 20:00.

### F3 — My Last 7 Days (P0)
* Rolling window of the last 7 calendar days ending today.
* Strip of 7 day cells: weekday, date, status dot, and counts (e.g. *4 planned · 1 blocker*). Scroll-snap carousel on mobile; 7 columns on desktop.
* Day status: `submitted` · `not submitted` · `on leave` · `holiday` · `weekend`. Selecting expands read-only view.

### F4 — Team Page (P0)
* Transparent to every role.
* Header: `18 of 22 submitted · 2 on leave · 2 not submitted · 3 blockers`.
* Fixed feed ordering: **Critical blockers → Other blockers → Submitted → Not submitted → On leave**.
* Date picker for past working days; future dates disabled.
* Filters: Search by name, squad/team select, "Blockers only", "Not submitted".
* Nudge button (lead/admin): Sends one-click reminder email (rate limited: 1/person/day).

### F5 — Leave / Out-of-Office (P0)
* Self-serve recording or lead/admin recording on behalf of member.
* Fields: `start_date`, `end_date` (inclusive), `type` (`leave` | `sick` | `holiday` | `travel` | `other`), optional `note`.
* Automatically excludes user from expected submitters and reminders; shown under *On leave* with date range in the 20:00 digest. Overlaps rejected with 409.
* Submitting while on leave displays as submitted with a muted *"submitted while on leave"* tag.

### F6 — The 20:00 Team Digest Email (P0)
* Fires once per team per working day at 20:00 org time to all active members + `extra_digest_recipients`.
* **Anatomy**:
  1. Header: Team name, `Standup · Tue 12 Mar`, summary counts line.
  2. Blockers: Callout box listing every blocker (critical first, person name, who can unblock, blocker text). Omitted if no blockers.
  3. Updates: Per-person block with submit time, Yesterday list, Today list (`✓` checked, `·` unchecked). Verbatim.
  4. Not submitted: Comma-separated names. Omitted if empty.
  5. On leave: Names with date ranges. Omitted if empty.
  6. Footer: Link to team page for that date.
* Idempotent via `(team_id, run_date, kind)` unique constraint in `digest_runs`.
* SMTP failure retry with exponential backoff (1m, 5m, 15m), alerts admins. Preview & test-send endpoints.

### F7 — Friday Personal Weekly Recap (P1)
* Sent at 18:00 on the last working day of the week to each active user.
* Mon–Fri verbatim entries, totals, blockers raised, and items carried over 3+ days and never checked off.

### F8 — Nudges and Reminders (P1)
* Morning prompt (09:30): To expected submitters with no entry yet.
* Cutoff reminder (19:15): To expected submitters still unsubmitted.
* Mute preference in user `notification_prefs` (digest itself cannot be muted).

### F9 — Excel Export (P1)
* `GET /api/export.xlsx?from=&to=&teamId=` streams workbook built with `exceljs`.
* Columns: Date, Name, Email, Team, Status, Yesterday, Today, Blockers, Has blocker, Severity, Submitted at.

### F10 — Admin (P1)
* User management (add, deactivate, change role/team, CSV import).
* Team management & extra digest recipients.
* Holiday calendar CRUD.
* Job run history (last 30 runs) and manual "Run now" trigger.

---

## 5. Rich Text Rules
* **Formatting yes, media no**: basic text formatting only; no images, files, videos, tables, or headings.
* **Editor**: Tiptap (ProseMirror) with allowlisted extensions: Document, Paragraph, Text, Bold, Italic, Strike, Code, BulletList, OrderedList, ListItem, TaskList, TaskItem, Link, History, Placeholder.
* **Storage**: `*_html` (sanitised canonical HTML) and `*_text` (server-derived plaintext projection).
* **Sanitisation**: `sanitize-html` strictly enforced server-side.

---

## 6. Data Model (SQLite)
```sql
CREATE TABLE teams (
  id                      INTEGER PRIMARY KEY,
  name                    TEXT NOT NULL,
  slug                    TEXT NOT NULL UNIQUE,
  extra_digest_recipients TEXT NOT NULL DEFAULT '[]',
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id                 INTEGER PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name               TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','lead','admin')),
  team_id            INTEGER REFERENCES teams(id),
  is_active          INTEGER NOT NULL DEFAULT 1,
  notification_prefs TEXT NOT NULL DEFAULT '{"morning":true,"cutoff":true}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE standups (
  id                  INTEGER PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  team_id             INTEGER NOT NULL REFERENCES teams(id),
  standup_date        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
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
CREATE INDEX idx_standups_team_date ON standups(team_id, standup_date);
CREATE INDEX idx_standups_user_date ON standups(user_id, standup_date DESC);

CREATE TABLE leaves (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'leave' CHECK (type IN ('leave','sick','holiday','travel','other')),
  note        TEXT NOT NULL DEFAULT '',
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_leaves_user_range ON leaves(user_id, start_date, end_date);

CREATE TABLE holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE auth_codes (
  id          INTEGER PRIMARY KEY,
  email       TEXT NOT NULL COLLATE NOCASE,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auth_codes_email ON auth_codes(email, created_at DESC);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  token_hash   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  user_agent   TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE digest_runs (
  id           INTEGER PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('daily_digest','weekly_recap','morning','cutoff')),
  team_id      INTEGER REFERENCES teams(id),
  run_date     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','sent','failed','skipped')),
  recipients   INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at  TEXT,
  UNIQUE (kind, team_id, run_date)
);
```

---

## 7. Architecture & Stack
* **Client**: React 18 + Vite + TypeScript, React Router, TanStack Query, Tiptap, Lucide Icons, tokens CSS.
* **Server**: Node.js + Express 4 + TypeScript, `better-sqlite3` (WAL mode), `zod`, `pino`, `nodemailer`, `exceljs`, `sanitize-html`, `node-cron`.
* **Container**: Single Docker container with multi-stage Alpine build, mounted `/data` volume for SQLite, `tini` entrypoint.
