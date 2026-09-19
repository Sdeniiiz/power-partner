const express = require('express');
const router = express.Router();
const db = require('../db');

// Takvim etkinliklerini getir (Teslim Tarihleri + Randevu/Ziyaret Tarihleri)
router.get('/events', async (req, res) => {
  try {
    const { member_id, month, year } = req.query;

    // 1. İş Teslim Tarihleri (Jobs)
    let jobsQuery = `
      SELECT
        j.id as job_id,
        j.title,
        j.due_date as event_date,
        j.status as job_status,
        j.notes,
        'job_deadline' as event_type,
        l.id as lead_id,
        l.name as client_name,
        l.phone as client_phone,
        l.district,
        c.name as category_name,
        c.color as category_color,
        m.id as member_id,
        m.name as member_name,
        m.color as member_color
      FROM jobs j
      JOIN leads l ON j.lead_id = l.id
      LEFT JOIN categories c ON j.category_id = c.id
      LEFT JOIN team_members m ON j.assigned_member_id = m.id
      WHERE j.due_date IS NOT NULL AND j.due_date != ''
    `;
    const jobParams = [];

    if (member_id) {
      jobsQuery += ' AND j.assigned_member_id = ?';
      jobParams.push(member_id);
    }

    const jobEvents = await db.all(jobsQuery, ...jobParams);

    // 2. Randevu / Ziyaret Tarihleri (Leads with visit_date)
    let visitQuery = `
      SELECT
        l.id as lead_id,
        'Müşteri Ziyareti: ' || l.name as title,
        l.visit_date as event_date,
        l.status as lead_status,
        l.call_notes as notes,
        'lead_visit' as event_type,
        l.name as client_name,
        l.phone as client_phone,
        l.district,
        'Ziyaret / Randevu' as category_name,
        '#8B5CF6' as category_color,
        NULL as member_id,
        'Saha / Randevu' as member_name,
        '#8B5CF6' as member_color
      FROM leads l
      WHERE l.visit_date IS NOT NULL AND l.visit_date != '' AND l.status = 'randevu'
    `;

    const visitEvents = await db.all(visitQuery);

    // İki kaynağı birleştirip tarihe göre sıralayalım
    const allEvents = [...jobEvents, ...visitEvents].sort((a, b) => {
      return (a.event_date || '').localeCompare(b.event_date || '');
    });

    res.json({ data: allEvents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
