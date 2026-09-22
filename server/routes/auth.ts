import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/client.js';
import { renderOtpEmail } from '../emails/otpEmail.js';
import { sendEmail } from '../lib/mailer.js';
import { authMiddleware, AuthenticatedRequest } from '../lib/authMiddleware.js';
import { ORG_TIMEZONE, DIGEST_TIME, getOrgDate } from '../lib/dates.js';

export const authRouter = Router();

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'company.com,gmail.com,example.com')
  .split(',')
  .map(d => d.trim().toLowerCase());

const RequestCodeSchema = z.object({
  email: z.string().email().toLowerCase(),
  bootstrap: z.boolean().optional()
});

const VerifyCodeSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6),
  remember: z.boolean().optional()
});

function activeAdminCount(): number {
  return (db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`).get() as { count: number }).count;
}

authRouter.get('/bootstrap', (_req: Request, res: Response): void => {
  res.json({ open: activeAdminCount() === 0 });
});

// POST /api/auth/request-code
authRouter.post('/request-code', async (req: Request, res: Response): Promise<void> => {
  const parse = RequestCodeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Valid company email required' } });
    return;
  }

  const email = parse.data.email;
  const bootstrap = Boolean(parse.data.bootstrap) && activeAdminCount() === 0;
  const domain = email.split('@')[1]?.toLowerCase();

  // Domain check
  const currentAllowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'ampcuscyber.com,company.com,gmail.com,example.com')
    .split(',')
    .map(d => d.trim().toLowerCase());

  const isDomainAllowed = currentAllowedDomains.includes('*') || (domain && currentAllowedDomains.includes(domain));

  if (!domain || !isDomainAllowed) {
    res.status(400).json({ error: { code: 'INVALID_DOMAIN', message: "That domain isn't set up for Dailies." } });
    return;
  }

  // Rate limit: max 3 requests per email per 15 minutes
  const recentCodes = db.prepare(`
    SELECT COUNT(*) as count FROM auth_codes
    WHERE email = ? AND created_at > datetime('now', '-15 minutes')
  `).get(email) as { count: number };

  if (recentCodes.count >= 3) {
    // Return 204 to avoid leaking rate limit exhaustion
    res.status(204).end();
    return;
  }

  // Check if user exists (PRD §F1: Account must already exist. Unknown emails get same 204 but no mail)
  const user = db.prepare(`SELECT * FROM users WHERE email = ? AND is_active = 1`).get(email);

  if (user || bootstrap) {
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = bcrypt.hashSync(code, 10);
    db.prepare(`
      INSERT INTO auth_codes (email, code_hash, expires_at, ip, purpose)
      VALUES (?, ?, datetime('now', '+10 minutes'), ?, ?)
    `).run(email, codeHash, req.ip || null, bootstrap && !user ? 'bootstrap' : 'login');

    const { html, text } = renderOtpEmail(code);
    try {
      await sendEmail({
        to: email,
        subject: 'Your Dailies verification code',
        html,
        text
      });
    } catch (err: any) {
      console.error(`[AUTH] Failed to send OTP email to ${email}:`, err.message);
      res.status(500).json({ error: { code: 'MAIL_FAILED', message: 'Could not send verification email. Try again in a minute.' } });
      return;
    }
  }

  res.status(204).end();
});

// POST /api/auth/verify-code
authRouter.post('/verify-code', async (req: Request, res: Response): Promise<void> => {
  const parse = VerifyCodeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid verification input' } });
    return;
  }

  const { email, code, remember } = parse.data;

  // Find latest active code
  const authCode = db.prepare(`
    SELECT * FROM auth_codes
    WHERE email = ? AND consumed_at IS NULL AND expires_at > datetime('now')
    ORDER BY id DESC
    LIMIT 1
  `).get(email) as any;

  if (!authCode) {
    res.status(400).json({ error: { code: 'INVALID_CODE', message: 'Code has expired or does not exist' } });
    return;
  }

  // Max 5 attempts
  if (authCode.attempts >= 5) {
    db.prepare(`UPDATE auth_codes SET consumed_at = datetime('now') WHERE id = ?`).run(authCode.id);
    res.status(400).json({ error: { code: 'MAX_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new code.' } });
    return;
  }

  const isMatch = bcrypt.compareSync(code, authCode.code_hash);
  if (!isMatch) {
    db.prepare(`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?`).run(authCode.id);
    res.status(400).json({ error: { code: 'INVALID_CODE', message: 'Incorrect verification code' } });
    return;
  }

  // Mark code consumed
  db.prepare(`UPDATE auth_codes SET consumed_at = datetime('now') WHERE id = ?`).run(authCode.id);

  // Fetch user, or create the first admin from a bootstrap code
  let user = db.prepare(`SELECT * FROM users WHERE email = ? AND is_active = 1`).get(email) as any;
  if (!user) {
    if (authCode.purpose !== 'bootstrap' || activeAdminCount() > 0) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User account not active' } });
      return;
    }
    const local = email.split('@')[0] || 'Admin';
    const name = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    db.prepare(`
      INSERT INTO users (email, name, role, team_id, is_active)
      VALUES (?, ?, 'admin', NULL, 1)
    `).run(email, name.slice(0, 80));
    user = db.prepare(`SELECT * FROM users WHERE email = ? AND is_active = 1`).get(email) as any;
  }

  // Create session
  const sessionId = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  const expiryModifier = remember ? '+30 days' : '+12 hours';

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent)
    VALUES (?, ?, ?, datetime('now', ?), ?)
  `).run(sessionId, user.id, tokenHash, expiryModifier, req.headers['user-agent'] || null);

  const ttlMs = remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;

  // Set HTTP-only Cookie
  res.cookie('dailies_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ttlMs
  });

  const team = db.prepare(`SELECT id, name, slug FROM teams WHERE id = ?`).get(user.team_id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      team_id: user.team_id,
      is_active: Boolean(user.is_active)
    },
    team
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response): void => {
  const sessionId = req.cookies?.['dailies_session'];
  if (sessionId) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
  }
  res.clearCookie('dailies_session');
  res.status(204).end();
});

// GET /api/me
authRouter.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const team = db.prepare(`SELECT id, name, slug FROM teams WHERE id = ?`).get(user.team_id);

  res.json({
    user,
    team,
    orgTimezone: ORG_TIMEZONE,
    cutoff: DIGEST_TIME,
    currentOrgDate: getOrgDate()
  });
});
