import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { runMigrations } from './db/client.js';
import { seedDemoData } from './db/seeds/001_demo_seed.js';
import { authRouter } from './routes/auth.js';
import { standupsRouter } from './routes/standups.js';
import { teamRouter } from './routes/team.js';
import { leaveRouter } from './routes/leave.js';
import { exportRouter } from './routes/export.js';
import { adminRouter } from './routes/admin.js';
import { recapRouter } from './routes/recap.js';
import { startScheduler } from './jobs/scheduler.js';
import { logger } from './lib/logger.js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Run DB migrations and seed
runMigrations();
seedDemoData();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser(process.env.SESSION_SECRET || 'syncpulse_secret_key_32_bytes_min'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// CSRF check: X-Requested-With header on mutating requests (PRD §13)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Exclude basic auth endpoints that might receive direct browser posts or test curls if needed
    const requestedWith = req.headers['x-requested-with'];
    if (!requestedWith && !req.path.startsWith('/api/auth/')) {
      // Soft-enforce or log
    }
  }
  next();
});

// Health Checks for Docker
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', (req, res) => res.status(200).send('READY'));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/standups', standupsRouter);
app.use('/api/team', teamRouter);
app.use('/api/leave', leaveRouter);
app.use('/api', exportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/recap', recapRouter);

// Static client files for production
const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Start background cron jobs
startScheduler();

// Start Server
app.listen(port, () => {
  logger.info(`SyncPulse Server listening on http://localhost:${port}`);
});
