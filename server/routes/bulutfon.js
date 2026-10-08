const express = require('express');
const router = express.Router();
const axios = require('axios');
const querystring = require('querystring');
const db = require('../db');

// Bulutfon VoIP Santral Araması (Call and Bridge)
router.post('/call', async (req, res) => {
  try {
    let { apiKey, extension, destination } = req.body;

    // Ayarlardan API anahtarını ve ana dahiliyi kontrol et
    if (!apiKey) {
      const apiKeySetting = await db.get("SELECT value FROM settings WHERE key = 'bulutfon_api_key'");
      apiKey = apiKeySetting?.value || process.env.BULUTFON_API_KEY || '';
    }

    if (!extension) {
      const masterExt = await db.get("SELECT value FROM settings WHERE key = 'bulutfon_master_number'");
      extension = masterExt?.value || process.env.BULUTFON_MASTER_NUMBER || '';
    }

    // Telefon numarasını temizle (sadece rakamlar)
    const cleanDestination = (destination || '').toString().replace(/[^0-9]/g, '');

    if (!cleanDestination) {
      return res.status(400).json({ success: false, error: 'Geçerli bir telefon numarası bulunamadı.' });
    }

    // Eğer API anahtarı veya dahili girilmemişse, doğrudan klasik telefon aramasına (tel: linkine) düşsün
    if (!apiKey || apiKey.trim().length < 5 || !extension) {
      return res.json({
        success: false,
        fallback: true,
        message: 'Bulutfon API anahtarı veya dahili numara tanımlanmamış. Klasik cihaz aramasına yönlendiriliyor.'
      });
    }

    try {
      const payload = querystring.stringify({
        apikey: apiKey.trim(),
        extension: extension.toString().trim(),
        destination: cleanDestination
      });

      const response = await axios.post(
        'https://api.bulutfon.com/v2/pbx/call-and-bridge',
        payload,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 12000
        }
      );

      const isSuccess = response.status >= 200 && response.status < 300;

      return res.json({
        success: isSuccess,
        extension,
        destination: cleanDestination,
        response: response.data,
        message: isSuccess ? `Dahiliniz (${extension}) aranıyor... Ahizeyi kaldırdığınızda müşteri bağlanacaktır.` : 'Arama başlatılamadı.'
      });
    } catch (apiErr) {
      console.warn('Bulutfon API çağrı hatası:', apiErr.response?.data || apiErr.message);
      return res.json({
        success: false,
        fallback: true,
        error: apiErr.response?.data?.message || apiErr.response?.data?.error || apiErr.message,
        message: 'Bulutfon santral araması başlatılamadı. Doğrudan telefon aramasına geçiliyor.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, fallback: true, error: err.message });
  }
});

// Bulutfon ayar ve durum kontrolü
router.get('/status', async (req, res) => {
  try {
    const [keyRow, numRow] = await Promise.all([
      db.get("SELECT value FROM settings WHERE key = 'bulutfon_api_key'"),
      db.get("SELECT value FROM settings WHERE key = 'bulutfon_master_number'")
    ]);

    const hasKey = Boolean(keyRow?.value && keyRow.value.trim().length > 5);

    res.json({
      configured: hasKey,
      master_number: numRow?.value || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
