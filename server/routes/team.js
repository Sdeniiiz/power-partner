const express = require('express');
const router = express.Router();
const db = require('../db');

const ROLE_COLORS = {
  'Soğuk Arama': '#0284c7', // Mavi/Sky
  'Saha Satış': '#16a34a', // Yeşil
  'Yazılım': '#8b5cf6', // Mor
  'Baskı / İmalat': '#ea580c', // Turuncu
  'Dijital Ürünler': '#0d9488', // Teal
  'admin': '#e11d48', // Gül/Kırmızı
  'Yönetici (Admin)': '#e11d48'
};

// Ekip üyelerini listele (iş sayıları ile)
router.get('/members', (req, res) => {
  try {
    const members = db.prepare(`
      SELECT
        m.*,
        COUNT(CASE WHEN j.status != 'tamamlandi' THEN 1 END) as active_jobs,
        COUNT(CASE WHEN j.status = 'tamamlandi' THEN 1 END) as completed_jobs
      FROM team_members m
      LEFT JOIN jobs j ON m.id = j.assigned_member_id
      GROUP BY m.id
      ORDER BY m.id ASC
    `).all();

    res.json({ data: members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni ekip üyesi ekle (users tablosu ile tam senkron)
router.post('/members', (req, res) => {
  try {
    const { name, role, email, phone, color, password, username } = req.body;
    if (!name) return res.status(400).json({ error: 'İsim gereklidir.' });

    const finalRole = role || 'Soğuk Arama';
    const memberColor = color || ROLE_COLORS[finalRole] || '#3B82F6';

    const result = db.prepare(`
      INSERT INTO team_members (name, role, email, phone, color)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), finalRole, email || '', phone || '', memberColor);

    // users tablosuna da ekle (otomatik giriş hesabı)
    const baseUsername = (username || name).trim().toLowerCase().replace(/[^a-z0-9]/g, '') || `user${result.lastInsertRowid}`;
    let finalUsername = baseUsername;
    let count = 1;
    while (db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(finalUsername)) {
      finalUsername = `${baseUsername}${count++}`;
    }

    const userRole = finalRole === 'Yönetici (Admin)' ? 'admin' : finalRole;
    db.prepare(`
      INSERT INTO users (username, password, name, role, person)
      VALUES (?, ?, ?, ?, ?)
    `).run(finalUsername, password ? password.trim() : '123', name.trim(), userRole, name.trim());

    const created = db.prepare('SELECT * FROM team_members WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ekip üyesi sil (users tablosundan da temizle)
router.delete('/members/:id', (req, res) => {
  try {
    const memberId = req.params.id;
    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(memberId);
    if (member) {
      const u = db.prepare('SELECT id, username FROM users WHERE LOWER(name) = LOWER(?)').get(member.name.trim());
      if (u && u.username.toLowerCase() !== 'admin') {
        db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
      }
    }
    // Bağlı işleri boşa çıkar veya sil
    db.prepare('UPDATE jobs SET assigned_member_id = NULL WHERE assigned_member_id = ?').run(memberId);
    db.prepare('UPDATE categories SET default_member_id = NULL WHERE default_member_id = ?').run(memberId);
    db.prepare('DELETE FROM team_members WHERE id = ?').run(memberId);
    res.json({ success: true, message: 'Personel silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kategorileri listele
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT
        c.*,
        m.name as default_member_name,
        COUNT(j.id) as total_jobs
      FROM categories c
      LEFT JOIN team_members m ON c.default_member_id = m.id
      LEFT JOIN jobs j ON c.id = j.category_id
      GROUP BY c.id
      ORDER BY c.id ASC
    `).all();

    res.json({ data: categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni kategori ekle
router.post('/categories', (req, res) => {
  try {
    const { name, description, default_member_id, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Kategori adı gereklidir.' });

    const result = db.prepare(`
      INSERT INTO categories (name, description, default_member_id, color)
      VALUES (?, ?, ?, ?)
    `).run(name, description || '', default_member_id || null, color || '#6366f1');

    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// KULLANICI GİRİŞ & YÖNETİMİ (AUTH & USERS)
// ==========================================

// Giriş Yap (Login)
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    }

    const user = db.prepare(`
      SELECT id, username, name, role, person, password 
      FROM users 
      WHERE LOWER(username) = LOWER(?)
    `).get(username.trim());

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
router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, name, role, person, created_at FROM users ORDER BY id ASC').all();
    res.json({ data: users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni kullanıcı oluştur (Admin için)
router.post('/users', (req, res) => {
  try {
    const { username, password, name, role, person } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Kullanıcı adı, şifre ve isim gereklidir.' });
    }

    const trimmedUser = username.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedUser);
    if (existing) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }

    const finalRole = role || 'Soğuk Arama';
    const displayRole = finalRole === 'admin' ? 'Yönetici (Admin)' : finalRole;
    const color = ROLE_COLORS[finalRole] || '#2563eb';

    const result = db.prepare(`
      INSERT INTO users (username, password, name, role, person)
      VALUES (?, ?, ?, ?, ?)
    `).run(trimmedUser, password.trim(), name.trim(), finalRole, person || name.trim());

    // Otomatik olarak team_members tablosuna da ekleyelim (eğer yoksa) veya güncelleyelim
    const existingMember = db.prepare('SELECT id FROM team_members WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (!existingMember) {
      db.prepare('INSERT INTO team_members (name, role, color) VALUES (?, ?, ?)')
        .run(name.trim(), displayRole, color);
    } else {
      db.prepare('UPDATE team_members SET role = ?, color = ? WHERE id = ?')
        .run(displayRole, color, existingMember.id);
    }

    const created = db.prepare('SELECT id, username, name, role, person FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: created, message: 'Personel / kullanıcı başarıyla oluşturuldu.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı Şifre Değiştir (Yönetici veya kullanıcının kendisi)
router.put('/users/:id/password', (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || !newPassword.trim()) {
      return res.status(400).json({ error: 'Yeni şifre boş olamaz.' });
    }

    const user = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword.trim(), userId);
    res.json({ success: true, message: `${user.name} kullanıcısının şifresi başarıyla güncellendi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kullanıcı sil (Admin için)
router.delete('/users/:id', (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (user.username.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'Ana yönetici hesabı silinemez.' });
    }

    // team_members'dan da temizle
    const member = db.prepare('SELECT id FROM team_members WHERE LOWER(name) = LOWER(?)').get(user.name.trim());
    if (member) {
      db.prepare('UPDATE jobs SET assigned_member_id = NULL WHERE assigned_member_id = ?').run(member.id);
      db.prepare('UPDATE categories SET default_member_id = NULL WHERE default_member_id = ?').run(member.id);
      db.prepare('DELETE FROM team_members WHERE id = ?').run(member.id);
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ success: true, message: `${user.name} personeli ve kullanıcı hesabı silindi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

