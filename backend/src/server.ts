import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import pool from './db';
import { connectMongo } from './mongo';
import app from './app';
import { startReminderCron } from './services/notificationService';

const PORT = process.env.PORT || 3001;

async function runMigrations(): Promise<void> {
  const migrations = [
    '001_initial_schema.sql',
    '002_password_reset.sql',
    '003_seed_data.sql',
    '004_google_auth.sql',
    '005_page_visits.sql',
    '006_screening_history.sql',
    '007_admin.sql',
  ];
  const client = await pool.connect();
  try {
    for (const file of migrations) {
      const sqlFile = path.join(__dirname, 'migrations', file);
      if (!fs.existsSync(sqlFile)) { console.log(`Skipping ${file} (not found)`); continue; }
      const sql = fs.readFileSync(sqlFile, 'utf-8');
      await client.query(sql);
      console.log(`✓ Migration: ${file}`);
    }
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    client.release();
  }
}

async function start(): Promise<void> {
  // Wait for DB to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch {
      retries--;
      console.log(`Waiting for database... (${retries} retries left)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  await runMigrations();
  await connectMongo();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startReminderCron();
  });
}

void start();
