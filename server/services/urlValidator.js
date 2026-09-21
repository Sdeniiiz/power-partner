/**
 * Web sitesi ve Instagram linklerini doğrulama ve canlılık kontrolü yardımcısı
 */
const axios = require('axios');

/**
 * URL'nin geçerli olup olmadığını kontrol eder ve https:// protokolü ekler
 */
function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';

  // Eğer başında protokol yoksa https:// ekle
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname || !parsed.hostname.includes('.') || parsed.hostname.length < 4) {
      return '';
    }
    // Geçersiz veya test domainlerini engelle
    if (parsed.hostname.includes('localhost') || parsed.hostname === 'example.com') {
      return '';
    }
    return url;
  } catch (e) {
    return '';
  }
}

/**
 * İşletmenin gerçek Instagram profilini veya güvenli arama linkini oluşturur
 * Kesinlikle tahmin üretip 404 veren sahte Instagram linkleri oluşturmaz!
 */
function processInstagram(websiteUrl, placeName, district = '', city = '') {
  const normWeb = normalizeUrl(websiteUrl);

  // 1. Durum: Google Maps'teki web sitesi zaten Instagram profili ise
  if (normWeb && (normWeb.includes('instagram.com') || normWeb.includes('instagr.am'))) {
    try {
      const parsed = new URL(normWeb);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      // Profil kullanıcı adı ilk parçadır
      if (pathParts.length > 0 && !['p', 'reel', 'stories', 'explore', 'direct', 'accounts'].includes(pathParts[0].toLowerCase())) {
        const username = pathParts[0];
        return {
          has_instagram: true,
          is_verified: true,
          instagram_url: `https://www.instagram.com/${username}/`,
          username: `@${username}`,
          search_url: null
        };
      }
    } catch (e) {}
  }

  // 2. Durum: Instagram doğrulanmamışsa, kullanıcıyı kandıracak sahte link üretilmez, sadece arama linki verilir
  const query = `site:instagram.com "${placeName}" ${district} ${city}`.trim();
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  return {
    has_instagram: false,
    is_verified: false,
    instagram_url: null,
    username: null,
    search_url: searchUrl
  };
}

/**
 * Bir web sitesinin gerçekten canlı olup olmadığını hızlıca test eder (HEAD / GET)
 * Maksimum 1200ms zaman aşımı, asılı kalan sunucularda anında sonlanır.
 * @param {string} url 
 * @param {number} timeoutMs 
 * @returns {Promise<{ isAlive: boolean, status: string, error?: string }>}
 */
async function checkUrlAlive(url, timeoutMs = 1200) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return { isAlive: false, status: 'none' };
  }

  try {
    // 1. Önce hızlı HEAD isteği dene (sadece header, veri indirmez)
    const headRes = await axios.head(normalized, {
      timeout: timeoutMs,
      maxRedirects: 2,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerPartner-Bot/2.0'
      },
      validateStatus: (status) => status < 400
    });
    return { isAlive: true, status: 'active', code: headRes.status };
  } catch (headErr) {
    const status = headErr.response?.status;
    // Yalnızca HEAD metodunu engelleyen sunucularda (405 / 403) hızlı 800ms GET dene
    if (status === 405 || status === 403) {
      try {
        const getRes = await axios.get(normalized, {
          timeout: 800,
          maxRedirects: 2,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerPartner-Bot/2.0',
            'Range': 'bytes=0-50'
          },
          validateStatus: (s) => s < 400
        });
        return { isAlive: true, status: 'active', code: getRes.status };
      } catch (getErr) {
        return { isAlive: false, status: 'broken', error: getErr.code || getErr.message };
      }
    }
    // Zaman aşımı veya DNS hatası durumunda hemen kırık olarak işaretle (kullanıcıyı bekletme)
    const errMsg = headErr.code || headErr.message || 'Kapalı / Kırık Link';
    return { isAlive: false, status: 'broken', error: errMsg };
  }
}

/**
 * İşletme listesindeki web sitelerini paralel olarak ve maksimum 1800ms global süre sınırı ile test eder.
 * Arama isteğinin asla gecikmemesini ve 30s timeout yememesini garanti eder.
 * @param {Array} places
 * @param {number} maxGlobalTimeoutMs
 */
async function verifyWebsitesInBatch(places, maxGlobalTimeoutMs = 1800) {
  if (!Array.isArray(places) || places.length === 0) return places;

  const results = [...places];
  
  // Tekrarlayan siteleri tek seferde test etmek için benzersiz web sitelerini topla
  const uniqueUrls = new Set();
  results.forEach(p => {
    if (p.website) {
      uniqueUrls.add(p.website);
    } else {
      p.website_status = 'none';
      p.has_website = false;
    }
  });

  if (uniqueUrls.size === 0) {
    return results;
  }

  const urlStatusMap = new Map();

  // Tüm benzersiz siteleri tamamen PARALEL başlat
  const checkPromise = Promise.allSettled(
    Array.from(uniqueUrls).map(async (url) => {
      const check = await checkUrlAlive(url, 1200);
      urlStatusMap.set(url, check);
    })
  );

  // Global güvenlik sayacı: 1.8 saniye dolunca tamamlananları uygula, arama isteğini asla bekletme!
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, maxGlobalTimeoutMs));

  await Promise.race([checkPromise, timeoutPromise]);

  // Sonuçları işletme objelerine eşleştir
  // Google Haritalarda web sitesi kayıtlı olan işletmeler kesinlikle has_website: true olarak korunur.
  // Otomatik bot kontrolünün yavaş kalması işletmenin sitesi olmadığı anlamına gelmez.
  results.forEach(item => {
    if (item.website) {
      item.has_website = true;
      const check = urlStatusMap.get(item.website);
      if (check) {
        item.website_status = check.status;
        if (!check.isAlive) {
          item.website_broken_note = 'Web sitesi yavaş veya yanıt vermiyor olabilir';
        }
      } else {
        // Süre sınırı içinde yanıt vermeyen siteler "unknown" olarak kalır
        item.website_status = 'unknown';
      }
    } else {
      item.has_website = false;
      item.website_status = 'none';
    }
  });

  return results;
}

module.exports = {
  normalizeUrl,
  processInstagram,
  checkUrlAlive,
  verifyWebsitesInBatch
};
