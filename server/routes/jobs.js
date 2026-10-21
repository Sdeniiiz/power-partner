const express = require('express');
const router = express.Router();
const db = require('../db');

// Tüm işleri listele (Kategori, Çalışan ve İşletme bilgileriyle birlikte)
router.get('/', async (req, res) => {
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

    const jobs = await db.all(query, ...params);
    res.json({ data: jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Satış Havuzundan İş Dağıtımı Yap (Tekli veya Çoklu Ayrı İş Oluşturma Desteği)
router.post('/', async (req, res) => {
  try {
    const { lead_id, category_id, assigned_member_id, title, due_date, notes, products, jobs_list, keep_in_pool } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: 'İşletme seçilmelidir.' });
    }

    const lead = await db.get('SELECT * FROM leads WHERE id = ?', lead_id);
    if (!lead) {
      return res.status(404).json({ error: 'İşletme bulunamadı.' });
    }

    const insertSql = `
      INSERT INTO jobs (lead_id, category_id, assigned_member_id, title, due_date, notes, products, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'devam_ediyor')
    `;

    const createdIds = [];

    // Eğer birden fazla ayrı iş (jobs_list) gönderildiyse her birini ayrı iş satırı olarak kaydet
    if (Array.isArray(jobs_list) && jobs_list.length > 0) {
      for (const item of jobs_list) {
        const itemTitle = (item.title || `${lead.name} - Hizmet Paketi`).trim();
        const itemDueDate = item.due_date || due_date;
        if (!itemDueDate) {
          return res.status(400).json({ error: `"${itemTitle}" için teslim tarihi belirlenmelidir.` });
        }
        const itemProductsStr = item.products
          ? (typeof item.products === 'string' ? item.products : JSON.stringify(item.products))
          : null;

        const result = await db.run(
          insertSql,
          lead_id,
          item.category_id || null,
          item.assigned_member_id || assigned_member_id || null,
          itemTitle,
          itemDueDate,
          item.notes !== undefined ? item.notes : (notes || ''),
          itemProductsStr
        );
        if (result.lastInsertRowid) {
          createdIds.push(result.lastInsertRowid);
        }
      }
    } else {
      if (!title) {
        return res.status(400).json({ error: 'İş başlığı girilmelidir.' });
      }
      if (!due_date) {
        return res.status(400).json({ error: 'Lütfen teslim tarihi belirleyiniz.' });
      }

      const productsStr = products ? (typeof products === 'string' ? products : JSON.stringify(products)) : null;

      const result = await db.run(
        insertSql,
        lead_id,
        category_id || null,
        assigned_member_id || null,
        title,
        due_date,
        notes || '',
        productsStr
      );
      if (result.lastInsertRowid) {
        createdIds.push(result.lastInsertRowid);
      }
    }

    // Müşteri adayının durumunu (eğer havuzda tut seçeneği işaretlenmediyse) 'is_dagitildi' yap
    if (!keep_in_pool) {
      await db.run(`
        UPDATE leads
        SET status = 'is_dagitildi', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, lead_id);
    }

    const placeholders = createdIds.map(() => '?').join(',');
    const createdJobs = createdIds.length > 0
      ? await db.all(`
          SELECT j.*, l.name as lead_name, c.name as category_name, m.name as member_name
          FROM jobs j
          JOIN leads l ON j.lead_id = l.id
          LEFT JOIN categories c ON j.category_id = c.id
          LEFT JOIN team_members m ON j.assigned_member_id = m.id
          WHERE j.id IN (${placeholders})
          ORDER BY j.id ASC
        `, ...createdIds)
      : [];

    res.json({
      success: true,
      data: createdJobs[0] || null,
      jobs: createdJobs,
      count: createdJobs.length,
      message: createdJobs.length > 1
        ? `${createdJobs.length} ayrı iş başarıyla oluşturuldu ve ilgili ekip üyelerine atandı.`
        : 'İş başarıyla oluşturuldu ve ekip üyesine atandı.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İş Bilgisini, Başlığını, Kategorisini, Alt Ürünlerini veya Teslim Tarihini Güncelle
router.put('/:id', async (req, res) => {
  try {
    const { title, category_id, status, due_date, notes, assigned_member_id, products } = req.body;
    const jobId = req.params.id;

    const existing = await db.get('SELECT * FROM jobs WHERE id = ?', jobId);
    if (!existing) {
      return res.status(404).json({ error: 'İş bulunamadı.' });
    }

    const nextTitle = title !== undefined && String(title).trim() !== '' ? String(title).trim() : existing.title;
    const nextCategoryId = category_id !== undefined && category_id !== null ? Number(category_id) : existing.category_id;
    const nextStatus = status !== undefined && status !== null ? status : existing.status;
    const nextDueDate = due_date !== undefined && due_date !== null ? due_date : existing.due_date;
    const nextNotes = notes !== undefined ? notes : existing.notes;
    const nextMemberId = assigned_member_id !== undefined ? (assigned_member_id ? Number(assigned_member_id) : null) : existing.assigned_member_id;
    const nextProducts = products !== undefined
      ? (typeof products === 'string' ? products : JSON.stringify(products))
      : existing.products;

    const updateSql = `
      UPDATE jobs
      SET
        title = ?,
        category_id = ?,
        status = ?,
        due_date = ?,
        notes = ?,
        assigned_member_id = ?,
        products = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.run(
      updateSql,
      nextTitle,
      nextCategoryId,
      nextStatus,
      nextDueDate,
      nextNotes,
      nextMemberId,
      nextProducts,
      jobId
    );

    const updated = await db.get(`
      SELECT
        j.*,
        l.name AS lead_name,
        l.phone AS lead_phone,
        l.district AS lead_district,
        c.name AS category_name,
        c.color AS category_color,
        m.name AS member_name,
        m.role AS member_role,
        m.avatar_color AS member_color
      FROM jobs j
      JOIN leads l ON j.lead_id = l.id
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN team_members m ON j.assigned_member_id = m.id
      WHERE j.id = ?
    `, jobId);

    res.json({ success: true, data: updated, message: 'İş başarıyla güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İşi Sil
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM jobs WHERE id = ?', req.params.id);
    res.json({ success: true, message: 'İş silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
