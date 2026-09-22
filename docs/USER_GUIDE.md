# User guide

Sign in with your work email, submit a daily update, check the team table, and review your last 7 days. Use the sun/moon control in the navbar to switch light and dark themes; the choice is saved in the browser.

## Sign in

1. Open the app. `/admin` is only for the person who sets up the team.
2. Enter your work email and continue.
3. Enter the 6-digit code from email. It lasts about 10 minutes. You can **Resend code** or **Use a different email**.
4. Optionally keep the session for 30 days.

An admin must add you by name and email before a normal sign-in works. The invite link opens `/today`.

If you sign in from the admin link and you are not an admin, you land on `/today`.

## Today (`/today`)

Write:

1. **Yesterday** — optional
2. **Today** — required (empty checklists do not count)
3. **Blockers** — optional. Set severity, and a teammate if you are waiting on someone

Unfinished checklist items from the last submitted day can show as carry-over chips until you submit. Removing a chip asks for confirmation.

The navbar counts down to digest lock time (with your org timezone). After that, today’s update is locked.

Submit with the button or **Ctrl+Enter** (⌘+Enter on Mac). While submitting, the button stays disabled.

Click a past day on the strip to view that day’s standup. Return to today to edit again. **Cancel** while editing restores the submitted snapshot.

If you are on leave, Today says so. You can still submit if you want.

Before digest time, if you have not submitted, you may get one reminder email. People who already submitted, and people on leave, do not get that mail.

## Team (`/team`)

A table for your team on a chosen date: name, status, yesterday, today, blockers. Search by name. **Copy for email** pastes digest HTML suitable for Outlook or Gmail.

Status and blocker severity use plain labels (Submitted, Missing, On leave, Critical, …). Missing people show in the table. There is no separate nudge button.

## Recap (`/recap`)

Your last 7 calendar days, including empty days. If the server has `OPENAI_API_KEY`, a short summary of **your** week can appear; if generation fails, use **Retry**. An empty week points you back to `/today`.

## Leave (`/leave`)

Record your own time off (admins can record for teammates). The digest and the reminder then treat you as on leave instead of missing. Deleting a leave record asks for confirmation.
