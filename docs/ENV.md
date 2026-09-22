# Environment variables

Configure a root `.env` (see `.env.example`). The server also reads `server/.env` if that file is the one it finds first.

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3000` | No | Express listen port |
| `NODE_ENV` | `development` | No | `production` sets the session cookie `Secure` |
| `APP_URL` | `http://localhost:3000` | Yes | Public origin used in email links. Browser `Origin` on writes must match this, or local dev ports 5173 and 3000 |
| `DATABASE_PATH` | `./dailies.db` | No | SQLite file. Docker Compose sets `/data/dailies.db` |
| `SESSION_SECRET` | fallback string in code | Yes in production | Long random value. Do not keep the example secret |
| `ORG_TIMEZONE` | `Asia/Kolkata` | No | IANA zone for dates, cutoff, and cron |
| `DIGEST_TIME` | `20:00` | No | Default digest clock. Each team can override it in `/admin` |
| `WORK_DAYS` | `1,2,3,4,5` | No | Comma-separated weekdays. Sunday is `0`. Use `1,2,3,4,5`, not `1-5` |
| `ALLOWED_EMAIL_DOMAINS` | from `.env.example` | Yes | Domains that may request an OTP. `*` allows every domain |
| `SMTP_HOST` | `localhost` | Yes to send mail | SMTP hostname. Inside Compose, MailHog is `mailhog`, not `localhost` |
| `SMTP_PORT` | `1025` | Yes to send mail | `587` for STARTTLS, `1025` for MailHog |
| `SMTP_SECURE` | `false` | No | `true` only for port 465 |
| `SMTP_USER` | — | For real SMTP | Username. Leave empty for MailHog |
| `SMTP_PASS` | — | For real SMTP | Password or app password |
| `MAIL_FROM` | `Dailies <SMTP_USER>` | Yes | From header. The name is `MAIL_FROM`, not `SMTP_FROM` |
| `ENABLE_CRON` | off unless `true` | Production: yes | The exact string `true` starts reminder and digest jobs |
| `ADMIN_EMAIL` | — | No | `npm run seed` creates this admin if none exists |
| `OPENAI_API_KEY` | — | No | Enables Recap analysis |
| `OPENAI_MODEL` | `gpt-4o-mini` | No | Model for that analysis |
| `EXPORT_DIR` | `./exports`, or `/data/exports` in production | No | Nightly xlsx after a successful digest. Compose sets `/data/exports` |
| `LOG_LEVEL` | `info` | No | Pino level |
| `REMINDER_MORNING_TIME` | `09:30` | No | Fallback shown when a team row has no reminder time. The live clock is the team field |
| `TEST_EMAIL_OVERRIDE_TO` | — | No | Replaces digest To. Unset this in production |
| `TEST_EMAIL_OVERRIDE_CC` | — | No | Replaces digest Cc when the To override is set |

There is no `TEAMS_WEBHOOK_URL` environment variable. Each team’s webhook is saved in `/admin` and must start with `https://`.

OTP codes are emailed. They are not printed as a login path. Reminder time, digest time, and message templates are columns on `teams`, not env vars.
