import { Request, Response, NextFunction } from 'express';
import { db } from '../db/client.js';
import { User, UserRole } from '../../shared/types.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.['dailies_session'];

  if (!sessionId) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const session = db.prepare(`
    SELECT s.*, u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `).get(sessionId) as any;

  if (!session) {
    res.clearCookie('dailies_session');
    res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Session has expired' } });
    return;
  }

  // Update last_seen_at
  db.prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?`).run(sessionId);

  req.user = {
    id: session.user_id,
    email: session.email,
    name: session.name,
    role: session.role as UserRole,
    team_id: session.team_id,
    is_active: Boolean(session.is_active),
    notification_prefs: JSON.parse(session.notification_prefs || '{"morning":true,"cutoff":true}'),
    created_at: session.created_at
  };

  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }
    next();
  };
}
