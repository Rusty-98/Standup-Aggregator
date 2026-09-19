export function renderReminderEmail({
  type,
  userName,
  cutoffTime,
  submitUrl
}: {
  type: 'morning' | 'cutoff' | 'nudge';
  userName: string;
  cutoffTime: string;
  submitUrl: string;
}): { html: string; text: string; subject: string } {
  let title = 'Daily Standup Reminder';
  let subject = `Reminder: Submit today's standup by ${cutoffTime}`;
  let message = `Hi ${userName}, please take a moment to submit your standup for today before the ${cutoffTime} cutoff.`;

  if (type === 'morning') {
    title = 'Good morning · Daily Standup';
    subject = `Good morning: Daily standup is open (cutoff ${cutoffTime})`;
    message = `Hi ${userName}, the standup window is open. Share your progress from yesterday, your goals for today, and any blockers.`;
  } else if (type === 'cutoff') {
    title = 'Final Reminder · Cutoff Approaching';
    subject = `Final reminder: Standup cutoff at ${cutoffTime}`;
    message = `Hi ${userName}, the daily team digest will be sent at ${cutoffTime}. Submit your update now to be included.`;
  } else if (type === 'nudge') {
    title = 'Standup Nudge from Team Lead';
    subject = `Nudge: Please submit your daily standup`;
    message = `Hi ${userName}, your team lead has sent you a quick reminder to submit your daily standup.`;
  }

  const text = `${title}\n\n${message}\n\nSubmit here: ${submitUrl}\n`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FBFBFA; color: #17191C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #FFFFFF; border: 1px solid #E4E4E2; border-radius: 8px; padding: 32px;" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #17191C;">${title}</h2>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #6B6F76;">${message}</p>
              
              <div style="margin-bottom: 24px;">
                <a href="${submitUrl}" style="display: inline-block; background-color: #2C5CE0; color: #FFFFFF; text-decoration: none; padding: 10px 20px; font-size: 13px; font-weight: 500; border-radius: 6px;">Submit standup</a>
              </div>
              
              <p style="margin: 0; font-size: 12px; color: #8B9099;">Automated notification from SyncPulse.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { html, text, subject };
}
