const express = require('express');
const router = express.Router();
const db = require('../db');
const GoogleMapsService = require('../services/googleMapsService');
const { analyzePhoneNumber } = require('../services/phoneAnalyzer');

const getApiKey = () => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'google_maps_api_key'").get();
  return row?.value || '';
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

// Arama sonuçlarından seçilenleri veritabanına aktar (Arama Listesine ekle)
router.post('/import', (req, res) => {
  try {
    const { places } = req.body;

    if (!Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: 'Eklenecek işletme listesi boş.' });
    }

    const insertLead = db.prepare(`
      INSERT INTO leads (
        place_id, name, category, district, city, address,
        phone, raw_phone, phone_type, phone_type_label, is_mobile,
        whatsapp_link, call_link, rating, user_ratings_total,
        website, has_website, instagram, has_instagram,
        maps_url, lat, lng, status
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, 'arama_listesi'
      )
      ON CONFLICT(place_id) DO UPDATE SET
        rating = excluded.rating,
        user_ratings_total = excluded.user_ratings_total,
        phone = COALESCE(excluded.phone, leads.phone),
        website = COALESCE(excluded.website, leads.website),
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertMany = db.transaction((items) => {
      let added = 0;
      for (const item of items) {
        const phoneInfo = analyzePhoneNumber(item.raw_phone || item.phone || '');
        const pId = item.place_id || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        insertLead.run(
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
          item.website ? 1 : 0,
          item.instagram || '',
          item.instagram ? 1 : 0,
          item.maps_url || '',
          item.lat || null,
          item.lng || null
        );
        added++;
      }
      return added;
    });

    const count = insertMany(places);
    res.json({ success: true, count, message: `${count} işletme arama listesine kaydedildi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İlçe ve Sektör/Kategori filtre seçeneklerini getir
router.get('/meta/filters', (req, res) => {
  try {
    const districts = db.prepare(`
      SELECT DISTINCT district 
      FROM leads 
      WHERE district IS NOT NULL AND TRIM(district) != '' 
      ORDER BY district ASC
    `).all().map(r => r.district);

    const categories = db.prepare(`
      SELECT DISTINCT category 
      FROM leads 
      WHERE category IS NOT NULL AND TRIM(category) != '' 
      ORDER BY category ASC
    `).all().map(r => r.category);

    res.json({ districts, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İşletmeleri listele ve filtrele
router.get('/', (req, res) => {
  try {
    const { 
      status, district, category, phone_type, search,
      has_website, has_instagram, min_rating, min_score,
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

    query += ' ORDER BY score DESC, id DESC LIMIT ?';
    params.push(Number(limit));

    const rows = db.prepare(query).all(...params);

    // İstatistikler (Diyagram aşamaları bazında özet)
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'arama_listesi' THEN 1 ELSE 0 END) as in_queue,
        SUM(CASE WHEN status = 'mutlak_olumsuz' THEN 1 ELSE 0 END) as mutlak_olumsuz,
        SUM(CASE WHEN status = 'randevu' THEN 1 ELSE 0 END) as randevu,
        SUM(CASE WHEN status = 'satis_havuzu' THEN 1 ELSE 0 END) as satis_havuzu,
        SUM(CASE WHEN status = 'is_dagitildi' THEN 1 ELSE 0 END) as is_dagitildi,
        SUM(CASE WHEN status = 'iletisimsiz' THEN 1 ELSE 0 END) as iletisimsiz
      FROM leads
    `).get();

    res.json({ data: rows, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tek işletme ve arama geçmişi
router.get('/:id', (req, res) => {
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'İşletme bulunamadı' });

    const logs = db.prepare('SELECT * FROM call_logs WHERE lead_id = ? ORDER BY created_at DESC').all(lead.id);
    const jobs = db.prepare(`
      SELECT j.*, c.name as category_name, c.color as category_color, m.name as member_name, m.color as member_color
      FROM jobs j
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN team_members m ON j.assigned_member_id = m.id
      WHERE j.lead_id = ?
    `).all(lead.id);

    res.json({ lead, logs, jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Arama sonucunu kaydet ve durumu güncelle (Diyagram akışı)
router.post('/:id/call', (req, res) => {
  try {
    const { outcome, notes, caller_name, visit_date, score, retry_date, products } = req.body;
    const leadId = req.params.id;

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    if (!lead) return res.status(404).json({ error: 'İşletme bulunamadı' });

    let newStatus = lead.status;
    if (outcome === 'mutlak_olumsuz') newStatus = 'mutlak_olumsuz';
    else if (outcome === 'iletisimsiz') newStatus = 'iletisimsiz';
    else if (outcome === 'randevu') newStatus = 'randevu';
    else if (outcome === 'ziyaret_olumlu') newStatus = 'satis_havuzu';
    else if (outcome === 'ziyaret_olumsuz') newStatus = 'mutlak_olumsuz';
    else if (outcome === 'satis') newStatus = 'satis_havuzu';

    // Arama günlüğü ekle
    db.prepare(`
      INSERT INTO call_logs (lead_id, outcome, caller_name, notes)
      VALUES (?, ?, ?, ?)
    `).run(leadId, outcome, caller_name || 'Operatör', notes || '');

    // Lead'i güncelle
    const productsStr = products ? (typeof products === 'string' ? products : JSON.stringify(products)) : null;

    db.prepare(`
      UPDATE leads
      SET
        status = ?,
        call_notes = COALESCE(?, call_notes),
        visit_date = CASE WHEN ? IS NOT NULL THEN ? ELSE visit_date END,
        score = CASE WHEN ? IS NOT NULL THEN ? ELSE score END,
        retry_date = CASE WHEN ? IS NOT NULL THEN ? ELSE retry_date END,
        products = CASE WHEN ? IS NOT NULL THEN ? ELSE products END,
        call_count = call_count + 1,
        last_called_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newStatus, 
      notes || null, 
      visit_date || null, visit_date || null,
      score !== undefined ? Number(score) : null, score !== undefined ? Number(score) : null,
      retry_date || null, retry_date || null,
      productsStr, productsStr,
      leadId
    );

    const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    res.json({ success: true, lead: updatedLead, message: 'Arama kaydı ve durum güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tek işletme güncelle (Not, Puan, vb. hızlı düzenleme)
router.put('/:id', (req, res) => {
  try {
    const { call_notes, score, retry_date, status, category, district, city } = req.body;
    const leadId = req.params.id;

    db.prepare(`
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
    `).run(
      call_notes !== undefined ? call_notes : null,
      score !== undefined ? Number(score) : null,
      retry_date !== undefined ? retry_date : null,
      status !== undefined ? status : null,
      category !== undefined ? category : null,
      district !== undefined ? district : null,
      city !== undefined ? city : null,
      leadId
    );

    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kampanya Listesi (İlçe - Sektör Grupları)
router.get('/campaigns/summary', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        district, 
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'satis_havuzu' OR status = 'is_dagitildi' THEN 1 ELSE 0 END) as sales,
        SUM(CASE WHEN status = 'arama_listesi' THEN 1 ELSE 0 END) as remaining
      FROM leads
      GROUP BY district, category
      ORDER BY total DESC
    `).all();

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kampanya Toplu Yeniden Adlandır (Örnekteki Kampanya Yönetimi)
router.put('/campaigns/rename', (req, res) => {
  try {
    const { oldDistrict, oldCategory, newDistrict, newCategory } = req.body;
    if (!oldDistrict || !oldCategory || !newDistrict || !newCategory) {
      return res.status(400).json({ error: 'Eski ve yeni ilçe/kategori değerleri zorunludur.' });
    }

    const result = db.prepare(`
      UPDATE leads
      SET district = ?, category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE district = ? AND category = ?
    `).run(newDistrict.trim(), newCategory.trim(), oldDistrict.trim(), oldCategory.trim());

    res.json({ success: true, count: result.changes, message: `${result.changes} işletme güncellendi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kampanya Toplu Sil
router.delete('/campaigns/delete', (req, res) => {
  try {
    const { district, category } = req.body;
    if (!district || !category) {
      return res.status(400).json({ error: 'Silinecek ilçe ve kategori zorunludur.' });
    }

    // İlgili lead id'lerini bulup bağlı tabloları da temizleyelim
    const leadIds = db.prepare('SELECT id FROM leads WHERE district = ? AND category = ?').all(district, category).map(r => r.id);
    
    if (leadIds.length > 0) {
      const placeholders = leadIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM call_logs WHERE lead_id IN (${placeholders})`).run(...leadIds);
      db.prepare(`DELETE FROM jobs WHERE lead_id IN (${placeholders})`).run(...leadIds);
      const delResult = db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...leadIds);
      return res.json({ success: true, count: delResult.changes, message: `${delResult.changes} işletme ve bağlı kayıtlar silindi.` });
    }

    res.json({ success: true, count: 0, message: 'Silinecek işletme bulunamadı.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toplu veya Tekil Durum Değiştir / Kuyruğa Geri Döndür (Örn: Mutlak Olumsuz / İletişimsiz -> Arama Listesi)
router.post('/batch-status', (req, res) => {
  try {
    const { leadIds, status } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'İşlem yapılacak işletme ID listesi gereklidir.' });
    }
    const targetStatus = status || 'arama_listesi';
    const placeholders = leadIds.map(() => '?').join(',');
    const result = db.prepare(`
      UPDATE leads 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(targetStatus, ...leadIds);

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
router.post('/requeue-unreachable', (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE leads
      SET status = 'arama_listesi', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'iletisimsiz'
    `).run();

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
router.post('/admin/clear-queue', (req, res) => {
  try {
    const queueLeads = db.prepare("SELECT id FROM leads WHERE status = 'arama_listesi'").all().map(r => r.id);
    if (queueLeads.length > 0) {
      const placeholders = queueLeads.map(() => '?').join(',');
      db.prepare(`DELETE FROM call_logs WHERE lead_id IN (${placeholders})`).run(...queueLeads);
      db.prepare(`DELETE FROM jobs WHERE lead_id IN (${placeholders})`).run(...queueLeads);
      const delResult = db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...queueLeads);
      return res.json({ success: true, count: delResult.changes, message: `${delResult.changes} bekleyen işletme arama listesinden temizlendi.` });
    }
    res.json({ success: true, count: 0, message: 'Arama listesinde temizlenecek işletme yok.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Tüm İşletmeleri ve Arama Kayıtlarını Sıfırla
router.post('/admin/clear-all', (req, res) => {
  try {
    db.prepare('DELETE FROM call_logs').run();
    db.prepare('DELETE FROM jobs').run();
    const result = db.prepare('DELETE FROM leads').run();
    res.json({ success: true, count: result.changes, message: `Tüm sistem sıfırlandı: ${result.changes} işletme silindi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lead silme
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM call_logs WHERE lead_id = ?').run(req.params.id);
    db.prepare('DELETE FROM jobs WHERE lead_id = ?').run(req.params.id);
    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'İşletme silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

