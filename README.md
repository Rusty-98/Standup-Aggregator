# Dailies

Dailies is an async daily standup app. Members submit Yesterday / Today / Blockers. Admins set up the team, reminder, and digest from `/admin`. On working days the server emails a reminder to people who have not submitted, then sends one digest after cutoff if enough people updated.

## Features

- Email OTP sign-in. The first admin can be created from `/admin` only while no admin exists
- Daily standup with Yesterday / Today / Blockers and carry-over of unfinished tasks
- Team table for a chosen date (submitted, missing, on leave), with **Copy for email**
- One reminder at the team reminder time, and one digest at the team digest time
- Digest **To** is active members. **Digest Cc** is extra addresses, with To people removed
- Optional HTTPS Teams webhook per team, with editable reminder and digest text
- Personal last-7-days **Recap**. Optional OpenAI analysis when `OPENAI_API_KEY` is set
- Leave tracking so digests list people as on leave instead of missing
- Admin console for teams, members, templates, holidays, a manual digest run, and Excel download
- Light and dark themes (saved in the browser), with shared form and toast UI

## Branches (production workflow)

We use three long-lived branches. Day-to-day work happens on **`dev`**, not on `main`.

| Branch | Role | Who merges here |
|---|---|---|
| **`main`** | Production / stable. Deploy from here. Treat as **code freeze** except for verified releases. | Only from `test` after QA |
| **`test`** | Staging / release candidate. Run full checks and UAT here before production. | From `dev` when a batch is ready |
| **`dev`** | Active development. Feature work and fixes land here first. | Feature branches → `dev` |

**Flow**

```text
feature/*  →  dev  →  test  →  main (production)
```

1. Create a feature branch from `dev` (optional but preferred for larger changes).
2. Open a PR into `dev`. Keep `npm test` green.
3. When a release batch is ready, merge `dev` → `test`. Deploy or smoke-test against staging.
4. When `test` is verified, merge `test` → `main` and tag/deploy production.
5. Hotfixes: branch from `main`, merge back to `main`, then cherry-pick or merge into `dev` and `test` so they stay aligned.

**Do not** commit unfinished work directly to `main`. After cloning:

```bash
git checkout dev
git pull
```

Details: [docs/BRANCHING.md](./docs/BRANCHING.md).

## Quick start

```bash
git clone https://github.com/Rusty-98/Standup-Aggregator.git
cd Standup-Aggregator
git checkout dev
npm install
npm install --prefix client
npm install --prefix server
cp .env.example .env
```

Set at least `ADMIN_EMAIL` and `MAIL_FROM` (plus SMTP) in `.env`, then:

```bash
npm run seed
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3000
- Admin: http://localhost:5173/admin

If you skip `ADMIN_EMAIL`, open `/admin` while the database has no admin and create that account with the emailed code. After one admin exists, signup on that URL stays closed.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Client (Vite) and server (`tsx watch`) together |
| `npm run build` | Build the client and compile the server |
| `npm start` | Run the production server (`server/dist/server/index.js`) |
| `npm run seed` | Apply migrations and create an admin from `ADMIN_EMAIL` if none exists |
| `npm test` | Client unit tests + server unit and DB wiring tests |

## Docs

- [Setup](./docs/SETUP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Environment variables](./docs/ENV.md)
- [User guide](./docs/USER_GUIDE.md)
- [Admin guide](./docs/ADMIN_GUIDE.md)
- [Deploy](./docs/DEPLOY.md)
- [Testing](./docs/TESTING.md)
- [Branching](./docs/BRANCHING.md)
