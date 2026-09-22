# Testing

Run everything from the repo root:

```bash
npm install --prefix client
npm install --prefix server
npm test
```

Or separately:

```bash
npm run test:server
npm run test:client
```

## What is covered

### Server (`server/tests/`)

- **Unit** (`unit.test.ts`): digest quiet-day rule, HTTPS webhook guard, message template fill/presets, clock compare helpers, HTML sanitize
- **Wiring** (`wiring.test.ts`): migrations on a throwaway SQLite file, `getDigestEligibility` against real tables, holiday → non-working day

Uses Node’s built-in test runner via `tsx --test`. No extra test framework on the server.

### Client (`client/src/**/*.test.ts`)

- Human status / leave / severity / job labels and `friendlyError` mapping
- Today submit emptiness check (`htmlHasContent`)
- Date display and human time + timezone helpers

Uses Vitest (`vitest run`).

## Intentionally out of scope

- Full browser E2E (Playwright/Cypress)
- Live SMTP or OpenAI calls
- Cron tick timing against a real clock

Those stay as manual checks when you change mail, AI, or schedule behavior. See [Admin guide](./ADMIN_GUIDE.md) and [User guide](./USER_GUIDE.md).
