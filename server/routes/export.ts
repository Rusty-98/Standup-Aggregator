import { Router, Response } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db/client.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../lib/authMiddleware.js';

export const exportRouter = Router();

exportRouter.use(authMiddleware);

// GET /api/export.xlsx?from=&to=&teamId=
exportRouter.get('/export.xlsx', requireRole(['lead', 'admin']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const from = req.query.from as string || '2000-01-01';
  const to = req.query.to as string || '2099-12-31';
  const teamId = req.query.teamId ? parseInt(req.query.teamId as string, 10) : user.team_id;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SyncPulse';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Standups');

  worksheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Team', key: 'team', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Yesterday', key: 'yesterday', width: 40 },
    { header: 'Today', key: 'today', width: 40 },
    { header: 'Blockers', key: 'blockers', width: 35 },
    { header: 'Has blocker', key: 'has_blocker', width: 12 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Submitted at', key: 'submitted_at', width: 20 }
  ];

  // Header styling: clean utilitarian slate
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF121519' }
  };

  const rows = db.prepare(`
    SELECT
      s.standup_date as date,
      u.name as name,
      u.email as email,
      t.name as team,
      s.status as status,
      s.yesterday_text as yesterday,
      s.today_text as today,
      s.blocker_text as blockers,
      s.has_blockers as has_blocker,
      s.blocker_severity as severity,
      s.submitted_at as submitted_at
    FROM standups s
    JOIN users u ON u.id = s.user_id
    JOIN teams t ON t.id = s.team_id
    WHERE s.team_id = ? AND s.standup_date >= ? AND s.standup_date <= ?
    ORDER BY s.standup_date DESC, u.name ASC
  `).all(teamId, from, to) as any[];

  for (const r of rows) {
    worksheet.addRow({
      date: r.date,
      name: r.name,
      email: r.email,
      team: r.team,
      status: r.status === 'submitted' ? 'Submitted' : 'Draft',
      yesterday: r.yesterday,
      today: r.today,
      blockers: r.blockers || '',
      has_blocker: r.has_blocker ? 'Yes' : 'No',
      severity: r.severity || '',
      submitted_at: r.submitted_at || ''
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="syncpulse-standups-${from}-to-${to}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});
