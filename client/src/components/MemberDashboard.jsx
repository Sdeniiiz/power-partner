import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Briefcase, 
  Layers, 
  ExternalLink 
} from 'lucide-react';
import { getJobs, updateJob } from '../api';

export default function MemberDashboard({ currentUser, teamMembers, onJobUpdated }) {
  const [activeMember, setActiveMember] = useState(currentUser || (teamMembers[0] || null));
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      setActiveMember(currentUser);
    }
  }, [currentUser]);

  const loadMemberJobs = async () => {
    if (!activeMember) return;
    setLoading(true);
    try {
      const res = await getJobs({ member_id: activeMember.id });
      setJobs(res.data || []);
    } catch (err) {
      console.error('Görevler yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemberJobs();
  }, [activeMember]);

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await updateJob(jobId, { status: newStatus });
      loadMemberJobs();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      alert(`Güncelleme hatası: ${err.message}`);
    }
  };

  // Örnek projedeki Google Calendar ve .ics dışa aktarma fonksiyonları
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

  return (
    <div className="space-y-6">
      
      {/* Üst Ekip Seçici & Karşılama */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-2xl text-white font-extrabold text-lg flex items-center justify-center shadow-md"
            style={{ backgroundColor: activeMember?.color || '#2563eb' }}
          >
            {activeMember?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">
                {activeMember?.name} Kullanıcı Ekranı
              </h1>
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                {activeMember?.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Üzerinize atanan teslimat bekleyen işler ve kişisel takvim görünümü
            </p>
          </div>
        </div>

        {/* Ekip Üyeleri Arasında Hızlı Geçiş & Toplu ICS İndir */}
        <div className="flex flex-wrap items-center gap-2">
          {activeJobs.some(j => j.due_date) && (
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

          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
            <span className="text-[11px] font-bold text-slate-500 px-2 shrink-0">Ekran Değiştir:</span>
            {teamMembers.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMember(m)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                  activeMember?.id === m.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>


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

        {loading ? (
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

                      {/* Google Takvim & Müşteriyi Arama */}
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
  );
}
