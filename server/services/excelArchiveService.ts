import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { db } from '../db/client.js';
import { logger } from '../lib/logger.js';

export async function archiveTeamStandupExcel(teamId: number, dateStr: string): Promise<string> {
  const exportDir = process.env.EXPORT_DIR?.trim() || (process.env.NODE_ENV === 'production' ? '/data/exports' : path.resolve(process.cwd(), 'exports'));

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const team = db.prepare('SELECT id, name, slug FROM teams WHERE id = ?').get(teamId) as any;
  const teamSlug = team?.slug || `team-${teamId}`;
  const fileName = `${teamSlug}-${dateStr}.xlsx`;
  const filePath = path.join(exportDir, fileName);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dailies';
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
    WHERE s.team_id = ? AND s.standup_date = ?
    ORDER BY u.name ASC
  `).all(teamId, dateStr) as any[];

  for (const r of rows) {
    worksheet.addRow({
      date: r.date,
      name: r.name,
      email: r.email,
      team: r.team,
      status: r.status === 'submitted' ? 'Submitted' : 'Draft',
      yesterday: r.yesterday || '',
      today: r.today || '',
      blockers: r.blockers || '',
      has_blocker: r.has_blocker ? 'Yes' : 'No',
      severity: r.severity || '',
      submitted_at: r.submitted_at || ''
    });
  }

  await workbook.xlsx.writeFile(filePath);
  logger.info({ filePath, teamSlug, dateStr, rowsCount: rows.length }, 'Nightly Excel digest archive written to disk');
  return filePath;
}
