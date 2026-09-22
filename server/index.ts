import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { runMigrations, db } from './db/client.js';
import { authRouter } from './routes/auth.js';
import { standupsRouter } from './routes/standups.js';
import { teamRouter } from './routes/team.js';
import { leaveRouter } from './routes/leave.js';
import { exportRouter } from './routes/export.js';
import { adminRouter } from './routes/admin.js';
import { recapRouter } from './routes/recap.js';
import { startScheduler } from './jobs/scheduler.js';
import { logger } from './lib/logger.js';
import { authMiddleware, AuthenticatedRequest } from './lib/authMiddleware.js';
import { getOrgDate } from './lib/dates.js';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), 'server', '.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Run DB migrations
runMigrations();

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser(process.env.SESSION_SECRET || 'dailies_secret_key_32_bytes_min'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } }
});
app.use('/api/auth/request-code', otpLimiter);
app.use('/api/auth/verify-code', otpLimiter);

function allowedOrigins(): Set<string> {
  const raw = [
    process.env.APP_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ].filter(Boolean) as string[];
  const origins = new Set<string>();
  for (const value of raw) {
    try {
      origins.add(new URL(value).origin);
    } catch {
      origins.add(value);
    }
  }
  return origins;
}

app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get('origin');
  if (!origin) {
    next();
    return;
  }
  if (!allowedOrigins().has(origin)) {
    res.status(403).json({ error: { code: 'BAD_ORIGIN', message: 'Request origin is not allowed' } });
    return;
  }
  next();
});

// Health Checks for Docker
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.status(200).send('READY');
  } catch {
    res.status(503).send('NOT READY');
  }
});

// Current Session Verification Route (Immediate Profile Check)
app.get(['/api/me', '/api/auth/me'], authMiddleware, (req: AuthenticatedRequest, res: express.Response): void => {
  const user = req.user!;
  const team = user.team_id ? db.prepare('SELECT id, name, slug, digest_time, reminder_morning_time, reminder_cutoff_time FROM teams WHERE id = ?').get(user.team_id) as any : null;

  res.json({
    user,
    team,
    orgTimezone: process.env.ORG_TIMEZONE || 'Asia/Kolkata',
    cutoff: team?.digest_time || process.env.DIGEST_TIME || '20:00',
    currentOrgDate: getOrgDate()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/standups', standupsRouter);
app.use('/api/team', teamRouter);
app.use('/api/digest', teamRouter);
app.use('/api/leave', leaveRouter);
app.use('/api', exportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/recap', recapRouter);

// 404 for unmatched API routes (prevents hang in Docker SPA fallback)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `API route ${req.method} ${req.path} not found` } });
});

// Static client files for production
const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start background cron jobs
startScheduler();

// Start Server
app.listen(port, () => {
  logger.info(`Dailies Server listening on http://localhost:${port}`);
});
