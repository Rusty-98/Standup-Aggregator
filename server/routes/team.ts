import { Router, Response } from 'express';
import { db } from '../db/client.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../lib/authMiddleware.js';
import { getTeamDigestData } from '../services/digestService.js';
import { renderDigestEmail } from '../emails/digestEmail.js';
import { sendEmail } from '../lib/mailer.js';
import { TeamMemberStatus, TeamSummary } from '../../shared/types.js';

export const teamRouter = Router();

teamRouter.use(authMiddleware);

// GET /api/team/:date
teamRouter.get('/:date', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const dateStr = req.params.date;

  const users = db.prepare(`
    SELECT id, name, email, role FROM users
    WHERE team_id = ? AND is_active = 1
    ORDER BY name ASC
  `).all(user.team_id) as any[];

  const standups = db.prepare(`
    SELECT s.*, b.name as blocked_on_name
    FROM standups s
    LEFT JOIN users b ON b.id = s.blocked_on_user_id
    WHERE s.team_id = ? AND s.standup_date = ? AND s.status = 'submitted'
  `).all(user.team_id, dateStr) as any[];
  const standupMap = new Map(standups.map(s => [s.user_id, s]));

  const leaves = db.prepare(`
    SELECT l.* FROM leaves l
    JOIN users u ON u.id = l.user_id
    WHERE u.team_id = ? AND l.start_date <= ? AND l.end_date >= ?
  `).all(user.team_id, dateStr, dateStr) as any[];
  const leaveMap = new Map(leaves.map(l => [l.user_id, l]));

  const members: TeamMemberStatus[] = [];

  for (const u of users) {
    const s = standupMap.get(u.id);
    const l = leaveMap.get(u.id);

    if (s) {
      members.push({
        user: u,
        status: 'submitted',
        submitted_at: s.submitted_at,
        yesterday_html: s.yesterday_html,
        today_html: s.today_html,
        has_blockers: Boolean(s.has_blockers),
        blocker_html: s.blocker_html,
        blocker_severity: s.blocker_severity,
        blocked_on_user: s.blocked_on_name ? { id: s.blocked_on_user_id, name: s.blocked_on_name } : null,
        leave: l ? { type: l.type, start_date: l.start_date, end_date: l.end_date, note: l.note } : null
      });
    } else if (l) {
      members.push({
        user: u,
        status: 'on_leave',
        submitted_at: null,
        yesterday_html: '',
        today_html: '',
        has_blockers: false,
        blocker_html: '',
        blocker_severity: null,
        blocked_on_user: null,
        leave: { type: l.type, start_date: l.start_date, end_date: l.end_date, note: l.note }
      });
    } else {
      members.push({
        user: u,
        status: 'not_submitted',
        submitted_at: null,
        yesterday_html: '',
        today_html: '',
        has_blockers: false,
        blocker_html: '',
        blocker_severity: null,
        blocked_on_user: null,
        leave: null
      });
    }
  }

  members.sort((a, b) => {
    const rank = (m: TeamMemberStatus) => {
      if (m.has_blockers && m.blocker_severity === 'critical') return 1;
      if (m.has_blockers) return 2;
      if (m.status === 'submitted') return 3;
      if (m.status === 'not_submitted') return 4;
      return 5;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.user.name.localeCompare(b.user.name);
  });

  const summary: TeamSummary = {
    date: dateStr,
    totalMembers: users.length,
    submittedCount: members.filter(m => m.status === 'submitted').length,
    onLeaveCount: members.filter(m => m.status === 'on_leave').length,
    notSubmittedCount: members.filter(m => m.status === 'not_submitted').length,
    blockerCount: members.filter(m => m.has_blockers).length,
    members
  };

  res.json(summary);
});

teamRouter.get('/:date/preview', (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const dateStr = req.params.date;
  const teamId = req.query.teamId ? parseInt(String(req.query.teamId), 10) : user.team_id;
  if (user.role !== 'admin' && teamId !== user.team_id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot preview another team' } });
    return;
  }
  const data = getTeamDigestData(teamId, dateStr);
  const { html } = renderDigestEmail(data);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

teamRouter.post('/:date/test-send', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const dateStr = req.params.date;
  const teamId = req.body?.teamId ? parseInt(String(req.body.teamId), 10) : user.team_id;

  try {
    const data = getTeamDigestData(teamId, dateStr);
    const { html, text, subject } = renderDigestEmail(data);

    await sendEmail({
      to: user.email,
      subject: `[TEST PREVIEW] ${subject}`,
      html,
      text
    });

    res.json({ success: true, message: `Test digest email sent to ${user.email}` });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'TEST_SEND_FAILED', message: `Failed to dispatch test digest: ${err.message}` } });
  }
});
