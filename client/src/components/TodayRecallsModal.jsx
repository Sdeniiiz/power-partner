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
  ArrowRight
} from 'lucide-react';
import { getLeads, recordCall } from '../api';

export default function TodayRecallsModal({ 
  isOpen, 
  onClose, 
  authUser, 
  currentUser, 
  onLeadUpdated,
  onOpenCallModal
}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [quickNoteLead, setQuickNoteLead] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const isAdmin = authUser?.role === 'admin';

  const fetchTodayRecalls = async () => {
    setLoading(true);
    try {
      const params = {
        is_today_recall: '1',
        limit: 500
      };
      // Eğer admin değilse sadece kendine atanan veya boşta olanları çekebilir
      if (!isAdmin && currentUser?.id) {
        params.assigned_caller_id = currentUser.id;
      }
      const res = await getLeads(params);
      setLeads(res.data || []);
    } catch (err) {
      console.error("Bugün aranacaklar yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTodayRecalls();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLeads = leads.filter(lead => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (lead.name && lead.name.toLowerCase().includes(q)) ||
      (lead.phone && lead.phone.includes(q)) ||
      (lead.category && lead.category.toLowerCase().includes(q)) ||
      (lead.district && lead.district.toLowerCase().includes(q))
    );
  });

  const handleSaveQuickNote = async (lead) => {
    if (!quickNoteText.trim()) return;
    setSavingNote(true);
    try {
      const callerName = authUser?.name || currentUser?.name || 'Sistem';
      await recordCall(lead.id, {
        status: 'randevu_arama', // Randevu durumunu koru
        notes: quickNoteText.trim(),
        score: lead.score || 3,
        caller_name: callerName
      });
      setQuickNoteText('');
      setQuickNoteLead(null);
      fetchTodayRecalls();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      alert(`Not kaydedilemedi: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlığı */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/25 shadow-inner">
              <Clock className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Bugün Aranacak Randevular & Hatırlatmalar
                </h2>
                <span className="bg-white/25 text-white text-xs font-black px-2 py-0.5 rounded-full border border-white/30">
                  {leads.length} İşletme
                </span>
              </div>
              <p className="text-amber-100 text-xs font-medium mt-0.5">
                Vadesi bugün veya geçmişte dolmuş olan, aranması gereken müşteriler
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTodayRecalls}
              disabled={loading}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Arama ve Filtre Çubuğu */}
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="İşletme adı, telefon, kategori veya ilçe ile ara..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>
          <span className="text-xs text-slate-500 font-bold px-2 whitespace-nowrap">
            {filteredLeads.length} / {leads.length} Gösteriliyor
          </span>
        </div>

        {/* Dikey Liste Alanı (Alt Alta Listeleme) */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3 divide-y divide-slate-100/0 flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-500" />
              <p className="text-xs font-bold text-slate-600">Bugün aranacak randevular taranıyor...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400 opacity-60" />
              <h3 className="text-sm font-extrabold text-slate-700">Harika! Bugün aranacak bekleyen randevu bulunmuyor.</h3>
              <p className="text-xs text-slate-500 mt-1">Tüm görüşmeler zamanında yapılmış veya henüz randevu eklenmemiş.</p>
            </div>
          ) : (
            filteredLeads.map((lead, idx) => {
              const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9]/g, '') : '';
              const bulutfonLink = cleanPhone ? `bulutfon://call?phone=${cleanPhone}` : null;
              const telLink = cleanPhone ? `tel:${cleanPhone}` : null;
              const waLink = lead.whatsapp_link || (cleanPhone ? `https://wa.me/90${cleanPhone.slice(-10)}` : null);

              return (
                <div 
                  key={lead.id}
                  className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all space-y-3"
                >
                  {/* Üst Satır: Saat, İşletme Adı, Kategori, İlçe */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xs font-black text-slate-400 w-5 shrink-0 mt-0.5">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900 hover:text-amber-600 transition-colors">
                            {lead.name}
                          </h3>
                          {lead.category && (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                              {lead.category}
                            </span>
                          )}
                          {lead.district && (
                            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5 border border-blue-100">
                              <MapPin className="w-2.5 h-2.5" />
                              {lead.district}
                            </span>
                          )}
                        </div>

                        {lead.address && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {lead.address}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Randevu Saati / Vadesi Rozeti */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1 text-right flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <div>
                          <div className="text-[10px] font-extrabold text-amber-900 leading-tight">
                            {lead.recall_time ? `⏰ ${lead.recall_time}` : '⏰ Saat Belirtilmedi'}
                          </div>
                          <div className="text-[9px] text-amber-700 font-medium leading-none">
                            {lead.recall_date ? lead.recall_date : 'Bugün'}
                          </div>
                        </div>
                      </div>

                      {lead.assigned_caller_name && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-2 py-1 flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                          <User className="w-3 h-3 text-indigo-600" />
                          <span>{lead.assigned_caller_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Orta Alan: Önceki Notlar */}
                  {lead.notes && (
                    <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/70 text-xs text-slate-700 font-medium">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-slate-400" />
                        <span>Mevcut Not & Görüşme Geçmişi:</span>
                      </div>
                      <p className="whitespace-pre-line text-[11px] text-slate-800 leading-relaxed max-h-24 overflow-y-auto">
                        {lead.notes}
                      </p>
                    </div>
                  )}

                  {/* Hızlı Not Ekleme Açılır Kutusu */}
                  {quickNoteLead === lead.id && (
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 animate-fade-in">
                      <label className="text-[11px] font-bold text-amber-900">
                        Bu randevu için yeni not ekle:
                      </label>
                      <textarea
                        value={quickNoteText}
                        onChange={(e) => setQuickNoteText(e.target.value)}
                        placeholder="Örn: Müşteri arandı, saat 16:00'da tekrar aramamızı istedi..."
                        className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 min-h-[60px]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setQuickNoteLead(null); setQuickNoteText(''); }}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 font-bold cursor-pointer"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveQuickNote(lead)}
                          disabled={savingNote}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          {savingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alt Satır: Arama Butonları ve Eylemler */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 font-mono">
                        {lead.phone || 'Numara Yok'}
                      </span>
                      {lead.score > 0 && (
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                          ⭐ {lead.score}/5
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Bulutfon / VoIP ile Ara */}
                      {bulutfonLink && (
                        <a
                          href={bulutfonLink}
                          onClick={() => onOpenCallModal && onOpenCallModal(lead)}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                          title="Bulutfon Plus ile Ara"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Bulutfon</span>
                        </a>
                      )}

                      {/* Normal Telefon / GSM Ara */}
                      {telLink && (
                        <a
                          href={telLink}
                          onClick={() => onOpenCallModal && onOpenCallModal(lead)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                          title="Telefon ile Ara"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Ara</span>
                        </a>
                      )}

                      {/* WhatsApp */}
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                          title="WhatsApp Aç"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WP</span>
                        </a>
                      )}

                      {/* Hızlı Not Butonu */}
                      <button
                        type="button"
                        onClick={() => {
                          setQuickNoteLead(quickNoteLead === lead.id ? null : lead.id);
                          setQuickNoteText('');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        Not Ekle
                      </button>

                      {/* Detay & Çağrı Kaydet Modalı Aç */}
                      {onOpenCallModal && (
                        <button
                          type="button"
                          onClick={() => onOpenCallModal(lead)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <span>Sonuç Kaydet</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Alt Kapatma */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium shrink-0">
          <span>Toplam {filteredLeads.length} randevu listelendi</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
