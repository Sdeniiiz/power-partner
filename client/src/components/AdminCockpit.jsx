import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  PhoneCall,
  Calendar,
  Clock,
  AlertTriangle,
  Award,
  DollarSign,
  Copy,
  Check,
  RefreshCw,
  Search,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  Users,
  Building2,
  MapPin,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  ArrowUpRight,
  Sparkles,
  PhoneOff,
  X
} from 'lucide-react';
import { getAdminCockpit, getBulutfonDialUrl, triggerBulutfonCallApi } from '../api';

export default function AdminCockpit({
  authUser,
  teamMembers = [],
  onOpenLeadInCallQueue,
  onNavigateToTab
}) {
  const [range, setRange] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [showVisitsModal, setShowVisitsModal] = useState(false);

  const fetchCockpitData = async (selectedRange = range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminCockpit({ range: selectedRange });
      setData(res);
    } catch (err) {
      console.error('Kokpit verisi alınamadı:', err);
      setError(err?.response?.data?.error || err.message || 'Veriler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCockpitData(range);
  }, [range]);

  const handleCopyBriefing = () => {
    if (!data?.daily_briefing) return;
    navigator.clipboard.writeText(data.daily_briefing).then(() => {
      setCopiedBriefing(true);
      setTimeout(() => setCopiedBriefing(false), 2500);
    }).catch(err => {
      console.error('Kopyalanamadı:', err);
    });
  };

  const pulse = data?.daily_pulse || {
    today_pending_calls: 0,
    today_pending_pool: 0,
    today_recalls_due: 0,
    today_field_visits_total: 0,
    today_field_visits_completed: 0,
    today_field_visits_pending: 0,
    today_sales_count: 0,
    today_sales_total_tl: 0,
    red_flags_count: 0
  };

  const coldCallers = data?.cold_callers_performance || [];
  const fieldStaff = data?.field_sales_performance || [];
  const soldJobs = data?.field_sold_jobs || [];
  const overdueRecalls = data?.red_flags?.overdue_recalls || [];
  const unreachableRecovery = data?.red_flags?.unreachable_recovery || [];
  const outcomeDist = data?.charts?.outcome_distribution || {};
  const totalCalls = data?.charts?.total_calls || 0;

  // Filtreleme
  const filteredSoldJobs = soldJobs.filter(j => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (j.lead_name || '').toLowerCase().includes(term) ||
      (j.district || '').toLowerCase().includes(term) ||
      (j.sold_services || '').toLowerCase().includes(term) ||
      (j.field_member_name || '').toLowerCase().includes(term) ||
      (j.assigned_caller_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* 1. ÜST BAŞLIK VE KONTROL ÇUBUĞU */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-4 sm:p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/20 text-amber-300 text-xs font-black px-2.5 py-1 rounded-full border border-amber-400/30 flex items-center gap-1">
              👑 Yönetici Kokpiti
            </span>
            <span className="text-xs text-slate-400">
              {data?.start_date === data?.end_date ? data?.start_date : `${data?.start_date} → ${data?.end_date}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2">
            <span>Operasyon & Performans Merkezi</span>
            {loading && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Soğuk arama ekibi (Bahar & Aslı) ve saha satış ekibinin (Yiğit) günlük performans karnesi, kapanan cirolar ve alarm merkezi.
          </p>
        </div>

        {/* Tarih Filtre Butonları & Rapor Kopyala */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-1 flex items-center gap-1 shadow-inner">
            {[
              { id: 'today', label: 'Bugün' },
              { id: 'yesterday', label: 'Dün' },
              { id: 'this_week', label: 'Bu Hafta' },
              { id: 'this_month', label: 'Bu Ay' },
              { id: 'all', label: 'Tümü' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRange(tab.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  range === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyBriefing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer active:scale-95 border border-emerald-400/30"
            title="Günün özetini WhatsApp mesajı olarak kopyalayın"
          >
            {copiedBriefing ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>Kopyalandı! ✅</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>📋 WhatsApp Brifingi</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => fetchCockpitData()}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. GÜNÜN CANLI NABZI (4 BÜYÜK KPI KARTI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Bugün Yapılacak Arama Sayısı */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              📞 Bugün Yapılacak Arama
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {pulse.today_pending_calls.toLocaleString('tr-TR')}
            </span>
            <span className="text-xs text-slate-500 font-semibold">işletme</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Kuyrukta: <strong className="text-blue-700">{pulse.today_pending_pool}</strong></span>
            <span>Randevulu: <strong className="text-amber-700">{pulse.today_recalls_due}</strong></span>
          </div>
        </div>

        {/* KPI 2: Gidilecek İşletmeler (Saha Randevuları) */}
        <div 
          onClick={() => setShowVisitsModal(true)}
          className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer"
          title="Tıklayarak bugün ve geçmişten bekleyen saha randevularının listesini inceleyin"
        >
          <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              {range === 'today' ? '🚗 Bugün Gidilecek İşletme' : `🚗 Planlanan Ziyaretler (${range === 'this_month' ? 'Bu Ay' : range === 'this_week' ? 'Bu Hafta' : range === 'yesterday' ? 'Dün' : 'Tümü'})`}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700">
              {range === 'today' ? pulse.today_field_visits_total : (pulse.period_field_visits_total ?? pulse.today_field_visits_total)}
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              {range === 'today' ? 'bugün planlanan' : 'seçilen dönemde'}
            </span>
            {range === 'today' && pulse.overdue_field_visits_total > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                +{pulse.overdue_field_visits_total} Geçmişten Bekleyen
              </span>
            )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            {range === 'today' ? (
              <>
                <span>Bugün Kalan: <strong className="text-emerald-700">{pulse.today_field_visits_pending}</strong></span>
                <span className="text-blue-600 hover:underline">Listeyi Gör ({pulse.today_field_visits_total + (pulse.overdue_field_visits_total || 0)}) →</span>
              </>
            ) : (
              <>
                <span>Dönem Toplamı: <strong className="text-emerald-700">{pulse.period_field_visits_total ?? pulse.today_field_visits_total}</strong></span>
                <span className="text-blue-600 hover:underline">Listeyi Gör →</span>
              </>
            )}
          </div>
        </div>

        {/* KPI 3: Kapanan Satışlar & Ciro */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden group hover:border-purple-300 transition-all">
          <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-purple-500 to-pink-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              🤝 Kapanan Satış & Ciro
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-purple-900">
              {soldJobs.length}
            </span>
            <span className="text-xs text-slate-500 font-semibold">satış kapandı</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Toplam Ciro:</span>
            <strong className="text-purple-700 text-xs font-black">
              {soldJobs.reduce((sum, j) => sum + (Number(j.total_sale_price) || 0), 0).toLocaleString('tr-TR')} TL
            </strong>
          </div>
        </div>

        {/* KPI 4: Kırmızı Bayrak Alarmları */}
        <div className={`rounded-3xl p-4 sm:p-5 border shadow-xs relative overflow-hidden group transition-all ${
          pulse.red_flags_count > 0 
            ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300' 
            : 'bg-white border-slate-200'
        }`}>
          <div className={`absolute top-0 left-0 h-1.5 w-full ${pulse.red_flags_count > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              ⚠️ Kırmızı Bayrak Alarmları
            </span>
            <div className={`p-2 rounded-2xl group-hover:scale-110 transition-transform ${
              pulse.red_flags_count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black ${pulse.red_flags_count > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {overdueRecalls.length}
            </span>
            <span className="text-xs text-slate-500 font-semibold">geciken arama</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-600">Kurtarılacak İletişimsiz:</span>
            <strong className="text-orange-700">{unreachableRecovery.length}</strong>
          </div>
        </div>

      </div>

      {/* 3. İÇ NAVİGASYON SEKMELERİ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'overview', label: '📊 Genel Bakış & Grafikler', icon: BarChart3 },
          { id: 'callers', label: `👩‍💼 Soğuk Arama Ekibi (${coldCallers.length})`, icon: PhoneCall },
          { id: 'field', label: `🚗 Saha Satış Ekibi (${fieldStaff.length})`, icon: MapPin },
          { id: 'sold_jobs', label: `🎉 Sahada Satılan İşler (${soldJobs.length})`, icon: Award },
          { id: 'alerts', label: `⚠️ Alarmlar & Kaçaklar (${overdueRecalls.length + unreachableRecovery.length})`, icon: AlertTriangle },
          { id: 'briefing', label: '📋 Gün Sonu Brifingi', icon: Copy }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* SEKMELER: 1. GENEL BAKIŞ & GRAFİKLER */}
      {/* ========================================================= */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Soğuk Arama Öncüleri (Bahar & Aslı Öncelikli Gösterim) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <span>Soğuk Arama Personel Karnesi (Bahar & Aslı)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Yapılan soğuk aramaların randevuya ve satışa dönüşüm oranları.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('callers')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Detaylı Tablo →</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coldCallers.slice(0, 2).map((caller, idx) => (
                <div
                  key={caller.name}
                  className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl p-4 border border-slate-200/90 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-md">
                        {caller.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900 capitalize">{caller.name}</h4>
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">
                            {caller.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Toplam <strong>{caller.total_calls}</strong> Arama
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">
                        Başarı Oranı
                      </span>
                      <span className="text-lg font-black text-blue-700">
                        %{caller.success_rate}
                      </span>
                    </div>
                  </div>

                  {/* İlerleme Çubuğu */}
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-3">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(5, caller.success_rate))}%` }}
                    ></div>
                  </div>

                  {/* Detay Metrikler */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200/80 text-center">
                    <div className="bg-white/80 rounded-xl p-1.5 border border-slate-200/60">
                      <span className="text-[10px] text-purple-700 font-bold block">🤝 Yüz Yüze</span>
                      <strong className="text-xs font-black text-purple-950">{caller.randevu_count}</strong>
                    </div>
                    <div className="bg-white/80 rounded-xl p-1.5 border border-slate-200/60">
                      <span className="text-[10px] text-amber-700 font-bold block">⏰ Randevu</span>
                      <strong className="text-xs font-black text-amber-950">{caller.recall_count}</strong>
                    </div>
                    <div className="bg-white/80 rounded-xl p-1.5 border border-slate-200/60">
                      <span className="text-[10px] text-orange-700 font-bold block">📵 İletişimsiz</span>
                      <strong className="text-xs font-black text-orange-950">{caller.unreachable_count}</strong>
                    </div>
                    <div className="bg-white/80 rounded-xl p-1.5 border border-slate-200/60">
                      <span className="text-[10px] text-rose-700 font-bold block">❌ Olumsuz</span>
                      <strong className="text-xs font-black text-rose-950">{caller.negative_count}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saha Satış Karnesi (Yiğit) ve Arama Dağılım Grafiği */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Yiğit Saha Satış Kartı */}
            <div className="lg:col-span-1 bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 text-white rounded-3xl p-5 border border-emerald-800/50 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-400/30">
                    🚗 Saha Satış Sorumlusu
                  </span>
                  <Award className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-black text-white">Yiğit dalkılıç</h3>
                <p className="text-xs text-emerald-200/80 mt-1">
                  Yüz yüze işletme ziyaretleri, teklif sunumu ve sözleşme kapama performansı.
                </p>

                {/* Büyük Rakamlar */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/10 backdrop-blur-xs">
                    <span className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-wider block">
                      Ziyaret Edilen
                    </span>
                    <span className="text-2xl font-black text-white mt-1 block">
                      {fieldStaff.find(f => /yiğit/i.test(f.name))?.total_visits || 0}
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/10 backdrop-blur-xs">
                    <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider block">
                      Kapanan Satış
                    </span>
                    <span className="text-2xl font-black text-amber-300 mt-1 block">
                      {fieldStaff.find(f => /yiğit/i.test(f.name))?.positive_sales || 0}
                    </span>
                  </div>
                </div>

                <div className="mt-4 bg-emerald-500/20 rounded-2xl p-3.5 border border-emerald-400/30 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-200 block font-bold">Kapama Başarı Oranı:</span>
                    <span className="text-xl font-black text-white">
                      %{fieldStaff.find(f => /yiğit/i.test(f.name))?.closing_rate || 0}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-200 block font-bold">Toplam Ciro:</span>
                    <span className="text-base font-black text-amber-300">
                      {(fieldStaff.find(f => /yiğit/i.test(f.name))?.total_revenue || 0).toLocaleString('tr-TR')} TL
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 text-right">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('sold_jobs')}
                  className="text-xs font-black text-emerald-300 hover:text-white flex items-center justify-end gap-1 cursor-pointer transition-colors"
                >
                  <span>Satılan İşleri İncele →</span>
                </button>
              </div>
            </div>

            {/* Arama Çıktıları Dağılım Çubukları */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>Arama Sonuçları Dağılımı ({totalCalls} Toplam Arama)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ekibin yaptığı tüm görüşmelerin kategori bazlı ağırlığı ve dönüşümü.
                </p>

                <div className="mt-5 space-y-3">
                  {[
                    { label: '🤝 Yüz Yüze Randevu (Saha)', count: outcomeDist.randevu || 0, color: 'bg-purple-600', textColor: 'text-purple-700' },
                    { label: '⏰ Arama Randevusu (Geri Ara)', count: outcomeDist.randevu_arama || 0, color: 'bg-amber-500', textColor: 'text-amber-700' },
                    { label: '🎉 Satış / Satış Havuzu', count: outcomeDist.satis_havuzu || 0, color: 'bg-emerald-600', textColor: 'text-emerald-700' },
                    { label: '📵 İletişimsiz (Ulaşılamadı)', count: outcomeDist.iletisimsiz || 0, color: 'bg-orange-500', textColor: 'text-orange-700' },
                    { label: '❌ Mutlak Olumsuz', count: outcomeDist.mutlak_olumsuz || 0, color: 'bg-rose-500', textColor: 'text-rose-700' },
                  ].map(item => {
                    const percent = totalCalls > 0 ? Math.round((item.count / totalCalls) * 100) : 0;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-slate-700">{item.label}</span>
                          <span className="font-black text-slate-900">
                            {item.count} adet <span className={`${item.textColor} text-[11px]`}>({percent}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`${item.color} h-full rounded-full transition-all duration-700`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Olumlu Dönüşüm Toplamı: <strong className="text-emerald-700 font-extrabold">{((outcomeDist.randevu || 0) + (outcomeDist.randevu_arama || 0) + (outcomeDist.satis_havuzu || 0))} adet</strong></span>
                <span>Ulaşılamama Oranı: <strong className="text-orange-700 font-extrabold">%{totalCalls > 0 ? Math.round(((outcomeDist.iletisimsiz || 0) / totalCalls) * 100) : 0}</strong></span>
              </div>
            </div>

          </div>

          {/* Son Kapanan 5 Satış Tablosu Önizleme */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>Sahada Kapanan Son İşler & Ciro Akışı</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Yiğit ve saha ekibinin işletmelerde gerçekleştirdiği son satışlar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('sold_jobs')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
              >
                <span>Tümünü Gör ({soldJobs.length}) →</span>
              </button>
            </div>

            {soldJobs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Seçilen tarih aralığında henüz sahada kapanmış bir satış bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50/60">
                      <th className="py-2.5 px-3">İşletme Adı</th>
                      <th className="py-2.5 px-3">Bölge & Kategori</th>
                      <th className="py-2.5 px-3">Satılan Hizmet / Ürün</th>
                      <th className="py-2.5 px-3">Tutar</th>
                      <th className="py-2.5 px-3">Saha Personeli</th>
                      <th className="py-2.5 px-3">Randevuyu Alan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {soldJobs.slice(0, 5).map(job => (
                      <tr key={job.lead_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-extrabold text-slate-900">
                          {job.lead_name}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <span className="font-bold">{job.district || 'Samsun'}</span>
                          {job.category && <span className="text-[11px] text-slate-400 block">{job.category}</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className="bg-purple-100 text-purple-900 font-extrabold text-[11px] px-2 py-0.5 rounded-lg inline-block">
                            {job.sold_services || 'Hizmet Paketi'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-black text-emerald-700 text-sm">
                          {Number(job.total_sale_price || 0) > 0 ? `${Number(job.total_sale_price).toLocaleString('tr-TR')} TL` : 'Teklif Aşamasında'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          🚗 {job.field_member_name || 'Yiğit dalkılıç'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-600">
                          📞 {job.assigned_caller_name || 'Bahar'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* SEKMELER: 2. SOĞUK ARAMA PERSONEL KARNESİ (Bahar & Aslı) */}
      {/* ========================================================= */}
      {activeSubTab === 'callers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-blue-600" />
                <span>Soğuk Arama Ekibi Performans Detayı</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bahar, Aslı ve soğuk arama yapan personellerin arama adetleri, aldıkları yüz yüze randevular ve geri arama dönüşümleri.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50/80">
                    <th className="py-3 px-3.5">Personel</th>
                    <th className="py-3 px-3.5 text-center">Rol</th>
                    <th className="py-3 px-3.5 text-center">Toplam Arama</th>
                    <th className="py-3 px-3.5 text-center">🤝 Yüz Yüze Randevu</th>
                    <th className="py-3 px-3.5 text-center">⏰ Geri Arama</th>
                    <th className="py-3 px-3.5 text-center">🎉 Satış Havuzu</th>
                    <th className="py-3 px-3.5 text-center">📵 İletişimsiz</th>
                    <th className="py-3 px-3.5 text-center">❌ Olumsuz</th>
                    <th className="py-3 px-3.5 text-right">Başarı Oranı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {coldCallers.map((caller, idx) => (
                    <tr key={caller.name} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-xs shadow-2xs">
                            {caller.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 block capitalize">{caller.name}</span>
                            {caller.is_primary && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded">
                                ⭐ Soğuk Arama Öncelikli
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 text-center text-slate-600 font-bold text-[11px]">
                        {caller.role}
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-black text-slate-900 text-sm">
                        {caller.total_calls}
                      </td>
                      <td className="py-3.5 px-3.5 text-center">
                        <span className="bg-purple-100 text-purple-900 font-black px-2.5 py-1 rounded-xl text-xs">
                          {caller.randevu_count}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-extrabold text-amber-800">
                        {caller.recall_count}
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-extrabold text-emerald-700">
                        {caller.sales_pool_count}
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-extrabold text-orange-700">
                        {caller.unreachable_count}
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-extrabold text-rose-700">
                        {caller.negative_count}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-black text-sm">
                        <span className={`px-2.5 py-1 rounded-xl ${
                          caller.success_rate >= 25 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : caller.success_rate >= 15 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          %{caller.success_rate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKMELER: 3. SAHA SATIŞ EKİBİ (Yiğit) */}
      {/* ========================================================= */}
      {activeSubTab === 'field' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <span>Saha Satış Ekibi Ziyaret & Kapanış Karnesi</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Yiğit ve saha satış personellerinin yüz yüze ziyaret sayıları, olumlu satışa dönüşüm ve ciro oranları.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fieldStaff.map(staff => (
                <div key={staff.name} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center text-sm shadow-md">
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{staff.name}</h4>
                        <span className="text-[11px] text-emerald-800 font-extrabold">{staff.role}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">Kapanış Oranı</span>
                      <span className="text-lg font-black text-emerald-700">%{staff.closing_rate}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-bold">Toplam Ziyaret</span>
                      <strong className="text-sm font-black text-slate-800">{staff.total_visits}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-emerald-600 block font-bold">Kapanan Satış</span>
                      <strong className="text-sm font-black text-emerald-700">{staff.positive_sales}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-rose-600 block font-bold">Olumsuz Ziyaret</span>
                      <strong className="text-sm font-black text-rose-700">{staff.negative_visits}</strong>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Toplam Üretilen Ciro:</span>
                    <strong className="text-sm font-black text-emerald-800">
                      {staff.total_revenue.toLocaleString('tr-TR')} TL
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKMELER: 4. SAHADA SATILAN İŞLER & NE SATILDI */}
      {/* ========================================================= */}
      {activeSubTab === 'sold_jobs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>Sahada Satılan İşler & Ciro Detayı</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Yiğit'in sahada bağladığı işler, satılan paketler ve cirolar.
                </p>
              </div>

              {/* Arama Inputu */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="İşletme, ilçe veya hizmet ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-semibold text-slate-800"
                />
              </div>
            </div>

            {filteredSoldJobs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Arama kriterlerine uygun satılmış iş kaydı bulunamadı.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50/80">
                      <th className="py-3 px-3">İşletme Adı</th>
                      <th className="py-3 px-3">İlçe & Sektör</th>
                      <th className="py-3 px-3">Satılan Hizmet / Ürün</th>
                      <th className="py-3 px-3">Ciro Tutarı</th>
                      <th className="py-3 px-3">Satışı Kapatan</th>
                      <th className="py-3 px-3">Randevuyu Alan</th>
                      <th className="py-3 px-3">Son Not</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredSoldJobs.map(job => (
                      <tr key={job.lead_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-extrabold text-slate-900">
                          {job.lead_name}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <span className="font-bold">{job.district || 'Samsun'}</span>
                          {job.category && <span className="text-[11px] text-slate-400 block">{job.category}</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className="bg-purple-100 text-purple-900 font-black text-[11px] px-2.5 py-1 rounded-lg inline-block">
                            {job.sold_services || 'Hizmet Paketi'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-black text-emerald-700 text-sm">
                          {Number(job.total_sale_price || 0) > 0 ? `${Number(job.total_sale_price).toLocaleString('tr-TR')} TL` : 'Teklif Verildi'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          🚗 {job.field_member_name || 'Yiğit dalkılıç'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-600">
                          📞 {job.assigned_caller_name || 'Bahar'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-xs truncate text-[11px]">
                          {job.call_notes ? job.call_notes.split('\n').pop() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKMELER: 5. KIRMIZI BAYRAKLAR & KAÇAK ALARMLARI */}
      {/* ========================================================= */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-6">
          
          {/* Saati Geçen / Unutulan Geri Aramalar */}
          <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Geciken / Saati Geçmiş Geri Aramalar ({overdueRecalls.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Müşterinin "öğleden sonra ara" dediği veya randevu saati geçmiş olmasına rağmen henüz aranmamış işletmeler.
                </p>
              </div>
            </div>

            {overdueRecalls.length === 0 ? (
              <div className="text-center py-8 text-emerald-600 text-xs font-bold bg-emerald-50/60 rounded-2xl border border-emerald-200">
                ✅ Harika! Şu an saati geçmiş veya unutulmuş hiçbir arama bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-rose-100 text-[11px] font-black uppercase tracking-wider text-rose-700 bg-rose-50/60">
                      <th className="py-2.5 px-3">İşletme Adı</th>
                      <th className="py-2.5 px-3">Telefon</th>
                      <th className="py-2.5 px-3">İlçe</th>
                      <th className="py-2.5 px-3">Planlanan Tarih & Saat</th>
                      <th className="py-2.5 px-3">Atanan Personel</th>
                      <th className="py-2.5 px-3">Son Görüşme Notu</th>
                      <th className="py-2.5 px-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 text-xs">
                    {overdueRecalls.map(item => (
                      <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="py-3 px-3 font-extrabold text-slate-900">{item.name}</td>
                        <td className="py-3 px-3 font-bold text-slate-700">{item.phone}</td>
                        <td className="py-3 px-3 text-slate-600">{item.district || 'Samsun'}</td>
                        <td className="py-3 px-3">
                          <span className="bg-rose-100 text-rose-800 font-extrabold text-[11px] px-2 py-0.5 rounded-md inline-block">
                            ⏰ {item.recall_date} {item.recall_time || 'Günü Geçmiş'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700">{item.assigned_caller_name || 'Bahar'}</td>
                        <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                          {item.call_notes ? item.call_notes.split('\n').pop() : '-'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenLeadInCallQueue) {
                                onOpenLeadInCallQueue(item.id);
                              } else if (onNavigateToTab) {
                                onNavigateToTab('calls');
                              }
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Hemen Ara
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* İletişimsiz Kalmış Mobil Hatlı İşletmeler */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PhoneOff className="w-5 h-5 text-orange-600" />
                <span>Kurtarma Havuzu: İletişimsiz Kalmış Mobil Hatlar ({unreachableRecovery.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cep telefonu olan ancak ulaşılamadığı için havuzda bekleyen potansiyel işletmeler.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3">İşletme Adı</th>
                    <th className="py-2.5 px-3">Telefon</th>
                    <th className="py-2.5 px-3">İlçe</th>
                    <th className="py-2.5 px-3">Arama Sayısı</th>
                    <th className="py-2.5 px-3">Son Arama</th>
                    <th className="py-2.5 px-3">Personel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unreachableRecovery.slice(0, 10).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{u.name}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{u.phone}</td>
                      <td className="py-2.5 px-3 text-slate-600">{u.district || 'Samsun'}</td>
                      <td className="py-2.5 px-3 font-bold text-orange-700">{u.call_count} kez arandı</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{u.last_called_at || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-semibold">{u.assigned_caller_name || 'Bahar'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* SEKMELER: 6. GÜN SONU YÖNETİCİ BRİFİNGİ */}
      {/* ========================================================= */}
      {activeSubTab === 'briefing' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Copy className="w-5 h-5 text-emerald-600" />
                <span>Gün Sonu Yönetici Brifingi (WhatsApp Şablonu)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tek tıkla panoya kopyalayıp şirket WhatsApp grubuna veya patrona gönderebileceğiniz özet rapor.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyBriefing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              {copiedBriefing ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedBriefing ? 'Panoya Kopyalandı! ✅' : 'WhatsApp İçin Kopyala'}</span>
            </button>
          </div>

          <pre className="bg-slate-900 text-slate-100 p-5 rounded-2xl text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap border border-slate-800 shadow-inner">
            {data?.daily_briefing || 'Brifing oluşturuluyor...'}
          </pre>
        </div>
      )}

      {/* SAHA RANDEVULARI DETAY MODALI (BUGÜN + GEÇMİŞTEN KALANLAR) */}
      {showVisitsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Başlığı */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <MapPin className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black">
                    Saha Randevuları & Ziyaret Listesi
                  </h3>
                  <p className="text-xs text-emerald-200/80">
                    Bugün için planlanan ve geçmişten kapatılmayı bekleyen tüm randevular
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVisitsModal(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal İçeriği */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              
              {/* Bölüm A: Bugün Planlananlar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>📍 Bugün Ziyaret Edilecek İşletmeler ({pulse.today_field_visits_list?.length || 0})</span>
                  </h4>
                  <span className="text-xs font-bold text-emerald-700">Tarih: {data?.start_date || 'Bugün'}</span>
                </div>

                {(!pulse.today_field_visits_list || pulse.today_field_visits_list.length === 0) ? (
                  <div className="text-xs text-slate-500 bg-slate-50 rounded-2xl p-4 text-center border border-slate-200">
                    Bugün için kayıtlı yüz yüze randevu bulunmuyor.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pulse.today_field_visits_list.map(v => (
                      <div key={v.id} className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 space-y-2 hover:border-emerald-300 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-black text-sm text-slate-900">{v.name}</h5>
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                            {v.visit_date ? v.visit_date.slice(11, 16) : 'Saat Yok'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{v.district || 'Samsun'} • {v.address || 'Adres belirtilmemiş'}</p>
                        <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">🚗 {v.field_member_name || 'Yiğit dalkılıç'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowVisitsModal(false);
                              if (onOpenLeadInCallQueue) onOpenLeadInCallQueue(v.id);
                              else if (onNavigateToTab) onNavigateToTab('field_route');
                            }}
                            className="text-xs font-black text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                          >
                            Detayı Aç →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bölüm B: Geçmiş Günlerden Kalan Henüz Kapatılmamış Randevular */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>⚠️ Geçmiş Günlerden Kalan Ziyaret Bekleyenler ({pulse.overdue_field_visits_list?.length || 0})</span>
                  </h4>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Saha ekibinin kapatması gerekenler
                  </span>
                </div>

                {(!pulse.overdue_field_visits_list || pulse.overdue_field_visits_list.length === 0) ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-200 font-bold">
                    ✅ Harika! Geçmişten kalan kapatılmamış hiçbir randevu yok.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50">
                          <th className="py-2.5 px-3">İşletme Adı</th>
                          <th className="py-2.5 px-3">Bölge</th>
                          <th className="py-2.5 px-3">Planlanan Tarih</th>
                          <th className="py-2.5 px-3">Saha Personeli</th>
                          <th className="py-2.5 px-3 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pulse.overdue_field_visits_list.map(v => (
                          <tr key={v.id} className="hover:bg-amber-50/50 transition-colors">
                            <td className="py-2.5 px-3 font-extrabold text-slate-900">{v.name}</td>
                            <td className="py-2.5 px-3 text-slate-600">{v.district || 'Samsun'}</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-rose-100 text-rose-800 font-bold text-[10px] px-2 py-0.5 rounded-md">
                                {v.visit_date ? v.visit_date.replace('T', ' ') : 'Tarih Yok'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              🚗 {v.field_member_name || 'Yiğit dalkılıç'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowVisitsModal(false);
                                  if (onOpenLeadInCallQueue) onOpenLeadInCallQueue(v.id);
                                  else if (onNavigateToTab) onNavigateToTab('field_route');
                                }}
                                className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                İncele
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Alt Çubuk */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Toplam Aktif Randevu: <strong>{pulse.total_active_field_visits || (pulse.today_field_visits_total + (pulse.overdue_field_visits_total || 0))}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowVisitsModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
