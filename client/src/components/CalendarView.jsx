import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Layers, 
  ExternalLink,
  Briefcase
} from 'lucide-react';
import { getCalendarEvents, getTeamMembers } from '../api';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const loadEvents = async () => {
    setLoading(true);
    try {
      const [eventsRes, membersRes] = await Promise.all([
        getCalendarEvents({
          member_id: selectedMember === 'all' ? undefined : selectedMember
        }),
        getTeamMembers()
      ]);
      setEvents(eventsRes.data || []);
      setTeamMembers(membersRes.data || []);
    } catch (err) {
      console.error('Takvim yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [selectedMember, month, year]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Ayın günlerini hesapla
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Pazartesi başlangıçlı index (Pzt=0, Paz=6)
  const startDayOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Etkinlikleri günlere göre grupla
  const eventsByDate = {};
  events.forEach((ev) => {
    if (!ev.event_date) return;
    const dateKey = ev.event_date.split('T')[0]; // YYYY-MM-DD
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
    eventsByDate[dateKey].push(ev);
  });

  return (
    <div className="space-y-6">
      
      {/* Üst Bar: Navigasyon & Filtre */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Ay / Yıl Seçici */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {MONTH_NAMES[month]} {year}
            </h1>
            <p className="text-xs text-slate-500">
              Teslimat tarihleri ve müşteri randevuları takvimi
            </p>
          </div>
        </div>

        {/* Kontroller: Önceki/Sonraki Ay & Kişi Filtresi */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Kişi Filtresi */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-bold text-slate-500">Kişi:</span>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
            >
              <option value="all">Tüm Ekip</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer"
              title="Önceki Ay"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition-all cursor-pointer"
            >
              Bugün
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer"
              title="Sonraki Ay"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Takvim Izgarası */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Gün Başlıkları */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center font-bold text-xs text-slate-600 py-3">
          {DAY_NAMES.map((d, i) => (
            <div key={i} className={i >= 5 ? 'text-amber-600' : ''}>
              {d}
            </div>
          ))}
        </div>

        {/* Gün Hücreleri */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[520px]">
          
          {/* Önceki ay boşlukları */}
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-50/40 p-2 min-h-[90px]" />
          ))}

          {/* Ayın günleri */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayEvents = eventsByDate[dateStr] || [];

            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDayEvents({ date: dateStr, events: dayEvents })}
                className={`p-2 min-h-[100px] hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col justify-between ${
                  isToday ? 'bg-amber-50/30' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isToday
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">
                        {dayEvents.length} kayıt
                      </span>
                    )}
                  </div>

                  {/* Etkinlik Hapları (Maksimum 2 adet gösterilir, fazlası için +X) */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((ev, evIdx) => {
                      const isVisit = ev.event_type === 'lead_visit';

                      return (
                        <div
                          key={evIdx}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate text-white ${
                            isVisit ? 'bg-purple-600' : ''
                          }`}
                          style={!isVisit ? { backgroundColor: ev.category_color || '#2563eb' } : {}}
                          title={`${ev.title} (${ev.member_name || ''})`}
                        >
                          {ev.member_name ? `[${ev.member_name}] ` : ''}{ev.title}
                        </div>
                      );
                    })}

                    {dayEvents.length > 2 && (
                      <div className="text-[9px] font-extrabold text-blue-600 pl-1">
                        +{dayEvents.length - 2} daha fazla...
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}

        </div>

      </div>

      {/* Gün Detayı Modalı (Tıklanan Güne Ait Tüm Teslimatlar & Randevular) */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Günlük Ajanda & Teslimat Listesi
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  {new Date(selectedDayEvents.date).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    weekday: 'long'
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
              {selectedDayEvents.events.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Bu tarihte planlanmış bir teslimat veya randevu bulunmuyor.
                </p>
              ) : (
                selectedDayEvents.events.map((ev, i) => {
                  const isVisit = ev.event_type === 'lead_visit';

                  return (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span 
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-md text-white"
                          style={{ backgroundColor: isVisit ? '#7c3aed' : (ev.category_color || '#2563eb') }}
                        >
                          {isVisit ? 'Müşteri Randevusu / Ziyaret' : ev.category_name}
                        </span>

                        <span className="text-xs font-bold text-slate-600">
                          {ev.member_name || 'Genel Saha'}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {ev.title}
                      </h4>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>{ev.district}</span>
                        {ev.client_phone && (
                          <a
                            href={`tel:${ev.client_phone}`}
                            className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {ev.client_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl"
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
