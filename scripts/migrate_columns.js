const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrate() {
  const cols = [
    { name: 'assigned_caller_id', type: 'INTEGER' },
    { name: 'assigned_caller_name', type: 'TEXT' },
    { name: 'recall_date', type: 'TEXT' },
    { name: 'recall_time', type: 'TEXT' },
    { name: 'is_verified_location', type: 'INTEGER DEFAULT 1' },
    { name: 'actual_district', type: 'TEXT' },
    { name: 'website_status', type: "TEXT DEFAULT 'unknown'" },
    { name: 'phone_status', type: "TEXT DEFAULT 'valid'" }
  ];

  for (const col of cols) {
    try {
      await client.execute(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✓ Added column: ${col.name}`);
    } catch (e) {
      console.log(`- Column ${col.name}: ${e.message}`);
    }
  }

  // Also update local SQLite database if exists
  try {
    const Database = require('better-sqlite3');
    const localDbPath = path.join(__dirname, '..', 'server', 'data', 'powerpartner.db');
    const localDb = new Database(localDbPath);
    for (const col of cols) {
      try {
        localDb.prepare(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`).run();
        console.log(`✓ Local DB: Added column ${col.name}`);
      } catch (e) {
        // already exists
      }
    }
  } catch (e) {
    console.warn('Local DB migration notice:', e.message);
  }

  const res = await client.execute('PRAGMA table_info(leads)');
  console.log('Final columns in Turso leads table:\n', res.rows.map(r => r.name).join(', '));
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
