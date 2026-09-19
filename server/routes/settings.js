const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');

let cachedSettings = null;
let settingsCacheTime = 0;

// Ayarları getir
router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedSettings && (now - settingsCacheTime < 60000)) {
      return res.json(cachedSettings);
    }

    const rows = await db.all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    const result = {
      google_maps_api_key: settings.google_maps_api_key || '',
      has_api_key: Boolean(settings.google_maps_api_key && settings.google_maps_api_key.trim().length > 10),
      default_city: settings.default_city || 'İstanbul'
    };

    cachedSettings = result;
    settingsCacheTime = now;

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ayarları kaydet
router.post('/', async (req, res) => {
  try {
    const { google_maps_api_key, default_city } = req.body;

    const upsertSql = `
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `;

    if (google_maps_api_key !== undefined) {
      const trimmedKey = (google_maps_api_key || '').trim();
      await db.run(upsertSql, 'google_maps_api_key', trimmedKey);
    }
    if (default_city !== undefined) {
      await db.run(upsertSql, 'default_city', default_city.trim());
    }

    cachedSettings = null;
    res.json({ success: true, message: 'Ayarlar başarıyla kaydedildi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google Maps API Anahtarını Test Et (Hem Yeni Places API v1 hem de Klasik Places API'yi dener)
router.post('/test-key', async (req, res) => {
  let { key } = req.body;
  if (!key || typeof key !== 'string' || key.trim().length < 10) {
    return res.status(400).json({ 
      valid: false, 
      message: 'Lütfen geçerli bir Google Maps API anahtarı giriniz (AIzaSy... ile başlar).' 
    });
  }

  key = key.trim();

  let errorDetails = [];

  // 1. TEST: Google Places API (New) - v1
  try {
    const v1Url = 'https://places.googleapis.com/v1/places:searchText';
    const v1Res = await axios.post(
      v1Url,
      {
        textQuery: 'Kadıköy cafe',
        languageCode: 'tr',
        maxResultCount: 1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id,places.displayName'
        },
        timeout: 9000
      }
    );

    if (v1Res.status === 200) {
      return res.json({ 
        valid: true, 
        apiType: 'places_v1_new',
        message: 'Harika! Google Places API (New) bağlantısı başarıyla doğrulandı.' 
      });
    }
  } catch (err) {
    const v1ErrMsg = err.response?.data?.error?.message || err.message;
    const v1Status = err.response?.data?.error?.status || '';
    errorDetails.push(`Places API (New): [${v1Status || err.response?.status}] ${v1ErrMsg}`);
  }

  // 2. TEST: Google Places API (Legacy Text Search)
  try {
    const legacyUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const legacyRes = await axios.get(legacyUrl, {
      params: {
        query: 'Kadıköy cafe',
        key: key,
        language: 'tr'
      },
      timeout: 9000
    });

    const status = legacyRes.data.status;
    if (status === 'OK' || status === 'ZERO_RESULTS') {
      return res.json({ 
        valid: true, 
        apiType: 'places_legacy',
        message: 'Harika! Google Places API (Legacy) bağlantısı başarıyla doğrulandı.' 
      });
    } else {
      const errMsg = legacyRes.data.error_message || status;
      errorDetails.push(`Places API (Legacy): [${status}] ${errMsg}`);
    }
  } catch (err) {
    const errMsg = err.response?.data?.error_message || err.message;
    errorDetails.push(`Places API (Legacy): ${errMsg}`);
  }

  const combinedErrors = errorDetails.join('\n');
  let userFriendlyTip = '';

  if (combinedErrors.includes('Billing') || combinedErrors.includes('billing') || combinedErrors.includes('BILLING_DISABLED')) {
    userFriendlyTip = 'ÖNEMLİ: Google Cloud projenizde Faturalandırma (Billing Account) aktif edilmemiş. Google Maps Places API servisi için faturalandırma hesabı tanımlanması zorunludur (Google aylık 200$ ücretsiz kullanım kredisi tanımlar).';
  } else if (combinedErrors.includes('API_KEY_INVALID') || combinedErrors.includes('Invalid API key') || combinedErrors.includes('API key not valid')) {
    userFriendlyTip = 'API anahtarı hatalı. Lütfen anahtarın başındaki/sonundaki boşlukları kontrol edin ve AIzaSy... formatındaki tam anahtarı yapıştırdığınızdan emin olun.';
  } else if (combinedErrors.includes('IP') || combinedErrors.includes('referer') || combinedErrors.includes('referrer') || combinedErrors.includes('restricted')) {
    userFriendlyTip = 'Kısıtlama Hatası: API anahtarınızda HTTP Referrer (Web sitesi) veya IP kısıtlaması bulunuyor olabilir. Google Cloud Console > Credentials alanında kısıtlamayı geçici olarak "None" (Yok) yapıp tekrar deneyiniz.';
  } else if (combinedErrors.includes('not authorized') || combinedErrors.includes('disabled') || combinedErrors.includes('PERMISSION_DENIED')) {
    userFriendlyTip = 'Yetki Hatası: Google Cloud Console > "APIs & Services" > "Library" bölümünden "Places API" veya "Places API (New)" servisini projenizde etkinleştirmeniz (Enable) gerekmektedir.';
  }

  return res.status(400).json({
    valid: false,
    message: userFriendlyTip || 'Google Maps API anahtarı doğrulanamadı.',
    technicalDetails: combinedErrors
  });
});

// JSON Veri Yedeği İndir
router.get('/backup', async (req, res) => {
  try {
    const settings = await db.all('SELECT * FROM settings');
    const teamMembers = await db.all('SELECT * FROM team_members');
    const categories = await db.all('SELECT * FROM categories');
    const leads = await db.all('SELECT * FROM leads');
    const jobs = await db.all('SELECT * FROM jobs');
    const callLogs = await db.all('SELECT * FROM call_logs');

    const backup = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings,
      teamMembers,
      categories,
      leads,
      jobs,
      callLogs
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=powerpartner-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// JSON Veri Yedeği Geri Yükle
router.post('/restore', async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Geçersiz yedek dosyası formatı.' });
    }

    const batchStmts = [];

    // Leads geri yükleme
    if (Array.isArray(data.leads) && data.leads.length > 0) {
      for (const l of data.leads) {
        batchStmts.push({
          sql: `
            INSERT OR REPLACE INTO leads (
              id, place_id, name, category, district, city, address,
              phone, raw_phone, phone_type, phone_type_label, is_mobile,
              whatsapp_link, call_link, rating, user_ratings_total,
              website, has_website, instagram, has_instagram,
              maps_url, lat, lng, status, score, retry_date, products,
              visit_date, call_notes, call_count, last_called_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?
            )
          `,
          args: [
            l.id || null, l.place_id || `res_${Date.now()}_${Math.random()}`, l.name, l.category || 'Genel',
            l.district || '', l.city || '', l.address || '',
            l.phone || '', l.raw_phone || '', l.phone_type || 'sabit', l.phone_type_label || 'Sabit',
            l.is_mobile || 0, l.whatsapp_link || '', l.call_link || '',
            l.rating || null, l.user_ratings_total || 0,
            l.website || '', l.has_website || 0, l.instagram || '', l.has_instagram || 0,
            l.maps_url || '', l.lat || null, l.lng || null,
            l.status || 'arama_listesi', l.score || 0, l.retry_date || null,
            typeof l.products === 'object' ? JSON.stringify(l.products) : (l.products || null),
            l.visit_date || null, l.call_notes || '', l.call_count || 0, l.last_called_at || null
          ]
        });
      }
    }

    // Jobs geri yükleme
    if (Array.isArray(data.jobs) && data.jobs.length > 0) {
      for (const j of data.jobs) {
        batchStmts.push({
          sql: `
            INSERT OR REPLACE INTO jobs (id, lead_id, title, category_id, assigned_member_id, products, status, due_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            j.id || null, j.lead_id, j.title, j.category_id || null, j.assigned_member_id || null,
            typeof j.products === 'object' ? JSON.stringify(j.products) : (j.products || null),
            j.status || 'devam_ediyor', j.due_date || null, j.notes || ''
          ]
        });
      }
    }

    if (batchStmts.length > 0) {
      // 50'şerli batch grupları halinde çalıştıralım
      for (let i = 0; i < batchStmts.length; i += 50) {
        const chunk = batchStmts.slice(i, i + 50);
        await db.batch(chunk, 'write');
      }
    }

    res.json({ success: true, message: 'Yedek başarıyla veritabanına aktarıldı.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
