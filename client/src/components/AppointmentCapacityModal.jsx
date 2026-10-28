import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  PhoneCall,
  Users,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';

export default function AppointmentCapacityModal({
  isOpen,
  onClose,
  capacityData,
  onSelectDate,
  selectedVisitDate
}) {
  const [expandedDate, setExpandedDate] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [viewOnlyMine, setViewOnlyMine] = useState(false);

  if (!isOpen) return null;

  const todayStats = capacityData?.today_stats || {};
  const tomorrowStats = capacityData?.tomorrow_stats || {};
  const days = capacityData?.days || [];
  const firstAvailableDate = capacityData?.first_available_date;
  const DAILY_QUOTA = capacityData?.daily_quota || 20;

  const toggleExpand = (dateStr) => {
    setExpandedDate(prev => (prev === dateStr ? null : dateStr));
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}.${m}.${y}`;
    } catch {
      return dateStr;
    }
  };

  const filteredDays = days.map(day => {
    let appts = day.appointments || [];
    if (viewOnlyMine) {
      appts = appts.filter(a => a.is_mine);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      appts = appts.filter(
        a =>
          (a.name || '').toLowerCase().includes(q) ||
          (a.district || '').toLowerCase().includes(q) ||
          (a.assigned_caller_name || '').toLowerCase().includes(q) ||
          (a.field_member_name || '').toLowerCase().includes(q)
      );
    }
    return {
      ...day,
      appointments: appts
    };
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Üst Başlık Banner */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  🤝 Yüz Yüze Randevu (Ziyaret) Kotası
                </span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  Maks. {DAILY_QUOTA} Randevu / Gün (2 Saha Personeli)
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                Günlük Randevu Doluluk & Personel Kontenjan Takvimi
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                2 saha personeli kapasitesine göre sonraki gün için toplam randevu sayısı <strong>{DAILY_QUOTA}'ye ulaştığında</strong> kota dolar ve randevuların bir sonraki müsait güne alınması gerekir.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 3'lü Hızlı İstatistik Kartları (Kişisel vs Ekip Ayrımı) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
            {/* 1. Bugün Yapılan Arama Sayısı */}
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3">
              <div className="text-[10px] font-extrabold text-blue-200 uppercase tracking-wider flex items-center justify-between">
                <span>Bugün Yaptığım Arama</span>
                <PhoneCall className="w-3.5 h-3.5 text-blue-300" />
              </div>
              <div className="text-xl font-black text-white mt-1">
                {todayStats.calls_caller ?? 0}
                <span className="text-xs font-normal text-slate-300 ml-1.5">
                  (Ekip Toplamı: {todayStats.calls_total ?? 0})
                </span>
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">
                Bugün sisteme girdiğiniz çağrılar
              </div>
            </div>

            {/* 2. Bugün Aldığım Yüzyüze Randevu Sayısı */}
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3">
              <div className="text-[10px] font-extrabold text-purple-200 uppercase tracking-wider flex items-center justify-between">
                <span>Bugün Aldığım Randevu</span>
                <Calendar className="w-3.5 h-3.5 text-purple-300" />
              </div>
              <div className="text-xl font-black text-purple-200 mt-1">
                {todayStats.visit_appointments_caller ?? 0}
                <span className="text-xs font-normal text-purple-300/80 ml-1.5">
                  (Ekip Toplamı: {todayStats.visit_appointments_total ?? 0})
                </span>
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">
                Bugün bağladığınız ziyaret randevuları
              </div>
            </div>

            {/* 3. Yarının Durumu */}
            <div
              className={`rounded-2xl p-3 border backdrop-blur-xs ${
                tomorrowStats.is_full
                  ? 'bg-rose-500/20 border-rose-400/50 text-white'
                  : (tomorrowStats.count || 0) >= 15
                  ? 'bg-amber-500/20 border-amber-400/50 text-white'
                  : 'bg-emerald-500/20 border-emerald-400/50 text-white'
              }`}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-between">
                <span>Yarınki Randevu Yükü</span>
                {tomorrowStats.is_full ? (
                  <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded">
                    KOTA DOLDU (20/20)
                  </span>
                ) : (
                  <span className="bg-emerald-500/40 text-emerald-100 text-[9px] font-black px-1.5 py-0.2 rounded">
                    MÜSAİT
                  </span>
                )}
              </div>
              <div className="text-xl font-black mt-1">
                {tomorrowStats.count ?? 0} / {DAILY_QUOTA} Randevu
                <span className="text-xs font-normal text-slate-200 ml-1.5">
                  (Sizin: {tomorrowStats.caller_count ?? 0})
                </span>
              </div>
              <div className="text-[10px] text-slate-200 mt-0.5">
                {tomorrowStats.is_full
                  ? `⚠️ Dolu! Randevuları sonraki güne (${formatShortDate(firstAvailableDate)}) aktarın.`
                  : `${tomorrowStats.remaining_quota ?? DAILY_QUOTA} kontenjan boş (Sizin aldığınız: ${tomorrowStats.caller_count ?? 0}).`}
              </div>
            </div>
          </div>
        </div>

        {/* Ara Arama, Filtre & Personel Görünümü Çubuğu */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Görünüm Filtresi: Tüm Ekip vs Sadece Benim */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewOnlyMine(false)}
                className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  !viewOnlyMine
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                👥 Tüm Ekip Randevuları
              </button>
              <button
                type="button"
                onClick={() => setViewOnlyMine(true)}
                className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  viewOnlyMine
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Sadece Benim Aldığım Randevular</span>
              </button>
            </div>

            {firstAvailableDate && (
              <span className="bg-indigo-100 text-indigo-800 text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-indigo-200">
                ⚡ İlk Müsait Gün: {formatShortDate(firstAvailableDate)}
              </span>
            )}
          </div>

          <div className="w-full sm:w-60">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="İşletme, ilçe veya personel..."
              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>

        {/* Gün Kartları Listesi (Scrollable) */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
          {filteredDays.map((day) => {
            const isFull = day.is_full;
            const count = day.count || 0;
            const myCount = day.caller_count || 0;
            const remaining = day.remaining_quota;
            const isExpanded = expandedDate === day.date;
            const isTargetDaySelected =
              selectedVisitDate && selectedVisitDate.slice(0, 10) === day.date;

            const breakdown = day.caller_breakdown || {};

            return (
              <div
                key={day.date}
                className={`rounded-2xl border transition-all ${
                  isTargetDaySelected
                    ? 'ring-2 ring-purple-600 border-purple-400 bg-purple-50/20'
                    : isFull
                    ? 'bg-rose-50/30 border-rose-200'
                    : count >= 15
                    ? 'bg-amber-50/20 border-amber-200'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Gün Kartı Başlığı */}
                <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center text-center font-bold shrink-0 shadow-2xs ${
                        isFull
                          ? 'bg-rose-600 text-white'
                          : count >= 15
                          ? 'bg-amber-500 text-white'
                          : 'bg-purple-100 text-purple-900 border border-purple-200'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase leading-none">
                        {day.date.split('-')[1]}/{day.date.split('-')[2]}
                      </span>
                      <span className="text-xs font-black leading-none mt-0.5">
                        {day.day_name.slice(0, 3)}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900">
                          {formatShortDate(day.date)} • {day.day_name}
                        </span>
                        {day.label === 'Bugün' && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.2 rounded-full">
                            Bugün
                          </span>
                        )}
                        {day.label === 'Yarın' && (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.2 rounded-full">
                            Yarın
                          </span>
                        )}
                        {isFull ? (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.2 rounded-md border border-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>20/20 DOLU (KOTA DOLDU)</span>
                          </span>
                        ) : count >= 15 ? (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.2 rounded-md border border-amber-300">
                            {count}/20 Yoğun ({remaining} Boş)
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.2 rounded-md border border-emerald-300">
                            {count}/20 Müsait ({remaining} Boş Kontenjan)
                          </span>
                        )}

                        {/* Personelin Kendi Aldığı Randevu Sayısı Rozeti */}
                        <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-extrabold px-2 py-0.2 rounded-md">
                          👤 Sizin Aldığınız: {myCount} Randevu
                        </span>
                      </div>

                      {/* Doluluk İlerleme Çubuğu */}
                      <div className="flex items-center gap-2 mt-2 w-full sm:w-72">
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFull
                                ? 'bg-rose-600'
                                : count >= 15
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${day.percent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 shrink-0">
                          {count}/{DAILY_QUOTA} (%{day.percent})
                        </span>
                      </div>

                      {/* Personel Dağılım Rozetleri */}
                      {Object.keys(breakdown).length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Dağılım:</span>
                          {Object.entries(breakdown).map(([cName, cCount]) => (
                            <span
                              key={cName}
                              className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-1.5 py-0.2 rounded"
                            >
                              {cName}: <strong>{cCount}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Butonlar & Aksiyonlar */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                    {onSelectDate && (
                      <button
                        type="button"
                        disabled={isFull}
                        onClick={() => onSelectDate(`${day.date}T14:00`)}
                        className={`text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                          isFull
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        <span>{isFull ? 'Kota Dolu' : 'Bu Günü Seç (14:00)'}</span>
                        {!isFull && <ArrowRight className="w-3 h-3" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(day.date)}
                      className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                      title="Randevuları Göster / Gizle"
                    >
                      <span>{day.appointments?.length || 0} Randevu</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Açılır Randevu Detay Listesi */}
                {isExpanded && (
                  <div className="p-3 pt-0 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                    {(!day.appointments || day.appointments.length === 0) ? (
                      <div className="py-4 text-center text-xs text-slate-400 italic">
                        {viewOnlyMine
                          ? 'Bu gün için sizin aldığınız kayıtlı bir randevu bulunmuyor.'
                          : `Bu gün için henüz kayıtlı yüz yüze randevu bulunmuyor (${DAILY_QUOTA} kontenjanın tümü boş).`}
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {day.appointments.map((appt, idx) => {
                          const timeStr = appt.visit_date
                            ? appt.visit_date.slice(11, 16)
                            : 'Saat Belirtilmedi';

                          return (
                            <div
                              key={appt.id || idx}
                              className={`border rounded-xl p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs transition-colors ${
                                appt.is_mine
                                  ? 'bg-purple-50/70 border-purple-300'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-slate-900">
                                    {appt.name}
                                  </span>
                                  <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                                    ⏰ {timeStr}
                                  </span>
                                  {appt.district && (
                                    <span className="text-slate-500 text-[11px]">
                                      • {appt.district}
                                    </span>
                                  )}
                                  {appt.is_mine && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.2 rounded-full border border-emerald-300">
                                      ⭐ Sizin Randevunuz
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
                                  <span>
                                    🎧 Arayan: <strong>{appt.caller_name || appt.assigned_caller_name || 'Operatör'}</strong>
                                  </span>
                                  <span>
                                    🚗 Saha: <strong>{appt.field_member_name || 'Atanmadı'}</strong>
                                  </span>
                                  {appt.phone && (
                                    <span className="text-slate-400 font-mono">
                                      📞 {appt.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Alt Çubuk */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Kural: 2 saha personeli için günlük toplam kota {DAILY_QUOTA}'dir. 20 randevuya ulaşıldığında randevular takip eden sonraki günlere verilir.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-2xs"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
