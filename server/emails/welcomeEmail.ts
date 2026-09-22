export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  teamName: string;
  role: 'member' | 'admin';
  cutoffTime: string;
  orgTimezone: string;
  loginUrl: string;
}

export function renderWelcomeEmail(data: WelcomeEmailData): { html: string; text: string; subject: string } {
  const subject = `Welcome to Dailies · ${data.teamName} Daily Standup`;

  const roleTitle = data.role === 'admin' ? 'Administrator' : 'Team Member';

  const text = `
Welcome to Dailies!

Hi ${data.userName},

You have been added as a ${roleTitle} to the ${data.teamName} team on Dailies for async daily standups.

HOW IT WORKS:
Dailies replaces long status meetings with a fast, 60-second written update. Every working day, you share:
1. Yesterday — What you accomplished or shipped
2. Today — Your key focus tasks with checkboxes
3. Blockers — Any roadblocks or help needed from teammates

DAILY CUTOFF:
Please submit your update before ${data.cutoffTime} (${data.orgTimezone}).
At cutoff, Dailies automatically compiles all team updates into one clean daily digest email for the entire team.

HOW TO LOG IN:
Dailies uses secure, passwordless authentication. Simply enter your work email (${data.userEmail}) on the login page to receive a 6-digit verification code.

Log in here: ${data.loginUrl}

Best regards,
Dailies Automated Standups
`.trim();

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: 'Segoe UI', Calibri, Arial, sans-serif !important;}
  </style>
  <![endif]-->
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #F8F9FA; color: #17191C; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="560">
        <tr>
        <td align="center" valign="top" width="560">
        <![endif]-->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E4E4E2; border-radius: 8px; text-align: left; overflow: hidden; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px 20px; background-color: #FAFAFA; border-bottom: 1px solid #EFEFEF; font-family: 'Segoe UI', Calibri, Arial, sans-serif;">
              <span style="display: inline-block; padding: 3px 8px; background-color: #EEF2FF; color: #3B5CCC; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 4px; margin-bottom: 8px;">
                Dailies Standup
              </span>
              <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #17191C; line-height: 1.3;">
                Welcome to the ${data.teamName} Team
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #6B6F76;">
                Role: <strong>${roleTitle}</strong> · Organization Timezone: <strong>${data.orgTimezone}</strong>
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 24px 32px 28px; font-family: 'Segoe UI', Calibri, Arial, sans-serif;">
              <p style="margin: 0 0 16px; font-size: 14.5px; line-height: 1.5; color: #17191C;">
                Hi <strong>${data.userName}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #4B515D;">
                You have been added to the <strong>${data.teamName}</strong> team on Dailies. Dailies replaces long status meetings with a fast, written standup that takes under 60 seconds each morning.
              </p>

              <!-- The 3 Questions Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FB; border: 1px solid #E5E7EB; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <div style="font-size: 13px; font-weight: bold; color: #17191C; margin-bottom: 10px;">
                      📝 What you'll share each working day:
                    </div>
                    <div style="font-size: 13px; line-height: 1.6; color: #374151;">
                      <div style="margin-bottom: 6px;"><strong>1. Yesterday:</strong> What you accomplished or shipped</div>
                      <div style="margin-bottom: 6px;"><strong>2. Today:</strong> Your key goals and tasks with checkboxes</div>
                      <div><strong>3. Blockers:</strong> Any roadblocks or teammates you need help from</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Cutoff & Digest Box -->
              <div style="font-size: 13.5px; line-height: 1.5; color: #4B515D; margin-bottom: 24px;">
                ⏰ <strong>Daily Cutoff:</strong> Submit your update before <strong>${data.cutoffTime}</strong>. At cutoff, the system compiles everyone's updates into a single formatted email digest sent to the entire team.
              </div>

              <!-- CTA Button -->
              <div style="margin-bottom: 24px; text-align: left;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${data.loginUrl}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="12%" stroke="f" fillcolor="#2C5CE0">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:'Segoe UI', Calibri, Arial,sans-serif;font-size:14px;font-weight:bold;">Log In to Dailies &rarr;</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${data.loginUrl}" style="display: inline-block; background-color: #2C5CE0; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 6px; -webkit-text-size-adjust: none;">
                  🚀 Log In to Dailies &rarr;
                </a>
                <!--<![endif]-->
              </div>

              <!-- Authentication hint -->
              <div style="padding-top: 18px; border-top: 1px solid #EFEFEF; font-size: 12.5px; line-height: 1.5; color: #6B6F76;">
                🔒 <strong>Passwordless Sign-In:</strong> Simply enter your email (<code>${data.userEmail}</code>) to receive a 6-digit verification code. No password creation required.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 14px 32px; background-color: #FAFAFA; border-top: 1px solid #EFEFEF; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11.5px; color: #8C9199; text-align: center;">
              Dailies Automated Async Standup System
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { html, text, subject };
}
