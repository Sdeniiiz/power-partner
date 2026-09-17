const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'powerpartner.db');
const db = new Database(dbPath);

// Enable WAL mode for performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    default_member_id INTEGER,
    color TEXT DEFAULT '#3B82F6',
    FOREIGN KEY(default_member_id) REFERENCES team_members(id)
  );

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

  CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    caller_name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'admin' veya 'member'
    person TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe migrations if tables already existed
try { db.exec("ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 0;"); } catch(e){}
try { db.exec("ALTER TABLE leads ADD COLUMN retry_date TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE leads ADD COLUMN products TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE jobs ADD COLUMN products TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE team_members ADD COLUMN username TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE team_members ADD COLUMN password TEXT;"); } catch(e){}

// Seed initial users if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, role, person)
    VALUES (?, ?, ?, ?, ?)
  `);

  // 1. Yönetici (Admin)
  insertUser.run('admin', 'admin123', 'Sistem Yöneticisi', 'admin', null);
  // 2. Personeller
  insertUser.run('sezai', '123', 'Sezai', 'member', 'Sezai');
  insertUser.run('yes', '123', 'Yeş', 'member', 'Yeş');
  insertUser.run('burak', '123', 'Burak', 'member', 'Burak');
  insertUser.run('emre', '123', 'Emre', 'member', 'Emre');
}

// Seed initial team members if empty (Diyagramdaki kişiler)
const memberCount = db.prepare('SELECT COUNT(*) as count FROM team_members').get().count;
if (memberCount === 0) {
  const insertMember = db.prepare(`
    INSERT INTO team_members (name, role, email, phone, color)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertMember.run('Sezai', 'Web & Sosyal Medya Uzmanı', 'sezai@powerpartner.com', '0532 000 00 01', '#2563eb');
  insertMember.run('Yeş', 'Influencer & B2B Pazarlama', 'yes@powerpartner.com', '0533 000 00 02', '#db2777');
  insertMember.run('Burak', 'QR Menü & Dijital Dönüşüm', 'burak@powerpartner.com', '0535 000 00 03', '#059669');
  insertMember.run('Emre', 'Fiziki Baskı & Prodüksiyon', 'emre@powerpartner.com', '0544 000 00 04', '#d97706');
}

// Seed initial work categories if empty (Diyagramdaki iş dağıtım kategorileri)
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
if (categoryCount === 0) {
  const members = db.prepare('SELECT id, name FROM team_members').all();
  const getMemberId = (name) => members.find(m => m.name.toLowerCase() === name.toLowerCase())?.id || null;

  const insertCategory = db.prepare(`
    INSERT INTO categories (name, description, default_member_id, color)
    VALUES (?, ?, ?, ?)
  `);

  insertCategory.run('Web Hizmetleri', 'Web sitesi tasarımı, SEO ve teknik altyapı', getMemberId('Sezai'), '#2563eb');
  insertCategory.run('Sosyal Medya', 'İçerik üretimi, hesap yönetimi ve reklam', getMemberId('Sezai'), '#7c3aed');
  insertCategory.run('Influencer Marketing', 'Tanıtım işbirlikleri ve influencer kampanyaları', getMemberId('Yeş'), '#db2777');
  insertCategory.run('Powercoffee', 'Kurumsal kahve ve ortaklık konsepti', getMemberId('Yeş'), '#b45309');
  insertCategory.run('QR Menü', 'Dijital menü kurulumu ve entegrasyon', getMemberId('Burak'), '#059669');
  insertCategory.run('Fiziki Baskı', 'Broşür, tabela, kartvizit ve matbaa işleri', getMemberId('Emre'), '#ea580c');
}

module.exports = db;

