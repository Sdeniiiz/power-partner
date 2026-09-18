import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  PhoneCall, 
  MessageSquare, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  PhoneOff, 
  Clock, 
  RotateCcw, 
  Globe, 
  MapPin, 
  Star, 
  Filter, 
  Search, 
  FileText, 
  ChevronDown, 
  Sparkles,
  Smartphone,
  ExternalLink,
  HelpCircle,
  CheckSquare,
  Square,
  RefreshCw,
  Undo2,
  SlidersHorizontal,
  X
} from 'lucide-react';
import InstagramIcon from './InstagramIcon';
import { getLeads, recordCall, requeueUnreachable, deleteLead, updateLead, updateBatchStatus, getLeadFilterMeta } from '../api';

export default function CallQueue({ currentUser, authUser, onLeadUpdated }) {
  const isAdmin = authUser?.role === 'admin';
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('arama_listesi'); // Varsayılan: Arama Kuyruğu
  const [districtFilter, setDistrictFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [phoneTypeFilter, setPhoneTypeFilter] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState('');
  const [instagramFilter, setInstagramFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [metaFilters, setMetaFilters] = useState({ districts: [], categories: [] });
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCallModal, setActiveCallModal] = useState(null); // Arama yapılan işletme
  const [callNotes, setCallNotes] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [modalScore, setModalScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const loadFilterMeta = async () => {
    try {
      const res = await getLeadFilterMeta();
      if (res) {
        setMetaFilters({
          districts: res.districts || [],
          categories: res.categories || []
        });
      }
    } catch (err) {
      console.error('Filtre meta seçenekleri yüklenirken hata:', err);
    }
  };

  useEffect(() => {
    loadFilterMeta();
  }, []);

  const loadLeads = async (customSearch) => {
    setLoading(true);
    try {
      const activeSearch = customSearch !== undefined ? customSearch : searchQuery;
      const res = await getLeads({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: activeSearch || undefined,
        district: districtFilter || undefined,
        category: categoryFilter || undefined,
        phone_type: phoneTypeFilter || undefined,
        has_website: websiteFilter !== '' ? websiteFilter : undefined,
        has_instagram: instagramFilter !== '' ? instagramFilter : undefined,
        min_rating: ratingFilter || undefined
      });
      setLeads(res.data || []);

    } catch (err) {
      console.error('Leads yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter, districtFilter, categoryFilter, phoneTypeFilter, websiteFilter, instagramFilter, ratingFilter]);

  const activeFiltersCount = [
    districtFilter,
    categoryFilter,
    phoneTypeFilter,
    websiteFilter,
    instagramFilter,
    ratingFilter,
    searchQuery
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setDistrictFilter('');
    setCategoryFilter('');
    setPhoneTypeFilter('');
    setWebsiteFilter('');
    setInstagramFilter('');
    setRatingFilter('');
    setSearchQuery('');
    loadLeads('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadLeads();
  };

  const handleOutcomeSubmit = async (outcome) => {
    if (!activeCallModal) return;

    if (outcome === 'randevu' && !visitDate) {
      alert('Lütfen randevu / ziyaret tarihi ve saatini belirleyiniz.');
      return;
    }

    setSubmitting(true);
    try {
      await recordCall(activeCallModal.id, {
        outcome,
        notes: callNotes,
        caller_name: currentUser?.name || 'Operatör',
        visit_date: visitDate || null,
        score: modalScore || 0
      });

      setActionSuccessMsg(`Arama sonucu '${outcome}' olarak kaydedildi.`);
      setActiveCallModal(null);
      setCallNotes('');
      setVisitDate('');
      setModalScore(0);
      loadLeads();
      if (onLeadUpdated) onLeadUpdated();

      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err) {
      alert(`Kayıt hatası: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScoreChange = async (lead, scoreVal) => {
    const newScore = lead.score === scoreVal ? 0 : scoreVal;
    try {
      await updateLead(lead.id, { score: newScore });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, score: newScore } : l));
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const openCallModal = (lead) => {
    setActiveCallModal(lead);
    setCallNotes(lead.call_notes || '');
    setVisitDate(lead.visit_date || '');
    setModalScore(lead.score || 0);
  };


  const toggleSelectLead = (id) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length && leads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
  };

  const handleRestoreToQueue = async (leadId) => {
    try {
      await updateBatchStatus([leadId], 'arama_listesi');
      setActionSuccessMsg('İşletme başarıyla tekrar arama kuyruğuna aktarıldı.');
      setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
      loadLeads();
      if (onLeadUpdated) onLeadUpdated();
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Seçilen ${selectedLeadIds.length} adet işletme tekrar Arama Bekleyenler listesine aktarılacak. Onaylıyor musunuz?`)) return;

    setBatchActionLoading(true);
    try {
      const res = await updateBatchStatus(selectedLeadIds, 'arama_listesi');
      setActionSuccessMsg(res.message || 'Seçilen işletmeler arama listesine geri aktarıldı.');
      setSelectedLeadIds([]);
      loadLeads();
      if (onLeadUpdated) onLeadUpdated();
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } catch (err) {
      alert(`Toplu geri alma hatası: ${err.message}`);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleRequeueUnreachable = async () => {
    if (!confirm('Tüm iletişimsiz işletmeler tekrar Arama Listesine aktarılacak. Devam edilsin mi?')) {
      return;
    }
    try {
      const res = await requeueUnreachable();
      setActionSuccessMsg(res.message);
      loadLeads();
      if (onLeadUpdated) onLeadUpdated();
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Üst Başlık ve Diyagram Özeti */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900">
              Günlük Arama Kuyruğu & Çağrı Yönetimi
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
              Adım 5 & 6
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Numaraları tek tıkla arayın veya WhatsApp mesajı atın. Diyagramdaki dallara göre sonucu kaydedin.
          </p>
        </div>

        {/* Diyagram Döngü Butonu: Tüm İletişimsizlikleri Sıfırla */}
        <button
          onClick={handleRequeueUnreachable}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-300/80 flex items-center gap-2 transition-all cursor-pointer"
          title="Diyagram: Tüm İletişimsizlikler -> Listesini Ayarlayan döngüsü"
        >
          <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
          <span>İletişimsizleri Kuyruğa Geri Al</span>
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Filtre ve Arama Barı */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        {/* Durum Sekmeleri (Diyagram Düğümleri) */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter('arama_listesi')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
              statusFilter === 'arama_listesi'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Arama Bekleyenler
          </button>

          <button
            onClick={() => setStatusFilter('randevu')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
              statusFilter === 'randevu'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Randevu Alınanlar / Ziyaret
          </button>

          <button
            onClick={() => setStatusFilter('iletisimsiz')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
              statusFilter === 'iletisimsiz'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            İletişimsizler (Ulaşılamadı)
          </button>

          <button
            onClick={() => setStatusFilter('mutlak_olumsuz')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
              statusFilter === 'mutlak_olumsuz'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Mutlak Olumsuz
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tümü
          </button>
        </div>

        {/* Hızlı Arama Kutusu */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İşletme adı veya telefon..."
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 sm:w-64 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
          />
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer shrink-0"
          >
            Filtrele
          </button>
        </form>
      </div>

      {/* Gelişmiş Filtreleme Çubuğu (İlçe, Sektör, İletişim & Kalite Kriterleri) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs space-y-3 min-w-0 max-w-full">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Detaylı Kriter Filtreleri</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-100 text-blue-700 text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                {activeFiltersCount} Aktif Filtre
              </span>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 hover:underline cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Filtreleri Sıfırla</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-2.5 min-w-0">
          {/* İlçe Filtresi */}
          <div className="min-w-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              İlçe
            </label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full min-w-0 max-w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
            >
              <option value="">Tüm İlçeler ({metaFilters.districts?.length || 0})</option>
              {metaFilters.districts?.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Sektör / Kategori Filtresi */}
          <div className="min-w-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Sektör / Kategori
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full min-w-0 max-w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
            >
              <option value="">Tüm Sektörler ({metaFilters.categories?.length || 0})</option>
              {metaFilters.categories?.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Telefon Türü */}
          <div className="min-w-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Telefon Tipi
            </label>
            <select
              value={phoneTypeFilter}
              onChange={(e) => setPhoneTypeFilter(e.target.value)}
              className="w-full min-w-0 max-w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
            >
              <option value="">Tüm Numaralar</option>
              <option value="mobile">📱 Sadece Cep (GSM)</option>
              <option value="landline">☎️ Sadece Sabit Hat</option>
              <option value="has_phone">📞 Numarası Olanlar</option>
            </select>
          </div>

          {/* Web Sitesi Durumu */}
          <div className="min-w-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Web Sitesi
            </label>
            <select
              value={websiteFilter}
              onChange={(e) => setWebsiteFilter(e.target.value)}
              className="w-full min-w-0 max-w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
            >
              <option value="">Tümü</option>
              <option value="1">🌐 Web Sitesi Var</option>
              <option value="0">❌ Web Sitesi Yok</option>
            </select>
          </div>

          {/* Instagram Durumu */}
          <div className="min-w-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Instagram
            </label>
            <select
              value={instagramFilter}
              onChange={(e) => setInstagramFilter(e.target.value)}
              className="w-full min-w-0 max-w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
            >
              <option value="">Tümü</option>
              <option value="1">📸 Instagram Var</option>
              <option value="0">❌ Instagram Yok</option>
            </select>
          </div>

          {/* Google Puanı */}
          <div className="min-w-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Google Puanı
            </label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="w-full min-w-0 max-w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
            >
              <option value="">Tüm Puanlar</option>
              <option value="4.5">★ 4.5 ve Üzeri</option>
              <option value="4.0">★ 4.0 ve Üzeri</option>
              <option value="3.5">★ 3.5 ve Üzeri</option>
            </select>
          </div>
        </div>
      </div>

      {/* YÖNETİCİ ÇOKLU SEÇİM & KUYRUĞA GERİ DÖNDÜRME ÇUBUĞU */}
      {isAdmin && leads.length > 0 && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-indigo-900 hover:text-indigo-700 cursor-pointer"
            >
              {selectedLeadIds.length === leads.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-indigo-400" />
              )}
              <span>
                {selectedLeadIds.length === leads.length ? 'Tüm Seçimleri Kaldır' : 'Tümünü Seç'}
              </span>
            </button>
            <span className="text-xs text-indigo-700/80 font-medium">
              ({selectedLeadIds.length} / {leads.length} seçildi)
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={selectedLeadIds.length === 0 || batchActionLoading}
              onClick={handleBatchRestore}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Seçilenleri Arama Listesine Döndür ({selectedLeadIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Arama Kartları / Tablosu */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold">İşletmeler yükleniyor...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
          <PhoneCall className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Bu filtrelere uygun işletme bulunamadı</p>
          <p className="text-xs text-slate-400 mt-1">
            'Harita Arama' sekmesinden yeni ilçe ve sektörler tarayarak arama listesine aday ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 min-w-0">
          {leads.map((lead) => {
            const hasPhone = Boolean(lead.phone && lead.phone !== 'Numara Yok');
            const isSelected = selectedLeadIds.includes(lead.id);

            return (
              <div 
                key={lead.id}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 flex flex-col justify-between space-y-4 min-w-0 overflow-hidden break-words ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md' : 'border-slate-200/90 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Kart Üst Bilgileri */}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 sm:gap-2.5 min-w-0 flex-1">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => toggleSelectLead(lead.id)}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                          title="Seç"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug break-words">
                          {lead.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                          <span className="bg-slate-100 text-slate-700 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md">
                            {lead.district} / {lead.city}
                          </span>
                          <span className="bg-blue-50 text-blue-700 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-md">
                            {lead.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Yıldız Puanı */}
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-900 font-bold text-xs px-2 py-1 rounded-lg border border-amber-200 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{lead.rating || '-'}</span>
                    </div>
                  </div>

                  {/* Adres ve Konum Linki */}
                  <div className="flex items-start justify-between gap-2 mt-2">
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {lead.address}
                    </p>
                    {lead.maps_url && (
                      <a
                        href={lead.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-lg shrink-0 transition-colors"
                        title="Google Haritalar'da Konumu Aç"
                      >
                        <MapPin className="w-3.5 h-3.5 text-red-500" />
                      </a>
                    )}
                  </div>

                  {/* Dijital Durum (Web / Insta) */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
                    {lead.has_website && lead.website ? (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md font-semibold flex items-center gap-1 border border-blue-200 transition-colors max-w-[130px] truncate"
                        title={lead.website}
                      >
                        <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-semibold border border-amber-200">
                        ⚠️ Web Yok
                      </span>
                    )}

                    {lead.has_instagram && lead.instagram ? (
                      <a
                        href={lead.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-700 bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded-md font-semibold flex items-center gap-1 border border-pink-200 transition-colors"
                      >
                        <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
                        <span>Instagram</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <a
                        href={`https://www.google.com/search?q=site:instagram.com+"${encodeURIComponent(lead.name + ' ' + lead.district)}"`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-pink-700 bg-slate-100 hover:bg-pink-50 px-2 py-0.5 rounded-md font-medium flex items-center gap-1 border border-slate-200 transition-colors"
                        title="Bu işletmenin Instagram hesabını ara"
                      >
                        <InstagramIcon className="w-3 h-3 text-slate-400" />
                        <span>Insta Ara 🔍</span>
                      </a>
                    )}
                  </div>

                  {/* Randevu / Ziyaret Tarihi Varsa */}
                  {lead.visit_date && (
                    <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-2.5 text-xs text-purple-900 font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Randevu: {new Date(lead.visit_date).toLocaleString('tr-TR')}</span>
                    </div>
                  )}

                  {/* Son Arama Notu */}
                  {lead.call_notes && (
                    <div className="mt-2 text-xs bg-slate-50 p-2 rounded-lg text-slate-600 italic">
                      " {lead.call_notes} "
                    </div>
                  )}

                  {/* Örnek Proje Özelliği: 1-5 Müşteri İlgi Puanı (Score Dots) */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500">Müşteri İlgi Düzeyi:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleScoreChange(lead, num)}
                          className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                            (lead.score || 0) >= num
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={`Öncelik Puanı ${num}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Kart Altı: Telefon & Tek Tıkla Arama (Adım 5) */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {lead.is_mobile ? (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          Cep (GSM)
                        </span>
                      ) : (
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          Sabit Hat
                        </span>
                      )}
                    </div>

                    <span className="font-bold text-slate-800 text-xs tracking-wide">
                      {lead.phone || 'Numara Yok'}
                    </span>
                  </div>

                  {/* Arama, WhatsApp ve Not/Durum Aksiyonları (6. Adım) */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Tek Tıkla Arama */}
                      {hasPhone ? (
                        <a
                          href={lead.call_link}
                          onClick={() => openCallModal(lead)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                          title="Telefonu Ara ve Karar Notu Ekle"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Hemen Ara</span>
                        </a>
                      ) : (
                        <button
                          disabled
                          className="bg-slate-100 text-slate-400 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-not-allowed"
                        >
                          Numara Yok
                        </button>
                      )}

                      {/* WhatsApp Mesajı (Sadece GSM ise aktif) */}
                      {lead.whatsapp_link ? (
                        <a
                          href={lead.whatsapp_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                          title="WhatsApp Mesajı Başlat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      ) : (
                        <span className="bg-slate-50 text-slate-400 border border-slate-200 text-xs font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 opacity-40" />
                          <span>Sabit Hat</span>
                        </span>
                      )}
                    </div>

                    {/* HER İŞLETME İÇİN KESİNTİSİZ NOT / ÇAĞRI DURUMU BUTONU */}
                    <button
                      type="button"
                      onClick={() => openCallModal(lead)}
                      className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                      title="Görüşme notu ekle ve durum güncelle (Randevu, Satış, Olumsuz, Ulaşılamadı)"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Not Ekle / Çağrı Durumu Belirle</span>
                    </button>

                    {/* SİSTEM YÖNETİCİSİ: KUYRUĞA GERİ DÖNDÜR BUTONU (TEKİL) */}
                    {isAdmin && (statusFilter !== 'arama_listesi' || lead.status !== 'arama_listesi') && (
                      <button
                        type="button"
                        onClick={() => handleRestoreToQueue(lead.id)}
                        className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                        title="Bu işletmeyi tekrar Arama Listesine aktar"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Arama Listesine Geri Döndür</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}


      {/* Arama Sonucu ve Diyagram Karar Modalı (6. Adım) */}
      {activeCallModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-scale-up max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Diyagram Çağrı Karar Masası
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  {activeCallModal.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeCallModal.phone} • {activeCallModal.district}
                </p>
              </div>
              <button
                onClick={() => setActiveCallModal(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Görüşme Notu */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Görüşme Notu:
              </label>
              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Örn: Yetkili Ali Bey ile görüşüldü, yeni web sitesi ve Instagram yönetimi istiyorlar..."
                rows={3}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Müşteri İlgi Puanı (1-5) */}
            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Müşteri İlgi Düzeyi (Puan):
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setModalScore(modalScore === num ? 0 : num)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      modalScore >= num
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    ★ {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Randevu Tarihi (Eğer randevu seçilecekse) */}

            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                Randevu / Ziyaret Tarihi (Randevu ise zorunludur):
              </label>
              <input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
              />
            </div>

            {/* Diyagram Butonları: Sonuç İşaretleme (6. Adım) */}
            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Görüşme Sonucunu Seçiniz (Diyagram Akışı):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                
                {/* 1. Doğrudan Satış -> Satış Havuzu */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOutcomeSubmit('satis')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>🤝 Satış Yapıldı (Satış Havuzuna)</span>
                </button>

                {/* 2. Randevu Alındı -> Ziyaret */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOutcomeSubmit('randevu')}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>🗓️ Randevu Alındı (Ziyaret Planla)</span>
                </button>

                {/* 3. İletişimsiz Telefon -> Tüm İletişimsizlikler */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOutcomeSubmit('iletisimsiz')}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>📵 Ulaşılamadı (İletişimsizler Havuzu)</span>
                </button>

                {/* 4. Mutlak Olumsuz -> Süreç Sonu */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOutcomeSubmit('mutlak_olumsuz')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>❌ Mutlak Olumsuz (İptal)</span>
                </button>

              </div>

              {/* Randevu durumundaki işletmeler için Ziyaret Sonuç Butonları */}
              {activeCallModal.status === 'randevu' && (
                <div className="pt-3 border-t border-slate-200 mt-2 space-y-1.5">
                  <span className="text-[11px] font-bold text-purple-700">
                    Ziyaret Yapıldıysa Sonucu İşaretleyin:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOutcomeSubmit('ziyaret_olumlu')}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 px-2.5 rounded-xl cursor-pointer"
                    >
                      ✅ Ziyaret Olumlu (Satış Havuzuna)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOutcomeSubmit('ziyaret_olumsuz')}
                      className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold py-2 px-2.5 rounded-xl cursor-pointer"
                    >
                      ❌ Ziyaret Olumsuz (Kapat)
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
