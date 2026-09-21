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
 * @param {string} url 
 * @param {number} timeoutMs 
 * @returns {Promise<{ isAlive: boolean, status: string, error?: string }>}
 */
async function checkUrlAlive(url, timeoutMs = 2500) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return { isAlive: false, status: 'none' };
  }

  try {
    // Önce hızlı HEAD isteği dene
    const headRes = await axios.head(normalized, {
      timeout: timeoutMs,
      maxRedirects: 3,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerPartner-Bot/2.0'
      },
      validateStatus: (status) => status < 400
    });
    return { isAlive: true, status: 'active', code: headRes.status };
  } catch (headErr) {
    // Bazı sunucular HEAD isteğini reddeder (405 / 403), bu durumda GET ile 1 byte dene
    try {
      const getRes = await axios.get(normalized, {
        timeout: timeoutMs,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PowerPartner-Bot/2.0',
          'Range': 'bytes=0-100'
        },
        validateStatus: (status) => status < 400
      });
      return { isAlive: true, status: 'active', code: getRes.status };
    } catch (getErr) {
      const errMsg = getErr.code || getErr.message || 'Kapalı / Kırık Link';
      return { isAlive: false, status: 'broken', error: errMsg };
    }
  }
}

/**
 * İşletme listesindeki web sitelerini paralel olarak test eder
 */
async function verifyWebsitesInBatch(places, batchSize = 6) {
  if (!Array.isArray(places) || places.length === 0) return places;

  const results = [...places];
  for (let i = 0; i < results.length; i += batchSize) {
    const chunk = results.slice(i, i + batchSize);
    await Promise.all(chunk.map(async (item) => {
      if (item.website) {
        const check = await checkUrlAlive(item.website);
        item.website_status = check.status;
        if (!check.isAlive) {
          // Web sitesi var ama çalışmıyor (Satış için sıcak fırsat!)
          item.has_website = false;
          item.website_broken_note = 'Web sitesi açılmıyor / arızalı';
        } else {
          item.has_website = true;
        }
      } else {
        item.website_status = 'none';
        item.has_website = false;
      }
    }));
  }
  return results;
}

module.exports = {
  normalizeUrl,
  processInstagram,
  checkUrlAlive,
  verifyWebsitesInBatch
};
