import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../lib/authMiddleware.js';
import { sendDailyDigest } from '../services/digestService.js';
import { getOrgDate } from '../lib/dates.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requireRole(['admin']));

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

// POST /api/admin/users
adminRouter.post('/users', (req: AuthenticatedRequest, res: Response): void => {
  const schema = z.object({
    email: z.string().email().toLowerCase(),
    name: z.string().min(1),
    role: z.enum(['member', 'lead', 'admin']),
    team_id: z.number().default(1)
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Valid name, email and role required' } });
    return;
  }

  const { email, name, role, team_id } = parse.data;

  try {
    const insert = db.prepare(`
      INSERT INTO users (email, name, role, team_id, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const result = insert.run(email, name, role, team_id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'USER_EXISTS', message: 'User with this email already exists' } });
  }
});

// PATCH /api/admin/users/:id
adminRouter.patch('/users/:id', (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const schema = z.object({
    role: z.enum(['member', 'lead', 'admin']).optional(),
    is_active: z.boolean().optional(),
    team_id: z.number().optional()
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid update attributes' } });
    return;
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

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(user);
});

// GET /api/admin/holidays
adminRouter.get('/holidays', (req: AuthenticatedRequest, res: Response): void => {
  const holidays = db.prepare('SELECT * FROM holidays ORDER BY date ASC').all();
  res.json(holidays);
});

// POST /api/admin/holidays
adminRouter.post('/holidays', (req: AuthenticatedRequest, res: Response): void => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string().min(1)
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Date (YYYY-MM-DD) and holiday name required' } });
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

// GET /api/admin/jobs
adminRouter.get('/jobs', (req: AuthenticatedRequest, res: Response): void => {
  const runs = db.prepare(`SELECT * FROM digest_runs ORDER BY id DESC LIMIT 30`).all();
  res.json(runs);
});

// POST /api/admin/jobs/:kind/run
adminRouter.post('/jobs/:kind/run', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const kind = req.params.kind;
  const dateStr = req.body.date || getOrgDate();
  const teamId = req.body.teamId || 1;

  if (kind === 'daily_digest') {
    try {
      await sendDailyDigest(teamId, dateStr, true);
      res.json({ success: true, message: `Daily digest dispatched for team ${teamId} on ${dateStr}` });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'RUN_FAILED', message: err.message } });
    }
  } else {
    res.status(400).json({ error: { code: 'UNKNOWN_JOB', message: `Job ${kind} not directly runnable via this endpoint` } });
  }
});
