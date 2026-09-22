import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../lib/authMiddleware.js';
import { getLeaves, recordLeave, deleteLeave, LeaveConflictError } from '../services/leaveService.js';

export const leaveRouter = Router();

leaveRouter.use(authMiddleware);

// GET /api/leave
leaveRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const targetUserId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;

  let queryUserId: number | undefined = targetUserId;
  let queryTeamId: number | undefined = undefined;

  if (user.role === 'member') {
    queryUserId = user.id;
  } else if (user.role === 'admin') {
    if (req.query.userId === 'all' || !targetUserId) {
      queryUserId = undefined;
      queryTeamId = user.team_id || undefined;
    }
    if (req.query.teamId) {
      queryTeamId = parseInt(req.query.teamId as string, 10);
    }
  }

  const leaves = getLeaves({ userId: queryUserId, teamId: queryTeamId, from, to });
  res.json(leaves);
});

const RecordLeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['leave', 'sick', 'holiday', 'travel', 'other']),
  note: z.string().optional(),
  userId: z.number().optional()
});

// POST /api/leave
leaveRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const parse = RecordLeaveSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid leave data' } });
    return;
  }

  const { startDate, endDate, type, note, userId } = parse.data;
  let targetUserId = user.id;

  if (userId && userId !== user.id) {
    if (user.role !== 'admin') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only admins can record leave for others' } });
      return;
    }
    targetUserId = userId;
  }

  try {
    const leave = recordLeave({
      userId: targetUserId,
      startDate,
      endDate,
      type,
      note: note || '',
      createdBy: user.id
    });
    res.status(201).json(leave);
  } catch (err: any) {
    if (err instanceof LeaveConflictError) {
      res.status(409).json({ error: { code: 'LEAVE_CONFLICT', message: err.message } });
      return;
    }
    res.status(400).json({ error: { code: 'RECORD_FAILED', message: err.message } });
  }
});

// DELETE /api/leave/:id
leaveRouter.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const id = parseInt(req.params.id, 10);

  try {
    const success = deleteLeave(id, user.id, user.role);
    if (!success) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave record not found' } });
      return;
    }
    res.status(204).end();
  } catch (err: any) {
    res.status(403).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
  }
});
