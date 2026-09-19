require('dotenv').config();
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.warn('⚠️ TURSO_DATABASE_URL bulunamadı! Lütfen .env dosyasını veya ortam değişkenlerini kontrol edin.');
}

const client = createClient({
  url: url || 'file:local.db',
  authToken: authToken || undefined,
});

const normalizeArgs = (args) => {
  if (!args || args.length === 0) return [];
  const flat = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
  return flat.map(v => (v === undefined ? null : v));
};

const db = {
  client,

  async all(sql, ...params) {
    const args = normalizeArgs(params);
    const res = await client.execute({ sql, args });
    return res.rows;
  },

  async get(sql, ...params) {
    const args = normalizeArgs(params);
    const res = await client.execute({ sql, args });
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  async run(sql, ...params) {
    const args = normalizeArgs(params);
    const res = await client.execute({ sql, args });
    return {
      lastInsertRowid: res.lastInsertRowid !== undefined && res.lastInsertRowid !== null ? Number(res.lastInsertRowid) : null,
      changes: res.rowsAffected || 0,
      rowsAffected: res.rowsAffected || 0
    };
  },

  async execute(stmt) {
    return await client.execute(stmt);
  },

  async batch(stmts, mode = 'write') {
    const normalized = stmts.map(s => {
      if (typeof s === 'string') return s;
      return {
        sql: s.sql,
        args: normalizeArgs(s.args || [])
      };
    });
    return await client.batch(normalized, mode);
  }
};

async function initDb() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT,
        email TEXT,
        phone TEXT,
        color TEXT DEFAULT '#3B82F6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        default_member_id INTEGER,
        color TEXT DEFAULT '#3B82F6',
        FOREIGN KEY(default_member_id) REFERENCES team_members(id)
      );
    `);

    await client.execute(`
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
      );
    `);

    await client.execute(`
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lead_id) REFERENCES leads(id),
        FOREIGN KEY(category_id) REFERENCES categories(id),
        FOREIGN KEY(assigned_member_id) REFERENCES team_members(id)
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        outcome TEXT NOT NULL,
        caller_name TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lead_id) REFERENCES leads(id)
      );
    `);

    await client.execute(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        person TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Hızlı sorgular için performans indeksleri
    await client.execute('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_leads_district ON leads(district);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_leads_is_mobile ON leads(is_mobile);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_jobs_assigned ON jobs(assigned_member_id);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_jobs_lead ON jobs(lead_id);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_jobs_due_date ON jobs(due_date);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON call_logs(lead_id);');

    console.log('✅ Turso veritabanı tabloları ve indeksleri hazır.');
  } catch (err) {
    console.error('❌ Turso veritabanı başlatma hatası:', err.message);
  }
}

initDb().catch(console.error);

module.exports = db;
