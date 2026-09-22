import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { authMiddleware, AuthenticatedRequest } from '../lib/authMiddleware.js';
import {
  getStandup,
  saveStandupDraft,
  submitStandup,
  getCarryOverItems,
  getRollingDays
} from '../services/standupService.js';
import { isUserOnLeave } from '../services/leaveService.js';
import { getOrgDate, isPastCutoff, ORG_TIMEZONE, DIGEST_TIME } from '../lib/dates.js';

export const standupsRouter = Router();

standupsRouter.use(authMiddleware);

// GET /api/standups/today
standupsRouter.get('/today', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const todayDateStr = getOrgDate();

  const entry = getStandup(user.id, todayDateStr);
  // Preserve carry-over until submitted (PRD §4.5)
  const carryOver = (entry && entry.status === 'submitted') ? [] : getCarryOverItems(user.id, todayDateStr);
  const leaveToday = isUserOnLeave(user.id, todayDateStr);

  const team = user.team_id ? db.prepare('SELECT digest_time FROM teams WHERE id = ?').get(user.team_id) as any : null;
  const cutoffTime = team?.digest_time || DIGEST_TIME;
  const windowState = isPastCutoff(cutoffTime) ? 'past_cutoff' : 'open';

  res.json({
    entry,
    carryOver,
    windowState,
    leaveToday,
    cutoffTime,
    orgTimezone: ORG_TIMEZONE,
    currentOrgDate: todayDateStr
  });
});

// GET /api/standups/mine?days=7
standupsRouter.get('/mine', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const daysParam = parseInt(req.query.days as string, 10) || 7;
  const days = Math.min(Math.max(daysParam, 1), 30);

  const rolling = getRollingDays(user.id, days);
  res.json(rolling);
});

// GET /api/standups/:date
standupsRouter.get('/:date', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const dateStr = req.params.date;

  const entry = getStandup(user.id, dateStr);
  res.json(entry);
});

const StandupPayloadSchema = z.object({
  yesterday_html: z.string().optional(),
  today_html: z.string().optional(),
  has_blockers: z.boolean().optional(),
  blocker_html: z.string().optional(),
  blocker_severity: z.enum(['low', 'medium', 'critical']).nullable().optional(),
  blocked_on_user_id: z.number().nullable().optional()
});

// PUT /api/standups/:date (Autosave draft)
standupsRouter.put('/:date', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const dateStr = req.params.date;

  const parse = StandupPayloadSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid standup payload' } });
    return;
  }

  try {
    const updated = saveStandupDraft(user.id, user.team_id, dateStr, parse.data);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'SAVE_FAILED', message: err.message } });
  }
});

// POST /api/standups/:date/submit (Submit standup)
standupsRouter.post('/:date/submit', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const dateStr = req.params.date;

  const parse = StandupPayloadSchema.safeParse(req.body);
  if (!parse.success || !parse.data.today_html) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Today section is required' } });
    return;
  }

  try {
    const submitted = submitStandup(user.id, user.team_id, dateStr, {
      ...parse.data,
      today_html: parse.data.today_html
    });
    res.json(submitted);
  } catch (err: any) {
    res.status(400).json({ error: { code: 'SUBMIT_FAILED', message: err.message } });
  }
});
