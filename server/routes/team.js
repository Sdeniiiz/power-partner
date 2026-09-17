const express = require('express');
const router = express.Router();
const db = require('../db');

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

// Yeni ekip üyesi ekle
router.post('/members', (req, res) => {
  try {
    const { name, role, email, phone, color } = req.body;
    if (!name) return res.status(400).json({ error: 'İsim gereklidir.' });

    const result = db.prepare(`
      INSERT INTO team_members (name, role, email, phone, color)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, role || '', email || '', phone || '', color || '#3B82F6');

    const created = db.prepare('SELECT * FROM team_members WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ekip üyesi sil
router.delete('/members/:id', (req, res) => {
  try {
    const memberId = req.params.id;
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

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
    if (existing) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }

    const result = db.prepare(`
      INSERT INTO users (username, password, name, role, person)
      VALUES (?, ?, ?, ?, ?)
    `).run(username.trim().toLowerCase(), password.trim(), name.trim(), role || 'member', person || name.trim());

    // Otomatik olarak team_members tablosuna da ekleyelim (eğer yoksa)
    const existingMember = db.prepare('SELECT id FROM team_members WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (!existingMember && role !== 'admin') {
      db.prepare('INSERT INTO team_members (name, role, color) VALUES (?, ?, ?)')
        .run(name.trim(), 'Ekip Üyesi', '#2563eb');
    }

    const created = db.prepare('SELECT id, username, name, role, person FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: created, message: 'Kullanıcı başarıyla oluşturuldu.' });
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

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ success: true, message: `${user.name} kullanıcısı silindi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

