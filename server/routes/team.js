const express = require('express');
const router = express.Router();
const db = require('../db');

const ROLE_COLORS = {
  'Soğuk Arama': '#0284c7',
  'Saha Satış': '#16a34a',
  'Yazılım': '#8b5cf6',
  'Baskı / İmalat': '#ea580c',
  'Dijital Ürünler': '#0d9488',
  'Müdür': '#b45309',
  'admin': '#e11d48',
  'Yönetici (Admin)': '#e11d48'
};

const PALETTE = ['#0284c7', '#16a34a', '#8b5cf6', '#ea580c', '#0d9488', '#b45309', '#4f46e5', '#db2777', '#0891b2', '#475569'];
function getRoleColor(role) {
  if (!role) return '#2563eb';
  if (ROLE_COLORS[role]) return ROLE_COLORS[role];
  let hash = 0;
  for (let i = 0; i < role.length; i++) hash = role.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

let cachedRoles = null;
let rolesCacheTime = 0;

// Tüm rolleri listele (Varsayılan + Kayıtlı Özel Roller)
router.get('/roles', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedRoles && (now - rolesCacheTime < 60000)) {
      return res.json({ data: cachedRoles });
    }

    const defaultRoles = [
      'Soğuk Arama',
      'Saha Satış',
      'Yazılım',
      'Baskı / İmalat',
      'Dijital Ürünler',
      'Müdür',
      'admin'
    ];

    const [dbRolesRows, savedCustom] = await Promise.all([
      db.all(`
        SELECT DISTINCT role FROM users WHERE role IS NOT NULL AND TRIM(role) != ''
        UNION
        SELECT DISTINCT role FROM team_members WHERE role IS NOT NULL AND TRIM(role) != ''
      `),
      db.get("SELECT value FROM settings WHERE key = 'custom_roles'")
    ]);

    const dbRoles = dbRolesRows.map(r => r.role);

    let customList = [];
    try {
      if (savedCustom?.value) customList = JSON.parse(savedCustom.value);
    } catch(e) {}

    const allRoles = Array.from(new Set([...defaultRoles, ...dbRoles, ...customList]))
      .filter(r => r && r !== 'member' && r !== 'Ekip Üyesi');

    cachedRoles = allRoles;
    rolesCacheTime = now;

    res.json({ data: allRoles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni özel rol ekle
router.post('/roles', async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !role.trim()) {
      return res.status(400).json({ error: 'Rol adı gereklidir.' });
    }
    const cleanRole = role.trim();

    const savedCustom = await db.get("SELECT value FROM settings WHERE key = 'custom_roles'");
    let customList = [];
    try {
      if (savedCustom?.value) customList = JSON.parse(savedCustom.value);
    } catch(e) {}

    if (!customList.includes(cleanRole)) {
      customList.push(cleanRole);
      await db.run(`
        INSERT INTO settings (key, value) VALUES ('custom_roles', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, JSON.stringify(customList));
      cachedRoles = null;
    }

    res.json({ success: true, role: cleanRole, message: `"${cleanRole}" rolü başarıyla kaydedildi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ekip üyelerini listele (iş sayıları ile)
router.get('/members', async (req, res) => {
  try {
    const members = await db.all(`
      SELECT
        m.*,
        COUNT(CASE WHEN j.status != 'tamamlandi' THEN 1 END) as active_jobs,
        COUNT(CASE WHEN j.status = 'tamamlandi' THEN 1 END) as completed_jobs
      FROM team_members m
      LEFT JOIN jobs j ON m.id = j.assigned_member_id
      GROUP BY m.id
      ORDER BY m.id ASC
    `);

    res.json({ data: members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni ekip üyesi ekle (users tablosu ile tam senkron)
router.post('/members', async (req, res) => {
  try {
    const { name, role, email, phone, color, password, username } = req.body;
    if (!name) return res.status(400).json({ error: 'İsim gereklidir.' });

    const finalRole = role || 'Soğuk Arama';
    const memberColor = color || getRoleColor(finalRole);

    const result = await db.run(`
      INSERT INTO team_members (name, role, email, phone, color)
      VALUES (?, ?, ?, ?, ?)
    `, name.trim(), finalRole, email || '', phone || '', memberColor);

    // users tablosuna da ekle (otomatik giriş hesabı)
    const baseUsername = (username || name).trim().toLowerCase().replace(/[^a-z0-9]/g, '') || `user${result.lastInsertRowid}`;
    let finalUsername = baseUsername;
    let count = 1;
    while (await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', finalUsername)) {
      finalUsername = `${baseUsername}${count++}`;
    }

    const userRole = finalRole === 'Yönetici (Admin)' ? 'admin' : finalRole;
    await db.run(`
      INSERT INTO users (username, password, name, role, person)
      VALUES (?, ?, ?, ?, ?)
    `, finalUsername, password ? password.trim() : '123', name.trim(), userRole, name.trim());

    const created = await db.get('SELECT * FROM team_members WHERE id = ?', result.lastInsertRowid);
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ekip üyesi sil (users tablosundan da temizle)
router.delete('/members/:id', async (req, res) => {
  try {
    const memberId = req.params.id;
    const member = await db.get('SELECT * FROM team_members WHERE id = ?', memberId);
    if (member) {
      const u = await db.get('SELECT id, username FROM users WHERE LOWER(name) = LOWER(?)', member.name.trim());
      if (u && u.username.toLowerCase() !== 'admin') {
        await db.run('DELETE FROM users WHERE id = ?', u.id);
      }
    }
    // Bağlı işleri boşa çıkar veya sil
    await db.run('UPDATE jobs SET assigned_member_id = NULL WHERE assigned_member_id = ?', memberId);
    await db.run('UPDATE categories SET default_member_id = NULL WHERE default_member_id = ?', memberId);
    await db.run('DELETE FROM team_members WHERE id = ?', memberId);
    res.json({ success: true, message: 'Personel silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kategorileri listele
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.all(`
      SELECT
        c.*,
        m.name as default_member_name,
        COUNT(j.id) as total_jobs
      FROM categories c
      LEFT JOIN team_members m ON c.default_member_id = m.id
      LEFT JOIN jobs j ON c.id = j.category_id
      GROUP BY c.id
      ORDER BY c.id ASC
    `);

    res.json({ data: categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni kategori ekle
router.post('/categories', async (req, res) => {
  try {
    const { name, description, default_member_id, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Kategori adı gereklidir.' });

    const result = await db.run(`
      INSERT INTO categories (name, description, default_member_id, color)
      VALUES (?, ?, ?, ?)
    `, name, description || '', default_member_id || null, color || '#6366f1');

    const created = await db.get('SELECT * FROM categories WHERE id = ?', result.lastInsertRowid);
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// KULLANICI GİRİŞ & YÖNETİMİ (AUTH & USERS)
// ==========================================

// Giriş Yap (Login)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    }

    const user = await db.get(`
      SELECT id, username, name, role, person, password 
      FROM users 
      WHERE LOWER(username) = LOWER(?)
    `, username.trim());

    if (!user || user.password !== password.trim()) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    // Şifreyi yanıttan çıkar
    const { password: _, ...userSafe } = user;
    res.json({ success: true, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm kullanıcıları listele (Admin için)
router.get('/users', async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, name, role, person, created_at FROM users ORDER BY id ASC');
    res.json({ data: users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni kullanıcı oluştur (Admin için)
router.post('/users', async (req, res) => {
  try {
    const { username, password, name, role, person } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Kullanıcı adı, şifre ve isim gereklidir.' });
    }

    const trimmedUser = username.trim().toLowerCase();
    const existing = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', trimmedUser);
    if (existing) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }

    const finalRole = role || 'Soğuk Arama';
    const displayRole = finalRole === 'admin' ? 'Yönetici (Admin)' : finalRole;
    const color = getRoleColor(finalRole);

    const result = await db.run(`
      INSERT INTO users (username, password, name, role, person)
      VALUES (?, ?, ?, ?, ?)
    `, trimmedUser, password.trim(), name.trim(), finalRole, person || name.trim());

    // Otomatik olarak team_members tablosuna da ekleyelim (eğer yoksa) veya güncelleyelim
    const existingMember = await db.get('SELECT id FROM team_members WHERE LOWER(name) = LOWER(?)', name.trim());
    if (!existingMember) {
      await db.run('INSERT INTO team_members (name, role, color) VALUES (?, ?, ?)', name.trim(), displayRole, color);
    } else {
      await db.run('UPDATE team_members SET role = ?, color = ? WHERE id = ?', displayRole, color, existingMember.id);
    }

    const created = await db.get('SELECT id, username, name, role, person FROM users WHERE id = ?', result.lastInsertRowid);
    res.json({ success: true, data: created, message: 'Personel / kullanıcı başarıyla oluşturuldu.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı Şifre Değiştir (Yönetici veya kullanıcının kendisi)
router.put('/users/:id/password', async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || !newPassword.trim()) {
      return res.status(400).json({ error: 'Yeni şifre boş olamaz.' });
    }

    const user = await db.get('SELECT id, username, name FROM users WHERE id = ?', userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    await db.run('UPDATE users SET password = ? WHERE id = ?', newPassword.trim(), userId);
    res.json({ success: true, message: `${user.name} kullanıcısının şifresi başarıyla güncellendi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı sil (Admin için)
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (user.username.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'Ana yönetici hesabı silinemez.' });
    }

    // team_members'dan da temizle
    const member = await db.get('SELECT id FROM team_members WHERE LOWER(name) = LOWER(?)', user.name.trim());
    if (member) {
      await db.run('UPDATE jobs SET assigned_member_id = NULL WHERE assigned_member_id = ?', member.id);
      await db.run('UPDATE categories SET default_member_id = NULL WHERE default_member_id = ?', member.id);
      await db.run('DELETE FROM team_members WHERE id = ?', member.id);
    }

    await db.run('DELETE FROM users WHERE id = ?', userId);
    res.json({ success: true, message: `${user.name} personeli ve kullanıcı hesabı silindi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
