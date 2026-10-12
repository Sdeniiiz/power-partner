const express = require('express');
const router = express.Router();
const db = require('../db');

// Bildirimleri listele
router.get('/', async (req, res) => {
  try {
    const { user, is_admin, role } = req.query;
    const isAdmin = is_admin === 'true' || is_admin === true || role === 'admin' || (!user && is_admin !== 'false');
    let notifications = [];

    if (!isAdmin && user) {
      // Normal personel: Kendisine atanan bildirimler veya genel bildirimler (Case-insensitive)
      notifications = await db.all(
        `SELECT * FROM notifications 
         WHERE LOWER(TRIM(to_user)) = LOWER(TRIM(?)) OR to_user = 'all' 
         ORDER BY id DESC LIMIT 50`,
        user.trim()
      );
    } else {
      // Admin: Yalnızca genel sistem bildirimleri veya doğrudan admine gönderilenler
      notifications = await db.all(
        `SELECT * FROM notifications 
         WHERE to_user = 'all' OR to_user = 'admin' OR LOWER(TRIM(to_user)) = 'admin'
         ORDER BY id DESC LIMIT 50`
      );
    }

    // Bugün aranacak randevuların sayısını dinamik hesapla
    // ÖNEMLİ: Admin yönetici olduğu için aranacak randevu bildirimi ALMAZ (adminde aranacak kişi çıkmaz)
    let todayRecallCount = 0;

    if (!isAdmin && user) {
      // Sadece personelin kendisine atanan vadesi gelmiş randevuları say
      const member = await db.get(
        'SELECT id, name FROM team_members WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
        user.trim()
      );

      if (member) {
        const recallResult = await db.get(
          `SELECT COUNT(*) as count FROM leads 
           WHERE status = 'randevu_arama' 
             AND (recall_date <= DATE('now', 'localtime') OR recall_date IS NULL)
             AND assigned_caller_id = ?`,
          member.id
        );
        todayRecallCount = recallResult?.count || 0;
      }

      if (todayRecallCount > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const dynamicNotif = {
          id: 'today-recalls-dynamic',
          to_user: user,
          title: '⏰ Bugün Aranacak Randevularınız Var!',
          message: `Bugün aramanız planlanan size atanmış ${todayRecallCount} adet işletme bulunuyor. Aramak için tıklayın.`,
          date: todayStr,
          time: 'Bugün',
          read: 0,
          type: 'today_recalls',
          count: todayRecallCount
        };
        // Bildirim listesinin en başına ekle
        notifications.unshift(dynamicNotif);
      }
    }

    const unreadCount = notifications.filter(n => n.read === 0).length;

    res.json({
      data: notifications,
      unread_count: unreadCount,
      today_recalls_count: todayRecallCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bildirimleri okundu olarak işaretle
router.post('/mark-read', async (req, res) => {
  try {
    const { id, user } = req.body;

    if (id) {
      await db.run('UPDATE notifications SET read = 1 WHERE id = ?', id);
    } else if (user) {
      await db.run(
        "UPDATE notifications SET read = 1 WHERE LOWER(TRIM(to_user)) = LOWER(TRIM(?)) OR to_user = 'all'",
        user.trim()
      );
    } else {
      await db.run('UPDATE notifications SET read = 1');
    }

    res.json({ success: true, message: 'Bildirimler okundu olarak işaretlendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni bildirim ekle
router.post('/', async (req, res) => {
  try {
    const { to_user, title, message, date, time, count, type } = req.body;
    if (!to_user || !title || !message) {
      return res.status(400).json({ error: 'to_user, title ve message zorunludur.' });
    }

    const todayStr = date || new Date().toISOString().slice(0, 10);
    const timeStr = time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const result = await db.run(
      `INSERT INTO notifications (to_user, title, message, date, time, read, type, count)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      to_user.trim(),
      title.trim(),
      message.trim(),
      todayStr,
      timeStr,
      type || 'call_assignment',
      Number(count) || 0
    );

    const created = await db.get('SELECT * FROM notifications WHERE id = ?', result.lastInsertRowid);
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bildirim sil
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM notifications WHERE id = ?', req.params.id);
    res.json({ success: true, message: 'Bildirim silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
