# Setup

## Prerequisites

- **Node.js 22** (`node -v`). The server uses built-in `node:sqlite`, not `better-sqlite3`
- **npm** 9+
- **Git**

## Install

```bash
git clone https://github.com/Rusty-98/Standup-Aggregator.git
cd Standup-Aggregator
npm install
npm install --prefix client
npm install --prefix server
```

## Environment

```bash
cp .env.example .env
```

Minimum local values:

```ini
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:5173
ORG_TIMEZONE=Asia/Kolkata
ADMIN_EMAIL=you@yourcompany.com
MAIL_FROM="Dailies <you@yourcompany.com>"
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@yourcompany.com
SMTP_PASS=your_app_password
ENABLE_CRON=true
ALLOWED_EMAIL_DOMAINS=yourcompany.com
```

Use `APP_URL=http://localhost:5173` when you develop with Vite, because the browser origin is the Vite port. `http://localhost:3000` is also accepted. See [ENV.md](./ENV.md).

## Seed

```bash
npm run seed
```

Creates `dailies.db`, the default Engineering team, and an admin from `ADMIN_EMAIL` if no admin exists. It does not create demo members. Add submitters from `/admin`.

You can skip `ADMIN_EMAIL` and create the first admin in the browser at `/admin` instead. That path closes after one admin exists.

## Run

```bash
npm run dev
```

- Client: http://localhost:5173 (Vite proxies `/api` to the server)
- Server: http://localhost:3000

Production build, from the repo root:

```bash
npm run build
npm start
```

That serves the API and the built client on port 3000.

## Tests

```bash
npm test
```

See [TESTING.md](./TESTING.md) for what is covered.

## SMTP

- Use an app password for Gmail or Microsoft, not the normal account password.
- Prefer port **587** with `SMTP_SECURE=false` (STARTTLS).
- The sign-in code is emailed. If it never arrives, check `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and spam.
- `server/scripts/testSmtpConnection.ts` can check the SMTP settings without sending a standup.

```bash
npx --prefix server tsx scripts/testSmtpConnection.ts
```
