export function renderOtpEmail(code: string): { html: string; text: string } {
  const text = `Your Dailies verification code is: ${code}\nThis code is valid for 10 minutes.\nIf you did not request this code, you can safely ignore this email.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Dailies verification code</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FBFBFA; color: #17191C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #FFFFFF; border: 1px solid #E4E4E2; border-radius: 8px; padding: 32px;" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #17191C;">Dailies Sign-in</h2>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #6B6F76;">Use this single-use code to sign in to your company account. The code expires in 10 minutes.</p>
              
              <div style="background-color: #F3F3F1; border: 1px solid #E4E4E2; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: ui-monospace, 'JetBrains Mono', Consolas, monospace; font-size: 28px; font-weight: 600; letter-spacing: 6px; color: #2C5CE0;">${code}</span>
              </div>
              
              <p style="margin: 0; font-size: 12px; color: #8B9099;">If you didn't request this code, no action is needed.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { html, text };
}
