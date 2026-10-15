import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Phone, 
  PhoneCall, 
  MessageSquare, 
  MapPin, 
  Building2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Search,
  User,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  TrendingUp,
  UserCheck,
  CheckCircle,
  XCircle,
  PhoneOff
} from 'lucide-react';
import { getDailyActivity, parseCallNote, getBulutfonDialUrl, triggerBulutfonCallApi } from '../api';

export default function DailyActivityModal({ 
  isOpen, 
  onClose, 
  initialDate,
  teamMembers = [],
  authUser,
  onOpenInCallQueue
}) {
  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayStr());
  const [selectedCaller, setSelectedCaller] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'calls' | 'recalls' | 'visits' | 'jobs'
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(true);

  // InitialDate değiştiğinde güncelle
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const res = await getDailyActivity({
        date: selectedDate,
        caller_name: selectedCaller === 'all' ? undefined : selectedCaller
      });
      setActivityData(res);
    } catch (err) {
      console.error('Günlük aktivite verileri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActivity();
    }
  }, [isOpen, selectedDate, selectedCaller]);

  if (!isOpen) return null;

  // Gün değiştirme yardımcıları
  const handleShiftDate = (days) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().slice(0, 10));
  };

  // Formatlı tarih (Örn: 15 Ekim 2026 Perşembe)
  const formatDisplayDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        weekday: 'long'
      });
    } catch {
      return dateStr;
    }
  };

  const summary = activityData?.summary || {
    total_calls: 0,
    total_recalls: 0,
    total_visits: 0,
    total_jobs: 0,
    total_unique_leads: 0,
    callers: [],
    outcomes: []
  };

  const calls = activityData?.calls || [];
  const recalls = activityData?.recalls || [];
  const visits = activityData?.visits || [];
  const jobs = activityData?.jobs || [];
  const timeline = activityData?.timeline || [];

  // Arama filtreleme
  const matchesSearch = (text) => {
    if (!searchFilter.trim()) return true;
    return (text || '').toLowerCase().includes(searchFilter.toLowerCase().trim());
  };

  const filteredCalls = calls.filter(c => 
    matchesSearch(c.lead_name) || matchesSearch(c.lead_phone) || matchesSearch(c.caller_name) || matchesSearch(c.notes)
  );

  const filteredRecalls = recalls.filter(r => 
    matchesSearch(r.lead_name) || matchesSearch(r.lead_phone) || matchesSearch(r.assigned_caller_name) || matchesSearch(r.call_notes)
  );

  const filteredVisits = visits.filter(v => 
    matchesSearch(v.lead_name) || matchesSearch(v.lead_phone) || matchesSearch(v.lead_address) || matchesSearch(v.assigned_caller_name)
  );

  const filteredJobs = jobs.filter(j => 
    matchesSearch(j.title) || matchesSearch(j.lead_name) || matchesSearch(j.member_name) || matchesSearch(j.job_notes)
  );

  const filteredTimeline = timeline.filter(t => 
    matchesSearch(t.title) || matchesSearch(t.subtitle) || matchesSearch(t.lead_name) || matchesSearch(t.actor) || matchesSearch(t.notes)
  );

  const getOutcomeBadge = (outcome) => {
    switch (outcome) {
      case 'randevu':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-md">🤝 Yüz Yüze Randevu</span>;
      case 'randevu_arama':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md">⏰ Arama Randevusu</span>;
      case 'satis_havuzu':
      case 'satis':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md">🎉 Satış / Hizmet</span>;
      case 'iletisimsiz':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-md">📵 İletişimsiz</span>;
      case 'mutlak_olumsuz':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md">❌ Olumsuz</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">{outcome || 'Görüşüldü'}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh] animate-scale-up">
        
        {/* Üst Yönetici Başlık & Tarih Gezgini */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Başlık */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Calendar className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-base sm:text-xl text-white tracking-tight">
                    Günlük Yönetici Analiz Raporu
                  </h3>
                  <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                    Günün Tüm Aktiviteleri
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>
            </div>

            {/* Tarih Seçici Kontrolleri & Personel Filtresi */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              {/* Önceki Gün */}
              <button
                type="button"
                onClick={() => handleShiftDate(-1)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer border border-white/10 shrink-0"
                title="Bir Önceki Gün"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Date Input */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white text-slate-900 font-extrabold text-xs px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm cursor-pointer"
              />

              {/* Sonraki Gün */}
              <button
                type="button"
                onClick={() => handleShiftDate(1)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer border border-white/10 shrink-0"
                title="Bir Sonraki Gün"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Bugün Butonu */}
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayStr())}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-indigo-400/30 shrink-0"
              >
                Bugün
              </button>

              {/* Personel Filtresi Dropdown */}
              <select
                value={selectedCaller}
                onChange={(e) => setSelectedCaller(e.target.value)}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-2.5 py-2 rounded-xl border border-white/15 focus:outline-none cursor-pointer"
              >
                <option value="all" className="text-slate-900">👥 Tüm Personeller</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name} className="text-slate-900">
                    👤 {m.name}
                  </option>
                ))}
              </select>

              {/* Kapat Butonu */}
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer shrink-0 ml-1"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 4 Ana İstatistik Kartı */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4 pt-4 border-t border-white/10">
            {/* 1. Yapılan Görüşmeler */}
            <div 
              onClick={() => setActiveTab('calls')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'calls' 
                  ? 'bg-blue-600/30 border-blue-400 ring-2 ring-blue-400/40 shadow-md' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-200">📞 Yapılan Aramalar</span>
                <span className="text-xl font-black text-white">{summary.total_calls}</span>
              </div>
              <p className="text-[10px] text-blue-100/70 mt-1 line-clamp-1">
                {summary.callers.length > 0 
                  ? summary.callers.map(c => `${c.name}: ${c.count}`).join(', ')
                  : 'Görüşme kaydı yok'}
              </p>
            </div>

            {/* 2. Aranacak Randevular */}
            <div 
              onClick={() => setActiveTab('recalls')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'recalls' 
                  ? 'bg-amber-600/30 border-amber-400 ring-2 ring-amber-400/40 shadow-md' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-200">⏰ Aranacak Randevular</span>
                <span className="text-xl font-black text-white">{summary.total_recalls}</span>
              </div>
              <p className="text-[10px] text-amber-100/70 mt-1">
                {summary.total_recalls > 0 ? 'Bugün aranması planlananlar' : 'Planlı arama yok'}
              </p>
            </div>

            {/* 3. Saha Ziyaretleri / Randevular */}
            <div 
              onClick={() => setActiveTab('visits')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'visits' 
                  ? 'bg-purple-600/30 border-purple-400 ring-2 ring-purple-400/40 shadow-md' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-200">🤝 Saha Randevuları</span>
                <span className="text-xl font-black text-white">{summary.total_visits}</span>
              </div>
              <p className="text-[10px] text-purple-100/70 mt-1">
                {summary.total_visits > 0 ? 'Müşteri ziyaretleri' : 'Ziyaret randevusu yok'}
              </p>
            </div>

            {/* 4. Yapılan / Teslim Edilecek İşler */}
            <div 
              onClick={() => setActiveTab('jobs')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'jobs' 
                  ? 'bg-emerald-600/30 border-emerald-400 ring-2 ring-emerald-400/40 shadow-md' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-200">💼 Yapılan İşler</span>
                <span className="text-xl font-black text-white">{summary.total_jobs}</span>
              </div>
              <p className="text-[10px] text-emerald-100/70 mt-1">
                {summary.total_jobs > 0 ? 'Teslimat & tasarım işleri' : 'Bugüne ait iş yok'}
              </p>
            </div>
          </div>
        </div>

        {/* Sekmeler & Hızlı Filtre Barı */}
        <div className="p-3 sm:px-5 bg-slate-50 border-b border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
          
          {/* Sekmeler */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'all' 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              📋 Her Şey ({timeline.length})
            </button>

            <button
              onClick={() => setActiveTab('calls')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'calls' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
              }`}
            >
              <span>📞 Görüşülenler</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'calls' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {calls.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('recalls')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'recalls' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <span>⏰ Aranacaklar</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'recalls' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {recalls.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('visits')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'visits' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
              }`}
            >
              <span>🤝 Randevular</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'visits' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {visits.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'jobs' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span>💼 Yapılan İşler</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'jobs' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {jobs.length}
              </span>
            </button>
          </div>

          {/* Arama Kutusu & Çağrı Ekranında Filtrele Butonu */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Listede hızlı ara..."
                className="w-full bg-white text-slate-800 placeholder-slate-400 pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Çağrı Ekranında Aç Butonu */}
            {onOpenInCallQueue && activityData?.lead_ids?.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInCallQueue(selectedDate, activityData.lead_ids);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                title="Bu günün işletmelerini ana çağrı listesinde filtrele"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Çağrıda Filtrele</span>
                <span>({activityData.lead_ids.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Ana İçerik Listesi */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/50">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-9 h-9 animate-spin text-indigo-600 mb-3" />
              <p className="text-sm font-bold text-slate-700">
                {formatDisplayDate(selectedDate)} aktiviteleri analiz ediliyor...
              </p>
            </div>
          ) : (
            <>
              {/* 1. TÜMÜ (ZAMAN ÇİZELGESİ) */}
              {activeTab === 'all' && (
                <div className="space-y-3">
                  {filteredTimeline.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <Calendar className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">Seçilen güne ait hiçbir aktivite kaydı bulunamadı.</p>
                      <p className="text-xs text-slate-400 mt-1">Farklı bir gün seçebilir veya personellerin aramalarını kontrol edebilirsiniz.</p>
                    </div>
                  ) : (
                    filteredTimeline.map((item) => (
                      <div 
                        key={item.id}
                        className="bg-white rounded-2xl p-4 border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 font-bold text-xs shadow-xs ${
                            item.type === 'call' ? 'bg-blue-600' :
                            item.type === 'recall' ? 'bg-amber-600' :
                            item.type === 'visit' ? 'bg-purple-600' : 'bg-emerald-600'
                          }`}>
                            {item.type === 'call' ? '📞' : item.type === 'recall' ? '⏰' : item.type === 'visit' ? '🤝' : '💼'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-sm text-slate-900 truncate">
                                {item.lead_name || item.title}
                              </h4>

                              {item.type === 'call' && item.outcome && (
                                getOutcomeBadge(item.outcome)
                              )}

                              {item.lead_district && (
                                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                                  <MapPin className="w-2.5 h-2.5 text-slate-500" />
                                  {item.lead_district}
                                </span>
                              )}

                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                                👤 {item.actor || 'Personel'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 mt-0.5 font-medium">
                              {item.subtitle}
                            </p>

                            {item.notes && (
                              <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed font-sans">
                                <span className="font-bold text-slate-900">Görüşme / İş Notu: </span>
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sağ Saat & Hızlı Arama */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 self-start">
                          <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                            {item.time ? item.time.slice(11, 16) || item.time.slice(0, 10) : ''}
                          </span>

                          {item.lead_phone && (
                            <a
                              href={`tel:${item.lead_phone}`}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{item.lead_phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 2. YAPILAN ARAMALAR & GÖRÜŞÜLENLER */}
              {activeTab === 'calls' && (
                <div className="space-y-3">
                  {filteredCalls.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <PhoneCall className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">Bu tarihte yapılmış bir görüşme kaydı bulunamadı.</p>
                    </div>
                  ) : (
                    filteredCalls.map((call, idx) => (
                      <div 
                        key={call.log_id || idx}
                        className="bg-white rounded-2xl p-4 border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-black text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                              {call.lead_name}
                            </h4>

                            {getOutcomeBadge(call.outcome)}

                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                              👤 {call.caller_name}
                            </span>

                            {call.lead_district && (
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                                <MapPin className="w-2.5 h-2.5 text-slate-500" />
                                {call.lead_district}
                              </span>
                            )}
                          </div>

                          {/* Görüşme Notu */}
                          {call.notes ? (
                            <div className="mt-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-sans">
                              {call.notes}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic mt-1">Not eklenmemiş.</p>
                          )}
                        </div>

                        {/* Saat & Arama Butonları */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 self-start">
                          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {call.created_at ? call.created_at.slice(11, 16) : ''}
                          </span>

                          {call.lead_phone && (
                            <a
                              href={`tel:${call.lead_phone}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{call.lead_phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 3. ARANACAK RANDAVULAR */}
              {activeTab === 'recalls' && (
                <div className="space-y-3">
                  {filteredRecalls.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <Clock className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">Bu tarihte planlanmış bir arama randevusu yok.</p>
                    </div>
                  ) : (
                    filteredRecalls.map((recall, idx) => (
                      <div 
                        key={recall.lead_id || idx}
                        className="bg-white rounded-2xl p-4 border border-amber-200/90 hover:border-amber-400 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-amber-100 text-amber-900 font-black text-xs px-2 py-0.5 rounded-lg flex items-center gap-1">
                              ⏰ Saat: {recall.recall_time || 'Gündüz'}
                            </span>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                              {recall.lead_name}
                            </h4>

                            {recall.assigned_caller_name && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                                👤 Sorumlu: {recall.assigned_caller_name}
                              </span>
                            )}

                            {recall.lead_district && (
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                📍 {recall.lead_district}
                              </span>
                            )}
                          </div>

                          {recall.call_notes && (
                            <div className="mt-2 p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/50 text-xs text-amber-950">
                              <span className="font-bold">Önceki Görüşme Notu: </span>
                              {recall.call_notes.split('\n').filter(Boolean).pop()}
                            </div>
                          )}
                        </div>

                        {recall.lead_phone && (
                          <div className="shrink-0 self-start">
                            <a
                              href={`tel:${recall.lead_phone}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{recall.lead_phone}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 4. SAHA ZİYARETLERİ */}
              {activeTab === 'visits' && (
                <div className="space-y-3">
                  {filteredVisits.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <UserCheck className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">Bu tarihte saha ziyareti veya yüz yüze randevu yok.</p>
                    </div>
                  ) : (
                    filteredVisits.map((visit, idx) => (
                      <div 
                        key={visit.lead_id || idx}
                        className="bg-white rounded-2xl p-4 border border-purple-200/90 hover:border-purple-400 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-purple-100 text-purple-900 font-black text-xs px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              🤝 Randevu Saati: {visit.visit_date ? visit.visit_date.slice(11, 16) || visit.visit_date : 'Belirtilmedi'}
                            </span>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                              {visit.lead_name}
                            </h4>

                            {visit.lead_district && (
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                📍 {visit.lead_district}
                              </span>
                            )}
                          </div>

                          {visit.lead_address && (
                            <p className="text-xs text-slate-600 mt-1 flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span>{visit.lead_address}</span>
                            </p>
                          )}

                          {visit.call_notes && (
                            <div className="mt-2 p-2.5 bg-purple-50/50 rounded-xl border border-purple-200/50 text-xs text-purple-950">
                              <span className="font-bold">Randevu Notları: </span>
                              {visit.call_notes.split('\n').filter(Boolean).pop()}
                            </div>
                          )}
                        </div>

                        {visit.lead_phone && (
                          <div className="shrink-0 self-start">
                            <a
                              href={`tel:${visit.lead_phone}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{visit.lead_phone}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 5. YAPILAN İŞLER */}
              {activeTab === 'jobs' && (
                <div className="space-y-3">
                  {filteredJobs.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <Briefcase className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">Bu tarihe ait teslim edilecek veya oluşturulan iş bulunmuyor.</p>
                    </div>
                  ) : (
                    filteredJobs.map((job) => (
                      <div 
                        key={job.job_id}
                        className="bg-white rounded-2xl p-4 border border-emerald-200/90 hover:border-emerald-400 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              job.job_status === 'tamamlandi' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {job.job_status === 'tamamlandi' ? '✓ Tamamlandı' : '⚡ Devam Ediyor'}
                            </span>

                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                              {job.title}
                            </h4>

                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              🏢 {job.lead_name}
                            </span>

                            {job.member_name && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                                👤 Sorumlu: {job.member_name}
                              </span>
                            )}
                          </div>

                          {job.products && (
                            <p className="text-xs text-slate-500 mt-1">
                              <span className="font-bold text-slate-700">Ürünler: </span>
                              {job.products}
                            </p>
                          )}

                          {job.job_notes && (
                            <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-700">
                              <span className="font-bold">İş Notları: </span>
                              {job.job_notes}
                            </div>
                          )}
                        </div>

                        {job.due_date && (
                          <div className="shrink-0 self-start text-right">
                            <span className="text-[10px] font-bold text-slate-400 block">Teslim Tarihi</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{job.due_date}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Alt Kapatma Çubuğu */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Seçilen Gün: <b className="text-indigo-900 font-bold">{formatDisplayDate(selectedDate)}</b> • Toplam <b className="text-slate-800">{activityData?.lead_ids?.length || 0}</b> işletmeyle etkileşim
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
