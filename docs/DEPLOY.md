# Deploy

## Docker Compose

From the repo root, with a real `.env`:

```bash
cp .env.example .env
docker compose up -d --build
```

Set these in `.env` before the build matters for mail and sign-in:

```ini
APP_URL=https://your-host.example
SESSION_SECRET=replace-with-a-long-random-string
MAIL_FROM="Dailies <you@yourcompany.com>"
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@yourcompany.com
SMTP_PASS=your_app_password
ENABLE_CRON=true
ALLOWED_EMAIL_DOMAINS=yourcompany.com
ORG_TIMEZONE=Asia/Kolkata
ADMIN_EMAIL=you@yourcompany.com
```

`APP_URL` must be the origin users type in the browser. Writes from any other origin are rejected.

Compose always sets:

```ini
PORT=3000
NODE_ENV=production
DATABASE_PATH=/data/dailies.db
EXPORT_DIR=/data/exports
```

The database and nightly workbooks stay on the `dailies_data` volume. The image is Node 22. Migrations run when the process starts. The container listens on port 3000 and serves both the API and `client/dist`.

Health check calls `GET /healthz` with Node (Alpine does not include `wget`). Readiness is `GET /readyz`.

```bash
docker compose ps
docker compose logs -f app
```

MailHog is included for local inspection (`1025` SMTP, `8025` web UI). From inside the app container the host name is `mailhog`, not `localhost`:

```ini
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_SECURE=false
```

Leave `SMTP_USER` and `SMTP_PASS` empty for MailHog. For a real deploy, point SMTP at your relay and do not rely on MailHog.

Create the first admin before anyone else can sign up. On the host, with `ADMIN_EMAIL` set:

```bash
npm run seed
```

Or open `/admin` once while the database has no admin and complete the emailed code. That signup closes after the first admin exists. Inside a running container the same seed is:

```bash
docker compose exec app node server/dist/server/db/seeds/001_demo_seed.js
```

## Production checklist

- Node **22**
- `ENABLE_CRON=true` (exact string)
- `MAIL_FROM` set. OTP, reminder, and digest all use SMTP
- `SESSION_SECRET` replaced. The value in `.env.example` is only a sample
- `APP_URL` equals the public origin, including `https://`
- `EXPORT_DIR=/data/exports` so workbooks survive a recreate
- `TEST_EMAIL_OVERRIDE_TO` unset
- Webhook URLs entered in `/admin` as `https://` only

## Manual Node host

```bash
npm install
npm install --prefix client
npm install --prefix server
npm run build
node server/dist/server/index.js
```

Run that from the repo root so `client/dist` and `server/db/migrations` resolve. Put `DATABASE_PATH` on a persistent disk. Use `NODE_ENV=production` so the session cookie is marked Secure.
