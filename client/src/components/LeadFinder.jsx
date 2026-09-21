import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, 
  MapPin, 
  Building2, 
  Star, 
  Globe, 
  Phone, 
  Smartphone, 
  PhoneForwarded, 
  ExternalLink, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  ArrowRight,
  Layers,
  Zap,
  Navigation,
  Eye,
  FileSpreadsheet,
  ClipboardList,
  Upload,
  Users,
  Check,
  UserCheck
} from 'lucide-react';
import InstagramIcon from './InstagramIcon';
import { searchPlaces, importLeads, getTeamMembers } from '../api';

const POPULAR_LOCATIONS = [
  { district: 'Atakum', city: 'Samsun', label: 'Samsun Atakum' },
  { district: 'Kadıköy', city: 'İstanbul', label: 'Kadıköy' },
  { district: 'Beşiktaş', city: 'İstanbul', label: 'Beşiktaş' },
  { district: 'Şişli', city: 'İstanbul', label: 'Şişli' },
  { district: 'Çankaya', city: 'Ankara', label: 'Çankaya' },
  { district: 'Nilüfer', city: 'Bursa', label: 'Nilüfer' },
  { district: 'Karşıyaka', city: 'İzmir', label: 'Karşıyaka' },
  { district: 'Muratpaşa', city: 'Antalya', label: 'Muratpaşa' }
];

const POPULAR_CATEGORIES = [
  { id: 'cafe', label: 'Cafe & Kahve', icon: '☕' },
  { id: 'restaurant', label: 'Restoran & Lokanta', icon: '🍽️' },
  { id: 'giyim', label: 'Giyim & Butik', icon: '👗' },
  { id: 'kuafor', label: 'Kuaför & Güzellik', icon: '✂️' },
  { id: 'saglik', label: 'Diş Kliniği & Sağlık', icon: '🦷' },
  { id: 'otel', label: 'Butik Otel & Konaklama', icon: '🏨' },
  { id: 'mimarlik', label: 'Mimarlık & İç Tasarım', icon: '📐' },
  { id: 'diyetisyen', label: 'Diyetisyen & Yaşam', icon: '🥗' }
];

export default function LeadFinder({ onImportComplete, hasApiKey, onOpenSettings }) {
  const [inputMode, setInputMode] = useState('maps'); // 'maps' | 'excel' | 'paste'
  const [district, setDistrict] = useState('Atakum');
  const [city, setCity] = useState('Samsun');
  const [category, setCategory] = useState('cafe');
  const [customQuery, setCustomQuery] = useState('');
  const [deepSearch, setDeepSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [isDemoData, setIsDemoData] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [filterMobileOnly, setFilterMobileOnly] = useState(false);

  // Personel Paylaştırma State
  const [teamMembers, setTeamMembers] = useState([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [selectedCallerIds, setSelectedCallerIds] = useState(new Set());
  const [distributeToPool, setDistributeToPool] = useState(false);

  React.useEffect(() => {
    getTeamMembers().then(res => {
      const list = res.data || [];
      setTeamMembers(list);
      // Varsayılan olarak soğuk arama veya satış personellerini seç
      const callers = list.filter(m => /arama|satış|satis|çağrı|cagri/i.test(m.role || ''));
      if (callers.length > 0) {
        setSelectedCallerIds(new Set(callers.map(c => c.id)));
      } else if (list.length > 0) {
        setSelectedCallerIds(new Set(list.map(c => c.id)));
      }
    }).catch(err => console.error('Takım üyeleri alınamadı:', err));
  }, []);

  // Manuel Yapıştır & Excel State
  const [pasteText, setPasteText] = useState('');
  const [fileHint, setFileHint] = useState('');

  // Konum Önizleme Modalı
  const [mapModalPlace, setMapModalPlace] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setImportStatus(null);
    setSearchError(null);
    setSelectedIds(new Set());

    try {
      const res = await searchPlaces({
        district,
        city,
        category,
        query: customQuery,
        deepSearch: deepSearch
      });

      const list = res.data || [];
      setResults(list);
      setIsDemoData(res.isDemo || false);
      setSearchError(res.error || null);
      setSelectedIds(new Set(list.map(item => item.place_id)));
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setSearchError(`Arama isteği başarısız oldu: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Excel / CSV Dosya Yükleme (Örnek projedeki XLSX entegrasyonu)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileHint(`Okunuyor: ${file.name}...`);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        let rows = [];
        if (/\.csv$/i.test(file.name)) {
          let text = evt.target.result;
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          const lines = text.split(/\r?\n/).filter(Boolean);
          rows = lines.map(line => {
            const delim = line.includes(';') ? ';' : ',';
            return line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
          });
        } else {
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
        }

        rows = rows.filter(r => r.some(c => String(c).trim() !== ''));
        if (rows.length === 0) {
          setFileHint('Dosyada okunabilir satır bulunamadı.');
          return;
        }

        // Başlık satırı kontrolü
        const headerWords = ['ad', 'isim', 'işletme', 'name', 'adres', 'address', 'telefon', 'tel', 'phone'];
        const firstRow = rows[0].map(c => String(c).toLowerCase().trim());
        const hasHeader = firstRow.some(c => headerWords.some(w => c.includes(w)));
        if (hasHeader) rows = rows.slice(1);

        const mapped = rows.map((r, idx) => {
          const name = String(r[0] || '').trim();
          const address = String(r[1] || '').trim();
          const phone = String(r[2] || '').trim();
          const pId = `excel_${Date.now()}_${idx}`;
          return {
            place_id: pId,
            name: name || `İşletme #${idx + 1}`,
            address: address || `${district} / ${city}`,
            phone: phone,
            raw_phone: phone,
            district: district,
            city: city,
            category: category,
            rating: 5.0,
            has_website: 0,
            website: '',
            has_instagram: 0,
            instagram: '',
            maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + district)}`,
            is_mobile: /^0?5\d{9}$/.test(phone.replace(/\D/g, '')) ? 1 : 0
          };
        }).filter(r => r.name);

        setResults(mapped);
        setSelectedIds(new Set(mapped.map(m => m.place_id)));
        setFileHint(`✓ ${file.name} başarıyla okundu: ${mapped.length} işletme bulundu.`);
      } catch (err) {
        console.error(err);
        setFileHint('Dosya okunamadı. Lütfen .xlsx, .xls veya .csv yükleyin.');
      }
    };

    if (/\.csv$/i.test(file.name)) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Metin Yapıştırarak İçe Aktarma
  const handlePasteImport = (e) => {
    e.preventDefault();
    if (!pasteText.trim()) {
      alert('Lütfen yapıştırılacak satırları girin.');
      return;
    }

    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const mapped = lines.map((line, idx) => {
      const parts = line.includes(';') ? line.split(';') : (line.includes('\t') ? line.split('\t') : line.split(','));
      const name = (parts[0] || '').trim();
      const address = (parts[1] || '').trim();
      const phone = (parts[2] || '').trim();
      const pId = `paste_${Date.now()}_${idx}`;

      return {
        place_id: pId,
        name: name || `İşletme #${idx + 1}`,
        address: address || `${district} / ${city}`,
        phone: phone,
        raw_phone: phone,
        district: district,
        city: city,
        category: category,
        rating: 5.0,
        has_website: 0,
        website: '',
        has_instagram: 0,
        instagram: '',
        maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + district)}`,
        is_mobile: /^0?5\d{9}$/.test(phone.replace(/\D/g, '')) ? 1 : 0
      };
    }).filter(r => r.name);

    if (mapped.length === 0) {
      alert('Hiçbir geçerli işletme satırı ayrıştırılamadı.');
      return;
    }

    setResults(mapped);
    setSelectedIds(new Set(mapped.map(m => m.place_id)));
    setPasteText('');
    setFileHint(`✓ Yapıştırılan metinden ${mapped.length} işletme listelendi.`);
  };

  const setLocation = (loc) => {
    setDistrict(loc.district);
    setCity(loc.city);
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map(i => i.place_id)));
    }
  };

  const toggleCallerSelect = (id) => {
    const next = new Set(selectedCallerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCallerIds(next);
  };

  const handleImport = async (callerIds = null) => {
    const toImport = results.filter(r => selectedIds.has(r.place_id));
    if (toImport.length === 0) {
      alert('Lütfen eklenecek en az bir işletme seçiniz.');
      return;
    }

    setImporting(true);
    try {
      const payload = { places: toImport };
      if (Array.isArray(callerIds) && callerIds.length > 0) {
        payload.assigned_caller_ids = callerIds;
      }
      const res = await importLeads(payload);
      setImportStatus({
        success: true,
        message: `✓ ${res.message || `${res.count} işletme başarıyla 'Arama Listesi'ne aktarıldı!`}`
      });
      setShowDistributeModal(false);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      let friendlyError = err.response?.data?.error || err.message;
      if (err.response?.status === 413) {
        friendlyError = 'Seçilen işletme listesi veri boyut sınırını aştı (413 Payload Too Large). Sunucu sınırı 50MB\'a yükseltildi, lütfen tekrar deneyiniz.';
      } else if (friendlyError.includes('413')) {
        friendlyError = 'Seçilen kayıt boyutu çok büyük. Lütfen işletmeleri daha küçük gruplar halinde içe aktarın.';
      }
      setImportStatus({
        success: false,
        message: `İçe aktarma hatası: ${friendlyError}`
      });
    } finally {
      setImporting(false);
    }
  };


  // Filtrelenmiş sonuçlar
  const filteredResults = results.filter(item => {
    if (filterNoWebsite && item.has_website) return false;
    if (filterMobileOnly && !item.is_mobile) return false;
    return true;
  });


  return (
    <div className="space-y-6">
      
      {/* Üst Bilgi Kartı */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <span className="bg-white/20 text-blue-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
            Adım 1-4: Kapsamlı Bölge Taraması, Doğrulanmış Linkler & Konum
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            Google Maps İşletme Radarı
          </h1>
          <p className="text-blue-100/90 text-sm leading-relaxed">
            Belirlediğiniz ilçe ve kategorideki tüm işletmeleri tarayın. <strong>Doğrulanmış web siteleri</strong>, hatasız <strong>Instagram profilleri</strong>, <strong>harita konumları ve yol tarifleri</strong> ile eksiksiz listeleyin.
          </p>
        </div>

        {!hasApiKey && (
          <div className="mt-4 bg-amber-500/20 border border-amber-400/40 rounded-xl p-3.5 flex items-center justify-between text-amber-100 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                Henüz Google Maps API anahtarı kaydedilmedi. Şu anda <strong>Akıllı Simülatör (Demo)</strong> modu aktiftir. Gerçek harita verisi için anahtarınızı ekleyebilirsiniz.
              </span>
            </div>
            <button
              onClick={onOpenSettings}
              className="ml-3 px-3 py-1.5 bg-white text-slate-900 font-bold rounded-lg hover:bg-amber-100 transition-all text-xs shrink-0"
            >
              API Key Gir
            </button>
          </div>
        )}
      </div>

      {/* Giriş Modu Seçimi: Google Maps | Excel/CSV | Metin Yapıştır (Örnek Proje Özelliği) */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => setInputMode('maps')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            inputMode === 'maps'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Google Haritalar</span>
        </button>

        <button
          type="button"
          onClick={() => setInputMode('excel')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            inputMode === 'excel'
              ? 'bg-white text-emerald-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Excel / CSV</span>
        </button>

        <button
          type="button"
          onClick={() => setInputMode('paste')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            inputMode === 'paste'
              ? 'bg-white text-purple-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Metin Yapıştır</span>
        </button>
      </div>

      {/* 1. MOD: GOOGLE MAPS TARAMA FORMU */}
      {inputMode === 'maps' && (
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs min-w-0 max-w-full">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 min-w-0">

            
            {/* 1. İlçe Seçimi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                1. İlçe & Şehir
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Örn: Atakum"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Şehir"
                  className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                />
              </div>
              {/* Hızlı Lokasyon Butonları */}
              <div className="flex flex-wrap gap-1 mt-2">
                {POPULAR_LOCATIONS.map(loc => (
                  <button
                    key={loc.label}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${
                      district === loc.district && city === loc.city
                        ? 'bg-blue-600 text-white shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. İşletme Türü (Kategori) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                2. İşletme Türü (Sektör)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
              >
                {POPULAR_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1 mt-2">
                {POPULAR_CATEGORIES.slice(0, 4).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${
                      category === c.id 
                        ? 'bg-indigo-600 text-white shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label.split('&')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Özel Arama & Derin Tarama Seçeneği */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                Özel Arama Terimi (Opsiyonel)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="Örn: 3. Nesil Kahveci"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                />
              </div>

              <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deepSearch}
                  onChange={(e) => setDeepSearch(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Kapsamlı Derin Tarama (20 sınırı yok, tüm sayfaları ve varyasyonları tara)
                </span>
              </label>
            </div>

          </div>

          {/* Tarama Butonu */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 hidden sm:block">
              {deepSearch 
                ? `⚡ ${district} / ${city} bölgesinde ${category} kategorisindeki tüm işletmeler taranacak.`
                : `Hızlı tarama modu (İlk 20 işletme).`}
            </span>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-md shadow-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Bölgedeki Tüm İşletmeler Taranıyor...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>3. Bölgedeki Tüm İşletmeleri Listele</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* 2. MOD: EXCEL / CSV DOSYASI YÜKLEME (Örnek Proje Özelliği) */}
      {inputMode === 'excel' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Hedef İlçe & Şehir
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Örn: Atakum"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800"
                />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Şehir"
                  className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Sektör & Hizmet Kategorisi
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800"
              >
                {POPULAR_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <Upload className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm mb-1">
              Excel (.xlsx, .xls) veya .csv Dosyası Seçin
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              Sütun Sıralaması: <strong>İşletme Adı</strong>, <strong>Adres</strong>, <strong>Telefon</strong>. İlk satır başlık olsa dahi sistem otomatik tanır.
            </p>
            <label className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-all">
              <span>Dosya Seç ve Ayrıştır</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {fileHint && (
              <div className="mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 inline-block">
                {fileHint}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MOD: METİN YAPIŞTIRMA FORMU (Örnek Projedeki Elle Giriş) */}
      {inputMode === 'paste' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Hedef İlçe & Şehir
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Örn: Atakum"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800"
                />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Şehir"
                  className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Sektör & Hizmet Kategorisi
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800"
              >
                {POPULAR_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handlePasteImport} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Her Satıra Bir İşletme Girin (Ayırıcı: ; veya virgül veya Tab):
              </label>
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Örnek format:\nSoul Coffee Atakum; Cağaloğlu Cad. No:12; 0532 111 22 33\nMarinet Kafe; Lozan Cad. No:44; 0362 444 55 66"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Format: <code>İşletme Adı; Adres; Telefon</code>
              </span>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Metni Ayrıştır ve Listele
              </button>
            </div>
          </form>
          {fileHint && (
            <div className="text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-xl p-2.5 inline-block">
              {fileHint}
            </div>
          )}
        </div>
      )}

      {/* Google API Hata / Yetki Bildirim Kartı */}
      {searchError && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-amber-950 text-sm">
                Google Haritalar API Bildirimi
              </h3>
              <span className="bg-amber-200/80 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Simülasyon Moduna Geçildi
              </span>
            </div>
            <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
              {searchError}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs font-bold bg-white text-slate-800 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all cursor-pointer shadow-2xs"
              >
                API Anahtarı Ayarlarını Aç
              </button>
              <a
                href="https://console.cloud.google.com/apis/library/places.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1 shadow-2xs"
              >
                Google Cloud'da Places API (New)'i Etkinleştir ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Arama Sonuçları & Liste Kontrolü (Adım 3 & 4) */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0 max-w-full">

          
          {/* Sonuç Başlığı & Aksiyon Barı */}
          <div className="p-3.5 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-extrabold text-lg text-slate-900">
                  Bulunan İşletmeler ({filteredResults.length})
                </h2>
                <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-600" />
                  {results.length} İşletme Tespit Edildi
                </span>
                {isDemoData && (
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                    Simülasyon Verisi
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {district} / {city} bölgesinde {category} kategorisinde tespit edilen tüm işletmeler
              </p>
            </div>

            {/* Hızlı Filtreler & Aktarma Butonları */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterNoWebsite(!filterNoWebsite)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterNoWebsite 
                    ? 'bg-purple-50 text-purple-700 border-purple-300' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Web Sitesi Olmayanlar ({results.filter(r => !r.has_website).length})
              </button>

              <button
                type="button"
                onClick={() => setFilterMobileOnly(!filterMobileOnly)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterMobileOnly 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Sadece Cep (GSM) ({results.filter(r => r.is_mobile).length})
              </button>

              <button
                type="button"
                onClick={() => handleImport()}
                disabled={importing || selectedIds.size === 0}
                className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Tüm seçili işletmeleri ortak çağrı havuzuna aktar"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Ortak Havuza Ekle ({selectedIds.size})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDistributeModal(true)}
                disabled={importing || selectedIds.size === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                title="Seçili işletmeleri çağrı personellerine paylaştır"
              >
                <Users className="w-4 h-4" />
                <span>Personele Paylaştır ({selectedIds.size})</span>
              </button>
            </div>
          </div>

          {/* Başarı / Bilgi Uyarısı */}
          {importStatus && (
            <div className={`p-3.5 text-xs font-bold flex items-center justify-between ${
              importStatus.success ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{importStatus.message}</span>
              </div>
              <span className="text-[11px] underline cursor-pointer" onClick={() => setImportStatus(null)}>
                Kapat
              </span>
            </div>
          )}

          {/* İşletme Tablosu */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-600 uppercase font-bold border-b border-slate-200 tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {selectedIds.size === filteredResults.length && filteredResults.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5 min-w-[220px]">İşletme Adı & Konum Detayı</th>
                  <th className="p-3.5 min-w-[120px]">Puan & Yorum</th>
                  <th className="p-3.5 min-w-[150px]">Telefon Durumu (GSM / Sabit)</th>
                  <th className="p-3.5 min-w-[240px]">Web Sitesi & Instagram Durumu</th>
                  <th className="p-3.5 text-right min-w-[130px]">Harita & Yol Tarifi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 font-medium">
                {filteredResults.map((item) => {
                  const isSelected = selectedIds.has(item.place_id);

                  return (
                    <tr 
                      key={item.place_id} 
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/20' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.place_id)}
                          className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* İşletme Adı & Konum Bilgisi */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {item.name}
                        </div>
                        <div className="text-slate-600 text-[11px] mt-0.5 flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{item.address || `${item.district} / ${item.city}`}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {item.is_verified_location === 1 ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-200">
                              ✓ {item.actual_district || item.district} Teyitli
                            </span>
                          ) : item.location_warning ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-amber-200" title={item.location_warning}>
                              ⚠️ {item.actual_district ? `${item.actual_district} Bölgesi` : 'Farklı Bölge Uyarısı'}
                            </span>
                          ) : null}
                          {item.lat && item.lng && (
                            <span className="text-[10px] text-slate-400 font-mono">📍 {Number(item.lat).toFixed(4)}, {Number(item.lng).toFixed(4)}</span>
                          )}
                        </div>
                      </td>

                      {/* Yıldız Durumu */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            {item.rating || 'Puan Yok'}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            ({item.user_ratings_total || 0})
                          </span>
                        </div>
                      </td>

                      {/* Telefon & GSM/Sabit Kontrolü */}
                      <td className="p-3.5">
                        {item.phone && item.phone !== 'Numara Yok' ? (
                          <div className="space-y-1">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              {item.phone}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              {item.is_mobile ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Smartphone className="w-3 h-3" />
                                  Cep (GSM)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                                  <Phone className="w-3 h-3" />
                                  Sabit Hat
                                </span>
                              )}
                              {item.phone_status === 'invalid' && (
                                <span className="inline-flex items-center gap-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-rose-200">
                                  ⚠️ Hatalı
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Telefon Bulunamadı</span>
                        )}
                      </td>

                      {/* Doğrulanmış Web Sitesi & Instagram Durumu */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1.5">
                          
                          {/* Web Sitesi Linki (Doğrulanmış ve Protokollü) */}
                          {item.has_website && item.website ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={item.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200/80 transition-all max-w-[210px] truncate"
                                title={item.website}
                              >
                                <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="truncate">{item.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                                <ExternalLink className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                              </a>
                              {item.website_status === 'broken' && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0" title="Web sitesi yanıt vermiyor veya kapalı">
                                  ⚠️ Yanıt Vermiyor
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70 font-semibold text-[11px] w-fit">
                              <Globe className="w-3 h-3 text-amber-500" />
                              Web Yok (Fırsat!)
                            </span>
                          )}

                          {/* Instagram: Gerçek Link veya Hatasız Arama Butonu */}
                          {item.has_instagram && item.instagram ? (
                            <a
                              href={item.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-pink-700 hover:text-pink-900 font-bold bg-pink-50 hover:bg-pink-100 px-2.5 py-1 rounded-lg border border-pink-200 transition-all w-fit"
                              title="Instagram Profilini Aç"
                            >
                              <InstagramIcon className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                              <span>{item.instagram_username || 'Instagram'}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                            </a>
                          ) : (
                            <a
                              href={item.instagram_search_url || `https://www.google.com/search?q=site:instagram.com+"${encodeURIComponent(item.name + ' ' + item.district)}"`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-pink-700 bg-slate-100 hover:bg-pink-50 px-2 py-0.5 rounded-md border border-slate-200 transition-all text-[11px] w-fit"
                              title="Google ve Instagram'da bu işletmenin resmi hesabını tara"
                            >
                              <InstagramIcon className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>Instagram'da Ara 🔍</span>
                            </a>
                          )}

                        </div>
                      </td>

                      {/* Konum / Harita / Yol Tarifi Butonları */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Mini Harita Önizleme */}
                          <button
                            type="button"
                            onClick={() => setMapModalPlace(item)}
                            className="bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] px-2 py-1.5 rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                            title="Konum Haritasını Önizle"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span className="hidden sm:inline">Konum</span>
                          </button>

                          {/* Google Maps'te Aç */}
                          {item.maps_url && (
                            <a
                              href={item.maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-2 py-1.5 rounded-lg border border-blue-200 transition-all flex items-center gap-1"
                              title="Google Haritalar'da Aç"
                            >
                              <MapPin className="w-3.5 h-3.5 text-red-500" />
                              <span>Harita</span>
                            </a>
                          )}

                          {/* Yol Tarifi */}
                          {item.directions_url && (
                            <a
                              href={item.directions_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] p-1.5 rounded-lg border border-emerald-200 transition-all"
                              title="Google Maps Yol Tarifi Al"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                            </a>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Alt Özet & Seçilenleri Aktar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Toplam <strong>{results.length}</strong> işletmeden <strong>{selectedIds.size}</strong> tanesi seçili
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleImport()}
                disabled={importing || selectedIds.size === 0}
                className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Ortak Havuza Ekle</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDistributeModal(true)}
                disabled={importing || selectedIds.size === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Personele Paylaştır</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* KONUM VE HARİTA ÖNİZLEME MODALI */}
      {mapModalPlace && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  İşletme Konum Önizlemesi
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  {mapModalPlace.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mapModalPlace.address || `${mapModalPlace.district} / ${mapModalPlace.city}`}
                </p>
              </div>
              <button
                onClick={() => setMapModalPlace(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Harita Görüntüsü */}
            <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 h-80 bg-slate-100 relative shadow-inner">
              {mapModalPlace.lat && mapModalPlace.lng ? (
                <iframe
                  title="Konum Haritası"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight="0"
                  marginWidth="0"
                  src={`https://maps.google.com/maps?q=${mapModalPlace.lat},${mapModalPlace.lng}&hl=tr&z=16&output=embed`}
                  className="w-full h-full"
                />
              ) : (
                <iframe
                  title="Arama Haritası"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight="0"
                  marginWidth="0"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(mapModalPlace.name + ' ' + mapModalPlace.district)}&hl=tr&z=15&output=embed`}
                  className="w-full h-full"
                />
              )}
            </div>

            {/* Koordinat ve Hızlı Butonlar */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-mono">
                {mapModalPlace.lat && mapModalPlace.lng ? (
                  <span>Enlem/Boylam: <strong>{mapModalPlace.lat}, {mapModalPlace.lng}</strong></span>
                ) : (
                  <span>Adres: {mapModalPlace.address}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={mapModalPlace.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Google Haritalarda Aç</span>
                </a>
                
                {mapModalPlace.directions_url && (
                  <a
                    href={mapModalPlace.directions_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Yol Tarifi</span>
                  </a>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PERSONELLERE PAYLAŞTIRMA MODALI (YÖNETİCİ SEÇİMİ) */}
      {showDistributeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Yönetici Kontrolü: Personel Paylaştırma
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  Adayları Personellere Dağıt
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seçili <strong>{selectedIds.size}</strong> işletme seçtiğiniz personellere eşit paylaştırılacaktır.
                </p>
              </div>
              <button
                onClick={() => setShowDistributeModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* 1. SEÇENEK: ORTAK HAVUZ (ATANMAMIŞ) */}
              <div
                onClick={() => {
                  setDistributeToPool(true);
                  setSelectedCallerIds(new Set());
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  distributeToPool 
                    ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/20 shadow-xs' 
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🌐 Ortak Havuz (Atanmamış)</span>
                      {distributeToPool && (
                        <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.2 rounded">
                          Seçili
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Herhangi bir personele atama yapmadan adayları genel arama havuzuna aktarır.
                    </div>
                  </div>
                </div>

                <input
                  type="radio"
                  name="leadfinder_distribute_target"
                  checked={distributeToPool}
                  onChange={() => {
                    setDistributeToPool(true);
                    setSelectedCallerIds(new Set());
                  }}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {/* 2. SEÇENEK: PERSONELLERE PAYLAŞTIRMA */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Veya Personellere Paylaştır:
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDistributeToPool(false);
                        setSelectedCallerIds(new Set(teamMembers.map(m => m.id)));
                      }}
                      className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Tümünü Seç
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCallerIds(new Set())}
                      className="text-[11px] text-slate-500 font-bold hover:underline cursor-pointer"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                {/* Personel Listesi */}
                <div className="space-y-2 max-h-52 overflow-y-auto p-1">
                  {teamMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Ekip üyesi bulunamadı.</p>
                  ) : (
                    teamMembers.map(member => {
                      const isChecked = !distributeToPool && selectedCallerIds.has(member.id);
                      return (
                        <div
                          key={member.id}
                          onClick={() => {
                            setDistributeToPool(false);
                            toggleCallerSelect(member.id);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                            isChecked 
                              ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs' 
                              : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs"
                              style={{ backgroundColor: member.color || '#4f46e5' }}
                            >
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">{member.name}</div>
                              <div className="text-[11px] text-slate-500">{member.role || 'Ekip Üyesi'}</div>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // onClick parent handle ediyor
                            className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Dağıtım Önizleme Kutusu */}
              {distributeToPool ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 font-medium">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                    <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Ortak Havuz Kaydı:</span>
                  </div>
                  <span>
                    Seçili <strong>{selectedIds.size}</strong> işletme herhangi bir personele atanmadan genel <strong>Ortak Havuz</strong>a aktarılacaktır.
                  </span>
                </div>
              ) : selectedCallerIds.size > 0 && selectedIds.size > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 text-xs text-indigo-950 font-medium">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
                    <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Paylaştırma Planı:</span>
                  </div>
                  {selectedCallerIds.size === 1 ? (
                    <span>
                      Tüm <strong>{selectedIds.size}</strong> işletme seçilen <strong>{teamMembers.find(m => selectedCallerIds.has(m.id))?.name}</strong> personeline atanacak.
                    </span>
                  ) : (
                    <span>
                      <strong>{selectedIds.size}</strong> işletme, seçtiğiniz <strong>{selectedCallerIds.size}</strong> personele yaklaşık <strong>{Math.ceil(selectedIds.size / selectedCallerIds.size)}</strong> adet düşecek şekilde dengeli dağıtılacak.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Butonlar */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDistributeModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              {distributeToPool ? (
                <button
                  type="button"
                  disabled={importing || selectedIds.size === 0}
                  onClick={() => handleImport(null)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {importing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                  <span>Ortak Havuza Aktar ({selectedIds.size})</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={importing || selectedCallerIds.size === 0 || selectedIds.size === 0}
                  onClick={() => handleImport(Array.from(selectedCallerIds))}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {importing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  <span>Paylaştır ve İçe Aktar ({selectedIds.size})</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
