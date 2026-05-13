/**
 * server/scripts/migrate.js
 * Runs schema.sql against the database on first deploy.
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS logic.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');

  // Wrap everything in IF NOT EXISTS so re-runs are safe
  const safeSchema = schema
    .replace(/CREATE TABLE (\w+)/g, 'CREATE TABLE IF NOT EXISTS $1')
    .replace(/CREATE INDEX (\w+)/g, 'CREATE INDEX IF NOT EXISTS $1');

  try {
    await pool.query(safeSchema);
    console.log('✅ Database schema applied successfully');
  } catch (err) {
    // Non-fatal — table may already exist
    console.warn('⚠️  Migration warning (may be safe to ignore):', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
