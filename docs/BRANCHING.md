# Branching and releases

Dailies uses a three-branch production workflow.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Production. Stable code only. Prefer tagged releases. |
| `test` | Staging / QA. What you promote when a release candidate is ready. |
| `dev` | Integration for ongoing development. Default working branch. |

## Daily development

```bash
git checkout dev
git pull origin dev
git checkout -b feature/short-description
# …work…
npm test
git push -u origin HEAD
# Open a PR: feature/* → dev
```

Small solo fixes may land as commits directly on `dev`. Prefer PRs when more than one person is involved or the change is risky.

## Promoting a release

1. Ensure `dev` is green: `npm test` (and a local smoke of sign-in, Today submit, Admin save).
2. Merge `dev` into `test` (PR preferred).

   ```bash
   git checkout test
   git pull
   git merge --no-ff dev
   git push origin test
   ```

3. Deploy or run against staging from `test`. Fix issues on `dev`, then merge again into `test`.
4. When `test` is accepted, merge `test` into `main` and deploy production.

   ```bash
   git checkout main
   git pull
   git merge --no-ff test
   git tag -a v1.x.x -m "Release v1.x.x"
   git push origin main --tags
   ```

5. Merge `main` back into `dev` if you tagged hotfixes on `main`, so history stays aligned.

## Code freeze on `main`

- No feature work on `main`.
- Only merges from `test` (or emergency hotfixes that are immediately backported).
- After each production merge, leave `main` alone until the next verified `test` promotion.

## Hotfix

```bash
git checkout main
git checkout -b hotfix/describe-fix
# …fix + npm test…
# PR → main, deploy
git checkout dev
git merge main   # or cherry-pick the hotfix commit(s)
git checkout test
git merge main
```

## CI expectations

Before merging into `dev`, `test`, or `main`:

- `npm test` must pass
- Do not commit `.env` or secrets
- Migrations in `server/db/migrations` must remain forward-compatible for existing databases
