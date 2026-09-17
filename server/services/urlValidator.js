/**
 * Web sitesi ve Instagram linklerini doğrulama ve temizleme yardımcısı
 */

/**
 * URL'nin geçerli olup olmadığını kontrol eder ve https:// protokolü ekler
 */
function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';

  // Eğer başında protokol yoksa https:// ekle (localhost'a yönlenmesini engeller)
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    // Geçerli bir hostname ve en az bir nokta (tld) olmalı
    if (!parsed.hostname || !parsed.hostname.includes('.') || parsed.hostname.length < 4) {
      return '';
    }
    // Geçersiz veya şüpheli domainleri engelle
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
 */
function processInstagram(websiteUrl, placeName, district = '', city = '') {
  const normWeb = normalizeUrl(websiteUrl);

  // 1. Durum: Google Maps'teki web sitesi zaten Instagram profili ise
  if (normWeb && (normWeb.includes('instagram.com') || normWeb.includes('instagr.am'))) {
    try {
      const parsed = new URL(normWeb);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      // Profil kullanıcı adı ilk parçadır
      if (pathParts.length > 0 && !['p', 'reel', 'stories', 'explore'].includes(pathParts[0].toLowerCase())) {
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

  // 2. Durum: Web sitesinde veya metinde Instagram kullanıcı adı varsa
  const cleanHandle = placeName
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');

  const query = `site:instagram.com "${placeName}" ${district} ${city}`.trim();
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const directProfileGuess = cleanHandle.length >= 3 ? `https://www.instagram.com/${cleanHandle}/` : null;

  return {
    has_instagram: Boolean(normWeb && (normWeb.includes('instagram.com') || normWeb.includes('instagr.am'))),
    is_verified: false,
    instagram_url: directProfileGuess,
    username: cleanHandle ? `@${cleanHandle}` : null,
    search_url: searchUrl
  };
}

module.exports = {
  normalizeUrl,
  processInstagram
};

