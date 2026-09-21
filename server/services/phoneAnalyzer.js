/**
 * Telefon numarası analizi, geçerlilik kontrolü ve Sabit Hat / Cep (GSM) ayrımı
 */

// Türkiye Geçerli İl Alan Kodları (212 - 488)
const VALID_PROVINCE_CODES = new Set([
  '212', '216', '222', '224', '226', '228', '232', '236', '242', '246', '248', 
  '252', '256', '258', '262', '264', '266', '272', '274', '276', '282', '284', 
  '286', '288', '312', '318', '322', '324', '326', '328', '332', '338', '342', 
  '344', '346', '348', '352', '354', '356', '358', '362', '364', '366', '368', 
  '370', '372', '374', '376', '378', '380', '382', '384', '386', '388', '412', 
  '414', '416', '422', '424', '426', '428', '432', '434', '436', '438', '442', 
  '446', '452', '454', '456', '462', '464', '466', '472', '474', '476', '478', 
  '482', '484', '486', '488', '850'
]);

function analyzePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      raw: rawPhone || '',
      cleaned: '',
      formatted: 'Numara Yok',
      type: 'none',
      typeLabel: 'Numara Belirtilmemiş',
      isValid: false,
      isMobile: false,
      whatsappLink: null,
      callLink: null,
      badgeColor: 'gray'
    };
  }

  // Sadece rakamları al
  let digits = rawPhone.replace(/\D/g, '');

  // Başında 0090 varsa kaldır
  if (digits.startsWith('0090')) {
    digits = digits.slice(2);
  }
  // Başında 90 varsa kaldır (örnek: 905321234567 -> 12 hane)
  if (digits.startsWith('90') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  // Başında 0 varsa kaldırıp 10 haneli standart numara yapalım
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Özel Çağrı Merkezi Numaraları: 444 XXXX (7 hane)
  if (digits.length === 7 && digits.startsWith('444')) {
    return {
      raw: rawPhone,
      cleaned: digits,
      formatted: `444 ${digits.slice(3, 7)}`,
      type: 'landline',
      typeLabel: 'Çağrı Merkezi (444)',
      isValid: true,
      isMobile: false,
      whatsappLink: null,
      callLink: `tel:444${digits.slice(3, 7)}`,
      badgeColor: 'blue'
    };
  }

  // Standart Türkiye Numarası: 10 haneli olmalıdır (5XX veya 2XX/3XX/850)
  if (digits.length !== 10) {
    return {
      raw: rawPhone,
      cleaned: digits,
      formatted: rawPhone.trim() || 'Geçersiz Numara',
      type: 'invalid',
      typeLabel: digits.length < 10 ? 'Eksik Numara' : 'Hatalı Numara Formatı',
      isValid: false,
      isMobile: false,
      whatsappLink: null,
      callLink: digits.length >= 7 ? `tel:${digits}` : null,
      badgeColor: 'red'
    };
  }

  const prefix = digits.slice(0, 3);
  const isGSM = /^5\d{2}$/.test(prefix);
  const isLandline = VALID_PROVINCE_CODES.has(prefix);

  if (isGSM) {
    const formatted = `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
    return {
      raw: rawPhone,
      cleaned: digits,
      formatted: formatted,
      type: 'mobile',
      typeLabel: 'Cep Telefonu (GSM)',
      isValid: true,
      isMobile: true,
      whatsappLink: `https://wa.me/90${digits}`,
      callLink: `tel:+90${digits}`,
      badgeColor: 'emerald'
    };
  }

  if (isLandline) {
    const formatted = `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
    return {
      raw: rawPhone,
      cleaned: digits,
      formatted: formatted,
      type: 'landline',
      typeLabel: prefix === '850' ? 'Kurumsal Santral (0850)' : 'Sabit Hat',
      isValid: true,
      isMobile: false,
      whatsappLink: null,
      callLink: `tel:+90${digits}`,
      badgeColor: 'blue'
    };
  }

  // 10 hane ama Türkiye'de geçerli bir alan kodu değilse
  return {
    raw: rawPhone,
    cleaned: digits,
    formatted: `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`,
    type: 'unknown',
    typeLabel: 'Geçersiz Alan Kodu',
    isValid: false,
    isMobile: false,
    whatsappLink: null,
    callLink: `tel:+90${digits}`,
    badgeColor: 'amber'
  };
}

module.exports = {
  analyzePhoneNumber
};
