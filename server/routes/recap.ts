import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../lib/authMiddleware.js';
import { getPersonalWeek, getRecapAnalysis } from '../services/recapAnalysisService.js';

export const recapRouter = Router();

recapRouter.use(authMiddleware);

recapRouter.get('/week', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const week = getPersonalWeek(user.id);
  res.json({
    user,
    from: week.from,
    to: week.to,
    days: week.days,
    entries: week.days.map(d => d.standup).filter(Boolean)
  });
});

recapRouter.post('/analysis', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const analysis = await getRecapAnalysis(user.id);
  res.json(analysis);
});
