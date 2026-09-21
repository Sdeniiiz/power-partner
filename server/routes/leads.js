const express = require('express');
const router = express.Router();
const db = require('../db');
const GoogleMapsService = require('../services/googleMapsService');
const { analyzePhoneNumber } = require('../services/phoneAnalyzer');

// Hızlı bellek içi önbellek (Tokyo Turso sorgu gecikmesini sıfırlamak için)
let cachedStats = null;
let statsCacheTime = 0;
let cachedFilterMeta = null;
let filterMetaCacheTime = 0;

const getCachedStats = async (callerId = null) => {
  const now = Date.now();
  if (!callerId && cachedStats && (now - statsCacheTime < 25000)) {
    return cachedStats;
  }
  let sql = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'arama_listesi' THEN 1 ELSE 0 END) as in_queue,
      SUM(CASE WHEN status = 'randevu_arama' THEN 1 ELSE 0 END) as randevu_arama,
      SUM(CASE WHEN status = 'randevu' THEN 1 ELSE 0 END) as randevu,
      SUM(CASE WHEN status = 'iletisimsiz' THEN 1 ELSE 0 END) as iletisimsiz,
      SUM(CASE WHEN status = 'mutlak_olumsuz' THEN 1 ELSE 0 END) as mutlak_olumsuz,
      SUM(CASE WHEN status = 'satis_havuzu' THEN 1 ELSE 0 END) as satis_havuzu,
      SUM(CASE WHEN status = 'is_dagitildi' THEN 1 ELSE 0 END) as is_dagitildi,
      SUM(CASE WHEN status = 'randevu_arama' AND recall_date <= DATE('now', 'localtime') THEN 1 ELSE 0 END) as today_recalls
    FROM leads
  `;
  const params = [];
  if (callerId) {
    sql += ' WHERE assigned_caller_id = ?';
    params.push(callerId);
  }

  const stats = await db.get(sql, ...params);
  if (!callerId) {
    cachedStats = stats;
    statsCacheTime = now;
  }
  return stats;
};

const invalidateCache = () => {
  cachedStats = null;
  cachedFilterMeta = null;
};

const getApiKey = async () => {
  const row = await db.get("SELECT value FROM settings WHERE key = 'google_maps_api_key'");
  if (row?.value && row.value.trim().length > 10) {
    return row.value.trim();
  }
  if (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim().length > 10) {
    return process.env.GOOGLE_MAPS_API_KEY.trim();
  }
  return '';
};

const mapsService = new GoogleMapsService(getApiKey);

// 1, 2, 3: Google Maps veya Simülasyon üzerinden işletme ara
router.post('/search', async (req, res) => {
  try {
    const { district, category, city = 'İstanbul', query, deepSearch = true } = req.body;

    if (!district && !query) {
      return res.status(400).json({ error: 'Lütfen bir ilçe giriniz.' });
    }

    const searchResult = await mapsService.searchPlaces({
      district: district || '',
      category: category || 'cafe',
      city: city || 'İstanbul',
      query: query || '',
      deepSearch: Boolean(deepSearch)
    });

    res.json(searchResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Arama sonuçlarından seçilenleri veritabanına aktar (Arama Listesine ekle & İsteğe bağlı personele paylaştır)
router.post('/import', async (req, res) => {
  try {
    const { places, assigned_caller_id, assigned_caller_ids } = req.body;

    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: 'Eklenecek işletme listesi boş.' });
    }

    // Personel listesini ve isim haritasını hazırla
    let callerList = [];
    if (Array.isArray(assigned_caller_ids) && assigned_caller_ids.length > 0) {
      callerList = assigned_caller_ids.map(Number).filter(Boolean);
    } else if (assigned_caller_id) {
      callerList = [Number(assigned_caller_id)].filter(Boolean);
    }

    const callerMap = new Map();
    if (callerList.length > 0) {
      const ph = callerList.map(() => '?').join(',');
      const rows = await db.all(`SELECT id, name FROM team_members WHERE id IN (${ph})`, ...callerList);
      rows.forEach(r => callerMap.set(r.id, r.name));
    }

    const insertSql = `
      INSERT INTO leads (
        place_id, name, category, district, city, address,
        phone, raw_phone, phone_type, phone_type_label, is_mobile,
        whatsapp_link, call_link, rating, user_ratings_total,
        website, has_website, instagram, has_instagram,
        maps_url, lat, lng, status,
        is_verified_location, actual_district, website_status, phone_status,
        assigned_caller_id, assigned_caller_name
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, 'arama_listesi',
        ?, ?, ?, ?,
        ?, ?
      )
      ON CONFLICT(place_id) DO UPDATE SET
        rating = excluded.rating,
        user_ratings_total = excluded.user_ratings_total,
        phone = COALESCE(excluded.phone, leads.phone),
        website = COALESCE(excluded.website, leads.website),
        assigned_caller_id = COALESCE(excluded.assigned_caller_id, leads.assigned_caller_id),
        assigned_caller_name = COALESCE(excluded.assigned_caller_name, leads.assigned_caller_name),
        updated_at = CURRENT_TIMESTAMP
    `;

    const stmts = [];
    places.forEach((item, idx) => {
      const phoneInfo = analyzePhoneNumber(item.raw_phone || item.phone || '');
      const pId = item.place_id || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // Paylaştırma mantığı: Birden fazla seçildiyse sırayla dağıt (round-robin)
      let callerId = null;
      let callerName = null;
      if (callerList.length > 0) {
        callerId = callerList[idx % callerList.length];
        callerName = callerMap.get(callerId) || null;
      }

      stmts.push({
        sql: insertSql,
        args: [
          pId,
          item.name,
          item.category || 'Genel',
          item.district || '',
          item.city || 'İstanbul',
          item.address || '',
          phoneInfo.formatted,
          item.raw_phone || item.phone || '',
          phoneInfo.type,
          phoneInfo.typeLabel,
          phoneInfo.isMobile ? 1 : 0,
          phoneInfo.whatsappLink,
          phoneInfo.callLink,
          item.rating || null,
          item.user_ratings_total || 0,
          item.website || '',
          item.has_website ? 1 : 0,
          item.instagram || '',
          item.has_instagram ? 1 : 0,
          item.maps_url || '',
          item.lat || null,
          item.lng || null,
          item.is_verified_location !== undefined ? item.is_verified_location : 1,
          item.actual_district || item.district || '',
          item.website_status || (item.website ? 'unknown' : 'none'),
          item.phone_status || (phoneInfo.isValid ? 'valid' : 'invalid'),
          callerId,
          callerName
        ]
      });
    });

    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50), 'write');
    }

    invalidateCache();

    let feedbackMsg = `${stmts.length} işletme arama listesine kaydedildi.`;
    if (callerList.length > 1) {
      feedbackMsg += ` (${callerList.length} personele eşit paylaştırıldı)`;
    } else if (callerList.length === 1) {
      feedbackMsg += ` (${callerMap.get(callerList[0])} personeline atandı)`;
    }

    res.json({ success: true, count: stmts.length, message: feedbackMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adayları seçilen personellere eşit (round-robin) veya Ortak Havuz'a (atanmamış) paylaştır
router.post('/distribute', async (req, res) => {
  try {
    const { lead_ids, caller_ids, district, unassign, to_pool } = req.body;

    let targetLeadIds = [];
    if (Array.isArray(lead_ids) && lead_ids.length > 0) {
      targetLeadIds = lead_ids;
    } else if (district) {
      const rows = await db.all("SELECT id FROM leads WHERE district = ? AND status = 'arama_listesi'", district);
      targetLeadIds = rows.map(r => r.id);
    }

    if (targetLeadIds.length === 0) {
      return res.status(400).json({ error: 'Paylaştırılacak işletme bulunamadı.' });
    }

    // 1. Ortak Havuz'a geri alma durumu (Atamayı kaldır)
    const isUnassignRequest = Boolean(
      unassign ||
      to_pool ||
      (Array.isArray(caller_ids) && (caller_ids.includes('unassigned') || caller_ids.includes(0) || caller_ids.includes('0')))
    );

    if (isUnassignRequest) {
      const stmts = targetLeadIds.map(leadId => ({
        sql: 'UPDATE leads SET assigned_caller_id = NULL, assigned_caller_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [leadId]
      }));

      for (let i = 0; i < stmts.length; i += 50) {
        await db.batch(stmts.slice(i, i + 50), 'write');
      }

      invalidateCache();

      return res.json({
        success: true,
        count: targetLeadIds.length,
        unassigned: true,
        message: `${targetLeadIds.length} işletme ortak havuza (atanmamış) başarıyla geri alındı.`
      });
    }

    // 2. Personellere paylaştırma durumu
    if (!Array.isArray(caller_ids) || caller_ids.length === 0) {
      return res.status(400).json({ error: 'Lütfen paylaştırılacak en az bir personel veya Ortak Havuz seçiniz.' });
    }

    const cleanCallerIds = caller_ids.map(Number).filter(Boolean);
    if (cleanCallerIds.length === 0) {
      return res.status(400).json({ error: 'Geçerli bir personel seçilmedi.' });
    }

    const placeholders = cleanCallerIds.map(() => '?').join(',');
    const members = await db.all(`SELECT id, name FROM team_members WHERE id IN (${placeholders})`, ...cleanCallerIds);
    const memberMap = new Map();
    members.forEach(m => memberMap.set(m.id, m.name));

    const stmts = [];
    targetLeadIds.forEach((leadId, idx) => {
      const assignedCallerId = cleanCallerIds[idx % cleanCallerIds.length];
      const assignedCallerName = memberMap.get(assignedCallerId) || 'Personel';
      stmts.push({
        sql: 'UPDATE leads SET assigned_caller_id = ?, assigned_caller_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [assignedCallerId, assignedCallerName, leadId]
      });
    });

    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50), 'write');
    }

    invalidateCache();

    res.json({
      success: true,
      count: targetLeadIds.length,
      callerCount: cleanCallerIds.length,
      message: `${targetLeadIds.length} işletme seçilen ${cleanCallerIds.length} personele başarıyla paylaştırıldı.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// İlçe ve Sektör/Kategori filtre seçeneklerini getir (Hızlı Paralel & Önbellekli)
router.get('/meta/filters', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedFilterMeta && (now - filterMetaCacheTime < 60000)) {
      return res.json(cachedFilterMeta);
    }

    const [districtRows, categoryRows] = await Promise.all([
      db.all(`SELECT DISTINCT district FROM leads WHERE district IS NOT NULL AND TRIM(district) != '' ORDER BY district ASC`),
      db.all(`SELECT DISTINCT category FROM leads WHERE category IS NOT NULL AND TRIM(category) != '' ORDER BY category ASC`)
    ]);

    const result = {
      districts: districtRows.map(r => r.district),
      categories: categoryRows.map(r => r.category)
    };

    cachedFilterMeta = result;
    filterMetaCacheTime = now;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İşletmeleri listele ve filtrele (Paralel Sorgu & Hızlı İstatistik)
router.get('/', async (req, res) => {
  try {
    const { 
      status, district, category, phone_type, search,
      has_website, has_instagram, min_rating, min_score,
      assigned_caller_id, is_today_recall,
      limit = 300 
    } = req.query;

    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (district && district !== 'all') {
      query += ' AND district = ?';
      params.push(district);
    }
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (phone_type && phone_type !== 'all') {
      if (phone_type === 'mobile') {
        query += ' AND is_mobile = 1';
      } else if (phone_type === 'landline') {
        query += " AND (phone_type = 'landline' OR (is_mobile = 0 AND phone IS NOT NULL AND phone != '' AND phone != 'Numara Yok'))";
      } else if (phone_type === 'has_phone') {
        query += " AND phone IS NOT NULL AND phone != '' AND phone != 'Numara Yok'";
      }
    }
    if (has_website !== undefined && has_website !== 'all' && has_website !== '') {
      query += ' AND has_website = ?';
      params.push(Number(has_website));
    }
    if (has_instagram !== undefined && has_instagram !== 'all' && has_instagram !== '') {
      query += ' AND has_instagram = ?';
      params.push(Number(has_instagram));
    }
    if (min_rating && min_rating !== 'all' && min_rating !== '') {
      query += ' AND rating >= ?';
      params.push(Number(min_rating));
    }
    if (min_score && min_score !== 'all' && min_score !== '') {
      query += ' AND score >= ?';
      params.push(Number(min_score));
    }
    if (search && search.trim()) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR address LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Personel Filtresi (Atanan Çağrı Personeli)
    if (assigned_caller_id && assigned_caller_id !== 'all') {
      if (assigned_caller_id === 'unassigned') {
        query += ' AND (assigned_caller_id IS NULL OR assigned_caller_id = 0)';
      } else {
        query += ' AND assigned_caller_id = ?';
        params.push(Number(assigned_caller_id));
      }
    }

    // Bugün Aranacak Randevular Filtresi
    if (is_today_recall === '1') {
      query += " AND status = 'randevu_arama' AND (recall_date <= DATE('now', 'localtime') OR recall_date IS NULL)";
    }

    // Bugün aranacak randevular en üstte gösterilsin
    query += " ORDER BY CASE WHEN status = 'randevu_arama' AND recall_date <= DATE('now', 'localtime') THEN 0 ELSE 1 END, score DESC, id DESC LIMIT ?";
    params.push(Number(limit));

    // Her iki sorguyu eşzamanlı (paralel) çalıştırıp gecikmeyi yarı yarıya düşürüyoruz
    const callerIdForStats = (assigned_caller_id && assigned_caller_id !== 'all' && assigned_caller_id !== 'unassigned') ? Number(assigned_caller_id) : null;
    const [rows, stats] = await Promise.all([
      db.all(query, ...params),
      getCachedStats(callerIdForStats)
    ]);

    res.json({ data: rows, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tek işletme ve arama geçmişi (Paralel sorgular)
router.get('/:id', async (req, res) => {
  try {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', req.params.id);
    if (!lead) return res.status(404).json({ error: 'İşletme bulunamadı' });

    const [logs, jobs] = await Promise.all([
      db.all('SELECT * FROM call_logs WHERE lead_id = ? ORDER BY created_at DESC', lead.id),
      db.all(`
        SELECT j.*, c.name as category_name, c.color as category_color, m.name as member_name, m.color as member_color
        FROM jobs j
        LEFT JOIN categories c ON j.category_id = c.id
        LEFT JOIN team_members m ON j.assigned_member_id = m.id
        WHERE j.lead_id = ?
      `, lead.id)
    ]);

    res.json({ lead, logs, jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Arama sonucunu kaydet ve durumu güncelle (Diyagram akışı)
router.post('/:id/call', async (req, res) => {
  try {
    const { outcome, notes, caller_name, visit_date, recall_date, recall_time, score, retry_date, products } = req.body;
    const leadId = req.params.id;

    const lead = await db.get('SELECT * FROM leads WHERE id = ?', leadId);
    if (!lead) return res.status(404).json({ error: 'İşletme bulunamadı' });

    let newStatus = lead.status;
    if (outcome === 'mutlak_olumsuz') newStatus = 'mutlak_olumsuz';
    else if (outcome === 'iletisimsiz') newStatus = 'iletisimsiz';
    else if (outcome === 'randevu') newStatus = 'randevu';
    else if (outcome === 'randevu_arama') newStatus = 'randevu_arama'; // ⭐ Arama Randevusu
    else if (outcome === 'ziyaret_olumlu') newStatus = 'satis_havuzu';
    else if (outcome === 'ziyaret_olumsuz') newStatus = 'mutlak_olumsuz';
    else if (outcome === 'satis') newStatus = 'satis_havuzu';

    // Arama günlüğü ekle
    await db.run(`
      INSERT INTO call_logs (lead_id, outcome, caller_name, notes)
      VALUES (?, ?, ?, ?)
    `, leadId, outcome, caller_name || 'Operatör', notes || '');

    // Lead'i güncelle
    const productsStr = products ? (typeof products === 'string' ? products : JSON.stringify(products)) : null;

    await db.run(`
      UPDATE leads
      SET
        status = ?,
        call_notes = COALESCE(?, call_notes),
        visit_date = CASE WHEN ? IS NOT NULL THEN ? ELSE visit_date END,
        recall_date = CASE WHEN ? IS NOT NULL THEN ? ELSE recall_date END,
        recall_time = CASE WHEN ? IS NOT NULL THEN ? ELSE recall_time END,
        score = CASE WHEN ? IS NOT NULL THEN ? ELSE score END,
        retry_date = CASE WHEN ? IS NOT NULL THEN ? ELSE retry_date END,
        products = CASE WHEN ? IS NOT NULL THEN ? ELSE products END,
        call_count = call_count + 1,
        last_called_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      newStatus, 
      notes || null, 
      visit_date || null, visit_date || null,
      recall_date || null, recall_date || null,
      recall_time || null, recall_time || null,
      score !== undefined ? Number(score) : null, score !== undefined ? Number(score) : null,
      retry_date || null, retry_date || null,
      productsStr, productsStr,
      leadId
    );

    invalidateCache();

    const updatedLead = await db.get('SELECT * FROM leads WHERE id = ?', leadId);
    res.json({ success: true, lead: updatedLead, message: 'Arama kaydı ve durum güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seçilen işletmeleri tek bir personele topluca ata
router.put('/batch/assign', async (req, res) => {
  try {
    const { lead_ids, caller_id } = req.body;
    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'Lütfen en az bir işletme seçiniz.' });
    }

    let callerName = null;
    const cleanCallerId = caller_id ? Number(caller_id) : null;
    if (cleanCallerId) {
      const member = await db.get('SELECT name FROM team_members WHERE id = ?', cleanCallerId);
      callerName = member?.name || 'Personel';
    }

    const stmts = lead_ids.map(id => ({
      sql: 'UPDATE leads SET assigned_caller_id = ?, assigned_caller_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [cleanCallerId, callerName, id]
    }));

    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50), 'write');
    }

    invalidateCache();

    res.json({
      success: true,
      count: lead_ids.length,
      message: `${lead_ids.length} işletme ${callerName ? callerName + ' personeline atandı' : 'ortak havuza alındı'}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Tek işletme güncelle (Not, Puan, vb. hızlı düzenleme)
router.put('/:id', async (req, res) => {
  try {
    const { call_notes, score, retry_date, status, category, district, city } = req.body;
    const leadId = req.params.id;

    await db.run(`
      UPDATE leads
      SET
        call_notes = COALESCE(?, call_notes),
        score = COALESCE(?, score),
        retry_date = COALESCE(?, retry_date),
        status = COALESCE(?, status),
        category = COALESCE(?, category),
        district = COALESCE(?, district),
        city = COALESCE(?, city),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      call_notes !== undefined ? call_notes : null,
      score !== undefined ? Number(score) : null,
      retry_date !== undefined ? retry_date : null,
      status !== undefined ? status : null,
      category !== undefined ? category : null,
      district !== undefined ? district : null,
      city !== undefined ? city : null,
      leadId
    );

    invalidateCache();

    const updated = await db.get('SELECT * FROM leads WHERE id = ?', leadId);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kampanya Listesi (İlçe - Sektör Grupları)
router.get('/campaigns/summary', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT 
        district, 
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'satis_havuzu' OR status = 'is_dagitildi' THEN 1 ELSE 0 END) as sales,
        SUM(CASE WHEN status = 'arama_listesi' THEN 1 ELSE 0 END) as remaining
      FROM leads
      GROUP BY district, category
      ORDER BY total DESC
    `);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kampanya Toplu Yeniden Adlandır
router.put('/campaigns/rename', async (req, res) => {
  try {
    const { oldDistrict, oldCategory, newDistrict, newCategory } = req.body;
    if (!oldDistrict || !oldCategory || !newDistrict || !newCategory) {
      return res.status(400).json({ error: 'Eski ve yeni ilçe/kategori değerleri zorunludur.' });
    }

    const result = await db.run(`
      UPDATE leads
      SET district = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE district = ? AND category = ?
    `, newDistrict.trim(), newCategory.trim(), oldDistrict.trim(), oldCategory.trim());

    invalidateCache();
    res.json({ success: true, count: result.changes, message: `${result.changes} işletme güncellendi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kampanya Toplu Sil
router.delete('/campaigns/delete', async (req, res) => {
  try {
    const { district, category } = req.body;
    if (!district || !category) {
      return res.status(400).json({ error: 'Silinecek ilçe ve kategori zorunludur.' });
    }

    const leadRows = await db.all('SELECT id FROM leads WHERE district = ? AND category = ?', district, category);
    const leadIds = leadRows.map(r => r.id);
    
    if (leadIds.length > 0) {
      const placeholders = leadIds.map(() => '?').join(',');
      await db.run(`DELETE FROM call_logs WHERE lead_id IN (${placeholders})`, ...leadIds);
      await db.run(`DELETE FROM jobs WHERE lead_id IN (${placeholders})`, ...leadIds);
      const delResult = await db.run(`DELETE FROM leads WHERE id IN (${placeholders})`, ...leadIds);
      invalidateCache();
      return res.json({ success: true, count: delResult.changes, message: `${delResult.changes} işletme ve bağlı kayıtlar silindi.` });
    }

    res.json({ success: true, count: 0, message: 'Silinecek işletme bulunamadı.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toplu veya Tekil Durum Değiştir / Kuyruğa Geri Döndür
router.post('/batch-status', async (req, res) => {
  try {
    const { leadIds, status } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'İşlem yapılacak işletme ID listesi gereklidir.' });
    }
    const targetStatus = status || 'arama_listesi';
    const placeholders = leadIds.map(() => '?').join(',');
    const result = await db.run(`
      UPDATE leads 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `, targetStatus, ...leadIds);

    invalidateCache();
    res.json({
      success: true,
      count: result.changes,
      message: `${result.changes} işletme başarıyla '${targetStatus}' durumuna güncellendi.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diyagramdaki Döngü: Tüm İletişimsizlikleri tekrar Günlük Arama Listesine geri aktar
router.post('/requeue-unreachable', async (req, res) => {
  try {
    const result = await db.run(`
      UPDATE leads
      SET status = 'arama_listesi', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'iletisimsiz'
    `);

    invalidateCache();
    res.json({
      success: true,
      count: result.changes,
      message: `${result.changes} iletişimsiz işletme tekrar arama kuyruğuna aktarıldı.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Günlük Arama Listesini Temizle (Sadece aranmamış 'arama_listesi' durumundakiler)
router.post('/admin/clear-queue', async (req, res) => {
  try {
    const queueRows = await db.all("SELECT id FROM leads WHERE status = 'arama_listesi'");
    const queueLeads = queueRows.map(r => r.id);
    if (queueLeads.length > 0) {
      const placeholders = queueLeads.map(() => '?').join(',');
      await db.run(`DELETE FROM call_logs WHERE lead_id IN (${placeholders})`, ...queueLeads);
      await db.run(`DELETE FROM jobs WHERE lead_id IN (${placeholders})`, ...queueLeads);
      const delResult = await db.run(`DELETE FROM leads WHERE id IN (${placeholders})`, ...queueLeads);
      invalidateCache();
      return res.json({ success: true, count: delResult.changes, message: `${delResult.changes} bekleyen işletme arama listesinden temizlendi.` });
    }
    res.json({ success: true, count: 0, message: 'Arama listesinde temizlenecek işletme yok.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Tüm İşletmeleri ve Arama Kayıtlarını Sıfırla
router.post('/admin/clear-all', async (req, res) => {
  try {
    await db.run('DELETE FROM call_logs');
    await db.run('DELETE FROM jobs');
    const result = await db.run('DELETE FROM leads');
    invalidateCache();
    res.json({ success: true, count: result.changes, message: `Tüm sistem sıfırlandı: ${result.changes} işletme silindi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lead silme
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM call_logs WHERE lead_id = ?', req.params.id);
    await db.run('DELETE FROM jobs WHERE lead_id = ?', req.params.id);
    await db.run('DELETE FROM leads WHERE id = ?', req.params.id);
    invalidateCache();
    res.json({ success: true, message: 'İşletme silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
