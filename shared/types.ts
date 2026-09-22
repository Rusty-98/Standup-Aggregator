// Shared types between Client and Server for Dailies v1.0

export type UserRole = 'member' | 'lead' | 'admin';

export type BlockerSeverity = 'low' | 'medium' | 'critical';

export type LeaveType = 'leave' | 'sick' | 'holiday' | 'travel' | 'other';

export type StandupStatus = 'draft' | 'submitted';

export type DayStatus = 'submitted' | 'not submitted' | 'on leave' | 'holiday' | 'weekend';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  team_id: number;
  is_active: boolean;
  notification_prefs: {
    morning: boolean;
    cutoff: boolean;
  };
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  extra_digest_recipients: string[];
  reminder_morning_time: string;
  reminder_cutoff_time: string;
  digest_time: string;
  webhook_url?: string;
  reminder_template?: string;
  digest_template?: string;
  created_at: string;
  members_count?: number;
  members?: User[];
}

export interface Standup {
  id: number;
  user_id: number;
  team_id: number;
  standup_date: string; // YYYY-MM-DD
  status: StandupStatus;
  yesterday_html: string;
  yesterday_text: string;
  today_html: string;
  today_text: string;
  has_blockers: boolean;
  blocker_html: string;
  blocker_text: string;
  blocker_severity: BlockerSeverity | null;
  blocked_on_user_id: number | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarryOverItem {
  id: string;
  text: string;
}

export interface TodayResponse {
  entry: Standup | null;
  carryOver: CarryOverItem[];
  windowState: 'open' | 'past_cutoff';
  leaveToday: boolean;
  cutoffTime: string; // e.g. "20:00"
  orgTimezone: string;
  currentOrgDate: string;
}

export interface SaveStandupPayload {
  yesterday_html: string;
  yesterday_text?: string;
  today_html: string;
  today_text?: string;
  has_blockers: boolean;
  blocker_html?: string;
  blocker_text?: string;
  blocker_severity?: BlockerSeverity | null;
  blocked_on_user_id?: number | null;
}

export interface DaySummary {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  status: DayStatus;
  plannedCount: number;
  doneCount: number;
  hasBlocker: boolean;
  standup?: Standup | null;
  leaveInfo?: {
    type: LeaveType;
    note?: string;
  } | null;
}

export interface TeamMemberStatus {
  user: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
  };
  status: 'submitted' | 'not_submitted' | 'on_leave';
  submitted_at: string | null;
  yesterday_html: string;
  today_html: string;
  has_blockers: boolean;
  blocker_html: string;
  blocker_severity: BlockerSeverity | null;
  blocked_on_user?: {
    id: number;
    name: string;
  } | null;
  leave?: {
    type: LeaveType;
    start_date: string;
    end_date: string;
    note: string;
  } | null;
}

export interface TeamSummary {
  date: string;
  totalMembers: number;
  submittedCount: number;
  onLeaveCount: number;
  notSubmittedCount: number;
  blockerCount: number;
  members: TeamMemberStatus[];
}

export interface LeaveRecord {
  id: number;
  user_id: number;
  user_name?: string;
  start_date: string;
  end_date: string;
  type: LeaveType;
  note: string;
  created_by: number;
  created_at: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface JobRun {
  id: number;
  kind: 'daily_digest' | 'weekly_recap' | 'morning' | 'cutoff';
  team_id: number | null;
  run_date: string;
  status: 'running' | 'sent' | 'failed' | 'skipped';
  recipients: number;
  attempts: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface AuthVerifyResponse {
  user: User;
  team: Team | null;
}

export interface MeResponse {
  user: User;
  team: Team | null;
  orgTimezone: string;
  cutoff: string;
  currentOrgDate?: string;
}
