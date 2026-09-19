const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

const localDbPath = path.join(__dirname, '../../../../../../../../d/power_partner/server/data/powerpartner.db');
const localDb = new Database('d:\\power_partner\\server\\data\\powerpartner.db');

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('TURSO_DATABASE_URL veya TURSO_AUTH_TOKEN bulunamadi!');
  process.exit(1);
}

const turso = createClient({
  url: tursoUrl,
  authToken: tursoToken
});

async function migrate() {
  console.log('Turso semasi olusturuluyor...');

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      email TEXT,
      phone TEXT,
      color TEXT DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      default_member_id INTEGER,
      color TEXT DEFAULT '#3B82F6'
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      district TEXT,
      city TEXT,
      address TEXT,
      phone TEXT,
      raw_phone TEXT,
      phone_type TEXT,
      phone_type_label TEXT,
      is_mobile INTEGER DEFAULT 0,
      whatsapp_link TEXT,
      call_link TEXT,
      rating REAL,
      user_ratings_total INTEGER DEFAULT 0,
      website TEXT,
      has_website INTEGER DEFAULT 0,
      instagram TEXT,
      has_instagram INTEGER DEFAULT 0,
      maps_url TEXT,
      lat REAL,
      lng REAL,
      status TEXT DEFAULT 'arama_listesi',
      score INTEGER DEFAULT 0,
      retry_date TEXT,
      products TEXT,
      visit_date TEXT,
      call_notes TEXT,
      call_count INTEGER DEFAULT 0,
      last_called_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category_id INTEGER,
      assigned_member_id INTEGER,
      products TEXT,
      status TEXT DEFAULT 'devam_ediyor',
      due_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      caller_name TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      person TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Semalar basariyla hazirlandi. Veriler aktariliyor...');

  const settingsRows = localDb.prepare('SELECT * FROM settings').all();
  for (const row of settingsRows) {
    await turso.execute({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', args: [row.key, row.value] });
  }
  console.log('Settings aktarildi:', settingsRows.length);

  const memberRows = localDb.prepare('SELECT * FROM team_members').all();
  for (const row of memberRows) {
    await turso.execute({ sql: 'INSERT OR REPLACE INTO team_members (id, name, role, email, phone, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [row.id, row.name, row.role, row.email, row.phone, row.color, row.created_at] });
  }
  console.log('Team members aktarildi:', memberRows.length);

  const userRows = localDb.prepare('SELECT * FROM users').all();
  for (const row of userRows) {
    await turso.execute({ sql: 'INSERT OR REPLACE INTO users (id, username, password, name, role, person, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [row.id, row.username, row.password, row.name, row.role, row.person, row.created_at] });
  }
  console.log('Users aktarildi:', userRows.length);

  const catRows = localDb.prepare('SELECT * FROM categories').all();
  for (const row of catRows) {
    await turso.execute({ sql: 'INSERT OR REPLACE INTO categories (id, name, description, default_member_id, color) VALUES (?, ?, ?, ?, ?)', args: [row.id, row.name, row.description, row.default_member_id, row.color] });
  }
  console.log('Categories aktarildi:', catRows.length);

  const leadRows = localDb.prepare('SELECT * FROM leads').all();
  console.log('Leads aktarilacak toplam adet:', leadRows.length);
  for (const row of leadRows) {
    await turso.execute({
      sql: 'INSERT OR REPLACE INTO leads (id, place_id, name, category, district, city, address, phone, raw_phone, phone_type, phone_type_label, is_mobile, whatsapp_link, call_link, rating, user_ratings_total, website, has_website, instagram, has_instagram, maps_url, lat, lng, status, score, retry_date, products, visit_date, call_notes, call_count, last_called_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        row.id, row.place_id, row.name, row.category, row.district, row.city, row.address,
        row.phone, row.raw_phone, row.phone_type, row.phone_type_label, row.is_mobile,
        row.whatsapp_link, row.call_link, row.rating, row.user_ratings_total,
        row.website, row.has_website, row.instagram, row.has_instagram,
        row.maps_url, row.lat, row.lng, row.status, row.score, row.retry_date, row.products,
        row.visit_date, row.call_notes, row.call_count, row.last_called_at, row.created_at, row.updated_at
      ]
    });
  }
  console.log('Leads aktarildi:', leadRows.length);

  const logRows = localDb.prepare('SELECT * FROM call_logs').all();
  for (const row of logRows) {
    await turso.execute({ sql: 'INSERT OR REPLACE INTO call_logs (id, lead_id, outcome, caller_name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: [row.id, row.lead_id, row.outcome, row.caller_name, row.notes, row.created_at] });
  }
  console.log('Call logs aktarildi:', logRows.length);

  const jobRows = localDb.prepare('SELECT * FROM jobs').all();
  for (const row of jobRows) {
    await turso.execute({ sql: 'INSERT OR REPLACE INTO jobs (id, lead_id, title, category_id, assigned_member_id, products, status, due_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [row.id, row.lead_id, row.title, row.category_id, row.assigned_member_id, row.products, row.status, row.due_date, row.notes, row.created_at, row.updated_at] });
  }
  console.log('Jobs aktarildi:', jobRows.length);

  console.log('TUM VERILER TURSO BULUTUNA BASARIYLA AKTARILDI!');
}

migrate().catch(e => { console.error('HATA:', e); process.exit(1); });
