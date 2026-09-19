import nodemailer from 'nodemailer';
import { logger } from './logger.js';

const host = process.env.SMTP_HOST || 'localhost';
const port = parseInt(process.env.SMTP_PORT || '1025', 10);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const secure = process.env.SMTP_SECURE === 'true';
export const MAIL_FROM = process.env.MAIL_FROM || 'SyncPulse <standup@company.com>';

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user ? { user, pass } : undefined,
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendEmail({
  to,
  cc,
  subject,
  html,
  text
}: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      cc,
      subject,
      html,
      text
    });
    logger.info({ messageId: info.messageId, to, cc, subject }, 'Email successfully dispatched');
    return true;
  } catch (err: any) {
    logger.warn({ err: err.message, to, cc, subject }, 'SMTP send failed (MailHog or SMTP server may be offline). Logging to console.');
    console.log(`\n================= [DEV EMAIL DISPATCH] =================`);
    console.log(`TO: ${Array.isArray(to) ? to.join(', ') : to}`);
    if (cc) {
      console.log(`CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    }
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${text}`);
    console.log(`========================================================\n`);
    return true;
  }
}
