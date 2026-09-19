import { Router, Response } from 'express';
import { db } from '../db/client.js';
import { authMiddleware, AuthenticatedRequest } from '../lib/authMiddleware.js';

export const recapRouter = Router();

recapRouter.use(authMiddleware);

// GET /api/recap/week
recapRouter.get('/week', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const from = req.query.from as string;
  const to = req.query.to as string;

  let query = `
    SELECT * FROM standups
    WHERE user_id = ?
  `;
  const params: any[] = [user.id];

  if (from && to) {
    query += ` AND standup_date >= ? AND standup_date <= ?`;
    params.push(from, to);
  } else {
    query += ` ORDER BY standup_date DESC LIMIT 7`;
  }

  const entries = db.prepare(query).all(...params);
  res.json({
    user,
    entries
  });
});
