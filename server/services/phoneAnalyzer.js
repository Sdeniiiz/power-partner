/**
 * Telefon numarası analizi ve Sabit Hat / Cep Telefonu (GSM) ayrımı
 */
function analyzePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      raw: rawPhone || '',
      cleaned: '',
      formatted: 'Numara Yok',
      type: 'none',
      typeLabel: 'Numara Belirtilmemiş',
      isMobile: false,
      whatsappLink: null,
      callLink: null,
      badgeColor: 'gray'
    };
  }

  // Sadece rakamları al
  let digits = rawPhone.replace(/\D/g, '');

  // Başında 0090 varsa 90'a indir
  if (digits.startsWith('0090')) {
    digits = digits.slice(2);
  }
  // Başında 90 varsa (örnek: 905321234567 - 12 hane)
  if (digits.startsWith('90') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  // Başında 0 varsa kaldırıp 10 haneli standart numara yapalım
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Şimdi 10 haneli format: (5XX) XXX XX XX veya (2XX) XXX XX XX
  const isGSM = /^5\d{9}$/.test(digits);
  const isLandline = /^[2348]\d{9}$/.test(digits) || /^444\d{4}$/.test(digits);

  let type = 'unknown';
  let typeLabel = 'Bilinmeyen Hat';
  let badgeColor = 'amber';

  if (isGSM) {
    type = 'mobile';
    typeLabel = 'Cep Telefonu (GSM)';
    badgeColor = 'emerald';
  } else if (isLandline) {
    type = 'landline';
    typeLabel = 'Sabit Hat';
    badgeColor = 'blue';
  }

  // Formatlı gösterim
  let formatted = rawPhone;
  if (digits.length === 10) {
    formatted = `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  } else if (digits.length === 7 && digits.startsWith('444')) {
    formatted = `444 ${digits.slice(3, 7)}`;
  }

  const e164 = digits.length === 10 ? `+90${digits}` : rawPhone;
  const whatsappNumber = isGSM ? `90${digits}` : null;

  return {
    raw: rawPhone,
    cleaned: digits,
    formatted: formatted,
    type: type,
    typeLabel: typeLabel,
    isMobile: isGSM,
    whatsappLink: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
    callLink: `tel:${e164}`,
    badgeColor: badgeColor
  };
}

module.exports = {
  analyzePhoneNumber
};
