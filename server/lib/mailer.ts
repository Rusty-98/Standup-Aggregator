import nodemailer from 'nodemailer';
import { logger } from './logger.js';

export function getMailerConfig() {
  const host = (process.env.SMTP_HOST || 'localhost').trim();
  const port = parseInt(process.env.SMTP_PORT || '1025', 10);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const secure = process.env.SMTP_SECURE === 'true';
  const mailFrom = process.env.MAIL_FROM || `Dailies <${user || 'standup@company.com'}>`;

  return { host, port, user, pass, secure, mailFrom };
}

export function createTransporter() {
  const { host, port, user, pass, secure } = getMailerConfig();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: (user && pass) ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false
    }
  });
}

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
  const { host, user, pass, mailFrom } = getMailerConfig();
  const isRemoteSmtp = host !== 'localhost' && host !== '127.0.0.1' && host !== 'mailhog';

  // If pointing to a remote mail provider (Outlook/Gmail) without credentials
  if (isRemoteSmtp && (!user || !pass)) {
    const errorMsg = `SMTP credentials missing in .env for remote host "${host}". Cannot send live email.`;
    logger.error({ host, to }, errorMsg);
    console.log(`\n========================================================`);
    console.log(`❌ LIVE EMAIL CANNOT BE DELIVERED: SMTP CREDENTIALS MISSING`);
    console.log(`    SMTP_HOST is set to "${host}", but SMTP_USER or SMTP_PASS is empty in .env!`);
    console.log(`    To send real emails to ${Array.isArray(to) ? to.join(', ') : to}, set in .env:`);
    console.log(`      SMTP_USER=your_email@domain.com`);
    console.log(`      SMTP_PASS=your_app_password`);
    console.log(`      MAIL_FROM="Dailies <your_email@domain.com>"`);
    console.log(`========================================================\n`);
    throw new Error(errorMsg);
  }

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: mailFrom,
      to,
      cc,
      subject,
      html,
      text
    });
    logger.info({ messageId: info.messageId, to, cc, subject }, 'Email successfully dispatched through SMTP');
    console.log(`\n✅ LIVE EMAIL DELIVERED! Message ID: ${info.messageId} to ${Array.isArray(to) ? to.join(', ') : to}\n`);
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, to, cc, subject, host }, 'SMTP delivery error');
    console.log(`\n❌ SMTP DELIVERY ERROR from ${host}: ${err.message}`);
    if (err.message.includes('530') || err.message.includes('authentication')) {
      console.log(`💡 HINT: Microsoft/Google rejected the login. Make sure you are using an App Password instead of your normal password.`);
    }
    throw new Error(`SMTP delivery error from ${host}: ${err.message}`);
  }
}
