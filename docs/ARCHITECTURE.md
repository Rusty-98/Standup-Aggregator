# Architecture

## Layout

```
client/     React 18 + Vite + TypeScript SPA
server/     Express API, cron jobs, emails, SQLite
shared/     Shared TypeScript types
docs/       Guides
```

## Stack

| Layer | Choice |
|---|---|
| Client | React 18, Vite, TypeScript |
| Server | Node 22, Express, TypeScript |
| Database | SQLite via `node:sqlite` (`DatabaseSync`) |
| Email | Nodemailer (`MAIL_FROM`) |
| Scheduler | node-cron, one catch-up tick per minute when `ENABLE_CRON=true` |
| Export | ExcelJS |
| HTTP hardening | Helmet, origin check, OTP rate limit |

## Roles

Two roles: **member** and **admin**. Members submit standups and are digest **To**. Admins use `/admin`. An admin is not on digest To unless they are also an active member of the team.

The first admin can be created from `/admin` only when `users` has zero active admins. `GET /api/auth/bootstrap` returns `{ open: true }` in that case. The OTP is stored with `auth_codes.purpose = 'bootstrap'`, and verify inserts `role = 'admin'` with `team_id` null. After that, bootstrap stays closed. More admins are added with **Make admin**. The last active admin cannot be demoted or deactivated.

A signed-in member who opens `/admin` is sent to `/today`.

## Client routes

| Path | Who | Purpose |
|---|---|---|
| `/signin` | Anyone | Email OTP sign-in (resend / change email) |
| `/today` | Signed-in | Daily standup editor |
| `/team` | Signed-in | Team table for a date + copy for email |
| `/recap` | Signed-in | Last 7 calendar days + optional AI analysis |
| `/leave` | Signed-in | Personal leave records |
| `/admin` | Admin only | Team setup, members, templates, holidays, jobs, Excel |

Shared UI: design tokens in `client/src/styles/tokens.css` (light/dark via `data-theme`), plus `Toast`, `Modal` / `ConfirmDialog`, and `EmptyState` under `client/src/components/ui/`. Human labels for statuses live in `client/src/lib/labels.ts`.

## API routes

Mounted from `server/index.ts`:

| Prefix | File | Main endpoints |
|---|---|---|
| `/api/auth` | `routes/auth.ts` | `GET /bootstrap`, `POST /request-code`, `POST /verify-code`, `POST /logout`, `GET /me` |
| `/api/me` | `index.ts` | Session profile (also `/api/auth/me`). Team fields do not include the webhook |
| `/api/standups` | `routes/standups.ts` | `GET /today`, `GET /mine`, `GET\|PUT /:date`, `POST /:date/submit` |
| `/api/team` and `/api/digest` | `routes/team.ts` | `GET /:date`, `GET /:date/preview`, `POST /:date/test-send` (admin) |
| `/api/leave` | `routes/leave.ts` | `GET /`, `POST /`, `DELETE /:id` |
| `/api/recap` | `routes/recap.ts` | `GET /week`, `POST /analysis` |
| `/api/export.xlsx` | `routes/export.ts` | Admin blob download |
| `/api/admin` | `routes/admin.ts` | Teams, members, templates, webhook, holidays, jobs. Requires `admin` |
| `/healthz`, `/readyz` | `index.ts` | Liveness, and readiness (`SELECT 1`) |

## Security

- Session cookie `dailies_session` is httpOnly, `SameSite=lax`, and `Secure` when `NODE_ENV=production`. The server loads the session row. The client does not send a role that is trusted.
- OTP codes are random, bcrypt-hashed, and not put in the subject line or logs. Request and verify are limited to 10 calls per 15 minutes per IP, and to 3 codes per email per 15 minutes.
- `POST`, `PUT`, `PATCH`, and `DELETE` with an `Origin` header must match `APP_URL` or local dev (`localhost` / `127.0.0.1` on ports 5173 and 3000). A missing `Origin` is allowed.
- Helmet is enabled. Content-Security-Policy is off so the SPA can load.
- Admin writes are checked with Zod. A webhook URL must be empty or start with `https://`.
- Member APIs never select `teams.webhook_url`.

## When messages go out

Scheduler: every minute, org timezone, only if `ENABLE_CRON` is the string `true`. Non-working days (outside `WORK_DAYS`, plus `holidays`) are skipped.

**Reminder** (`digest_runs.kind = 'morning'`), once the clock is at or past `reminder_morning_time`:

- Email each active member who has not submitted that day and is not on leave.
- Post the reminder template to the team webhook when a URL is set.
- A webhook failure is logged and does not fail the email run.
- Retries up to 3 times if the run is `failed`.

**Digest** (`kind = 'daily_digest'`), once the clock is at or past `digest_time`:

- Sends only if `submittedCount >= min(2, active member count)`. A one-person team sends if that member submitted. Otherwise the run is `skipped`.
- **To** = active members. **Cc** = `extra_digest_recipients`, excluding anyone already on To.
- After a successful email, post `digest_template` to the webhook if a URL is set.
- Failed SMTP retries up to 3 times on later minutes.
- A successful send also writes an xlsx under `EXPORT_DIR`.
- `submitted_at` is the org-timezone wall clock from `getOrgDateTime()`.

Templates support `{{name}}`, `{{team}}`, `{{date}}`, `{{time}}`, and `{{link}}`. Empty stored text falls back to the built-in Short reminder or Standard digest.

`TEST_EMAIL_OVERRIDE_TO` replaces digest recipients. Leave it unset in production.

## Recap

`GET /api/recap/week` returns the signed-in user's last 7 calendar days. `POST /api/recap/analysis` calls OpenAI when `OPENAI_API_KEY` is set (default model `gpt-4o-mini`) and caches the result in `recap_analysis`. It only uses that user's standups.

## SQLite tables

| Table | Role |
|---|---|
| `teams` | Name, slug, `digest_time`, `reminder_morning_time`, `webhook_url`, `reminder_template`, `digest_template`, `extra_digest_recipients` |
| `users` | Email, name, role (`member` / `admin`), team, active flag |
| `standups` | Per-user daily draft or submitted content and blockers |
| `leaves` | Date ranges for time off |
| `holidays` | Org non-working dates |
| `auth_codes` | Hashed OTP codes and `purpose` (`login` or `bootstrap`) |
| `sessions` | Server-side sessions |
| `digest_runs` | Reminder and digest history (`sent` / `failed` / `skipped`) |
| `recap_analysis` | Cached AI recap per user and day |
| `_migrations` | Applied SQL file names |

Migrations live in `server/db/migrations` and run when the server starts.

## Tests

`npm test` runs server unit + SQLite wiring tests and client Vitest suites for labels, HTML emptiness, and date helpers. See [TESTING.md](./TESTING.md).
