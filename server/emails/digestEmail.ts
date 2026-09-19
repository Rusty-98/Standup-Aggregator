export interface DigestEmailData {
  teamName: string;
  dateFormatted: string; // e.g., "Tue 12 Mar"
  summaryLine: string; // e.g., "18 of 22 submitted · 2 on leave · 2 not submitted · 3 blockers"
  toNames?: string[];
  ccNames?: string[];
  blockers: Array<{
    name: string;
    severity: 'low' | 'medium' | 'critical';
    blockedOnName?: string;
    text: string;
    html: string;
  }>;
  updates: Array<{
    name: string;
    submittedAtTime: string;
    yesterdayHtml: string;
    yesterdayText: string;
    todayHtml: string;
    todayText: string;
  }>;
  notSubmittedNames: string[];
  onLeave: Array<{
    name: string;
    dateRange: string;
  }>;
  teamPageUrl: string;
}

export function renderDigestEmail(data: DigestEmailData): { html: string; text: string; subject: string } {
  const hasBlockers = data.blockers.length > 0;
  const subject = hasBlockers
    ? `Standup · ${data.teamName} · ${data.dateFormatted} · ${data.blockers.length} blocker${data.blockers.length > 1 ? 's' : ''}`
    : `Standup · ${data.teamName} · ${data.dateFormatted}`;

  // Plaintext construction (clean and readable in Outlook plain-text mode)
  let text = `Subject: ${subject}\n`;
  if (data.toNames && data.toNames.length > 0) {
    text += `To: ${data.toNames.join(', ')}\n`;
  }
  if (data.ccNames && data.ccNames.length > 0) {
    text += `Cc: ${data.ccNames.join(', ')}\n`;
  }
  text += `\nStandup · ${data.teamName} · ${data.dateFormatted}\n`;
  text += `${data.summaryLine}\n\n`;

  if (hasBlockers) {
    text += `=== ACTIVE BLOCKERS ===\n\n`;
    for (const b of data.blockers) {
      const tag = b.severity === 'critical' ? '[CRITICAL BLOCKER]' : '[BLOCKER]';
      const unblock = b.blockedOnName ? ` (Waiting on: ${b.blockedOnName})` : '';
      text += `${tag} ${b.name}${unblock}:\n${b.text}\n\n`;
    }
  }

  if (data.updates.length > 0) {
    text += `=== TEAM UPDATES ===\n\n`;
    for (const u of data.updates) {
      text += `${u.name} (submitted at ${u.submittedAtTime})\n`;
      if (u.yesterdayText) {
        text += `Yesterday:\n${u.yesterdayText}\n`;
      }
      if (u.todayText) {
        text += `Today:\n${u.todayText}\n`;
      }
      text += `----------------------------------------\n\n`;
    }
  }

  if (data.notSubmittedNames.length > 0) {
    text += `Not submitted: ${data.notSubmittedNames.join(', ')}\n\n`;
  }

  if (data.onLeave.length > 0) {
    text += `On leave: ${data.onLeave.map(l => `${l.name} (${l.dateRange})`).join(', ')}\n\n`;
  }

  text += `View dashboard: ${data.teamPageUrl}\n`;

  // HTML construction (Microsoft Outlook Word-Engine Compliant)
  let htmlBlockers = '';
  if (hasBlockers) {
    htmlBlockers = `
      <tr>
        <td style="padding-bottom: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 1px solid #E4E4E2; border-radius: 6px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <tr>
              <td style="background-color: #F8F9FA; padding: 10px 14px; border-bottom: 1px solid #E4E4E2; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #17191C;">
                Active Blockers (${data.blockers.length})
              </td>
            </tr>
            ${data.blockers.map(b => {
              const isCrit = b.severity === 'critical';
              const borderColor = isCrit ? '#B5392F' : '#A56B15';
              const label = isCrit ? 'Critical' : 'Blocked';
              return `
                <tr>
                  <td style="border-left: 4px solid ${borderColor}; padding: 12px 14px; border-bottom: 1px solid #F0F0EE; font-family: 'Segoe UI', Calibri, Arial, sans-serif;">
                    <div style="font-size: 13px; font-weight: bold; margin-bottom: 4px; color: #17191C;">
                      <span style="display: inline-block; padding: 2px 6px; font-size: 10.5px; font-weight: bold; text-transform: uppercase; border: 1px solid ${borderColor}; color: ${borderColor}; border-radius: 3px; margin-right: 6px;">${label}</span>
                      ${b.name} ${b.blockedOnName ? `<span style="font-weight: normal; font-size: 12px; color: #6B6F76;">(Waiting on ${b.blockedOnName})</span>` : ''}
                    </div>
                    <div style="font-size: 13px; line-height: 1.5; color: #2C3138; margin-top: 4px;">
                      ${b.html || b.text}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </table>
        </td>
      </tr>
    `;
  }

  let htmlUpdates = '';
  if (data.updates.length > 0) {
    htmlUpdates = data.updates.map(u => `
      <tr>
        <td style="padding-bottom: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 1px solid #E4E4E2; border-radius: 6px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <tr>
              <td style="padding: 10px 14px; border-bottom: 1px solid #F0F0EE; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #17191C;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size: 13px; font-weight: bold; color: #17191C;">${u.name}</td>
                    <td align="right" style="font-size: 11px; font-family: Consolas, monospace; color: #8B9099;">${u.submittedAtTime}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 14px; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #17191C;">
                ${u.yesterdayHtml ? `
                  <div style="margin-bottom: 10px;">
                    <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #6B6F76; margin-bottom: 4px;">Yesterday</div>
                    <div>${u.yesterdayHtml}</div>
                  </div>
                ` : ''}
                ${u.todayHtml ? `
                  <div>
                    <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #6B6F76; margin-bottom: 4px;">Today</div>
                    <div>${u.todayHtml}</div>
                  </div>
                ` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join('');
  }

  let htmlNotSubmitted = '';
  if (data.notSubmittedNames.length > 0) {
    htmlNotSubmitted = `
      <tr>
        <td style="padding-bottom: 12px; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 12.5px; color: #6B6F76;">
          <strong>Not submitted:</strong> ${data.notSubmittedNames.join(', ')}
        </td>
      </tr>
    `;
  }

  let htmlOnLeave = '';
  if (data.onLeave.length > 0) {
    htmlOnLeave = `
      <tr>
        <td style="padding-bottom: 14px; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 12.5px; color: #6B6F76;">
          <strong>On leave:</strong> ${data.onLeave.map(l => `${l.name} (${l.dateRange})`).join(', ')}
        </td>
      </tr>
    `;
  }

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
<body style="margin: 0; padding: 20px 10px; background-color: #FBFBFA; color: #17191C; -webkit-font-smoothing: antialiased;">
  <!-- Hidden preheader for Outlook & mobile clients -->
  <div style="display: none; font-size: 1px; color: #FBFBFA; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${data.summaryLine}
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; text-align: left; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding-bottom: 16px; font-family: 'Segoe UI', Calibri, Arial, sans-serif;">
              <div style="font-size: 11.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #2C5CE0;">${data.teamName}</div>
              <h1 style="margin: 4px 0 6px; font-size: 20px; font-weight: bold; color: #17191C;">Daily Standup · ${data.dateFormatted}</h1>
              <div style="font-size: 12.5px; font-family: Consolas, monospace; color: #6B6F76;">${data.summaryLine}</div>
            </td>
          </tr>

          <!-- Blockers -->
          ${htmlBlockers}

          <!-- Updates -->
          ${htmlUpdates}

          <!-- Missing & Leave Summary -->
          ${htmlNotSubmitted}
          ${htmlOnLeave}

          <!-- Footer -->
          <tr>
            <td style="padding-top: 16px; border-top: 1px solid #E4E4E2; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 12px; color: #8B9099;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td><a href="${data.teamPageUrl}" style="color: #2C5CE0; text-decoration: underline;">Open Team Dashboard</a></td>
                  <td align="right" style="color: #8B9099;">SyncPulse Automated Standup</td>
                </tr>
              </table>
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
