/**
 * Konum ve İlçe Doğrulama Modülü (Google Maps ve Adres Teyidi)
 * Kullanıcının aradığı ilçe ile işletmenin gerçek adresindeki ilçeyi karşılaştırır.
 */

// Türkçe karakter duyarlı küçük harfe dönüştürücü
function trLower(str) {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase()
    .trim();
}

// Türkçe karakterleri ascii'ye normalize etme (gevşek eşleşme için)
function normalizeAscii(str) {
  return trLower(str)
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Adres metninden veya addressComponents listesinden gerçek ilçeyi çıkarır
 */
function extractDistrictFromAddress(formattedAddress = '', addressComponents = []) {
  // 1. Öncelik: Google Places addressComponents (Varsa en güvenilir kaynak)
  if (Array.isArray(addressComponents) && addressComponents.length > 0) {
    // Türkiye'de ilçe genellikle 'administrative_area_level_2' dir
    const districtComp = addressComponents.find(c => 
      c.types?.includes('administrative_area_level_2') ||
      c.types?.includes('sublocality_level_1')
    );
    if (districtComp?.longText || districtComp?.long_name) {
      return (districtComp.longText || districtComp.long_name).trim();
    }
  }

  // 2. Öncelik: formattedAddress içindeki "İlçe/Şehir" yapısı (Örn: "55200 Atakum/Samsun, Türkiye")
  if (formattedAddress) {
    // Regex: "55000 Atakum/Samsun" veya "Atakum/Samsun" veya "Kadıköy/İstanbul"
    const matchSlash = formattedAddress.match(/(?:(?:[0-9]{5})\s+)?([A-Za-zÇĞİÖŞÜçğıöşü\s]+)\/([A-Za-zÇĞİÖŞÜçğıöşü\s]+)(?:,|$)/);
    if (matchSlash && matchSlash[1]) {
      return matchSlash[1].trim();
    }

    // Virgüle göre bölünmüş parçalardan ilçe bulma
    const parts = formattedAddress.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.includes('/')) {
        const sub = part.split('/')[0].replace(/^[0-9\s]+/, '').trim();
        if (sub.length > 2) return sub;
      }
    }
  }

  return '';
}

/**
 * İşletmenin aranan ilçede olup olmadığını teyit eder
 * @param {string} formattedAddress 
 * @param {Array} addressComponents 
 * @param {string} targetDistrict 
 * @param {string} targetCity 
 */
function verifyLocation(formattedAddress = '', addressComponents = [], targetDistrict = '', targetCity = '') {
  const normTargetDistrict = trLower(targetDistrict);
  const normTargetCity = trLower(targetCity);
  const rawTargetDistrictAscii = normalizeAscii(targetDistrict);

  // Eğer hedef ilçe belirtilmemişse genel aramadır
  if (!normTargetDistrict) {
    return {
      isMatch: true,
      actualDistrict: targetDistrict || '',
      isVerified: false,
      warning: null
    };
  }

  const detectedDistrict = extractDistrictFromAddress(formattedAddress, addressComponents);
  const normDetected = trLower(detectedDistrict);
  const detectedAscii = normalizeAscii(detectedDistrict);

  // 1. Tam veya gevşek ilçe eşleşmesi
  if (detectedAscii && (detectedAscii === rawTargetTargetMatch(rawTargetDistrictAscii, detectedAscii))) {
    return {
      isMatch: true,
      actualDistrict: detectedDistrict || targetDistrict,
      isVerified: true,
      warning: null
    };
  }

  // 2. formattedAddress içerisinde hedef ilçenin açıkça geçmesi
  const normAddress = trLower(formattedAddress);
  if (normAddress.includes(normTargetDistrict) || (rawTargetDistrictAscii.length >= 4 && normalizeAscii(formattedAddress).includes(rawTargetDistrictAscii))) {
    // Eğer adres açıkça hedef ilçeyi içeriyorsa (örn: "Atakum/Samsun" veya "Atakum Cd.")
    return {
      isMatch: true,
      actualDistrict: detectedDistrict || targetDistrict,
      isVerified: true,
      warning: null
    };
  }

  // 3. Eşleşmediyse: İşletme başka bir ilçede (Örn: Atakum arandı ama Canik/Samsun çıktı)
  if (detectedDistrict && detectedAscii !== rawTargetDistrictAscii) {
    return {
      isMatch: false,
      actualDistrict: detectedDistrict,
      isVerified: false,
      warning: `İşletme aranan '${targetDistrict}' ilçesinde değil, '${detectedDistrict}' bölgesinde yer alıyor.`
    };
  }

  // Tespit edilemedi ama adres hedef ilçeyi barındırmıyor
  return {
    isMatch: false,
    actualDistrict: detectedDistrict || 'Bilinmiyor',
    isVerified: false,
    warning: `Adreste '${targetDistrict}' ilçe teyidi bulunamadı.`
  };
}

function rawTargetTargetMatch(target, detected) {
  if (target === detected) return target;
  if (target.length >= 4 && (detected.includes(target) || target.includes(detected))) {
    return detected;
  }
  return '';
}

module.exports = {
  trLower,
  normalizeAscii,
  extractDistrictFromAddress,
  verifyLocation
};
