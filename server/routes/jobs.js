const express = require('express');
const router = express.Router();
const db = require('../db');

// Tüm işleri listele (Kategori, Çalışan ve İşletme bilgileriyle birlikte)
router.get('/', (req, res) => {
  try {
    const { member_id, category_id, status } = req.query;

    let query = `
      SELECT
        j.*,
        l.name as lead_name,
        l.phone as lead_phone,
        l.district as lead_district,
        l.city as lead_city,
        l.website as lead_website,
        c.name as category_name,
        c.color as category_color,
        m.name as member_name,
        m.role as member_role,
        m.color as member_color,
        m.email as member_email
      FROM jobs j
      JOIN leads l ON j.lead_id = l.id
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN team_members m ON j.assigned_member_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (member_id) {
      query += ' AND j.assigned_member_id = ?';
      params.push(member_id);
    }
    if (category_id) {
      query += ' AND j.category_id = ?';
      params.push(category_id);
    }
    if (status) {
      query += ' AND j.status = ?';
      params.push(status);
    }

    query += ' ORDER BY j.due_date ASC, j.id DESC';

    const jobs = db.prepare(query).all(...params);
    res.json({ data: jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Satış Havuzundan İş Dağıtımı Yap (Diyagram: Satış Havuzu -> İş Dağıtımı -> Kategori & Çalışan)
router.post('/', (req, res) => {
  try {
    const { lead_id, category_id, assigned_member_id, title, due_date, notes, products } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: 'İşletme seçilmelidir.' });
    }
    if (!title) {
      return res.status(400).json({ error: 'İş başlığı girilmelidir.' });
    }
    if (!due_date) {
      return res.status(400).json({ error: 'Lütfen teslim tarihi belirleyiniz.' });
    }

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
    if (!lead) {
      return res.status(404).json({ error: 'İşletme bulunamadı.' });
    }

    const productsStr = products ? (typeof products === 'string' ? products : JSON.stringify(products)) : null;

    // İşi oluştur
    const insertJob = db.prepare(`
      INSERT INTO jobs (lead_id, category_id, assigned_member_id, title, due_date, notes, products, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'devam_ediyor')
    `);

    const result = insertJob.run(
      lead_id,
      category_id || null,
      assigned_member_id || null,
      title,
      due_date,
      notes || '',
      productsStr
    );

    // Müşteri adayının durumunu 'is_dagitildi' yap
    db.prepare(`
      UPDATE leads
      SET status = 'is_dagitildi', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(lead_id);

    const createdJob = db.prepare(`
      SELECT j.*, l.name as lead_name, c.name as category_name, m.name as member_name
      FROM jobs j
      JOIN leads l ON j.lead_id = l.id
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN team_members m ON j.assigned_member_id = m.id
      WHERE j.id = ?
    `).get(result.lastInsertRowid);

    res.json({
      success: true,
      data: createdJob,
      message: 'İş başarıyla oluşturuldu ve ekip üyesine atandı.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İş Durumunu veya Teslim Tarihini Güncelle
router.put('/:id', (req, res) => {
  try {
    const { status, due_date, notes, assigned_member_id, products } = req.body;
    const jobId = req.params.id;

    const productsStr = products !== undefined ? (typeof products === 'string' ? products : JSON.stringify(products)) : null;

    db.prepare(`
      UPDATE jobs
      SET
        status = COALESCE(?, status),
        due_date = COALESCE(?, due_date),
        notes = COALESCE(?, notes),
        assigned_member_id = COALESCE(?, assigned_member_id),
        products = CASE WHEN ? IS NOT NULL THEN ? ELSE products END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status || null, due_date || null, notes || null, assigned_member_id || null, productsStr, productsStr, jobId);


    const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    res.json({ success: true, data: updated, message: 'İş güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İşi Sil
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'İş silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
