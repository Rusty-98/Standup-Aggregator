import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../lib/authMiddleware.js';
import { sendDailyDigest } from '../services/digestService.js';
import { renderWelcomeEmail } from '../emails/welcomeEmail.js';
import { sendEmail } from '../lib/mailer.js';
import { getOrgDate, DIGEST_TIME, ORG_TIMEZONE } from '../lib/dates.js';
import { assertWebhook } from '../lib/webhook.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requireRole(['admin']));

// ==========================================
// TEAMS MANAGEMENT
// ==========================================

// GET /api/admin/teams
adminRouter.get('/teams', (req: AuthenticatedRequest, res: Response): void => {
  const teams = db.prepare(`
    SELECT id, name, slug, extra_digest_recipients, reminder_morning_time, reminder_cutoff_time, digest_time,
           webhook_url, reminder_template, digest_template, created_at
    FROM teams
    ORDER BY id ASC
  `).all() as Array<any>;

  const defaultMorning = process.env.REMINDER_MORNING_TIME || '09:30';
  const defaultCutoff = process.env.REMINDER_CUTOFF_TIME || '19:15';
  const defaultDigest = process.env.DIGEST_TIME || '20:00';

  const result = teams.map(t => {
    const members = db.prepare(`
      SELECT id, email, name, role, is_active, created_at
      FROM users
      WHERE team_id = ?
      ORDER BY (CASE role WHEN 'admin' THEN 1 ELSE 2 END), name ASC
    `).all(t.id) as Array<any>;

    let extraRecipients: string[] = [];
    try {
      extraRecipients = JSON.parse(t.extra_digest_recipients || '[]');
    } catch {
      extraRecipients = [];
    }

    return {
      ...t,
      reminder_morning_time: t.reminder_morning_time || defaultMorning,
      reminder_cutoff_time: t.reminder_cutoff_time || defaultCutoff,
      digest_time: t.digest_time || defaultDigest,
      extra_digest_recipients: extraRecipients,
      members_count: members.filter(m => m.is_active).length,
      members: members.map(m => ({ ...m, is_active: Boolean(m.is_active) }))
    };
  });

  res.json(result);
});

// POST /api/admin/teams
adminRouter.post('/teams', (req: AuthenticatedRequest, res: Response): void => {
  const schema = z.object({
    name: z.string().trim().min(2, 'Team name must be at least 2 characters'),
    slug: z.string().trim().optional(),
    digest_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Digest time must be in HH:MM format').optional(),
    reminder_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Reminder time must be in HH:MM format').optional(),
    webhook_url: z.string().trim().max(500).optional(),
    reminder_template: z.string().max(2000).optional(),
    digest_template: z.string().max(2000).optional(),
    extra_digest_recipients: z.array(z.string().email('Invalid email address')).optional()
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parse.error.errors[0]?.message || 'Valid team name required' } });
    return;
  }

  const { name, extra_digest_recipients } = parse.data;
  let slug = parse.data.slug?.trim();
  if (!slug) {
    slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Check slug uniqueness
  const existingSlug = db.prepare('SELECT id FROM teams WHERE slug = ?').get(slug);
  if (existingSlug) {
    res.status(400).json({ error: { code: 'SLUG_EXISTS', message: `A team with URL slug "${slug}" already exists. Please choose a different name or slug.` } });
    return;
  }

  const digestTime = parse.data.digest_time || process.env.DIGEST_TIME || '20:00';
  const reminderTime = parse.data.reminder_time || '09:30';
  let webhook = '';
  try {
    webhook = assertWebhook(parse.data.webhook_url);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'INVALID_WEBHOOK', message: err.message } });
    return;
  }
  const extraJson = JSON.stringify(extra_digest_recipients || []);

  try {
    const insert = db.prepare(`
      INSERT INTO teams (name, slug, reminder_morning_time, digest_time, extra_digest_recipients, webhook_url, reminder_template, digest_template)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insert.run(
      name,
      slug,
      reminderTime,
      digestTime,
      extraJson,
      webhook,
      parse.data.reminder_template || '',
      parse.data.digest_template || ''
    );
    const created = db.prepare('SELECT * FROM teams WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json({
      ...created,
      digest_time: created.digest_time || digestTime,
      extra_digest_recipients: JSON.parse(created.extra_digest_recipients || '[]'),
      members_count: 0,
      members: []
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'CREATE_FAILED', message: err.message } });
  }
});

// PATCH /api/admin/teams/:id - update team schedule, name, or CC recipients
adminRouter.patch('/teams/:id', (req: AuthenticatedRequest, res: Response): void => {
  const teamId = parseInt(req.params.id, 10);
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  if (!team) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    return;
  }

  const schema = z.object({
    name: z.string().trim().min(2, 'Team name must be at least 2 characters').optional(),
    digest_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Digest time must be in HH:MM format').optional(),
    reminder_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Reminder time must be in HH:MM format').optional(),
    webhook_url: z.string().trim().max(500).optional(),
    reminder_template: z.string().max(2000).optional(),
    digest_template: z.string().max(2000).optional(),
    extra_digest_recipients: z.array(z.string().email('Invalid email address')).optional()
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parse.error.errors[0]?.message || 'Invalid input data' } });
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (parse.data.name !== undefined) {
    updates.push('name = ?');
    params.push(parse.data.name);
  }
  if (parse.data.digest_time !== undefined) {
    updates.push('digest_time = ?');
    params.push(parse.data.digest_time);
  }
  if (parse.data.reminder_time !== undefined) {
    updates.push('reminder_morning_time = ?');
    params.push(parse.data.reminder_time);
  }
  if (parse.data.webhook_url !== undefined) {
    try {
      updates.push('webhook_url = ?');
      params.push(assertWebhook(parse.data.webhook_url));
    } catch (err: any) {
      res.status(400).json({ error: { code: 'INVALID_WEBHOOK', message: err.message } });
      return;
    }
  }
  if (parse.data.reminder_template !== undefined) {
    updates.push('reminder_template = ?');
    params.push(parse.data.reminder_template);
  }
  if (parse.data.digest_template !== undefined) {
    updates.push('digest_template = ?');
    params.push(parse.data.digest_template);
  }
  if (parse.data.extra_digest_recipients !== undefined) {
    // Deduplicate and trim emails
    const cleanEmails = Array.from(new Set(parse.data.extra_digest_recipients.map(e => e.trim().toLowerCase())));
    updates.push('extra_digest_recipients = ?');
    params.push(JSON.stringify(cleanEmails));
  }

  if (updates.length > 0) {
    params.push(teamId);
    db.prepare(`UPDATE teams SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  const members = db.prepare(`
    SELECT id, email, name, role, is_active, created_at
    FROM users
    WHERE team_id = ?
    ORDER BY (CASE role WHEN 'admin' THEN 1 ELSE 2 END), name ASC
  `).all(teamId) as Array<any>;

  res.json({
    ...updated,
    digest_time: updated.digest_time || process.env.DIGEST_TIME || '20:00',
    extra_digest_recipients: JSON.parse(updated.extra_digest_recipients || '[]'),
    members_count: members.filter(m => m.is_active).length,
    members: members.map(m => ({ ...m, is_active: Boolean(m.is_active) }))
  });
});

// POST /api/admin/teams/:id/extra-recipients - add a dedicated digest CC recipient
adminRouter.post('/teams/:id/extra-recipients', (req: AuthenticatedRequest, res: Response): void => {
  const teamId = parseInt(req.params.id, 10);
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  if (!team) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    return;
  }

  const schema = z.object({
    email: z.string().trim().email('Please provide a valid email address')
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parse.error.errors[0]?.message } });
    return;
  }

  const newEmail = parse.data.email.toLowerCase();
  let currentRecipients: string[] = [];
  try {
    currentRecipients = JSON.parse(team.extra_digest_recipients || '[]');
  } catch {
    currentRecipients = [];
  }

  if (currentRecipients.includes(newEmail)) {
    res.status(400).json({ error: { code: 'ALREADY_EXISTS', message: `Recipient "${newEmail}" is already in the digest CC list for this team.` } });
    return;
  }

  currentRecipients.push(newEmail);
  db.prepare('UPDATE teams SET extra_digest_recipients = ? WHERE id = ?').run(JSON.stringify(currentRecipients), teamId);

  res.json({
    team_id: teamId,
    extra_digest_recipients: currentRecipients
  });
});

// DELETE /api/admin/teams/:id/extra-recipients/:email - remove a digest CC recipient
adminRouter.delete('/teams/:id/extra-recipients/:email', (req: AuthenticatedRequest, res: Response): void => {
  const teamId = parseInt(req.params.id, 10);
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  if (!team) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    return;
  }

  const targetEmail = decodeURIComponent(req.params.email).toLowerCase();
  let currentRecipients: string[] = [];
  try {
    currentRecipients = JSON.parse(team.extra_digest_recipients || '[]');
  } catch {
    currentRecipients = [];
  }

  const updated = currentRecipients.filter(e => e.toLowerCase() !== targetEmail);
  db.prepare('UPDATE teams SET extra_digest_recipients = ? WHERE id = ?').run(JSON.stringify(updated), teamId);

  res.json({
    team_id: teamId,
    extra_digest_recipients: updated
  });
});

// DELETE /api/admin/teams/:id
adminRouter.delete('/teams/:id', (req: AuthenticatedRequest, res: Response): void => {
  const teamId = parseInt(req.params.id, 10);
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  if (!team) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    return;
  }

  const memberCount = (db.prepare('SELECT COUNT(*) as count FROM users WHERE team_id = ?').get(teamId) as any)?.count || 0;
  if (memberCount > 0) {
    res.status(400).json({
      error: {
        code: 'TEAM_NOT_EMPTY',
        message: `Cannot delete team "${team.name}" because it still has ${memberCount} member(s). Please reassign or remove members first.`
      }
    });
    return;
  }

  db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
  res.status(204).end();
});

// POST /api/admin/teams/:id/members
adminRouter.post('/teams/:id/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const teamId = parseInt(req.params.id, 10);
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  if (!team) {
    res.status(404).json({ error: { code: 'TEAM_NOT_FOUND', message: 'Target team does not exist' } });
    return;
  }

  const schema = z.object({
    email: z.string().email('Please enter a valid work email address').toLowerCase().trim(),
    name: z.string().trim().min(1, 'Member name is required'),
    sendInvite: z.boolean().default(true)
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parse.error.errors[0]?.message || 'Valid member details required' } });
    return;
  }

  const { email, name, sendInvite } = parse.data;
  const role = 'member';

  // Domain validation against ALLOWED_EMAIL_DOMAINS
  const domain = email.split('@')[1]?.toLowerCase();
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'ampcuscyber.com,company.com,gmail.com,example.com')
    .split(',')
    .map(d => d.trim().toLowerCase());

  const isDomainAllowed = allowedDomains.includes('*') || (domain && allowedDomains.includes(domain));

  if (!domain || !isDomainAllowed) {
    res.status(400).json({
      error: {
        code: 'INVALID_DOMAIN',
        message: `Email domain @${domain} is not permitted. Permitted domains: ${allowedDomains.join(', ')}`
      }
    });
    return;
  }

  // Check existing user
  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  let userId: number;

  if (existingUser) {
    if (existingUser.team_id === teamId && existingUser.is_active) {
      res.status(400).json({
        error: {
          code: 'ALREADY_MEMBER',
          message: `${name} (${email}) is already an active member of the ${team.name} team.`
        }
      });
      return;
    }

    // Reassign existing user to this team and activate; never demote an admin via add-member
    const nextRole = existingUser.role === 'admin' ? 'admin' : 'member';
    db.prepare(`
      UPDATE users
      SET name = ?, role = ?, team_id = ?, is_active = 1
      WHERE id = ?
    `).run(name, nextRole, teamId, existingUser.id);
    userId = existingUser.id;
  } else {
    // Insert new user
    const insert = db.prepare(`
      INSERT INTO users (email, name, role, team_id, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const info = insert.run(email, name, role, teamId);
    userId = Number(info.lastInsertRowid);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

  // Send Welcome / Onboarding Email if requested
  let inviteDispatched = false;
  if (sendInvite) {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const inviteRole = (user.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member';
      const { html, text, subject } = renderWelcomeEmail({
        userName: name,
        userEmail: email,
        teamName: team.name,
        role: inviteRole,
        cutoffTime: team.digest_time || DIGEST_TIME || '20:00',
        orgTimezone: process.env.ORG_TIMEZONE || ORG_TIMEZONE || 'Asia/Kolkata',
        loginUrl: `${appUrl}${inviteRole === 'admin' ? '/admin' : '/today'}`
      });

      await sendEmail({
        to: email,
        subject,
        html,
        text
      });
      inviteDispatched = true;
    } catch (err: any) {
      console.error('Failed to dispatch welcome email:', err.message);
    }
  }

  res.status(201).json({
    user: { ...user, is_active: Boolean(user.is_active) },
    inviteDispatched
  });
});

// POST /api/admin/users/:id/resend-invite
adminRouter.post('/users/:id/resend-invite', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  const user = db.prepare(`
    SELECT u.*, t.name as team_name
    FROM users u
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE u.id = ?
  `).get(userId) as any;

  if (!user) {
    res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    return;
  }

  const teamName = user.team_name || 'Engineering';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  try {
    const { html, text, subject } = renderWelcomeEmail({
      userName: user.name,
      userEmail: user.email,
      teamName,
      role: user.role === 'admin' ? 'admin' : 'member',
      cutoffTime: process.env.DIGEST_TIME || DIGEST_TIME || '20:00',
      orgTimezone: process.env.ORG_TIMEZONE || ORG_TIMEZONE || 'Asia/Kolkata',
      loginUrl: `${appUrl}${user.role === 'admin' ? '/admin' : '/today'}`
    });

    await sendEmail({
      to: user.email,
      subject,
      html,
      text
    });

    res.json({ success: true, message: `Welcome invitation successfully resent to ${user.email}` });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'DISPATCH_FAILED', message: err.message } });
  }
});

// ==========================================
// USERS MANAGEMENT
// ==========================================

// GET /api/admin/users
adminRouter.get('/users', (req: AuthenticatedRequest, res: Response): void => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.team_id, u.is_active, u.created_at, t.name as team_name
    FROM users u
    LEFT JOIN teams t ON t.id = u.team_id
    ORDER BY u.name ASC
  `).all();
  res.json(users);
});

// PATCH /api/admin/users/:id
adminRouter.patch('/users/:id', (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const schema = z.object({
    role: z.enum(['member', 'admin']).optional(),
    is_active: z.boolean().optional(),
    team_id: z.number().optional()
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid update attributes' } });
    return;
  }

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    return;
  }

  const nextRole = parse.data.role ?? existing.role;
  const nextActive = parse.data.is_active !== undefined ? parse.data.is_active : Boolean(existing.is_active);
  const demotingOrDeactivatingAdmin = existing.role === 'admin' && (nextRole !== 'admin' || nextActive === false);
  if (demotingOrDeactivatingAdmin) {
    const adminCount = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1`).get() as { count: number }).count;
    if (adminCount <= 1) {
      res.status(400).json({
        error: {
          code: 'LAST_ADMIN',
          message: 'Cannot demote or deactivate the last remaining admin.'
        }
      });
      return;
    }
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (parse.data.role !== undefined) {
    updates.push('role = ?');
    params.push(parse.data.role);
  }
  if (parse.data.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(parse.data.is_active ? 1 : 0);
  }
  if (parse.data.team_id !== undefined) {
    updates.push('team_id = ?');
    params.push(parse.data.team_id);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    return;
  }
  res.json({ ...user, is_active: Boolean(user.is_active) });
});

// ==========================================
// HOLIDAYS MANAGEMENT
// ==========================================

// GET /api/admin/holidays
adminRouter.get('/holidays', (req: AuthenticatedRequest, res: Response): void => {
  const holidays = db.prepare('SELECT * FROM holidays ORDER BY date ASC').all();
  res.json(holidays);
});

// POST /api/admin/holidays
adminRouter.post('/holidays', (req: AuthenticatedRequest, res: Response): void => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    name: z.string().trim().min(1, 'Holiday name required')
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parse.error.errors[0]?.message || 'Date (YYYY-MM-DD) and holiday name required' } });
    return;
  }

  db.prepare(`INSERT OR REPLACE INTO holidays (date, name) VALUES (?, ?)`).run(parse.data.date, parse.data.name);
  res.status(201).json(parse.data);
});

// DELETE /api/admin/holidays/:date
adminRouter.delete('/holidays/:date', (req: AuthenticatedRequest, res: Response): void => {
  db.prepare('DELETE FROM holidays WHERE date = ?').run(req.params.date);
  res.status(204).end();
});

// ==========================================
// JOBS MANAGEMENT
// ==========================================

// GET /api/admin/jobs
adminRouter.get('/jobs', (req: AuthenticatedRequest, res: Response): void => {
  const runs = db.prepare(`SELECT * FROM digest_runs ORDER BY id DESC LIMIT 30`).all();
  res.json(runs);
});

// POST /api/admin/jobs/:kind/run
adminRouter.post('/jobs/:kind/run', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const kind = req.params.kind;
  const dateStr = req.body.date || getOrgDate();
  const teamId = parseInt(String(req.body.teamId ?? ''), 10);

  if (kind !== 'daily_digest') {
    res.status(400).json({ error: { code: 'UNKNOWN_JOB', message: 'Only daily_digest can be run from admin.' } });
    return;
  }

  if (!Number.isFinite(teamId) || teamId < 1) {
    res.status(400).json({ error: { code: 'TEAM_REQUIRED', message: 'Select a team before running the digest.' } });
    return;
  }

  try {
    await sendDailyDigest(teamId, dateStr, true);
    res.json({ success: true, message: `Daily digest dispatched for team #${teamId} on ${dateStr}` });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'RUN_FAILED', message: err.message } });
  }
});
