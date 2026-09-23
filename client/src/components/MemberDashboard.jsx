import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  PhoneCall,
  MessageSquare, 
  Briefcase, 
  Layers, 
  ExternalLink,
  MapPin,
  Star,
  Smartphone,
  FileText,
  RotateCcw,
  CheckCircle,
  XCircle,
  PhoneOff,
  Sparkles
} from 'lucide-react';
import InstagramIcon from './InstagramIcon';
import { getJobs, updateJob, getLeads, recordCall } from '../api';

export default function MemberDashboard({ currentUser, teamMembers = [], authUser, onJobUpdated }) {
  const [activeMember, setActiveMember] = useState(currentUser || (teamMembers[0] || null));
  const [viewMode, setViewMode] = useState('calls'); // 'calls' | 'jobs'
  
  // İşler (Jobs) State
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Arama Görevleri (Leads) State
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [activeCallTab, setActiveCallTab] = useState('arama_listesi'); // 'arama_listesi' | 'randevu_arama' | 'randevu' | 'iletisimsiz' | 'mutlak_olumsuz' | 'all'
  const [leadStats, setLeadStats] = useState(null);

  // Çağrı Karar Modalı
  const [activeCallModal, setActiveCallModal] = useState(null);
  const [callNotes, setCallNotes] = useState('');
  const [recallDate, setRecallDate] = useState('');
  const [recallTime, setRecallTime] = useState('14:00');
  const [visitDate, setVisitDate] = useState('');
  const [modalScore, setModalScore] = useState(0);
  const [submittingCall, setSubmittingCall] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  useEffect(() => {
    if (currentUser) {
      setActiveMember(currentUser);
    }
  }, [currentUser]);

  // Eğer personelin rolü soğuk arama/çağrı ise varsayılan arama ekranı olsun
  useEffect(() => {
    if (activeMember) {
      const isCaller = /arama|satış|satis|çağrı|cagri/i.test(activeMember.role || '');
      if (isCaller) {
        setViewMode('calls');
      }
    }
  }, [activeMember]);

  // Personelin İşlerini Yükle
  const loadMemberJobs = async () => {
    if (!activeMember) return;
    setLoadingJobs(true);
    try {
      const res = await getJobs({ member_id: activeMember.id });
      setJobs(res.data || []);
    } catch (err) {
      console.error('Görevler yüklenirken hata:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Personelin Çağrı / Aday İşletmelerini Yükle
  const loadMemberLeads = async () => {
    if (!activeMember) return;
    setLoadingLeads(true);
    try {
      const res = await getLeads({
        assigned_caller_id: activeMember.id,
        status: activeCallTab === 'all' ? undefined : activeCallTab,
        limit: 300
      });
      setLeads(res.data || []);
      if (res.stats) {
        setLeadStats(res.stats);
      }
    } catch (err) {
      console.error('Personel adayları yüklenirken hata:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'jobs') {
      loadMemberJobs();
    } else {
      loadMemberLeads();
    }
  }, [activeMember, viewMode, activeCallTab]);

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await updateJob(jobId, { status: newStatus });
      loadMemberJobs();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      alert(`Güncelleme hatası: ${err.message}`);
    }
  };

  // Modal Açma
  const openCallModal = (lead) => {
    setActiveCallModal(lead);
    setCallNotes('');
    setRecallDate(lead.recall_date || '');
    setRecallTime(lead.recall_time || '14:00');
    setVisitDate(lead.visit_date || '');
    setModalScore(lead.score || 0);
  };

  // Çağrı Kararını Kaydetme
  const handleCallOutcomeSubmit = async (outcome) => {
    if (!activeCallModal) return;

    if (outcome === 'randevu' && !visitDate) {
      alert('Lütfen randevu / ziyaret tarihi ve saatini belirleyiniz.');
      return;
    }

    if (outcome === 'randevu_arama' && !recallDate) {
      alert('Lütfen tekrar aranacak tarihi seçiniz.');
      return;
    }

    setSubmittingCall(true);
    try {
      const activeCallerName = authUser?.name || activeMember?.name || 'Personel';
      await recordCall(activeCallModal.id, {
        outcome,
        notes: callNotes,
        caller_name: activeCallerName,
        visit_date: visitDate || null,
        recall_date: recallDate || null,
        recall_time: recallTime || null,
        score: modalScore || 0
      });

      setActionSuccessMsg(`Arama sonucu '${outcome}' olarak başarıyla kaydedildi.`);
      setActiveCallModal(null);
      setCallNotes('');
      setRecallDate('');
      setRecallTime('14:00');
      setVisitDate('');
      setModalScore(0);
      loadMemberLeads();
      if (onJobUpdated) onJobUpdated();

      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err) {
      alert(`Kayıt hatası: ${err.message}`);
    } finally {
      setSubmittingCall(false);
    }
  };

  // Google Calendar ve .ics dışa aktarma fonksiyonları
  const addToGoogleCalendar = (job) => {
    if (!job.due_date) return;
    const start = job.due_date.replace(/-/g, '');
    const d = new Date(job.due_date);
    d.setDate(d.getDate() + 1);
    const end = d.toISOString().slice(0, 10).replace(/-/g, '');
    const title = encodeURIComponent(`${job.lead_name} — ${job.title}`);
    const details = encodeURIComponent(`PowerPartner İş Ataması\nMüşteri: ${job.lead_name}\nTelefon: ${job.lead_phone || 'Yok'}\nGörev: ${job.title}\nKategori: ${job.category_name}\nSorumlu: ${activeMember?.name}`);
    const location = encodeURIComponent(job.lead_district || '');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
    window.open(url, '_blank');
  };

  const downloadMemberICS = () => {
    const activeWithDate = jobs.filter(j => j.status !== 'tamamlandi' && j.due_date);
    if (!activeWithDate.length) {
      alert('Tarihi belirlenmiş aktif iş bulunamadı.');
      return;
    }

    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PowerPartner//CRM//TR\r\nCALSCALE:GREGORIAN\r\n';
    activeWithDate.forEach(j => {
      const dt = j.due_date.replace(/-/g, '');
      const d = new Date(j.due_date);
      d.setDate(d.getDate() + 1);
      const dtEnd = d.toISOString().slice(0, 10).replace(/-/g, '');
      const desc = `PowerPartner Gorev: ${j.title}. Musteri: ${j.lead_name} Tel: ${j.lead_phone || ''} Kategori: ${j.category_name}`.replace(/[\r\n]+/g, ' ');
      ics += `BEGIN:VEVENT\r\nUID:${j.id}@powerpartner\r\nDTSTAMP:${new Date().toISOString().slice(0, 10).replace(/-/g, '')}T000000Z\r\n`;
      ics += `DTSTART;VALUE=DATE:${dt}\r\nDTEND;VALUE=DATE:${dtEnd}\r\n`;
      ics += `SUMMARY:${j.lead_name} — ${j.title}\r\n`;
      ics += `DESCRIPTION:${desc}\r\nEND:VEVENT\r\n`;
    });
    ics += 'END:VCALENDAR';

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `powerpartner-${(activeMember?.name || 'takvim').toLowerCase()}-gorevler.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeJobs = jobs.filter(j => j.status !== 'tamamlandi');
  const completedJobs = jobs.filter(j => j.status === 'tamamlandi');

  // Bugün aranacak randevu sayısı
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecallCount = leads.filter(l => l.status === 'randevu_arama' && l.recall_date && l.recall_date <= todayStr).length;

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
      
      {/* ÜST BİLGİ & RESPONSIVE PERSONEL SEÇİCİ KART */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4 w-full min-w-0 max-w-full">
        
        {/* Karşılama ve Profil Bilgisi */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="w-12 h-12 rounded-2xl text-white font-extrabold text-lg flex items-center justify-center shadow-md shrink-0"
              style={{ backgroundColor: activeMember?.color || '#2563eb' }}
            >
              {activeMember?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                  {activeMember?.name} Ekranı
                </h1>
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200 shrink-0">
                  {activeMember?.role || 'Personel'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {viewMode === 'calls' ? 'Üzerinize atanan arama adayları ve planlanan arama randevuları' : 'Teslimat bekleyen işler ve kişisel takvim görünümü'}
              </p>
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {viewMode === 'jobs' && activeJobs.some(j => j.due_date) && (
              <button
                type="button"
                onClick={downloadMemberICS}
                className="text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Tüm iş teslim tarihlerini iCal (.ics) formatında indir"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Takvimi İndir (.ics)</span>
              </button>
            )}
          </div>
        </div>

        {/* RESPONSİVE EKİP ÜYELERİ KAYDIRMA ÇUBUĞU (iPhone SE ve Küçük Ekranlarda Kesilmez) */}
        <div className="pt-3 border-t border-slate-100 w-full min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              Personel Seçimi & Görünümü:
            </span>
            <span className="text-[10px] text-slate-400 font-medium sm:hidden">
              ← Sağa kaydırın →
            </span>
          </div>

          <div className="w-full min-w-0 overflow-x-auto pb-2 scrollbar-thin touch-pan-x flex items-center gap-2">
            {teamMembers.map(m => {
              const isSelected = activeMember?.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMember(m)}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all shrink-0 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? '#ffffff' : (m.color || '#3b82f6') }}
                  />
                  <span>{m.name}</span>
                  {m.role && (
                    <span className={`text-[10px] font-normal px-1.5 py-0.2 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {m.role}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* BAŞARI BİLDİRİMİ */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ANA GÖRÜNÜM DEĞİŞTİRİCİ: ARAMA GÖREVLERİM vs İŞ & TESLİMATLAR */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex items-center gap-1.5 w-full max-w-lg">
        <button
          type="button"
          onClick={() => setViewMode('calls')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            viewMode === 'calls'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>Arama Görevlerim</span>
          {todayRecallCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
              ⏰ {todayRecallCount} Acil
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setViewMode('jobs')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            viewMode === 'jobs'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>İş & Teslimat Görevleri</span>
          {activeJobs.length > 0 && (
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {activeJobs.length}
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. MOD: ÇAĞRI VE ARAMA GÖREVLERİ (6 ADET TALEP EDİLEN BÖLÜM) */}
      {/* ======================================================== */}
      {viewMode === 'calls' && (
        <div className="space-y-4">
          
          {/* 6 ADET ALT BÖLÜM SEKMESİ */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                Arama Kuyruğu Bölümleri (6 Kategori):
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {activeMember?.name} Arama Masası
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              
              {/* 1. Arama Bekleyenler */}
              <button
                type="button"
                onClick={() => setActiveCallTab('arama_listesi')}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCallTab === 'arama_listesi'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Arama Bekleyenler</span>
                {leadStats?.in_queue !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCallTab === 'arama_listesi' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {leadStats.in_queue}
                  </span>
                )}
              </button>

              {/* 2. Randevu Alınanlar (Arama) - Özel Saat Uyarı Rozetli */}
              <button
                type="button"
                onClick={() => setActiveCallTab('randevu_arama')}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCallTab === 'randevu_arama'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Randevu Alınanlar (Arama)</span>
                {todayRecallCount > 0 ? (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                    🔥 {todayRecallCount} Bugün!
                  </span>
                ) : leadStats?.randevu_arama ? (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCallTab === 'randevu_arama' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {leadStats.randevu_arama}
                  </span>
                ) : null}
              </button>

              {/* 3. Randevu Alınanlar (Ziyaret) */}
              <button
                type="button"
                onClick={() => setActiveCallTab('randevu')}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCallTab === 'randevu'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Randevu Alınanlar (Ziyaret)</span>
                {leadStats?.randevu !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCallTab === 'randevu' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {leadStats.randevu}
                  </span>
                )}
              </button>

              {/* 4. İletişimsizler */}
              <button
                type="button"
                onClick={() => setActiveCallTab('iletisimsiz')}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCallTab === 'iletisimsiz'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>İletişimsizler</span>
                {leadStats?.iletisimsiz !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCallTab === 'iletisimsiz' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {leadStats.iletisimsiz}
                  </span>
                )}
              </button>

              {/* 5. Olumsuz */}
              <button
                type="button"
                onClick={() => setActiveCallTab('mutlak_olumsuz')}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCallTab === 'mutlak_olumsuz'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Olumsuz</span>
                {leadStats?.mutlak_olumsuz !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCallTab === 'mutlak_olumsuz' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {leadStats.mutlak_olumsuz}
                  </span>
                )}
              </button>

              {/* 6. Tümü */}
              <button
                type="button"
                onClick={() => setActiveCallTab('all')}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCallTab === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Tümü</span>
                {leadStats?.total !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCallTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {leadStats.total}
                  </span>
                )}
              </button>

            </div>
          </div>

          {/* İŞLETME KARTLARI LİSTESİ */}
          {loadingLeads ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold">Arama listesi yükleniyor...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-200 text-slate-500 space-y-2">
              <PhoneCall className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Bu bölümde bekleyen aday işletme yok</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Yönetici 'Harita Arama' sekmesinden arama yapıp "Personele Paylaştır" dediğinde adaylar burada listenize eklenecektir.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
              {leads.map((lead) => {
                const hasPhone = Boolean(lead.phone && lead.phone !== 'Numara Yok');
                const isRecallActive = lead.status === 'randevu_arama' || lead.recall_date;
                const isRecallToday = isRecallActive && lead.recall_date && lead.recall_date <= todayStr;

                return (
                  <div
                    key={lead.id}
                    className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 flex flex-col justify-between space-y-3.5 min-w-0 overflow-hidden shadow-xs hover:shadow-md ${
                      isRecallToday 
                        ? 'border-rose-400 ring-2 ring-rose-300/40 bg-rose-50/10' 
                        : isRecallActive
                        ? 'border-indigo-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Kart Başlığı */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-slate-900 text-base leading-snug break-words">
                            {lead.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              {lead.district} / {lead.city}
                            </span>
                            <span className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                              {lead.category}
                            </span>
                            {lead.is_verified_location === 1 ? (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-200">
                                ✓ Teyitli
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Yıldız Puanı */}
                        <div className="flex items-center gap-1 bg-amber-50 text-amber-900 font-bold text-xs px-2 py-1 rounded-lg border border-amber-200 shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span>{lead.rating || '-'}</span>
                        </div>
                      </div>

                      {/* Adres */}
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {lead.address}
                      </p>

                      {/* ⭐ RANDEVU ALINANLAR (ARAMA) İÇİN SAAT UYARISI BİLDİRİMİ */}
                      {isRecallActive && (
                        <div>
                          {isRecallToday ? (
                            <div className="mt-3 bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-xl p-2.5 text-xs font-black flex items-center justify-between shadow-xs animate-pulse">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-white shrink-0" />
                                <span>⏰ BUGÜN SAAT {lead.recall_time || '14:00'}'TE ARANACAK!</span>
                              </div>
                              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Acil Arama
                              </span>
                            </div>
                          ) : (
                            <div className="mt-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-2.5 text-xs font-bold flex items-center gap-2">
                              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>Planlanan Arama: {new Date(lead.recall_date).toLocaleDateString('tr-TR')} {lead.recall_time ? `Saat: ${lead.recall_time}` : ''}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Yüz Yüze Randevu Tarihi Varsa */}
                      {lead.visit_date && (
                        <div className="mt-2.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl p-2 text-xs font-bold flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>Ziyaret: {new Date(lead.visit_date).toLocaleString('tr-TR')}</span>
                        </div>
                      )}

                      {/* Görüşme Notları Geçmişi (Personel Bazlı) */}
                      {lead.call_notes && (
                        <div className="mt-2.5 space-y-1.5">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Görüşme Notları ({lead.call_notes.split('\n').filter(Boolean).length}):
                          </span>
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                            {lead.call_notes.split('\n').filter(Boolean).map((noteLine, idx) => {
                              const colonIdx = noteLine.indexOf(':');
                              const hasAuthor = colonIdx > -1 && colonIdx < 35;
                              const author = hasAuthor ? noteLine.slice(0, colonIdx).trim() : null;
                              const noteContent = hasAuthor ? noteLine.slice(colonIdx + 1).trim() : noteLine;

                              return (
                                <div key={idx} className="bg-slate-50 border border-slate-200/90 rounded-xl p-2 text-xs flex flex-col gap-0.5">
                                  {author && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                                      <span>{author}</span>
                                    </div>
                                  )}
                                  <p className="text-slate-700 font-medium text-[11px] leading-relaxed italic pl-3">
                                    "{noteContent}"
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alt Kısım: Telefon & Aksiyon Butonları */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
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
                        <span className="font-bold text-slate-900 text-xs tracking-wide">
                          {lead.phone || 'Numara Yok'}
                        </span>
                      </div>

                      {/* Arama & WhatsApp Butonları */}
                      <div className="grid grid-cols-2 gap-2">
                        {hasPhone ? (
                          <a
                            href={lead.call_link || `tel:${lead.phone}`}
                            onClick={() => openCallModal(lead)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                            title="Numarayı Ara"
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

                      {/* Not Ekle / Çağrı Durumu Belirle Butonu */}
                      <button
                        type="button"
                        onClick={() => openCallModal(lead)}
                        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Not Ekle / Çağrı Durumu Güncelle</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MOD: İŞ & TESLİMAT GÖREVLERİ (MEVCUT GÖREVLER) */}
      {/* ======================================================== */}
      {viewMode === 'jobs' && (
        <div className="space-y-6">
          
          {/* İstatistik Rozetleri */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-semibold">Aktif İşler</span>
                <div className="text-2xl font-black text-blue-600 mt-0.5">{activeJobs.length}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-semibold">Tamamlanan İşler</span>
                <div className="text-2xl font-black text-emerald-600 mt-0.5">{completedJobs.length}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-semibold">Toplam Görev</span>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{jobs.length}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Aktif İşler Listesi */}
          <div className="space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Teslimat Bekleyen İşlerim ({activeJobs.length})</span>
            </h2>

            {loadingJobs ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                Yükleniyor...
              </div>
            ) : activeJobs.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                🎉 Harika! {activeMember?.name} üzerinde bekleyen teslimat bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeJobs.map((job) => {
                  const due = new Date(job.due_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const isUrgent = diffDays <= 2 && diffDays >= 0;
                  const isOverdue = diffDays < 0;

                  return (
                    <div 
                      key={job.id}
                      className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                        isOverdue 
                          ? 'border-red-300 ring-1 ring-red-200' 
                          : isUrgent 
                          ? 'border-amber-300 ring-1 ring-amber-200' 
                          : 'border-slate-200'
                      }`}
                    >
                      <div>
                        {/* Kategori Rozeti ve Durum */}
                        <div className="flex items-center justify-between mb-2">
                          <span 
                            className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md text-white"
                            style={{ backgroundColor: job.category_color || '#6366f1' }}
                          >
                            {job.category_name}
                          </span>

                          {/* Teslimat Uyarısı */}
                          {isOverdue ? (
                            <span className="bg-red-50 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-red-200 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Gecikti ({Math.abs(diffDays)} gün)
                            </span>
                          ) : isUrgent ? (
                            <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Acil ({diffDays === 0 ? 'Bugün!' : `${diffDays} gün kaldı`})
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs font-semibold">
                              {diffDays} gün kaldı
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-slate-900 text-base">
                          {job.title}
                        </h3>
                        <p className="text-xs font-bold text-slate-600 mt-1">
                          Müşteri: {job.lead_name} ({job.lead_district})
                        </p>

                        {job.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl mt-3 border border-slate-100">
                            {job.notes}
                          </p>
                        )}
                      </div>

                      {/* Alt Kısım: Tarih, Müşteri İletişimi ve Durum Değiştirme */}
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1 font-bold text-slate-800">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>Teslim: {new Date(job.due_date).toLocaleDateString('tr-TR')}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => addToGoogleCalendar(job)}
                              className="text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 flex items-center gap-1 text-[11px] cursor-pointer"
                              title="Google Takvime Ekle"
                            >
                              <Calendar className="w-3 h-3 text-blue-600" />
                              <span>Google Takvim</span>
                            </button>

                            {job.lead_phone && (
                              <a
                                href={`tel:${job.lead_phone}`}
                                className="text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 text-[11px]"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Müşteriyi Ara</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Hızlı Durum Butonları */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(job.id, 'tamamlandi')}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>İşi Tamamla</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(job.id, job.status === 'revizyonda' ? 'devam_ediyor' : 'revizyonda')}
                            className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl transition-all cursor-pointer"
                          >
                            {job.status === 'revizyonda' ? 'Revizyonda' : 'Revizyona Al'}
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ÇAĞRI VE GÖRÜŞME KARAR MODALI (PERSONEL EKRANI) */}
      {/* ======================================================== */}
      {activeCallModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-scale-up max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <PhoneCall className="w-3.5 h-3.5" />
                  Görüşme Notu & Sonuç Kaydı
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
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Önceki Görüşme Notları / Geçmiş */}
            {activeCallModal.call_notes && (
              <div className="mt-3.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Önceki Görüşme Notları / Geçmiş ({activeCallModal.call_notes.split('\n').filter(Boolean).length})</span>
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-2.5 scrollbar-thin">
                  {activeCallModal.call_notes.split('\n').filter(Boolean).map((line, i) => {
                    const colonIdx = line.indexOf(':');
                    const hasAuthor = colonIdx > -1 && colonIdx < 35;
                    const author = hasAuthor ? line.slice(0, colonIdx).trim() : null;
                    const content = hasAuthor ? line.slice(colonIdx + 1).trim() : line;
                    return (
                      <div key={i} className="text-xs bg-white border border-slate-200/90 rounded-lg p-2 text-slate-700 shadow-2xs">
                        {author && (
                          <span className="font-bold text-indigo-700 mr-1.5">[{author}]:</span>
                        )}
                        <span className="italic">{content}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Yeni Görüşme Notu */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Yeni Görüşme Notu:
                </label>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  ✍️ Not Yazan: {authUser?.name || activeMember?.name || 'Personel'}
                </span>
              </div>
              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder={`${authUser?.name || activeMember?.name || 'Personel'} olarak bu arama için yeni görüşme notunuzu buraya yazın...`}
                rows={3}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Puanlama (1-5) */}
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

            {/* 1. Tekrar Arama Planlama (Randevu Alınanlar - Arama) */}
            <div className="mt-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 space-y-2">
              <label className="block text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tekrar Arama Tarihi & Saati (Telefon Randevusu):</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase block mb-1">Arama Tarihi:</span>
                  <input
                    type="date"
                    value={recallDate}
                    onChange={(e) => setRecallDate(e.target.value)}
                    className="w-full text-xs bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase block mb-1">Arama Saati:</span>
                  <input
                    type="time"
                    value={recallTime}
                    onChange={(e) => setRecallTime(e.target.value)}
                    className="w-full text-xs bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Hızlı Tarih / Saat Seçenekleri */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-indigo-600 font-bold self-center mr-1">Hızlı:</span>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setRecallDate(today);
                    setRecallTime('15:00');
                  }}
                  className="text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg hover:bg-indigo-100 cursor-pointer"
                >
                  Bugün 15:00
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setRecallDate(d.toISOString().slice(0, 10));
                    setRecallTime('10:00');
                  }}
                  className="text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg hover:bg-indigo-100 cursor-pointer"
                >
                  Yarın 10:00
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setRecallDate(d.toISOString().slice(0, 10));
                    setRecallTime('14:00');
                  }}
                  className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-lg hover:bg-indigo-700 shadow-2xs cursor-pointer"
                >
                  Yarın 14:00 ⭐
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    setRecallDate(d.toISOString().slice(0, 10));
                    setRecallTime('11:00');
                  }}
                  className="text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg hover:bg-indigo-100 cursor-pointer"
                >
                  2 Gün Sonra 11:00
                </button>
              </div>
            </div>

            {/* 2. Ziyaret Randevusu (Yüz Yüze Ziyaret İçin) */}
            <div className="mt-3 bg-purple-50/70 border border-purple-200 rounded-2xl p-3">
              <label className="block text-xs font-bold text-purple-950 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>Yüz Yüze Ziyaret Tarihi & Saati:</span>
              </label>
              <input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full text-xs bg-white border border-purple-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800"
              />
            </div>

            {/* Sonuç Butonları */}
            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Görüşme Sonucunu Kaydedin:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                
                {/* 1. Randevu Alındı (Telefonla Arama) */}
                <button
                  type="button"
                  disabled={submittingCall}
                  onClick={() => handleCallOutcomeSubmit('randevu_arama')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>📞 Randevu (Telefonla Arama)</span>
                </button>

                {/* 2. Randevu Alındı (Ziyaret) */}
                <button
                  type="button"
                  disabled={submittingCall}
                  onClick={() => handleCallOutcomeSubmit('randevu')}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>🗓️ Randevu (Yüz Yüze Ziyaret)</span>
                </button>

                {/* 3. Satış Yapıldı */}
                <button
                  type="button"
                  disabled={submittingCall}
                  onClick={() => handleCallOutcomeSubmit('satis')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>🤝 Satış Yapıldı</span>
                </button>

                {/* 4. Ulaşılamadı */}
                <button
                  type="button"
                  disabled={submittingCall}
                  onClick={() => handleCallOutcomeSubmit('iletisimsiz')}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>📵 Ulaşılamadı</span>
                </button>

                {/* 5. Mutlak Olumsuz */}
                <button
                  type="button"
                  disabled={submittingCall}
                  onClick={() => handleCallOutcomeSubmit('mutlak_olumsuz')}
                  className="col-span-1 sm:col-span-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs p-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>❌ Mutlak Olumsuz (İptal)</span>
                </button>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
