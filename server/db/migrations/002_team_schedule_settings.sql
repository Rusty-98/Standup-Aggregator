-- 002_team_schedule_settings.sql: Add reminder and digest schedule configuration to teams
ALTER TABLE teams ADD COLUMN reminder_morning_time TEXT NOT NULL DEFAULT '09:30';
ALTER TABLE teams ADD COLUMN reminder_cutoff_time TEXT NOT NULL DEFAULT '19:15';
ALTER TABLE teams ADD COLUMN digest_time TEXT NOT NULL DEFAULT '20:00';
