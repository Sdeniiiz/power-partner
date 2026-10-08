const express = require('express');
const router = express.Router();
const db = require('../db');

// Bildirimleri listele
router.get('/', async (req, res) => {
  try {
    const { user } = req.query;
    let notifications = [];

    if (user) {
      notifications = await db.all(
        `SELECT * FROM notifications 
         WHERE to_user = ? OR to_user = 'all' 
         ORDER BY id DESC LIMIT 50`,
        user.trim()
      );
    } else {
      notifications = await db.all(
        `SELECT * FROM notifications ORDER BY id DESC LIMIT 50`
      );
    }

    const unreadCount = notifications.filter(n => n.read === 0).length;

    res.json({
      data: notifications,
      unread_count: unreadCount
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
        "UPDATE notifications SET read = 1 WHERE to_user = ? OR to_user = 'all'",
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
