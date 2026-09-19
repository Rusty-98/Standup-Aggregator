import { db } from '../db/client.js';
import { LeaveRecord, LeaveType } from '../../shared/types.js';

export class LeaveConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeaveConflictError';
  }
}

export function isUserOnLeave(userId: number, dateStr: string): boolean {
  const row = db.prepare(`
    SELECT id FROM leaves
    WHERE user_id = ? AND start_date <= ? AND end_date >= ?
    LIMIT 1
  `).get(userId, dateStr, dateStr);

  return !!row;
}

export function getUserLeaveForDate(userId: number, dateStr: string) {
  return db.prepare(`
    SELECT * FROM leaves
    WHERE user_id = ? AND start_date <= ? AND end_date >= ?
    LIMIT 1
  `).get(userId, dateStr, dateStr) as unknown as LeaveRecord | undefined;
}

export function getLeaves({
  userId,
  from,
  to
}: {
  userId?: number;
  from?: string;
  to?: string;
}): LeaveRecord[] {
  let query = `
    SELECT l.*, u.name as user_name
    FROM leaves l
    JOIN users u ON u.id = l.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (userId) {
    query += ` AND l.user_id = ?`;
    params.push(userId);
  }
  if (from) {
    query += ` AND l.end_date >= ?`;
    params.push(from);
  }
  if (to) {
    query += ` AND l.start_date <= ?`;
    params.push(to);
  }

  query += ` ORDER BY l.start_date DESC`;
  return db.prepare(query).all(...params) as unknown as LeaveRecord[];
}

export function recordLeave({
  userId,
  startDate,
  endDate,
  type,
  note,
  createdBy
}: {
  userId: number;
  startDate: string;
  endDate: string;
  type: LeaveType;
  note: string;
  createdBy: number;
}): LeaveRecord {
  if (endDate < startDate) {
    throw new Error('End date must be on or after start date');
  }

  // Check overlapping ranges for this user
  const overlap = db.prepare(`
    SELECT id, start_date, end_date FROM leaves
    WHERE user_id = ?
      AND NOT (end_date < ? OR start_date > ?)
    LIMIT 1
  `).get(userId, startDate, endDate) as unknown as { id: number; start_date: string; end_date: string } | undefined;

  if (overlap) {
    throw new LeaveConflictError(`An overlapping leave range already exists (${overlap.start_date} to ${overlap.end_date})`);
  }

  const insert = db.prepare(`
    INSERT INTO leaves (user_id, start_date, end_date, type, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(userId, startDate, endDate, type, note || '', createdBy);
  return db.prepare(`SELECT l.*, u.name as user_name FROM leaves l JOIN users u ON u.id = l.user_id WHERE l.id = ?`).get(result.lastInsertRowid) as unknown as LeaveRecord;
}

export function deleteLeave(id: number, requestingUserId: number, requestingUserRole: string): boolean {
  const leave = db.prepare('SELECT user_id FROM leaves WHERE id = ?').get(id) as unknown as { user_id: number } | undefined;
  if (!leave) return false;

  if (leave.user_id !== requestingUserId && requestingUserRole !== 'lead' && requestingUserRole !== 'admin') {
    throw new Error('Unauthorized to delete this leave record');
  }

  db.prepare('DELETE FROM leaves WHERE id = ?').run(id);
  return true;
}
