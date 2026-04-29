import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import pool from '../db';

async function migrate(): Promise<void> {
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
      const sqlFile = path.join(__dirname, file);
      if (!fs.existsSync(sqlFile)) {
        console.log(`Skipping ${file} (not found)`);
        continue;
      }
      const sql = fs.readFileSync(sqlFile, 'utf-8');
      console.log(`Running migration: ${file}`);
      await client.query(sql);
      console.log(`✓ ${file} completed`);
    }
    console.log('All migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
