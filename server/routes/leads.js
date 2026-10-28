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

  const [stats, callerSummary] = await Promise.all([
    db.get(sql, ...params),
    db.all(`
      SELECT caller_name, COUNT(*) as call_count, COUNT(DISTINCT lead_id) as lead_count
      FROM call_logs
      WHERE caller_name IS NOT NULL AND TRIM(caller_name) != ''
      GROUP BY caller_name
      ORDER BY call_count DESC
    `)
  ]);

  const fullStats = { ...(stats || {}), caller_summary: callerSummary || [] };
  if (!callerId) {
    cachedStats = fullStats;
    statsCacheTime = now;
  }
  return fullStats;
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

// 1, 2, 3: Google Maps veya Simülasyon üzerinden işletme ara (Mevcut Veritabanı Karşılaştırmalı)
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

    // Veritabanındaki mevcut kayıtları çekip karşılaştır (Hali hazırda ekli olanlar ile yenileri ayrıştır)
    const existingLeads = await db.all(`
      SELECT id, place_id, name, phone, raw_phone, status, assigned_caller_name, district, city
      FROM leads
    `);

    const STATUS_LABELS = {
      arama_listesi: 'Arama Listesinde',
      randevu_arama: 'Tekrar Aranacak',
      randevu: 'Saha Ziyareti / Randevu',
      satis_havuzu: 'Satış Havuzunda',
      is_dagitildi: 'İş Alındı & Dağıtıldı',
      iletisimsiz: 'Ulaşılamadı',
      mutlak_olumsuz: 'Olumsuz Görüşüldü'
    };

    const placeIdMap = new Map();
    const phoneMap = new Map();
    const nameMap = new Map();

    for (const l of existingLeads) {
      if (l.place_id) {
        placeIdMap.set(l.place_id, l);
      }
      const cleanPhone = (l.raw_phone || l.phone || '').replace(/\D/g, '');
      if (cleanPhone.length >= 7) {
        phoneMap.set(cleanPhone.slice(-7), l);
      }
      const cleanNameStr = (l.name || '').toLowerCase().trim();
      const cleanDistStr = (l.district || '').toLowerCase().trim();
      if (cleanNameStr.length >= 3) {
        nameMap.set(`${cleanNameStr}__${cleanDistStr}`, l);
      }
    }

    const rawData = searchResult.data || [];
    let existingCount = 0;
    let newCount = 0;

    const enrichedData = rawData.map(p => {
      let matchedLead = null;
      if (p.place_id && placeIdMap.has(p.place_id)) {
        matchedLead = placeIdMap.get(p.place_id);
      } else {
        const pPhone = (p.raw_phone || p.phone || '').replace(/\D/g, '');
        if (pPhone.length >= 7 && phoneMap.has(pPhone.slice(-7))) {
          matchedLead = phoneMap.get(pPhone.slice(-7));
        } else {
          const pName = (p.name || '').toLowerCase().trim();
          const pDist = (p.district || p.actual_district || district || '').toLowerCase().trim();
          if (pName.length >= 3 && nameMap.has(`${pName}__${pDist}`)) {
            matchedLead = nameMap.get(`${pName}__${pDist}`);
          }
        }
      }

      if (matchedLead) {
        existingCount++;
        return {
          ...p,
          is_existing: true,
          existing_id: matchedLead.id,
          existing_status: matchedLead.status,
          existing_status_label: STATUS_LABELS[matchedLead.status] || 'Arama Listesinde',
          existing_caller_name: matchedLead.assigned_caller_name || null
        };
      } else {
        newCount++;
        return {
          ...p,
          is_existing: false,
          existing_id: null,
          existing_status: null,
          existing_status_label: null,
          existing_caller_name: null
        };
      }
    });

    searchResult.data = enrichedData;
    searchResult.totalFound = enrichedData.length;
    searchResult.existingCount = existingCount;
    searchResult.newCount = newCount;
    searchResult.summaryMessage =
      existingCount > 0
        ? `${existingCount} tanesi daha önce günlük arama listesine eklendi, yeni bulunan ${newCount} adet işletme var.`
        : `Toplam ${newCount} yeni işletme bulundu!`;

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

    // Personele doğrudan atandıysa bildirim oluştur (İşletme Adları Dahil)
    if (callerList.length > 0) {
      try {
        const callerImportsMap = new Map();
        places.forEach((item, idx) => {
          const cId = callerList[idx % callerList.length];
          const cName = callerMap.get(cId) || 'Personel';
          if (!callerImportsMap.has(cName)) callerImportsMap.set(cName, []);
          callerImportsMap.get(cName).push(item.name || 'İşletme');
        });

        const todayStr = new Date().toISOString().slice(0, 10);
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        for (const [cName, names] of callerImportsMap.entries()) {
          const count = names.length;
          let title = '📞 Yeni Arama Atandı';
          let message = '';
          if (count === 1) {
            title = `📞 Yeni Arama: ${names[0]}`;
            message = `Yönetici size "${names[0]}" işletmesini arama listesine atadı.`;
          } else if (count === 2) {
            title = `📞 2 Yeni Arama Atandı`;
            message = `Yönetici size "${names[0]}" ve "${names[1]}" işletmelerini atadı.`;
          } else {
            title = `📞 ${count} Yeni Arama Atandı`;
            message = `Yönetici size "${names[0]}", "${names[1]}" ve ${count - 2} diğer işletmeyi atadı.`;
          }

          await db.run(
            `INSERT INTO notifications (to_user, title, message, date, time, read, type, count)
             VALUES (?, ?, ?, ?, ?, 0, 'call_assignment', ?)`,
            cName, title, message, todayStr, timeStr, count
          );
        }
      } catch (importNotifErr) {
        console.error('Import bildirim hatası:', importNotifErr);
      }
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

    // Hedef işletmelerin isim ve konum bilgilerini çek (Bildirimlerde işletme adlarını göstermek için)
    const targetLeadPlaceholders = targetLeadIds.map(() => '?').join(',');
    const leadRows = await db.all(
      `SELECT id, name, district, category FROM leads WHERE id IN (${targetLeadPlaceholders})`,
      ...targetLeadIds
    );
    const leadMap = new Map();
    leadRows.forEach(l => leadMap.set(l.id, l));

    const stmts = [];
    const callerLeadsMap = new Map();

    targetLeadIds.forEach((leadId, idx) => {
      const assignedCallerId = cleanCallerIds[idx % cleanCallerIds.length];
      const assignedCallerName = memberMap.get(assignedCallerId) || 'Personel';
      
      const leadInfo = leadMap.get(leadId) || { id: leadId, name: 'İşletme', district: '' };
      if (!callerLeadsMap.has(assignedCallerName)) {
        callerLeadsMap.set(assignedCallerName, []);
      }
      callerLeadsMap.get(assignedCallerName).push(leadInfo);

      stmts.push({
        sql: 'UPDATE leads SET assigned_caller_id = ?, assigned_caller_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [assignedCallerId, assignedCallerName, leadId]
      });
    });

    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50), 'write');
    }

    // Bildirim Oluşturma (İşletme Adları Açık ve Doğru Gösterilir)
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const notifStmts = [];

    for (const [callerName, assignedLeads] of callerLeadsMap.entries()) {
      const count = assignedLeads.length;
      let title = '📞 Yeni Arama Atandı';
      let message = '';

      if (count === 1) {
        const l = assignedLeads[0];
        const distText = l.district ? ` (${l.district})` : '';
        title = `📞 Yeni Arama: ${l.name}`;
        message = `Yönetici size "${l.name}"${distText} işletmesini arama listesine atadı.`;
      } else if (count === 2) {
        title = `📞 2 Yeni Arama Atandı`;
        message = `Yönetici size "${assignedLeads[0].name}" ve "${assignedLeads[1].name}" işletmelerini atadı.`;
      } else if (count === 3) {
        title = `📞 3 Yeni Arama Atandı`;
        message = `Yönetici size "${assignedLeads[0].name}", "${assignedLeads[1].name}" ve "${assignedLeads[2].name}" işletmelerini atadı.`;
      } else {
        title = `📞 ${count} Yeni Arama Atandı`;
        message = `Yönetici size "${assignedLeads[0].name}", "${assignedLeads[1].name}" ve ${count - 2} diğer işletmeyi atadı.`;
      }

      const leadIdsStr = assignedLeads.map(l => l.id).join(',');

      notifStmts.push({
        sql: `INSERT INTO notifications (to_user, title, message, date, time, read, type, count, lead_ids)
              VALUES (?, ?, ?, ?, ?, 0, 'call_assignment', ?, ?)`,
        args: [
          callerName,
          title,
          message,
          todayStr,
          timeStr,
          count,
          leadIdsStr
        ]
      });
    }

    if (notifStmts.length > 0) {
      await db.batch(notifStmts, 'write');
    }

    invalidateCache();

    res.json({
      success: true,
      count: targetLeadIds.length,
      callerCount: cleanCallerIds.length,
      message: `${targetLeadIds.length} işletme seçilen ${cleanCallerIds.length} personele başarıyla paylaştırıldı ve personele bildirim gönderildi.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Yönetici Günlük Aktivite & Analiz Raporu (Aramalar, Aranacaklar, Görüşülenler, Yapılan İşler, Randevular)
router.get('/daily-activity', async (req, res) => {
  try {
    const { date, caller_name } = req.query;
    const targetDate = date ? date.trim() : new Date().toISOString().slice(0, 10);

    // 1. O gün yapılan aramalar & görüşülenler (call_logs)
    let callsQuery = `
      SELECT 
        cl.id as log_id,
        cl.lead_id,
        cl.outcome,
        cl.caller_name,
        cl.notes,
        cl.created_at,
        l.name as lead_name,
        l.phone as lead_phone,
        l.district as lead_district,
        l.category as lead_category,
        l.status as lead_status,
        l.score as lead_score
      FROM call_logs cl
      JOIN leads l ON cl.lead_id = l.id
      WHERE (DATE(cl.created_at, 'localtime') = ? OR cl.created_at LIKE ?)
    `;
    const callParams = [targetDate, `${targetDate}%`];

    if (caller_name && caller_name !== 'all') {
      callsQuery += ' AND LOWER(TRIM(cl.caller_name)) = LOWER(TRIM(?))';
      callParams.push(caller_name.trim());
    }

    callsQuery += ' ORDER BY cl.created_at DESC';

    // 2. O gün aranacak olan randevular (leads recall_date)
    let recallsQuery = `
      SELECT 
        l.id as lead_id,
        l.name as lead_name,
        l.phone as lead_phone,
        l.district as lead_district,
        l.category as lead_category,
        l.status as lead_status,
        l.recall_date,
        l.recall_time,
        l.call_notes,
        l.score as lead_score,
        l.assigned_caller_name,
        l.assigned_caller_id
      FROM leads l
      WHERE l.recall_date = ?
    `;
    const recallParams = [targetDate];

    if (caller_name && caller_name !== 'all') {
      recallsQuery += ' AND LOWER(TRIM(l.assigned_caller_name)) = LOWER(TRIM(?))';
      recallParams.push(caller_name.trim());
    }

    recallsQuery += ' ORDER BY l.recall_time ASC, l.id DESC';

    // 3. O gün saha ziyareti / randevusu olanlar (leads visit_date)
    let visitsQuery = `
      SELECT 
        l.id as lead_id,
        l.name as lead_name,
        l.phone as lead_phone,
        l.address as lead_address,
        l.district as lead_district,
        l.category as lead_category,
        l.status as lead_status,
        l.visit_date,
        l.call_notes,
        l.score as lead_score,
        l.assigned_caller_name
      FROM leads l
      WHERE (l.visit_date LIKE ? OR DATE(l.visit_date) = ?)
    `;
    const visitParams = [`${targetDate}%`, targetDate];

    if (caller_name && caller_name !== 'all') {
      visitsQuery += ' AND LOWER(TRIM(l.assigned_caller_name)) = LOWER(TRIM(?))';
      visitParams.push(caller_name.trim());
    }

    visitsQuery += ' ORDER BY l.visit_date ASC';

    // 4. O gün teslim edilecek veya yapılan işler (jobs)
    let jobsQuery = `
      SELECT 
        j.id as job_id,
        j.lead_id,
        j.title,
        j.products,
        j.status as job_status,
        j.due_date,
        j.notes as job_notes,
        j.created_at as job_created_at,
        l.name as lead_name,
        l.phone as lead_phone,
        l.district as lead_district,
        c.name as category_name,
        c.color as category_color,
        m.name as member_name,
        m.color as member_color
      FROM jobs j
      JOIN leads l ON j.lead_id = l.id
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN team_members m ON j.assigned_member_id = m.id
      WHERE (j.due_date = ? OR DATE(j.created_at, 'localtime') = ? OR DATE(j.updated_at, 'localtime') = ?)
    `;
    const jobParams = [targetDate, targetDate, targetDate];

    if (caller_name && caller_name !== 'all') {
      jobsQuery += ' AND LOWER(TRIM(m.name)) = LOWER(TRIM(?))';
      jobParams.push(caller_name.trim());
    }

    jobsQuery += ' ORDER BY j.id DESC';

    // Tüm sorguları eşzamanlı çalıştır
    const [calls, recalls, visits, jobs] = await Promise.all([
      db.all(callsQuery, ...callParams),
      db.all(recallsQuery, ...recallParams),
      db.all(visitsQuery, ...visitParams),
      db.all(jobsQuery, ...jobParams)
    ]);

    // İstatistik ve dağılımlar
    const callerCounts = {};
    const outcomeCounts = {};

    calls.forEach(c => {
      const caller = c.caller_name || 'Bilinmiyor';
      callerCounts[caller] = (callerCounts[caller] || 0) + 1;
      const outcome = c.outcome || 'diger';
      outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    });

    // O güne ait benzersiz lead ID'leri
    const leadIdSet = new Set();
    calls.forEach(c => leadIdSet.add(c.lead_id));
    recalls.forEach(r => leadIdSet.add(r.lead_id));
    visits.forEach(v => leadIdSet.add(v.lead_id));
    jobs.forEach(j => leadIdSet.add(j.lead_id));

    // Kronolojik birleşik zaman çizelgesi (timeline)
    const timeline = [];

    calls.forEach(c => {
      timeline.push({
        id: `call_${c.log_id}`,
        type: 'call',
        title: `📞 Arama: ${c.lead_name}`,
        subtitle: `${c.caller_name} aradı • Sonuç: ${c.outcome}`,
        time: c.created_at,
        lead_id: c.lead_id,
        lead_name: c.lead_name,
        lead_phone: c.lead_phone,
        lead_district: c.lead_district,
        actor: c.caller_name,
        notes: c.notes,
        outcome: c.outcome
      });
    });

    recalls.forEach(r => {
      timeline.push({
        id: `recall_${r.lead_id}`,
        type: 'recall',
        title: `⏰ Arama Randevusu: ${r.lead_name}`,
        subtitle: `Planlanan Saat: ${r.recall_time || 'Gündüz'} • Sorumlu: ${r.assigned_caller_name || 'Ortak Havuz'}`,
        time: `${r.recall_date} ${r.recall_time || '10:00'}`,
        lead_id: r.lead_id,
        lead_name: r.lead_name,
        lead_phone: r.phone,
        lead_district: r.district,
        actor: r.assigned_caller_name,
        notes: r.call_notes
      });
    });

    visits.forEach(v => {
      timeline.push({
        id: `visit_${v.lead_id}`,
        type: 'visit',
        title: `🤝 Saha Ziyareti: ${v.lead_name}`,
        subtitle: `Ziyaret: ${v.visit_date} • Adres: ${v.lead_address || v.lead_district}`,
        time: v.visit_date,
        lead_id: v.lead_id,
        lead_name: v.lead_name,
        lead_phone: v.phone,
        lead_district: v.district,
        actor: v.assigned_caller_name,
        notes: v.call_notes
      });
    });

    jobs.forEach(j => {
      timeline.push({
        id: `job_${j.job_id}`,
        type: 'job',
        title: `💼 İş / Görev: ${j.title}`,
        subtitle: `Sorumlu: ${j.member_name || 'Ekip'} • Durum: ${j.job_status}`,
        time: j.due_date || j.job_created_at,
        lead_id: j.lead_id,
        lead_name: j.lead_name,
        lead_phone: j.lead_phone,
        lead_district: j.lead_district,
        actor: j.member_name,
        notes: j.job_notes
      });
    });

    // Zaman çizelgesini tarihe ve saate göre sırala (En son olan en üstte)
    timeline.sort((a, b) => (b.time || '').localeCompare(a.time || ''));

    res.json({
      success: true,
      date: targetDate,
      summary: {
        total_calls: calls.length,
        total_recalls: recalls.length,
        total_visits: visits.length,
        total_jobs: jobs.length,
        total_unique_leads: leadIdSet.size,
        callers: Object.entries(callerCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        outcomes: Object.entries(outcomeCounts).map(([outcome, count]) => ({ outcome, count })).sort((a, b) => b.count - a.count)
      },
      calls,
      recalls,
      visits,
      jobs,
      lead_ids: Array.from(leadIdSet),
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// YÖNETİCİ KOKPİTİ & PERFORMANS MERKEZİ (Admin Cockpit)
// Bahar & Aslı (Soğuk Arama), Yiğit (Saha Satış), Günlük Nabız, Satılan İşler, Alarmlar ve Brifing
// ==========================================
router.get('/admin-cockpit', async (req, res) => {
  try {
    const { range = 'today', start_date, end_date } = req.query;

    const now = new Date();
    const trNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const todayStr = trNow.toISOString().slice(0, 10);
    const currentHour = String(trNow.getUTCHours()).padStart(2, '0');
    const currentMin = String(trNow.getUTCMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;

    let startDate = todayStr;
    let endDate = todayStr;

    if (start_date && end_date) {
      startDate = start_date.trim();
      endDate = end_date.trim();
    } else if (range === 'yesterday') {
      const yDate = new Date(trNow.getTime() - 24 * 60 * 60 * 1000);
      startDate = yDate.toISOString().slice(0, 10);
      endDate = startDate;
    } else if (range === 'this_week') {
      const dayOfWeek = trNow.getUTCDay() === 0 ? 7 : trNow.getUTCDay();
      const monday = new Date(trNow.getTime() - (dayOfWeek - 1) * 24 * 60 * 60 * 1000);
      startDate = monday.toISOString().slice(0, 10);
      endDate = todayStr;
    } else if (range === 'this_month') {
      startDate = `${todayStr.slice(0, 7)}-01`;
      endDate = todayStr;
    } else if (range === 'all') {
      startDate = '2020-01-01';
      endDate = '2099-12-31';
    }

    // 1. GÜNÜN CANLI NABZI (Bugün Ne Var?)
    // a) Bugün yapılacak toplam arama sayısı (arama_listesi havuzu + bugüne randevulu geri aramalar)
    const pendingPoolCountRes = await db.get("SELECT COUNT(*) as count FROM leads WHERE status = 'arama_listesi'");
    const todayRecallCountRes = await db.get(
      "SELECT COUNT(*) as count FROM leads WHERE status = 'randevu_arama' AND (recall_date <= ? OR recall_date IS NULL)",
      todayStr
    );
    const todayPendingCallsTotal = (pendingPoolCountRes?.count || 0) + (todayRecallCountRes?.count || 0);

    // b) Ziyaret edilecek işletmeler (Saha randevuları)
    // 1. Bugün planlanan ziyaretler (2026-10-29)
    const todayFieldVisitsRes = await db.all(
      `SELECT id, name, district, address, phone, field_visit_status, field_member_name, visit_date 
       FROM leads 
       WHERE status = 'randevu' AND (visit_date LIKE ? OR DATE(visit_date) = ?)
       ORDER BY visit_date ASC`,
      `${todayStr}%`, todayStr
    );
    const todayFieldVisitsTotal = todayFieldVisitsRes.length;
    const todayFieldVisitsCompleted = todayFieldVisitsRes.filter(v => v.field_visit_status === 'ziyaret_edildi').length;
    const todayFieldVisitsPending = todayFieldVisitsTotal - todayFieldVisitsCompleted;

    // 2. Geçmiş günlerden kalan henüz kapatılmamış geciken ziyaret randevuları
    const overdueFieldVisitsRes = await db.all(
      `SELECT id, name, district, address, phone, field_visit_status, field_member_name, visit_date 
       FROM leads 
       WHERE status = 'randevu' AND (visit_date < ? OR DATE(visit_date) < ?)
       ORDER BY visit_date DESC`,
      `${todayStr}T00:00`, todayStr
    );
    const overdueFieldVisitsTotal = overdueFieldVisitsRes.length;

    // 3. Seçilen tarih aralığında planlanmış toplam randevular
    const periodFieldVisitsRes = await db.all(
      `SELECT id, name, district, address, phone, field_visit_status, field_member_name, visit_date 
       FROM leads 
       WHERE status = 'randevu' 
         AND (
           (DATE(visit_date) BETWEEN ? AND ?)
           OR (SUBSTR(visit_date, 1, 10) BETWEEN ? AND ?)
         )
       ORDER BY visit_date ASC`,
      startDate, endDate, startDate, endDate
    );

    // 4. Sistemdeki toplam aktif randevu havuzu
    const allActiveRandevuRes = await db.all(
      `SELECT id, name, district, address, phone, field_visit_status, field_member_name, visit_date 
       FROM leads 
       WHERE status = 'randevu'
       ORDER BY visit_date ASC`
    );

    // c) Bugün kapanan satış sayısı ve toplam TL ciro
    const todaySalesLogs = await db.all(
      "SELECT cl.id, cl.lead_id, cl.caller_name, cl.notes, cl.created_at, l.name as lead_name, l.district FROM call_logs cl JOIN leads l ON cl.lead_id = l.id WHERE cl.outcome IN ('ziyaret_olumlu', 'satis') AND (DATE(cl.created_at, 'localtime') = ? OR cl.created_at LIKE ?)",
      todayStr, `${todayStr}%`
    );
    const todayJobsRes = await db.all(
      "SELECT id, lead_id, title, sale_price, cost, products, created_at FROM jobs WHERE (DATE(created_at, 'localtime') = ? OR created_at LIKE ?)",
      todayStr, `${todayStr}%`
    );
    const todaySalesTotalTL = todayJobsRes.reduce((sum, j) => sum + (Number(j.sale_price) || 0), 0);

    // 2. SOĞUK ARAMA PERSONEL KARNESİ (Bahar & Aslı Öncelikli)
    const callLogsInRange = await db.all(
      `SELECT cl.*, l.name as lead_name, l.district as lead_district, l.phone as lead_phone
       FROM call_logs cl
       JOIN leads l ON cl.lead_id = l.id
       WHERE (
         (DATE(cl.created_at, 'localtime') BETWEEN ? AND ?)
         OR (SUBSTR(cl.created_at, 1, 10) BETWEEN ? AND ?)
       )`,
      startDate, endDate, startDate, endDate
    );

    const teamMembersList = await db.all("SELECT id, name, role, color FROM team_members");
    const coldCallerNamesSet = new Set(
      teamMembersList
        .filter(m => /soğuk|soguk|arama|tele/i.test(m.role || ''))
        .map(m => m.name.toLowerCase().trim())
    );
    coldCallerNamesSet.add('bahar');
    coldCallerNamesSet.add('aslı temür');
    coldCallerNamesSet.add('asli temur');
    coldCallerNamesSet.add('aslı');

    const coldCallersMap = {};

    // Bahar, Aslı ve soğuk arama rolündeki üyeleri önceden ekle (günün başında 0 arama olsa bile görünsünler)
    teamMembersList.forEach(m => {
      const lower = m.name.toLowerCase().trim();
      if (coldCallerNamesSet.has(lower)) {
        coldCallersMap[m.name] = {
          name: m.name,
          role: m.role || 'Soğuk Arama',
          color: m.color || '#0284c7',
          is_primary: true,
          total_calls: 0,
          randevu_count: 0,
          recall_count: 0,
          sales_pool_count: 0,
          unreachable_count: 0,
          negative_count: 0,
          positive_total: 0,
          success_rate: 0
        };
      }
    });

    callLogsInRange.forEach(log => {
      const rawName = (log.caller_name || 'Bilinmeyen').trim();
      const lower = rawName.toLowerCase();
      if (lower.includes('(saha)') || log.outcome === 'ziyaret_notu' || log.outcome === 'ziyaret_olumlu' || log.outcome === 'ziyaret_olumsuz') {
        return;
      }

      if (!coldCallersMap[rawName]) {
        const matchedMember = teamMembersList.find(m => m.name.toLowerCase().trim() === lower);
        coldCallersMap[rawName] = {
          name: rawName,
          role: matchedMember?.role || 'Soğuk Arama',
          color: matchedMember?.color || '#0284c7',
          is_primary: coldCallerNamesSet.has(lower),
          total_calls: 0,
          randevu_count: 0,
          recall_count: 0,
          sales_pool_count: 0,
          unreachable_count: 0,
          negative_count: 0,
          positive_total: 0,
          success_rate: 0
        };
      }

      const entry = coldCallersMap[rawName];
      entry.total_calls += 1;

      if (log.outcome === 'randevu') {
        entry.randevu_count += 1;
        entry.positive_total += 1;
      } else if (log.outcome === 'randevu_arama') {
        entry.recall_count += 1;
        entry.positive_total += 1;
      } else if (log.outcome === 'satis_havuzu' || log.outcome === 'satis') {
        entry.sales_pool_count += 1;
        entry.positive_total += 1;
      } else if (log.outcome === 'iletisimsiz') {
        entry.unreachable_count += 1;
      } else if (log.outcome === 'mutlak_olumsuz') {
        entry.negative_count += 1;
      }
    });

    const coldCallersPerformance = Object.values(coldCallersMap).map(c => {
      c.success_rate = c.total_calls > 0 ? Math.round((c.positive_total / c.total_calls) * 100) : 0;
      return c;
    }).sort((a, b) => b.total_calls - a.total_calls);

    // 3. SAHA SATIŞ PERSONEL KARNESİ (Yiğit Öncelikli)
    const fieldStaffNamesSet = new Set(
      teamMembersList
        .filter(m => /saha/i.test(m.role || ''))
        .map(m => m.name.toLowerCase().trim())
    );
    fieldStaffNamesSet.add('yiğit dalkılıç');
    fieldStaffNamesSet.add('yigit dalkilic');
    fieldStaffNamesSet.add('yiğit');

    const fieldStaffMap = {};

    // Yiğit ve saha ekibini önceden ekle (0 ziyaret olsa bile tabloda yer alsın)
    teamMembersList.forEach(m => {
      const lower = m.name.toLowerCase().trim();
      if (fieldStaffNamesSet.has(lower)) {
        fieldStaffMap[m.name] = {
          name: m.name,
          role: m.role || 'Saha Satış',
          color: m.color || '#16a34a',
          total_visits: 0,
          positive_sales: 0,
          negative_visits: 0,
          repeat_visits: 0,
          closing_rate: 0,
          total_revenue: 0
        };
      }
    });

    callLogsInRange.forEach(log => {
      const rawName = (log.caller_name || '').trim();
      const lower = rawName.toLowerCase();
      const isFieldLog = lower.includes('(saha)') || log.outcome.startsWith('ziyaret_') || fieldStaffNamesSet.has(lower.replace(/\(saha\)/g, '').trim());

      if (!isFieldLog) return;

      const cleanName = rawName.replace(/\(saha\)/gi, '').trim() || 'Yiğit dalkılıç';
      const cleanLower = cleanName.toLowerCase();

      if (!fieldStaffMap[cleanName]) {
        const matchedMember = teamMembersList.find(m => m.name.toLowerCase().trim() === cleanLower);
        fieldStaffMap[cleanName] = {
          name: cleanName,
          role: matchedMember?.role || 'Saha Satış',
          color: matchedMember?.color || '#16a34a',
          total_visits: 0,
          positive_sales: 0,
          negative_visits: 0,
          repeat_visits: 0,
          closing_rate: 0,
          total_revenue: 0
        };
      }

      const fEntry = fieldStaffMap[cleanName];
      fEntry.total_visits += 1;

      if (log.outcome === 'ziyaret_olumlu' || log.outcome === 'satis') {
        fEntry.positive_sales += 1;
      } else if (log.outcome === 'ziyaret_olumsuz') {
        fEntry.negative_visits += 1;
      } else if (log.outcome === 'tekrar_ziyaret') {
        fEntry.repeat_visits += 1;
      }
    });

    // 4. SAHADA GİDİLEN İŞLERDEN HANGİSİ OLUMLU OLMUŞ, NE SATILMIŞ?
    const fieldSoldJobs = await db.all(
      `SELECT 
         l.id as lead_id,
         l.name as lead_name,
         l.district,
         l.category,
         l.products as lead_products,
         l.field_member_name,
         l.assigned_caller_name,
         l.call_notes,
         l.visit_date,
         l.updated_at,
         COALESCE(
           (SELECT GROUP_CONCAT(j.title, ' | ') FROM jobs j WHERE j.lead_id = l.id),
           l.products
         ) as sold_services,
         COALESCE(
           (SELECT SUM(j.sale_price) FROM jobs j WHERE j.lead_id = l.id),
           0
         ) as total_sale_price
       FROM leads l
       WHERE (
         l.status IN ('satis_havuzu', 'satis')
         OR EXISTS (
           SELECT 1 FROM call_logs cl 
           WHERE cl.lead_id = l.id 
           AND cl.outcome IN ('ziyaret_olumlu', 'satis')
         )
       )
       AND (
         (DATE(l.updated_at, 'localtime') BETWEEN ? AND ?)
         OR (SUBSTR(l.updated_at, 1, 10) BETWEEN ? AND ?)
       )
       ORDER BY l.updated_at DESC
       LIMIT 50`,
      startDate, endDate, startDate, endDate
    );

    fieldSoldJobs.forEach(job => {
      const fName = (job.field_member_name || 'Yiğit dalkılıç').trim();
      if (fieldStaffMap[fName]) {
        fieldStaffMap[fName].total_revenue += (Number(job.total_sale_price) || 0);
      }
    });

    const fieldSalesPerformance = Object.values(fieldStaffMap).map(f => {
      f.closing_rate = f.total_visits > 0 ? Math.round((f.positive_sales / f.total_visits) * 100) : 0;
      return f;
    });

    // 5. KIRMIZI BAYRAKLAR & KAÇAKLAR (Alerts)
    const overdueRecalls = await db.all(
      `SELECT id, name, phone, district, recall_date, recall_time, assigned_caller_name, call_notes
       FROM leads
       WHERE status = 'randevu_arama'
       AND (
         recall_date < ? 
         OR (recall_date = ? AND recall_time IS NOT NULL AND recall_time < ?)
         OR (recall_date = ? AND recall_time IS NULL)
       )
       ORDER BY recall_date ASC, recall_time ASC
       LIMIT 25`,
      todayStr, todayStr, currentTimeStr, todayStr
    );

    const unreachableRecovery = await db.all(
      `SELECT id, name, phone, district, call_count, last_called_at, assigned_caller_name
       FROM leads
       WHERE status = 'iletisimsiz' AND is_mobile = 1
       ORDER BY last_called_at DESC
       LIMIT 25`
    );

    // 6. GRAFİK VERİLERİ (Charts Data)
    const outcomeCounts = {
      randevu: 0,
      randevu_arama: 0,
      satis_havuzu: 0,
      iletisimsiz: 0,
      mutlak_olumsuz: 0,
      diger: 0
    };

    callLogsInRange.forEach(l => {
      if (outcomeCounts[l.outcome] !== undefined) {
        outcomeCounts[l.outcome] += 1;
      } else {
        outcomeCounts.diger += 1;
      }
    });

    // 7. GÜN SONU YÖNETİCİ BRİFİNGİ (Kopyalanabilir Rapor Şablonu)
    const totalCallsInRange = callLogsInRange.length;
    const totalRandevuInRange = callLogsInRange.filter(c => c.outcome === 'randevu').length;
    const totalSalesAmount = fieldSoldJobs.reduce((sum, j) => sum + (Number(j.total_sale_price) || 0), 0);

    let briefingText = `📊 POWERPARTNER YÖNETİCİ RAPORU (${startDate === endDate ? startDate : `${startDate} - ${endDate}`})\n`;
    briefingText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    briefingText += `📞 TOPLAM ARAMA: ${totalCallsInRange} adet (${totalRandevuInRange} yüz yüze randevu alındı)\n\n`;

    briefingText += `👩‍💼 SOĞUK ARAMA PERFORMANSI:\n`;
    coldCallersPerformance.forEach(c => {
      briefingText += `• ${c.name}: ${c.total_calls} arama | 🤝 ${c.randevu_count} Yüz Yüze Randevu | ⏰ ${c.recall_count} Geri Arama (%${c.success_rate} Başarı)\n`;
    });

    briefingText += `\n🚗 SAHA SATIŞ (YİĞİT & SAHA EKİBİ):\n`;
    fieldSalesPerformance.forEach(f => {
      briefingText += `• ${f.name}: ${f.total_visits} Ziyaret | 🏆 ${f.positive_sales} Kapanan Satış (%${f.closing_rate} Kapama) | 💰 ${f.total_revenue.toLocaleString('tr-TR')} TL Ciro\n`;
    });

    if (fieldSoldJobs.length > 0) {
      briefingText += `\n🎉 KAPANAN İŞLER & CİRO (${fieldSoldJobs.length} İşletme - Toplam: ${totalSalesAmount.toLocaleString('tr-TR')} TL):\n`;
      fieldSoldJobs.slice(0, 5).forEach((j, idx) => {
        briefingText += `${idx + 1}. ${j.lead_name} (${j.district || 'Samsun'}) → ${j.sold_services || 'Hizmet Paketi'} [${Number(j.total_sale_price || 0).toLocaleString('tr-TR')} TL]\n`;
      });
      if (fieldSoldJobs.length > 5) {
        briefingText += `... ve ${fieldSoldJobs.length - 5} işletme daha.\n`;
      }
    }

    if (overdueRecalls.length > 0) {
      briefingText += `\n⚠️ DİKKAT: ${overdueRecalls.length} adet saati geçen geri arama bekliyor!\n`;
    }
    briefingText += `━━━━━━━━━━━━━━━━━━━━━━`;

    res.json({
      range,
      start_date: startDate,
      end_date: endDate,
      daily_pulse: {
        today_pending_calls: todayPendingCallsTotal,
        today_pending_pool: pendingPoolCountRes?.count || 0,
        today_recalls_due: todayRecallCountRes?.count || 0,
        today_field_visits_total: todayFieldVisitsTotal,
        today_field_visits_completed: todayFieldVisitsCompleted,
        today_field_visits_pending: todayFieldVisitsPending,
        overdue_field_visits_total: overdueFieldVisitsTotal,
        period_field_visits_total: periodFieldVisitsRes.length,
        total_active_field_visits: allActiveRandevuRes.length,
        today_field_visits_list: todayFieldVisitsRes,
        overdue_field_visits_list: overdueFieldVisitsRes,
        period_field_visits_list: periodFieldVisitsRes,
        today_sales_count: todaySalesLogs.length,
        today_sales_total_tl: todaySalesTotalTL,
        red_flags_count: overdueRecalls.length + overdueFieldVisitsTotal
      },
      cold_callers_performance: coldCallersPerformance,
      field_sales_performance: fieldSalesPerformance,
      field_sold_jobs: fieldSoldJobs,
      red_flags: {
        overdue_recalls: overdueRecalls,
        unreachable_recovery: unreachableRecovery
      },
      charts: {
        outcome_distribution: outcomeCounts,
        total_calls: totalCallsInRange
      },
      daily_briefing: briefingText
    });
  } catch (err) {
    console.error('admin-cockpit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Yüz yüze randevu (ziyaret) günlük kota ve doluluk takvimi (Maks 10 randevu kuralı)
router.get('/appointment-capacity', async (req, res) => {
  try {
    const { caller_name, days = 14 } = req.query;
    const numDays = Math.min(60, Math.max(1, Number(days) || 14));

    // Yerel Türkiye saati (GMT+3) için gün hesaplama
    const now = new Date();
    const trNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const getLocalYMD = (d) => {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getLocalYMD(trNow);
    const tmrwDate = new Date(trNow.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = getLocalYMD(tmrwDate);

    // 1. Bugün yapılan aramalar ve alınan yüz yüze randevular (toplam ve ilgili personel)
    const [todayCallsTotalRow, todayCallsCallerRow, todayVisitsTotalRow, todayVisitsCallerRow] = await Promise.all([
      db.get(
        `SELECT COUNT(*) as count FROM call_logs WHERE (DATE(created_at, 'localtime') = ? OR created_at LIKE ?)`,
        todayStr, `${todayStr}%`
      ),
      caller_name && caller_name !== 'all'
        ? db.get(
            `SELECT COUNT(*) as count FROM call_logs WHERE (DATE(created_at, 'localtime') = ? OR created_at LIKE ?) AND LOWER(TRIM(caller_name)) = LOWER(TRIM(?))`,
            todayStr, `${todayStr}%`, caller_name.trim()
          )
        : Promise.resolve({ count: 0 }),
      db.get(
        `SELECT COUNT(*) as count FROM call_logs WHERE outcome = 'randevu' AND (DATE(created_at, 'localtime') = ? OR created_at LIKE ?)`,
        todayStr, `${todayStr}%`
      ),
      caller_name && caller_name !== 'all'
        ? db.get(
            `SELECT COUNT(*) as count FROM call_logs WHERE outcome = 'randevu' AND (DATE(created_at, 'localtime') = ? OR created_at LIKE ?) AND LOWER(TRIM(caller_name)) = LOWER(TRIM(?))`,
            todayStr, `${todayStr}%`, caller_name.trim()
          )
        : Promise.resolve({ count: 0 })
    ]);

    // 2. Önümüzdeki günlerin yüz yüze randevularını çek (status = 'randevu' ve visit_date dolu)
    const upcomingLeads = await db.all(
      `SELECT
         l.id,
         l.name,
         l.phone,
         l.district,
         l.city,
         l.address,
         l.visit_date,
         l.status,
         l.field_member_id,
         l.field_member_name,
         COALESCE(
           (SELECT cl.caller_name FROM call_logs cl WHERE cl.lead_id = l.id AND cl.outcome = 'randevu' ORDER BY cl.created_at DESC LIMIT 1),
           l.assigned_caller_name
         ) as assigned_caller_name,
         l.call_notes,
         SUBSTR(l.visit_date, 1, 10) as visit_day
       FROM leads l
       WHERE l.status = 'randevu'
         AND l.visit_date IS NOT NULL
         AND TRIM(l.visit_date) != ''
         AND SUBSTR(l.visit_date, 1, 10) >= ?
       ORDER BY l.visit_date ASC`,
      todayStr
    );

    // Günlük eşleme haritası
    const dayMap = {};
    (upcomingLeads || []).forEach(lead => {
      const day = lead.visit_day;
      if (!day) return;
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(lead);
    });

    const DAILY_QUOTA = 20; // 2 saha personeli olduğu için günlük maksimum kota 20 olarak belirlendi
    const daysList = [];
    const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    const callerNameClean = caller_name && caller_name !== 'all' ? String(caller_name).trim().toLowerCase() : null;
    let firstAvailableDate = null;

    for (let i = 0; i < numDays; i++) {
      const curDate = new Date(trNow.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = getLocalYMD(curDate);
      const dayName = DAY_NAMES[curDate.getUTCDay()];
      const appts = dayMap[dateStr] || [];
      const count = appts.length;
      const isFull = count >= DAILY_QUOTA;

      let label = dateStr;
      if (i === 0) label = 'Bugün';
      else if (i === 1) label = 'Yarın';

      // En erken müsait gün (yarından itibaren dolmamış ilk gün)
      if (i >= 1 && !firstAvailableDate && !isFull) {
        firstAvailableDate = dateStr;
      }

      // Personel bazlı randevu dağılımı ve kullanıcının kendi aldığı randevu sayısı
      const callerBreakdown = {};
      let myAppointmentsCount = 0;

      const enrichedAppts = appts.map(a => {
        const cName = a.assigned_caller_name ? a.assigned_caller_name.trim() : 'Belirtilmedi';
        callerBreakdown[cName] = (callerBreakdown[cName] || 0) + 1;
        const isMine = callerNameClean ? String(cName).toLowerCase() === callerNameClean : false;
        if (isMine) myAppointmentsCount++;
        return {
          ...a,
          caller_name: cName,
          is_mine: isMine
        };
      });

      daysList.push({
        date: dateStr,
        day_name: dayName,
        label,
        count,
        caller_count: myAppointmentsCount,
        caller_breakdown: callerBreakdown,
        quota: DAILY_QUOTA,
        remaining_quota: Math.max(0, DAILY_QUOTA - count),
        is_full: isFull,
        percent: Math.min(100, Math.round((count / DAILY_QUOTA) * 100)),
        appointments: enrichedAppts
      });
    }

    const tomorrowItem = daysList.find(d => d.date === tomorrowStr) || {
      date: tomorrowStr,
      day_name: DAY_NAMES[tmrwDate.getUTCDay()],
      label: 'Yarın',
      count: 0,
      caller_count: 0,
      caller_breakdown: {},
      quota: DAILY_QUOTA,
      remaining_quota: DAILY_QUOTA,
      is_full: false,
      percent: 0,
      appointments: []
    };

    res.json({
      success: true,
      daily_quota: DAILY_QUOTA,
      today_stats: {
        date: todayStr,
        calls_total: todayCallsTotalRow?.count || 0,
        calls_caller: caller_name && caller_name !== 'all' ? (todayCallsCallerRow?.count || 0) : (todayCallsTotalRow?.count || 0),
        visit_appointments_total: todayVisitsTotalRow?.count || 0,
        visit_appointments_caller: caller_name && caller_name !== 'all' ? (todayVisitsCallerRow?.count || 0) : (todayVisitsTotalRow?.count || 0)
      },
      tomorrow_stats: tomorrowItem,
      first_available_date: firstAvailableDate || tomorrowStr,
      days: daysList
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

    const [districtRows, categoryRows, callerRows] = await Promise.all([
      db.all(`SELECT DISTINCT district FROM leads WHERE district IS NOT NULL AND TRIM(district) != '' ORDER BY district ASC`),
      db.all(`SELECT DISTINCT category FROM leads WHERE category IS NOT NULL AND TRIM(category) != '' ORDER BY category ASC`),
      db.all(`SELECT caller_name, COUNT(*) as call_count, COUNT(DISTINCT lead_id) as lead_count FROM call_logs WHERE caller_name IS NOT NULL AND TRIM(caller_name) != '' GROUP BY caller_name ORDER BY call_count DESC`)
    ]);

    const result = {
      districts: districtRows.map(r => r.district),
      categories: categoryRows.map(r => r.category),
      callers: callerRows || []
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
      assigned_caller_id, called_by, is_today_recall,
      activity_date,
      sort,
      limit = 2000 
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

    // Arama Yapan / Not Yazan Personel Filtresi
    if (called_by && called_by !== 'all' && called_by.trim() !== '') {
      query += ' AND id IN (SELECT DISTINCT lead_id FROM call_logs WHERE caller_name = ?)';
      params.push(called_by.trim());
    }

    // Bugün Aranacak Randevular Filtresi
    if (is_today_recall === '1') {
      query += " AND status = 'randevu_arama' AND (recall_date <= DATE('now', 'localtime') OR recall_date IS NULL)";
    }

    // Günlük Aktivite & Tarih Filtresi (O gün aranan, randevusu olan veya işi olan işletmeler)
    if (activity_date && activity_date.trim()) {
      const d = activity_date.trim();
      query += ` AND (
        id IN (SELECT DISTINCT lead_id FROM call_logs WHERE DATE(created_at, 'localtime') = ? OR created_at LIKE ?)
        OR recall_date = ?
        OR visit_date LIKE ?
        OR id IN (SELECT DISTINCT lead_id FROM jobs WHERE due_date = ? OR DATE(created_at, 'localtime') = ?)
      )`;
      params.push(d, `${d}%`, d, `${d}%`, d, d);
    }

    // Sıralama (Sort By): Tarihe göre artan/azalan, puana göre, son aramaya göre vb.
    let orderClause = '';

    switch (sort) {
      case 'date_desc':
        // Eklenme / Kayıt Tarihi (Yeniden Eskiye - En Yeni)
        orderClause = 'created_at DESC, id DESC';
        break;
      case 'date_asc':
        // Eklenme / Kayıt Tarihi (Eskiden Yeniye - En Eski)
        orderClause = 'created_at ASC, id ASC';
        break;
      case 'score_desc':
        // Müşteri İlgi Puanı (5 -> 1 - En Yüksek)
        orderClause = 'score DESC, rating DESC, id DESC';
        break;
      case 'score_asc':
        // Müşteri İlgi Puanı (1 -> 5 - En Düşük)
        orderClause = 'score ASC, id ASC';
        break;
      case 'last_called_desc':
        // Son Arama Tarihi (En Son Arananlar)
        orderClause = 'CASE WHEN last_called_at IS NULL THEN 1 ELSE 0 END, last_called_at DESC, id DESC';
        break;
      case 'last_called_asc':
        // Son Arama Tarihi (Hiç Aranmamış veya En Eski Arananlar)
        orderClause = 'CASE WHEN last_called_at IS NULL THEN 0 ELSE 1 END, last_called_at ASC, id ASC';
        break;
      case 'call_count_desc':
        // Arama Sayısı (En Çok Arananlar)
        orderClause = 'call_count DESC, id DESC';
        break;
      case 'call_count_asc':
        // Arama Sayısı (En Az / Hiç Aranmayanlar)
        orderClause = 'call_count ASC, id ASC';
        break;
      case 'rating_desc':
        // Google Puanı (En Yüksek)
        orderClause = 'rating DESC, user_ratings_total DESC, id DESC';
        break;
      case 'rating_asc':
        // Google Puanı (En Düşük)
        orderClause = 'rating ASC, id ASC';
        break;
      case 'name_asc':
        // İşletme Adı (A - Z)
        orderClause = 'name COLLATE NOCASE ASC';
        break;
      case 'name_desc':
        // İşletme Adı (Z - A)
        orderClause = 'name COLLATE NOCASE DESC';
        break;
      case 'priority':
      default:
        // Akıllı Öncelik: Vadesi gelen Randevular en üstte, ardından Puan ve ID
        orderClause = "CASE WHEN status = 'randevu_arama' AND recall_date <= DATE('now', 'localtime') THEN 0 ELSE 1 END, score DESC, id DESC";
        break;
    }

    query += ` ORDER BY ${orderClause} LIMIT ?`;
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

// ==========================================
// SAHA PERSONELİ ROTASI & SAHA ZİYARET YÖNETİMİ
// ==========================================

// Varsayılan saha personelini bulma yardımcısı
async function getDefaultFieldMember(requestedMemberId = null) {
  if (requestedMemberId) {
    const member = await db.get('SELECT id, name, role FROM team_members WHERE id = ?', Number(requestedMemberId));
    if (member) return member;
  }
  const fieldMember = await db.get("SELECT id, name, role FROM team_members WHERE LOWER(role) LIKE '%saha%' ORDER BY id ASC LIMIT 1");
  return fieldMember || null;
}

// 1. Saha Rotası Listesini Getir (Bekleyen ve Tamamlanan Saha Ziyaretleri, Sıralı)
router.get('/field-route', async (req, res) => {
  try {
    const { field_member_id, district, visit_status } = req.query;

    // İlk çalışmada eğer status='randevu' olup field_member_id atanmamış kayıt varsa otomatik bağla
    const defaultField = await getDefaultFieldMember();
    if (defaultField) {
      await db.run(
        `UPDATE leads 
         SET field_member_id = ?, field_member_name = ?, field_visit_status = COALESCE(field_visit_status, 'bekliyor')
         WHERE status = 'randevu' AND field_member_id IS NULL`,
        defaultField.id,
        defaultField.name
      );
    }

    let query = `
      SELECT * FROM leads 
      WHERE (status = 'randevu' OR field_member_id IS NOT NULL)
    `;
    const params = [];

    if (field_member_id && field_member_id !== 'all') {
      query += ' AND field_member_id = ?';
      params.push(Number(field_member_id));
    }

    if (district && district !== 'all' && district !== '') {
      query += ' AND district = ?';
      params.push(district);
    }

    if (visit_status && visit_status !== 'all') {
      if (visit_status === 'bekliyor') {
        query += " AND (status = 'randevu' AND COALESCE(field_visit_status, 'bekliyor') = 'bekliyor')";
      } else if (visit_status === 'tamamlandi') {
        query += " AND (field_visit_status = 'ziyaret_edildi' OR status IN ('satis_havuzu', 'is_dagitildi'))";
      }
    }

    query += `
      ORDER BY 
        CASE WHEN status = 'randevu' AND COALESCE(field_visit_status, 'bekliyor') = 'bekliyor' THEN 0 ELSE 1 END ASC,
        COALESCE(field_route_order, 9999) ASC,
        CASE WHEN visit_date IS NULL OR visit_date = '' THEN 1 ELSE 0 END ASC,
        visit_date ASC,
        id DESC
    `;

    const rows = await db.all(query, ...params);

    // Bekleyen ziyaretlere temiz sıra numarası (1, 2, 3...) sağla
    const pendingList = rows.filter(r => r.status === 'randevu' && (r.field_visit_status || 'bekliyor') === 'bekliyor');
    const completedList = rows.filter(r => !(r.status === 'randevu' && (r.field_visit_status || 'bekliyor') === 'bekliyor'));

    const districts = Array.from(new Set(rows.map(r => r.district).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));

    res.json({
      data: rows,
      pending: pendingList,
      completed: completedList,
      districts,
      stats: {
        total: rows.length,
        pending_count: pendingList.length,
        completed_count: completedList.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Saha Rotası Sıralamasını Güncelle (Saha Personeli Gideceği Sıraya Göre Dizdiğinde)
router.put('/field-route/reorder', async (req, res) => {
  try {
    const { ordered_ids } = req.body;
    if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
      return res.status(400).json({ error: 'Sıralanacak işletme listesi boş.' });
    }

    const stmts = ordered_ids.map((id, idx) => ({
      sql: 'UPDATE leads SET field_route_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [idx + 1, Number(id)]
    }));

    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50), 'write');
    }

    invalidateCache();
    res.json({
      success: true,
      message: 'Saha ziyaret rotası sıralaması kaydedildi.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Yönetici veya Çağrı Personeli Tarafından Saha Personeline İşletme Pasla (Tekli veya Toplu)
router.post('/field-route/assign', async (req, res) => {
  try {
    const { lead_ids, field_member_id, visit_date, notes, assigned_by } = req.body;
    const ids = Array.isArray(lead_ids) ? lead_ids.map(Number).filter(Boolean) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Lütfen sahaya paslanacak en az bir işletme seçiniz.' });
    }

    const targetMember = await getDefaultFieldMember(field_member_id);
    if (!targetMember) {
      return res.status(400).json({ error: 'Atanacak saha personeli bulunamadı.' });
    }

    // Mevcut en yüksek sırayı bul ki yeni eklenenler listenin sonuna düzenli eklensin
    const maxOrderRow = await db.get(
      `SELECT MAX(CASE WHEN field_route_order < 9000 THEN field_route_order ELSE 0 END) as max_order 
       FROM leads WHERE field_member_id = ? AND status = 'randevu'`,
      targetMember.id
    );
    let nextOrder = (maxOrderRow?.max_order || 0) + 1;

    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
    const author = (assigned_by || 'Yönetici').trim();

    for (const id of ids) {
      const lead = await db.get('SELECT id, name, call_notes, visit_date FROM leads WHERE id = ?', id);
      if (!lead) continue;

      let updatedNotes = lead.call_notes || '';
      if (notes && notes.trim()) {
        const formatted = `${author} [${dateStr} ${timeStr}] (Sahaya Paslandı): ${notes.trim()}`;
        updatedNotes = updatedNotes ? `${updatedNotes.trim()}\n${formatted}` : formatted;
        await db.run(
          'INSERT INTO call_logs (lead_id, outcome, caller_name, notes) VALUES (?, ?, ?, ?)',
          id, 'randevu', author, formatted
        );
      }

      await db.run(
        `UPDATE leads 
         SET status = 'randevu',
             field_member_id = ?,
             field_member_name = ?,
             field_visit_status = 'bekliyor',
             field_route_order = ?,
             visit_date = COALESCE(?, visit_date),
             call_notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        targetMember.id,
        targetMember.name,
        nextOrder++,
        visit_date || null,
        updatedNotes || null,
        id
      );
    }

    // Saha personeline bildirim gönder
    try {
      const ph = ids.map(() => '?').join(',');
      const assignedLeads = await db.all(`SELECT id, name, district FROM leads WHERE id IN (${ph})`, ...ids);
      if (assignedLeads.length > 0) {
        const count = assignedLeads.length;
        const todayIso = new Date().toISOString().slice(0, 10);
        let title = '🚗 Yeni Saha Ziyareti Paslandı';
        let msg = '';
        if (count === 1) {
          const l = assignedLeads[0];
          title = `🚗 Saha Ziyareti: ${l.name}`;
          msg = `${author} size "${l.name}"${l.district ? ` (${l.district})` : ''} işletmesini saha ziyareti için pasladı.`;
        } else {
          title = `🚗 ${count} Yeni Saha Ziyareti Paslandı`;
          msg = `${author} saha rotanıza "${assignedLeads[0].name}" dahil ${count} işletme ekledi.`;
        }

        await db.run(
          `INSERT INTO notifications (to_user, title, message, date, time, read, type, count, lead_ids)
           VALUES (?, ?, ?, ?, ?, 0, 'field_assignment', ?, ?)`,
          targetMember.name,
          title,
          msg,
          todayIso,
          timeStr,
          count,
          assignedLeads.map(l => l.id).join(',')
        );
      }
    } catch (notifErr) {
      console.error('Saha bildirim hatası:', notifErr);
    }

    invalidateCache();
    res.json({
      success: true,
      field_member: targetMember,
      message: `${ids.length} işletme saha personeli ${targetMember.name} rotasına paslandı.`
    });
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
    const { outcome, notes, caller_name, visit_date, recall_date, recall_time, score, retry_date, products, field_member_id } = req.body;
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

    // Personel adını belirle ve notu "Sezai [12.10.2026 14:35]: ..." şeklinde sistem saatinden çekerek biçimlendir
    const author = (caller_name || 'Operatör').trim();
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Istanbul'
    });
    const timeStr = now.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul'
    });

    let formattedNote = '';
    if (notes && notes.trim()) {
      let cleanNote = notes.trim();
      // Eğer kullanıcı veya arayüz zaten "Yazar: " veya "Yazar [tarih]: " eklediyse temizle
      const existingPrefixMatch = cleanNote.match(/^([^\[:]+?)(?:\s*\[[^\]]+\])?\s*:\s*(.*)$/);
      if (existingPrefixMatch && existingPrefixMatch[1].trim().toLowerCase() === author.toLowerCase()) {
        cleanNote = existingPrefixMatch[2].trim();
      } else if (cleanNote.toLowerCase().startsWith(author.toLowerCase() + ':')) {
        cleanNote = cleanNote.substring(author.length + 1).trim();
      }

      formattedNote = `${author} [${dateStr} ${timeStr}]: ${cleanNote}`;
    }

    // Günlük 20 Yüz Yüze Randevu Kotası Kontrolü (2 Saha Personeli x 10 = 20)
    if (outcome === 'randevu' && visit_date) {
      const targetDay = String(visit_date).slice(0, 10);
      const existingAppts = await db.get(
        `SELECT COUNT(*) as count FROM leads WHERE status = 'randevu' AND SUBSTR(visit_date, 1, 10) = ? AND id != ?`,
        targetDay,
        leadId
      );
      const currentCount = existingAppts?.count || 0;
      if (currentCount >= 20 && !req.body.force_over_quota) {
        return res.status(400).json({
          error: `${targetDay} tarihi için 20 yüz yüze randevu kotası dolmuştur (2 saha personeli kapasitesi)! Saha ekibinin randevulara yetişebilmesi için lütfen randevuyu bir sonraki müsait güne veriniz.`,
          quota_exceeded: true,
          current_count: currentCount,
          target_date: targetDay
        });
      }
    }

    // Arama günlüğü ekle
    await db.run(`
      INSERT INTO call_logs (lead_id, outcome, caller_name, notes)
      VALUES (?, ?, ?, ?)
    `, leadId, outcome, author, formattedNote || notes || '');

    // Mevcut call_notes ile birleştir (öncekileri silmeyip yeni satır olarak alta ekle)
    let newCallNotes = lead.call_notes || '';
    if (formattedNote) {
      if (newCallNotes && newCallNotes.trim()) {
        newCallNotes = newCallNotes.trim() + '\n' + formattedNote;
      } else {
        newCallNotes = formattedNote;
      }
    }

    // EĞER SONUÇ 'randevu' (YÜZ YÜZE ZİYARET RANDEVUSU) İSE OTOMATİK SAHA PERSONELİNE PASLA
    let assignedFieldId = lead.field_member_id || null;
    let assignedFieldName = lead.field_member_name || null;
    let assignedRouteOrder = lead.field_route_order || 9999;
    let assignedVisitStatus = lead.field_visit_status || 'bekliyor';

    if (outcome === 'randevu') {
      const targetFieldMember = await getDefaultFieldMember(field_member_id);
      if (targetFieldMember) {
        assignedFieldId = targetFieldMember.id;
        assignedFieldName = targetFieldMember.name;
        assignedVisitStatus = 'bekliyor';

        if (!lead.field_route_order || lead.field_route_order >= 9000) {
          const maxOrderRow = await db.get(
            `SELECT MAX(CASE WHEN field_route_order < 9000 THEN field_route_order ELSE 0 END) as max_order 
             FROM leads WHERE field_member_id = ? AND status = 'randevu'`,
            targetFieldMember.id
          );
          assignedRouteOrder = (maxOrderRow?.max_order || 0) + 1;
        }

        // Saha personeline anlık bildirim gönder
        try {
          const todayIso = new Date().toISOString().slice(0, 10);
          const distText = lead.district ? ` (${lead.district})` : '';
          await db.run(
            `INSERT INTO notifications (to_user, title, message, date, time, read, type, count, lead_ids)
             VALUES (?, ?, ?, ?, ?, 0, 'field_assignment', 1, ?)`,
            targetFieldMember.name,
            `🚗 Yeni Saha Ziyareti: ${lead.name}`,
            `${author}, "${lead.name}"${distText} işletmesi için yüz yüze randevu aldı ve saha rotanıza pasladı.`,
            todayIso,
            timeStr,
            String(lead.id)
          );
        } catch (notifErr) {
          console.error('Saha randevu bildirimi hatası:', notifErr);
        }
      }
    } else if (outcome === 'ziyaret_olumlu' || outcome === 'satis' || outcome === 'ziyaret_olumsuz') {
      assignedVisitStatus = 'ziyaret_edildi';
    }

    // Lead'i güncelle
    const productsStr = products ? (typeof products === 'string' ? products : JSON.stringify(products)) : null;

    await db.run(`
      UPDATE leads
      SET
        status = ?,
        call_notes = ?,
        visit_date = CASE WHEN ? IS NOT NULL THEN ? ELSE visit_date END,
        recall_date = CASE WHEN ? IS NOT NULL THEN ? ELSE recall_date END,
        recall_time = CASE WHEN ? IS NOT NULL THEN ? ELSE recall_time END,
        score = CASE WHEN ? IS NOT NULL THEN ? ELSE score END,
        retry_date = CASE WHEN ? IS NOT NULL THEN ? ELSE retry_date END,
        products = CASE WHEN ? IS NOT NULL THEN ? ELSE products END,
        field_member_id = ?,
        field_member_name = ?,
        field_route_order = ?,
        field_visit_status = ?,
        call_count = call_count + 1,
        last_called_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      newStatus, 
      newCallNotes || lead.call_notes || null, 
      visit_date || null, visit_date || null,
      recall_date || null, recall_date || null,
      recall_time || null, recall_time || null,
      score !== undefined ? Number(score) : null, score !== undefined ? Number(score) : null,
      retry_date || null, retry_date || null,
      productsStr, productsStr,
      assignedFieldId,
      assignedFieldName,
      assignedRouteOrder,
      assignedVisitStatus,
      leadId
    );

    invalidateCache();

    const updatedLead = await db.get('SELECT * FROM leads WHERE id = ?', leadId);
    res.json({
      success: true,
      lead: updatedLead,
      message: outcome === 'randevu' && assignedFieldName
        ? `Randevu kaydedildi ve otomatik olarak saha personeli (${assignedFieldName}) rotasına paslandı.`
        : 'Arama kaydı ve durum güncellendi.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Saha Personelinin Ziyaret Notu ve Sonucunu Kaydetmesi
router.post('/:id/field-visit', async (req, res) => {
  try {
    const { outcome, notes, visitor_name, score, products, next_visit_date, recall_date, recall_time } = req.body;
    const leadId = req.params.id;

    const lead = await db.get('SELECT * FROM leads WHERE id = ?', leadId);
    if (!lead) return res.status(404).json({ error: 'İşletme bulunamadı.' });

    const author = (visitor_name || lead.field_member_name || 'Saha Personeli').trim();
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

    let newStatus = lead.status;
    let newVisitStatus = 'ziyaret_edildi';
    let logOutcome = 'ziyaret_notu';

    if (outcome === 'satis' || outcome === 'ziyaret_olumlu') {
      newStatus = 'satis_havuzu';
      newVisitStatus = 'ziyaret_edildi';
      logOutcome = 'ziyaret_olumlu';
    } else if (outcome === 'tekrar_ziyaret') {
      newStatus = 'randevu';
      newVisitStatus = 'bekliyor';
      logOutcome = 'randevu';
    } else if (outcome === 'randevu_arama') {
      newStatus = 'randevu_arama';
      newVisitStatus = 'ziyaret_edildi';
      logOutcome = 'randevu_arama';
    } else if (outcome === 'ziyaret_olumsuz') {
      newStatus = 'mutlak_olumsuz';
      newVisitStatus = 'ziyaret_edildi';
      logOutcome = 'ziyaret_olumsuz';
    } else if (outcome === 'sadece_not') {
      newStatus = lead.status;
      newVisitStatus = lead.field_visit_status || 'bekliyor';
      logOutcome = 'randevu';
    }

    let formattedNote = '';
    if (notes && notes.trim()) {
      formattedNote = `${author} (Saha) [${dateStr} ${timeStr}]: ${notes.trim()}`;
    } else {
      const labelMap = {
        satis: 'Saha ziyareti olumlu tamamlandı, satış havuzuna aktarıldı.',
        ziyaret_olumlu: 'Saha ziyareti olumlu tamamlandı, satış havuzuna aktarıldı.',
        tekrar_ziyaret: 'Saha ziyareti yapıldı, tekrar ziyaret edilecek.',
        randevu_arama: 'Saha ziyareti yapıldı, telefonla tekrar aranacak.',
        ziyaret_olumsuz: 'Saha ziyareti olumsuz sonuçlandı.'
      };
      formattedNote = `${author} (Saha) [${dateStr} ${timeStr}]: ${labelMap[outcome] || 'Saha ziyareti gerçekleştirildi.'}`;
    }

    await db.run(
      'INSERT INTO call_logs (lead_id, outcome, caller_name, notes) VALUES (?, ?, ?, ?)',
      leadId, logOutcome, author, formattedNote
    );

    const newCallNotes = lead.call_notes && lead.call_notes.trim()
      ? `${lead.call_notes.trim()}\n${formattedNote}`
      : formattedNote;

    const productsStr = products ? (typeof products === 'string' ? products : JSON.stringify(products)) : null;

    await db.run(
      `UPDATE leads
       SET status = ?,
           call_notes = ?,
           field_visit_status = ?,
           visit_date = CASE WHEN ? IS NOT NULL THEN ? ELSE visit_date END,
           recall_date = CASE WHEN ? IS NOT NULL THEN ? ELSE recall_date END,
           recall_time = CASE WHEN ? IS NOT NULL THEN ? ELSE recall_time END,
           score = CASE WHEN ? IS NOT NULL THEN ? ELSE score END,
           products = CASE WHEN ? IS NOT NULL THEN ? ELSE products END,
           call_count = call_count + 1,
           last_called_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      newStatus,
      newCallNotes,
      newVisitStatus,
      next_visit_date || null, next_visit_date || null,
      recall_date || null, recall_date || null,
      recall_time || null, recall_time || null,
      score !== undefined ? Number(score) : null, score !== undefined ? Number(score) : null,
      productsStr, productsStr,
      leadId
    );

    invalidateCache();
    const updatedLead = await db.get('SELECT * FROM leads WHERE id = ?', leadId);
    res.json({
      success: true,
      lead: updatedLead,
      message: 'Saha ziyaret notu ve sonucu başarıyla kaydedildi.'
    });
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

    // Personele Atandıysa Bildirim Gönder (İşletme Adları Dahil)
    if (callerName && cleanCallerId) {
      try {
        const leadPlaceholders = lead_ids.map(() => '?').join(',');
        const assignedLeads = await db.all(
          `SELECT id, name, district FROM leads WHERE id IN (${leadPlaceholders})`,
          ...lead_ids
        );

        const count = assignedLeads.length;
        const todayStr = new Date().toISOString().slice(0, 10);
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        let title = '📞 Yeni Arama Atandı';
        let message = '';

        if (count === 1) {
          const l = assignedLeads[0];
          const distText = l.district ? ` (${l.district})` : '';
          title = `📞 Yeni Arama: ${l.name}`;
          message = `Yönetici size "${l.name}"${distText} işletmesini arama listesine atadı.`;
        } else if (count === 2) {
          title = `📞 2 Yeni Arama Atandı`;
          message = `Yönetici size "${assignedLeads[0].name}" ve "${assignedLeads[1].name}" işletmelerini atadı.`;
        } else if (count === 3) {
          title = `📞 3 Yeni Arama Atandı`;
          message = `Yönetici size "${assignedLeads[0].name}", "${assignedLeads[1].name}" ve "${assignedLeads[2].name}" işletmelerini atadı.`;
        } else {
          title = `📞 ${count} Yeni Arama Atandı`;
          message = `Yönetici size "${assignedLeads[0].name}", "${assignedLeads[1].name}" ve ${count - 2} diğer işletmeyi atadı.`;
        }

        const leadIdsStr = assignedLeads.map(l => l.id).join(',');

        await db.run(
          `INSERT INTO notifications (to_user, title, message, date, time, read, type, count, lead_ids)
           VALUES (?, ?, ?, ?, ?, 0, 'call_assignment', ?, ?)`,
          callerName,
          title,
          message,
          todayStr,
          timeStr,
          count,
          leadIdsStr
        );
      } catch (notifErr) {
        console.error('Batch assign bildirim oluşturma hatası:', notifErr);
      }
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
