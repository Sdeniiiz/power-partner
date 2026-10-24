const express = require('express');
const router = express.Router();
const db = require('../db');

// Seçilen kategori ve alt ürünlere göre katalogdan (service_pricing) varsayılan satış fiyatı ve maliyet hesapla
async function resolveDefaultPricing(categoryId, productsInput) {
  try {
    let prodList = [];
    if (Array.isArray(productsInput)) {
      prodList = productsInput;
    } else if (typeof productsInput === 'string' && productsInput.trim()) {
      try {
        prodList = JSON.parse(productsInput);
      } catch {
        prodList = [];
      }
    }

    const allPricing = await db.all('SELECT * FROM service_pricing');
    if (!allPricing || allPricing.length === 0) {
      return { sale_price: 0, cost: 0 };
    }

    // 1. Önce seçili alt ürünler (products) varsa onların katalog fiyat/maliyet toplamına bak
    if (Array.isArray(prodList) && prodList.length > 0) {
      let totalSale = 0;
      let totalCost = 0;
      let matchedAny = false;

      for (const prodName of prodList) {
        const match = allPricing.find(
          p => String(p.service_name).toLowerCase() === String(prodName).trim().toLowerCase()
        );
        if (match && (Number(match.sale_price) > 0 || Number(match.cost) > 0)) {
          totalSale += Number(match.sale_price) || 0;
          totalCost += Number(match.cost) || 0;
          matchedAny = true;
        }
      }

      if (matchedAny) {
        return { sale_price: totalSale, cost: totalCost };
      }
    }

    // 2. Alt ürün eşleşmediyse veya seçilmediyse kategori adına göre genel paket fiyatına bak
    if (categoryId) {
      const cat = await db.get('SELECT name FROM categories WHERE id = ?', categoryId);
      if (cat && cat.name) {
        const catNameLower = String(cat.name).toLowerCase();
        const exactCatMatch = allPricing.find(
          p =>
            String(p.service_name).toLowerCase() === `${catNameLower} (genel paket)` ||
            String(p.service_name).toLowerCase() === catNameLower ||
            (String(p.category_name).toLowerCase() === catNameLower &&
              (Number(p.sale_price) > 0 || Number(p.cost) > 0))
        );
        if (exactCatMatch) {
          return {
            sale_price: Number(exactCatMatch.sale_price) || 0,
            cost: Number(exactCatMatch.cost) || 0
          };
        }
      }
    }
  } catch (err) {
    console.warn('Varsayılan fiyat hesaplanamadı:', err.message);
  }
  return { sale_price: 0, cost: 0 };
}

// ============================================================================
// ÜRÜN / HİZMET SATIŞ FİYATI & MALİYET KATALOĞU (ADMİN FİYATLANDIRMA PANELİ)
// ============================================================================
router.get('/pricing', async (req, res) => {
  try {
    const items = await db.all('SELECT * FROM service_pricing ORDER BY category_name ASC, id ASC');
    res.json({ data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pricing', async (req, res) => {
  try {
    const { category_name, service_name, sale_price, cost, description } = req.body;
    if (!service_name || !String(service_name).trim()) {
      return res.status(400).json({ error: 'Ürün / Hizmet adı girilmelidir.' });
    }
    const cleanService = String(service_name).trim();
    const cleanCat = String(category_name || 'Genel Hizmet').trim();
    const numSale = Number(sale_price) || 0;
    const numCost = Number(cost) || 0;

    const existing = await db.get(
      'SELECT * FROM service_pricing WHERE LOWER(service_name) = LOWER(?)',
      cleanService
    );

    if (existing) {
      await db.run(
        `UPDATE service_pricing
         SET category_name = ?, sale_price = ?, cost = ?, description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        cleanCat,
        numSale,
        numCost,
        description || existing.description || null,
        existing.id
      );
      const updated = await db.get('SELECT * FROM service_pricing WHERE id = ?', existing.id);
      return res.json({ success: true, data: updated, message: 'Hizmet fiyatı ve maliyeti güncellendi.' });
    }

    const result = await db.run(
      `INSERT INTO service_pricing (category_name, service_name, sale_price, cost, description)
       VALUES (?, ?, ?, ?, ?)`,
      cleanCat,
      cleanService,
      numSale,
      numCost,
      description || null
    );
    const created = await db.get('SELECT * FROM service_pricing WHERE id = ?', result.lastInsertRowid);
    res.json({ success: true, data: created, message: 'Yeni hizmet/ürün fiyat kataloğuna eklendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/pricing/:id', async (req, res) => {
  try {
    const { category_name, service_name, sale_price, cost, description, apply_to_existing } = req.body;
    const id = req.params.id;

    const existing = await db.get('SELECT * FROM service_pricing WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ error: 'Katalog kalemi bulunamadı.' });
    }

    const nextCat = category_name !== undefined ? String(category_name).trim() : existing.category_name;
    const nextService = service_name !== undefined ? String(service_name).trim() : existing.service_name;
    const nextSale = sale_price !== undefined ? Number(sale_price) || 0 : Number(existing.sale_price) || 0;
    const nextCost = cost !== undefined ? Number(cost) || 0 : Number(existing.cost) || 0;
    const nextDesc = description !== undefined ? description : existing.description;

    await db.run(
      `UPDATE service_pricing
       SET category_name = ?, service_name = ?, sale_price = ?, cost = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      nextCat,
      nextService,
      nextSale,
      nextCost,
      nextDesc,
      id
    );

    // Eğer "Mevcut İşlere de Uygula" (veya fiyatı 0 olan eşleşen işlere uygula) istendiyse:
    let updatedJobsCount = 0;
    if (apply_to_existing) {
      const allJobs = await db.all(`
        SELECT j.*, c.name AS category_name
        FROM jobs j
        LEFT JOIN categories c ON j.category_id = c.id
      `);

      for (const job of allJobs) {
        let prods = [];
        try {
          prods = job.products ? JSON.parse(job.products) : [];
        } catch {
          prods = [];
        }
        const serviceLower = nextService.toLowerCase();
        const catLower = nextCat.toLowerCase();
        const isGeneralCatItem =
          serviceLower === `${catLower} (genel paket)` || serviceLower === catLower;

        const matchesProduct = Array.isArray(prods) && prods.some(p => String(p).toLowerCase() === serviceLower);
        const matchesGeneralCategory =
          isGeneralCatItem &&
          String(job.category_name || '').toLowerCase() === catLower &&
          (!Array.isArray(prods) || prods.length === 0);

        if (matchesProduct || matchesGeneralCategory) {
          await db.run(
            'UPDATE jobs SET sale_price = ?, cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            nextSale,
            nextCost,
            job.id
          );
          updatedJobsCount++;
        }
      }
    }

    const updated = await db.get('SELECT * FROM service_pricing WHERE id = ?', id);
    res.json({
      success: true,
      data: updated,
      updated_jobs_count: updatedJobsCount,
      message:
        updatedJobsCount > 0
          ? `"${nextService}" fiyatı güncellendi ve eşleşen ${updatedJobsCount} işe uygulandı.`
          : `"${nextService}" satış fiyatı ve maliyeti güncellendi.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/pricing/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM service_pricing WHERE id = ?', req.params.id);
    res.json({ success: true, message: 'Hizmet fiyat kalemi silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const {
      lead_id,
      category_id,
      assigned_member_id,
      title,
      due_date,
      notes,
      products,
      jobs_list,
      keep_in_pool,
      sale_price,
      cost,
      payment_method,
      installment_count,
      paid_amount
    } = req.body;

    if (!lead_id) {
      return res.status(400).json({ error: 'İşletme seçilmelidir.' });
    }

    const lead = await db.get('SELECT * FROM leads WHERE id = ?', lead_id);
    if (!lead) {
      return res.status(404).json({ error: 'İşletme bulunamadı.' });
    }

    const insertSql = `
      INSERT INTO jobs (
        lead_id, category_id, assigned_member_id, title, due_date, notes, products, status,
        sale_price, cost, payment_method, installment_count, paid_amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'devam_ediyor', ?, ?, ?, ?, ?)
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

        const catalogDefaults = await resolveDefaultPricing(item.category_id, item.products);
        const itemSalePrice =
          item.sale_price !== undefined && item.sale_price !== ''
            ? Number(item.sale_price) || 0
            : catalogDefaults.sale_price;
        const itemCost =
          item.cost !== undefined && item.cost !== ''
            ? Number(item.cost) || 0
            : catalogDefaults.cost;

        const result = await db.run(
          insertSql,
          lead_id,
          item.category_id || null,
          item.assigned_member_id || assigned_member_id || null,
          itemTitle,
          itemDueDate,
          item.notes !== undefined ? item.notes : (notes || ''),
          itemProductsStr,
          itemSalePrice,
          itemCost,
          item.payment_method || 'Havale / EFT',
          Number(item.installment_count) || 1,
          Number(item.paid_amount) || 0
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
      const catalogDefaults = await resolveDefaultPricing(category_id, products);
      const finalSalePrice =
        sale_price !== undefined && sale_price !== '' ? Number(sale_price) || 0 : catalogDefaults.sale_price;
      const finalCost =
        cost !== undefined && cost !== '' ? Number(cost) || 0 : catalogDefaults.cost;

      const result = await db.run(
        insertSql,
        lead_id,
        category_id || null,
        assigned_member_id || null,
        title,
        due_date,
        notes || '',
        productsStr,
        finalSalePrice,
        finalCost,
        payment_method || 'Havale / EFT',
        Number(installment_count) || 1,
        Number(paid_amount) || 0
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

// İş Bilgisini, Başlığını, Kategorisini, Alt Ürünlerini, Teslim Tarihini veya Finansal Bilgilerini Güncelle
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      category_id,
      status,
      due_date,
      notes,
      assigned_member_id,
      products,
      sale_price,
      cost,
      payment_method,
      installment_count,
      paid_amount
    } = req.body;
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

    // Eğer işin fiyatı/maliyeti henüz 0 ise ve tamamlandı'ya çekiliyorsa (veya kategori/ürün değiştiyse) katalogdan varsayılanları kontrol et
    let defaultPricing = { sale_price: Number(existing.sale_price) || 0, cost: Number(existing.cost) || 0 };
    if (defaultPricing.sale_price === 0 && defaultPricing.cost === 0) {
      const resolved = await resolveDefaultPricing(nextCategoryId, nextProducts);
      if (resolved.sale_price > 0 || resolved.cost > 0) {
        defaultPricing = resolved;
      }
    }

    const nextSalePrice =
      sale_price !== undefined && sale_price !== null && sale_price !== ''
        ? Number(sale_price) || 0
        : defaultPricing.sale_price;
    const nextCost =
      cost !== undefined && cost !== null && cost !== ''
        ? Number(cost) || 0
        : defaultPricing.cost;
    const nextPaymentMethod =
      payment_method !== undefined && payment_method !== null
        ? String(payment_method)
        : (existing.payment_method || 'Havale / EFT');
    const nextInstallmentCount =
      installment_count !== undefined && installment_count !== null
        ? Math.max(1, Number(installment_count) || 1)
        : Math.max(1, Number(existing.installment_count) || 1);
    const nextPaidAmount =
      paid_amount !== undefined && paid_amount !== null && paid_amount !== ''
        ? Math.max(0, Number(paid_amount) || 0)
        : (Number(existing.paid_amount) || 0);

    const nextCompletedAt =
      nextStatus === 'tamamlandi'
        ? (existing.completed_at || new Date().toISOString())
        : null;

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
        sale_price = ?,
        cost = ?,
        payment_method = ?,
        installment_count = ?,
        paid_amount = ?,
        completed_at = ?,
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
      nextSalePrice,
      nextCost,
      nextPaymentMethod,
      nextInstallmentCount,
      nextPaidAmount,
      nextCompletedAt,
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
        m.color AS member_color
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
