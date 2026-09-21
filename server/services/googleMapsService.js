const axios = require('axios');
const { analyzePhoneNumber } = require('./phoneAnalyzer');
const { normalizeUrl, processInstagram, verifyWebsitesInBatch } = require('./urlValidator');
const { verifyLocation } = require('./locationValidator');

/**
 * Google Places API (New v1 & Legacy) - Derin Tarama, Doğrulanmış Linkler ve Konum Servisi
 */
class GoogleMapsService {
  constructor(getApiKeyFn) {
    this.getApiKey = getApiKeyFn;
  }

  /**
   * İlçe ve Kategoriye göre bölgedeki TÜM işletmeleri arar
   */
  async searchPlaces({ district, category, city = 'İstanbul', query = '', deepSearch = true }) {
    const rawApiKey = await this.getApiKey();
    const apiKey = rawApiKey ? rawApiKey.trim() : '';

    const baseQuery = query || `${district} ${city} ${category}`.trim();

    // API Anahtarı girilmişse gerçek Google Places API'yi çağır
    if (apiKey && apiKey.length > 10) {
      let v1Error = null;
      let legacyError = null;

      // 1. Modern Places API (New) v1 üzerinden çoklu sayfalama ve varyasyon taraması
      try {
        const v1Results = await this.searchPlacesV1Deep(baseQuery, district, category, city, apiKey, deepSearch);
        if (v1Results && v1Results.length > 0) {
          return {
            isDemo: false,
            apiType: 'places_v1_new',
            totalFound: v1Results.length,
            data: v1Results
          };
        }
      } catch (errV1) {
        v1Error = errV1.response?.data?.error?.message || errV1.message;
        console.warn('Places API (New) sorgusu başarısız, Legacy deneniyor:', v1Error);
      }

      // 2. Olmazsa Klasik Places API (Legacy) üzerinden çoklu sayfalama
      try {
        const legacyResults = await this.searchGooglePlacesLegacyDeep(baseQuery, district, category, city, apiKey, deepSearch);
        if (legacyResults && legacyResults.length > 0) {
          return {
            isDemo: false,
            apiType: 'places_legacy',
            totalFound: legacyResults.length,
            data: legacyResults
          };
        }
      } catch (errLegacy) {
        legacyError = errLegacy.message;
        console.error('Google Places API (Legacy) Hatası:', legacyError);
      }

      // Her iki API de hata verdiyse kullanıcı için net ve yol gösterici teşhis
      let friendlyReason = '';
      const combined = `${v1Error || ''} ${legacyError || ''}`;
      if (combined.includes('PERMISSION_DENIED') || combined.includes('permission') || combined.includes('LegacyApiNotActivated')) {
        friendlyReason = "Google Cloud Console projenizde 'Places API (New)' servisi henüz etkinleştirilmemiş (Enable) veya API anahtarınızda bu servis kısıtlanmış. console.cloud.google.com adresinden 'Places API (New)' servisini etkinleştirmeniz gerekmektedir.";
      } else if (combined.includes('Billing') || combined.includes('billing') || combined.includes('BILLING')) {
        friendlyReason = "Google Cloud projenizde Faturalandırma Hesabı (Billing Account) aktif değil. Google Harita aramaları için faturalandırma bağlanmalıdır (Google aylık 200$ ücretsiz kullanım hakkı sunar).";
      } else if (combined.includes('API_KEY_INVALID') || combined.includes('Invalid API key')) {
        friendlyReason = "Google Maps API anahtarı geçersiz. Lütfen Ayarlar bölümünden anahtarınızı kontrol ediniz.";
      } else {
        friendlyReason = v1Error || legacyError || 'Google Maps API bağlantısı sağlanamadı.';
      }

      return {
        error: friendlyReason,
        isDemo: true,
        totalFound: 40,
        data: this.generateRealisticMockPlaces(district, category, city, 45)
      };
    }

    // API anahtarı yoksa gerçekçi simülasyon işletmeleri üret
    const mockData = this.generateRealisticMockPlaces(district, category, city, 45);
    return {
      isDemo: true,
      totalFound: mockData.length,
      data: mockData
    };
  }

  /**
   * Places API (New) v1 ile Derin Tarama ve Link Doğrulama
   */
  async searchPlacesV1Deep(baseQuery, district, category, city, apiKey, deepSearch = true) {
    const queryConfigs = [
      { query: baseQuery, maxPages: deepSearch ? 2 : 1 }
    ];

    // Derin tarama açıksa kategori varyasyonlarını paralel ekle (tüm işletmeleri eksiksiz bulmak için)
    if (deepSearch) {
      const lowerCat = (category || '').toLowerCase();
      const synonyms = [];
      if (lowerCat.includes('kafe') || lowerCat.includes('cafe')) {
        synonyms.push(`${district} ${city} cafe`);
        synonyms.push(`${district} ${city} kahve`);
        synonyms.push(`${district} ${city} coffee`);
        synonyms.push(`${district} ${city} pastane`);
      } else if (lowerCat.includes('restoran') || lowerCat.includes('restaurant')) {
        synonyms.push(`${district} ${city} restaurant`);
        synonyms.push(`${district} ${city} lokanta`);
        synonyms.push(`${district} ${city} kebap`);
        synonyms.push(`${district} ${city} yemek`);
      } else if (lowerCat.includes('giyim')) {
        synonyms.push(`${district} ${city} butik`);
        synonyms.push(`${district} ${city} giyim`);
        synonyms.push(`${district} ${city} moda`);
        synonyms.push(`${district} ${city} mağaza`);
      } else if (lowerCat.includes('kuafor') || lowerCat.includes('kuaför')) {
        synonyms.push(`${district} ${city} kuaför`);
        synonyms.push(`${district} ${city} güzellik salonu`);
        synonyms.push(`${district} ${city} berber`);
      } else if (lowerCat.includes('otel')) {
        synonyms.push(`${district} ${city} butik otel`);
        synonyms.push(`${district} ${city} pansiyon`);
        synonyms.push(`${district} ${city} otel`);
      } else {
        synonyms.push(`${district} ${city} ${category}`);
      }

      for (const syn of synonyms) {
        if (syn.toLowerCase() !== baseQuery.toLowerCase() && !queryConfigs.some(c => c.query.toLowerCase() === syn.toLowerCase())) {
          queryConfigs.push({ query: syn, maxPages: 2 });
        }
      }
    }

    const queryPromises = queryConfigs.map(cfg => this.fetchV1PagesForQuery(cfg.query, apiKey, cfg.maxPages));
    const queryResults = await Promise.all(queryPromises);

    const uniqueMap = new Map();
    for (const placeList of queryResults) {
      for (const p of placeList) {
        if (p.id && !uniqueMap.has(p.id)) {
          uniqueMap.set(p.id, p);
        }
      }
    }

    const mergedPlaces = Array.from(uniqueMap.values());

    const mappedPlaces = mergedPlaces.map(p => {
      const rawPhone = p.nationalPhoneNumber || p.internationalPhoneNumber || '';
      const phoneInfo = analyzePhoneNumber(rawPhone);
      const placeName = p.displayName?.text || 'İşletme';

      // 1. Evrensel Konum & İlçe Doğrulama (Aranan ilçe ile gerçek adres kontrolü)
      const locCheck = verifyLocation(p.formattedAddress || '', p.addressComponents || [], district, city);

      // 2. Web sitesi ve Instagram kontrolü (Kırık linkleri engellemek için doğrulama)
      const rawWebsite = p.websiteUri || '';
      const normalizedWeb = normalizeUrl(rawWebsite);
      const isInstaLink = normalizedWeb.includes('instagram.com') || normalizedWeb.includes('instagr.am');

      const validWebsite = (!isInstaLink && normalizedWeb) ? normalizedWeb : '';
      const instaInfo = processInstagram(rawWebsite, placeName, district, city);

      // Konum koordinatları ve doğrudan harita linkleri
      const lat = p.location?.latitude || null;
      const lng = p.location?.longitude || null;
      const hasCoords = Boolean(lat && lng);

      const mapsUrl = hasCoords 
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${p.id}`
        : (p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' ' + district)}`);

      const directionsUrl = hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : mapsUrl;

      const embedMapUrl = hasCoords
        ? `https://maps.google.com/maps?q=${lat},${lng}&hl=tr&z=15&output=embed`
        : null;

      return {
        place_id: p.id,
        name: placeName,
        category: category,
        district: locCheck.actualDistrict || district,
        city: city,
        actual_district: locCheck.actualDistrict || district,
        is_verified_location: locCheck.isMatch ? 1 : 0,
        location_warning: locCheck.warning,
        address: p.formattedAddress || '',
        rating: p.rating || null,
        user_ratings_total: p.userRatingCount || 0,
        phone: phoneInfo.formatted,
        raw_phone: rawPhone,
        phone_type: phoneInfo.type,
        phone_type_label: phoneInfo.typeLabel,
        phone_status: phoneInfo.isValid ? 'valid' : 'invalid',
        is_mobile: phoneInfo.isMobile,
        whatsapp_link: phoneInfo.whatsappLink,
        call_link: phoneInfo.callLink,
        badge_color: phoneInfo.badgeColor,
        // Doğrulanmış Web Sitesi
        website: validWebsite,
        has_website: Boolean(validWebsite),
        website_status: validWebsite ? 'unknown' : 'none',
        // Doğrulanmış Instagram Bilgileri (Sahte/tahmin link içermez)
        instagram: instaInfo.instagram_url,
        has_instagram: instaInfo.has_instagram,
        instagram_username: instaInfo.username,
        instagram_search_url: instaInfo.search_url,
        // Konum Bilgileri
        lat: lat,
        lng: lng,
        has_coords: hasCoords,
        maps_url: mapsUrl,
        directions_url: directionsUrl,
        embed_map_url: embedMapUrl
      };
    });

    // Filtre: Eğer kullanıcı belirli bir ilçe aradıysa, adresi başka bir ilçeye ait olanları ayıkla
    let finalPlaces = mappedPlaces;
    if (district && district.trim()) {
      const strictDistrictMatches = mappedPlaces.filter(p => p.is_verified_location === 1);
      if (strictDistrictMatches.length > 0) {
        finalPlaces = strictDistrictMatches;
      }
    }

    // Web siteleri için hızlı paralel canlılık kontrolü (maks 1.8 sn global süre)
    try {
      finalPlaces = await verifyWebsitesInBatch(finalPlaces, 1800);
    } catch (e) {
      console.warn('Web siteleri kontrolü atlandı:', e.message);
    }

    return finalPlaces;
  }

  /**
   * Tek bir metin sorgusu için Places API v1 sayfalarını çeker
   */
  async fetchV1PagesForQuery(textQuery, apiKey, maxPages = 2) {
    let places = [];
    let pageToken = null;
    let pageCount = 0;

    do {
      try {
        const v1Url = 'https://places.googleapis.com/v1/places:searchText';
        const body = {
          textQuery: textQuery,
          languageCode: 'tr',
          maxResultCount: 20
        };
        if (pageToken) {
          body.pageToken = pageToken;
        }

        const response = await axios.post(v1Url, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.location,places.addressComponents,nextPageToken'
          },
          timeout: 6000
        });

        const batch = response.data?.places || [];
        places.push(...batch);
        pageToken = response.data?.nextPageToken || null;
        pageCount++;

        if (!pageToken || pageCount >= maxPages) break;
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        console.warn(`v1 sayfalama hatası (${textQuery}, sayfa ${pageCount}):`, errMsg);
        if (pageCount === 0) {
          throw err;
        }
        break;
      }
    } while (pageToken && pageCount < maxPages);

    return places;
  }


  /**
   * Klasik Google Places API (Legacy)
   */
  async searchGooglePlacesLegacyDeep(baseQuery, district, category, city, apiKey, deepSearch = true) {
    const textSearchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    
    const firstRes = await axios.get(textSearchUrl, {
      params: {
        query: baseQuery,
        key: apiKey,
        language: 'tr'
      },
      timeout: 9000
    });

    if (firstRes.data.status !== 'OK' && firstRes.data.status !== 'ZERO_RESULTS') {
      throw new Error(firstRes.data.error_message || `API Yanıtı: ${firstRes.data.status}`);
    }

    let allRawPlaces = [...(firstRes.data.results || [])];
    let nextToken = firstRes.data.next_page_token;

    if (deepSearch && nextToken) {
      try {
        await new Promise(r => setTimeout(r, 2000));
        const secondRes = await axios.get(textSearchUrl, {
          params: { pagetoken: nextToken, key: apiKey },
          timeout: 9000
        });
        if (secondRes.data.results) {
          allRawPlaces.push(...secondRes.data.results);
        }
      } catch (err2) {
        console.warn('Legacy 2. sayfa çekilemedi:', err2.message);
      }
    }

    const detailedPlaces = await this.enrichPlacesInBatches(allRawPlaces, apiKey, district, city, category);
    return detailedPlaces;
  }

  /**
   * Detayları gruplar halinde çekip doğrular
   */
  async enrichPlacesInBatches(rawPlaces, apiKey, district, city, category, batchSize = 8) {
    const results = [];
    const detailUrl = 'https://maps.googleapis.com/maps/api/place/details/json';

    for (let i = 0; i < rawPlaces.length; i += batchSize) {
      const batch = rawPlaces.slice(i, i + batchSize);
      const batchPromises = batch.map(async (place) => {
        try {
          const detailRes = await axios.get(detailUrl, {
            params: {
              place_id: place.place_id,
              fields: 'formatted_phone_number,international_phone_number,website,url,geometry',
              key: apiKey,
              language: 'tr'
            },
            timeout: 4500
          });

          const detail = detailRes.data?.result || {};
          const rawPhone = detail.formatted_phone_number || detail.international_phone_number || '';
          const phoneInfo = analyzePhoneNumber(rawPhone);
          const rawWebsite = detail.website || '';
          const normalizedWeb = normalizeUrl(rawWebsite);
          const isInsta = normalizedWeb.includes('instagram.com');
          const validWeb = (!isInsta && normalizedWeb) ? normalizedWeb : '';
          const instaInfo = processInstagram(rawWebsite, place.name, district, city);

          const lat = detail.geometry?.location?.lat || place.geometry?.location?.lat || null;
          const lng = detail.geometry?.location?.lng || place.geometry?.location?.lng || null;
          const hasCoords = Boolean(lat && lng);

          return {
            place_id: place.place_id,
            name: place.name,
            category: category,
            district: district,
            city: city,
            address: place.formatted_address || '',
            rating: place.rating || null,
            user_ratings_total: place.user_ratings_total || 0,
            phone: phoneInfo.formatted,
            raw_phone: rawPhone,
            phone_type: phoneInfo.type,
            phone_type_label: phoneInfo.typeLabel,
            is_mobile: phoneInfo.isMobile,
            whatsapp_link: phoneInfo.whatsappLink,
            call_link: phoneInfo.callLink,
            website: validWeb,
            has_website: Boolean(validWeb),
            instagram: instaInfo.instagram_url,
            has_instagram: instaInfo.has_instagram,
            instagram_username: instaInfo.username,
            instagram_search_url: instaInfo.search_url,
            lat: lat,
            lng: lng,
            has_coords: hasCoords,
            maps_url: hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : (detail.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`),
            directions_url: hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null,
            embed_map_url: hasCoords ? `https://maps.google.com/maps?q=${lat},${lng}&hl=tr&z=15&output=embed` : null
          };
        } catch (err) {
          const phoneInfo = analyzePhoneNumber('');
          const lat = place.geometry?.location?.lat || null;
          const lng = place.geometry?.location?.lng || null;
          return {
            place_id: place.place_id,
            name: place.name,
            category: category,
            district: district,
            city: city,
            address: place.formatted_address || '',
            rating: place.rating || null,
            user_ratings_total: place.user_ratings_total || 0,
            phone: phoneInfo.formatted,
            raw_phone: '',
            phone_type: 'none',
            phone_type_label: 'Numara Belirtilmemiş',
            is_mobile: false,
            whatsapp_link: null,
            call_link: null,
            website: '',
            has_website: false,
            instagram: null,
            has_instagram: false,
            lat: lat,
            lng: lng,
            has_coords: Boolean(lat && lng),
            maps_url: lat ? `https://www.google.com/maps?q=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`,
            directions_url: lat ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null
          };
        }
      });

      const resolvedBatch = await Promise.all(batchPromises);
      results.push(...resolvedBatch);
    }

    return results;
  }

  /**
   * Simülasyon verisi (Gerçekçi ve doğrulanmış çalışan linklerle)
   */
  generateRealisticMockPlaces(district = 'Atakum', category = 'cafe', city = 'Samsun', targetCount = 45) {
    let streets = [
      'Atakum Sahil Yolu', 'İsmet İnönü Bulvarı (Türkiş)', 'Cağaloğlu Caddesi', 
      'Denizevleri Sahili', 'Güzelyalı Caddesi', 'Ömürevleri Bulvarı', 
      'Yenimahalle Sahil', 'Atakent Bulvarı', 'Körfez Caddesi', 'Liman İçi'
    ];

    const cafePrefixes = [
      'Espresso Lab', 'Kahve Dünyası', 'Petra Roastery', 'Kronotrop Coffee', 'Moda Artisan Cafe',
      'Sahil Kahvecisi', 'Marina Lounge & Coffee', 'Federal Coffee', 'Soul Kitchen & Cafe', 'Caribou Coffee',
      'Barns Coffee', 'Mackbear Coffee', 'Coffy', 'Tarihi Kahve Evi', 'Harbour Cafe',
      'The Garden Coffee', 'Gusto Cafe', 'Botanica Coffee House', 'Black Sheep Coffee', 'Loft Coffee & Bakery'
    ];

    const results = [];
    const baseLat = 41.325;
    const baseLng = 36.295;

    for (let i = 0; i < targetCount; i++) {
      const baseName = cafePrefixes[i % cafePrefixes.length];
      const name = `${baseName} - ${district} (${i + 1})`;
      const street = streets[i % streets.length];
      const doorNo = (i + 1) * 3 + (i % 7);

      const isGSM = (i % 3) !== 0;
      const phoneNum = isGSM 
        ? `053${(i % 9)} ${100 + (i * 17) % 899} ${10 + (i * 13) % 89} ${20 + (i * 19) % 79}`
        : `0362 ${300 + (i * 23) % 499} ${10 + (i * 7) % 89} ${10 + (i * 11) % 89}`;

      const phoneInfo = analyzePhoneNumber(phoneNum);
      const rating = Number((3.8 + ((i * 13) % 12) * 0.1).toFixed(1));
      const reviews = 25 + (i * 37) % 650;
      
      const hasWeb = (i % 3) === 0;
      const cleanSlug = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const validWeb = hasWeb ? `https://www.google.com/search?q=${encodeURIComponent(name)}` : '';
      
      const hasRealInsta = (i % 2) === 0;
      const instaProfile = hasRealInsta ? `https://www.instagram.com/explore/tags/${cleanSlug}/` : null;

      const lat = baseLat + ((i * 0.003) % 0.05);
      const lng = baseLng + ((i * 0.004) % 0.05);

      results.push({
        place_id: `mock_${district.toLowerCase()}_${category.toLowerCase()}_${i + 1}`,
        name: name,
        category: category,
        district: district,
        city: city,
        actual_district: district,
        is_verified_location: 1,
        location_warning: null,
        address: `${street} No:${doorNo}, ${district} / ${city}`,
        rating: rating,
        user_ratings_total: reviews,
        phone: phoneInfo.formatted,
        raw_phone: phoneNum,
        phone_type: phoneInfo.type,
        phone_type_label: phoneInfo.typeLabel,
        phone_status: 'valid',
        is_mobile: phoneInfo.isMobile,
        whatsapp_link: phoneInfo.whatsappLink,
        call_link: phoneInfo.callLink,
        badge_color: phoneInfo.badgeColor,
        website: validWeb,
        has_website: hasWeb,
        instagram: instaProfile,
        has_instagram: hasRealInsta,
        instagram_username: hasRealInsta ? `#${cleanSlug}` : null,
        instagram_search_url: `https://www.google.com/search?q=site:instagram.com+"${encodeURIComponent(name)}"`,
        lat: lat,
        lng: lng,
        has_coords: true,
        maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
        directions_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        embed_map_url: `https://maps.google.com/maps?q=${lat},${lng}&hl=tr&z=15&output=embed`,
        is_mock: true
      });
    }

    return results;
  }
}

module.exports = GoogleMapsService;
