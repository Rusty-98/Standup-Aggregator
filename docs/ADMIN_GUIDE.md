# Admin guide

Send the setup person **`{APP_URL}/admin`**. Members use `/today`, `/team`, `/recap`, and `/leave`. If a member opens `/admin`, they are sent to `/today`.

Schedule times in the console show the org timezone abbreviation (from `ORG_TIMEZONE`). Destructive actions (deactivate, delete holiday, run digest, template presets) ask for confirmation. Field saves show Saving / Saved / error without remounting the whole page.

## Roles

| | Member | Admin |
|---|---|---|
| Submit updates | Yes | Optional |
| Team / recap / leave | Yes | Yes |
| `/admin` console | No | Yes |
| Digest **To** | Yes, if an active member | No, unless also an active member |
| Excel export, test send, run digest | No | Yes |

## First admin

Two ways, and only while no active admin exists:

1. Set `ADMIN_EMAIL` and run `npm run seed`.
2. Open `/admin`, request a code, and verify it. That account becomes the admin. Signup on this URL then closes.

Add later admins with **Make admin**. The last remaining admin cannot be demoted or deactivated.

## Team setup

Each team card is one calm stack:

1. **Name** and **digest time** when you create the team (default digest `20:00` in `ORG_TIMEZONE`).
2. **Reminder time** (default `09:30`). This is the only reminder clock.
3. **Digest time**.
4. **Teams webhook**. Leave blank or paste an `https://` incoming webhook. `http://` is rejected.
5. **Message templates.** Confirm before applying Short, Standard, or Blockers first, then edit the reminder text and the digest webhook text. Placeholders: `{{name}}` `{{team}}` `{{date}}` `{{time}}` `{{link}}`.
6. **Members.** Add member is name + email. They are digest **To**. The invite link is `/today`.
7. **Digest Cc.** Pick members and/or type extra emails. Anyone already on To is dropped from Cc.

The webhook URL is stored in SQLite and returned only on admin APIs. Job history shows team **names** and human status badges (Sent / Failed / Skipped). Email preview is a light layout (digest emails are light even in dark UI).

## What gets sent

On working days (`WORK_DAYS`, minus holidays), after the clocks below. The job checks every minute, so it does not need the exact second.

- **Reminder time:** email members who have not submitted and are not on leave. Also post the reminder text to the webhook.
- **Digest time:** one digest email. It is skipped unless at least `min(2, active member count)` members submitted. A one-person team sends if that person submitted. Quiet days show as `skipped` in job history. After the email, the digest template is posted to the webhook.

A webhook error does not cancel the email. Failed mail retries up to 3 times.

**Run digest now** needs a selected team and a confirmation. **Test send** goes only to you; Run/Test stay disabled while a job is pending.

## Holidays

Add org holidays so both the reminder and the digest skip those dates. A quiet weekday with too few submissions still skips the digest even without a holiday row. Deleting a holiday asks for confirmation.

## Excel export

Download a workbook for a date range from `/admin`. This is admin-only. There is no export preset on `/team`. A successful digest also writes `{slug}-{date}.xlsx` under `EXPORT_DIR` (in Docker, `/data/exports`).
