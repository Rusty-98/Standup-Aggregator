import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const mailFrom = process.env.MAIL_FROM || `Dailies <${user}>`;

  console.log('--- Testing SMTP Configuration ---');
  console.log(`Host: ${host}:${port}`);
  console.log(`Secure: ${secure}`);
  console.log(`Auth User: ${user}`);
  console.log(`Mail From: ${mailFrom}`);
  console.log(`Password length: ${pass.length} chars`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });

  try {
    console.log('\nStep 1: Verifying SMTP connection and credentials...');
    await transporter.verify();
    console.log('✅ SMTP connection and authentication succeeded!\n');

    console.log('Step 2: Sending a test email...');
    const info = await transporter.sendMail({
      from: mailFrom,
      to: user,
      subject: 'Dailies SMTP Live Test Verification',
      text: 'Hello Sumit,\n\nThis is a live test email from Dailies confirming that your SMTP connection to Office 365 is working properly!\n\nBest regards,\nDailies Team',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1E293B;">
          <h2 style="color: #4F46E5;">Dailies SMTP Live Test Verification</h2>
          <p>Hello Sumit,</p>
          <p>This is a live test email confirming that your SMTP credentials and delivery are working seamlessly!</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748B;">Dispatched via ${host}:${port} on ${new Date().toISOString()}</p>
        </div>
      `
    });

    console.log(`✅ TEST EMAIL SENT SUCCESSFULLY!`);
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Accepted by server:`, info.accepted);
  } catch (err: any) {
    console.error('\n❌ SMTP FAILED:');
    console.error(`Error code: ${err.code}`);
    console.error(`Response code: ${err.responseCode}`);
    console.error(`Command: ${err.command}`);
    console.error(`Message: ${err.message}`);
    if (err.response) {
      console.error(`Server raw response: ${err.response}`);
    }
  }
}

main();
