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
  Layers
} from 'lucide-react';
import { getNotificationLeads, recordCall, getBulutfonDialUrl, triggerBulutfonCallApi } from '../api';

export default function AssignedLeadsModal({ 
  isOpen, 
  onClose, 
  notification,
  authUser, 
  currentUser, 
  onLeadUpdated,
  onOpenInCallQueue
}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [quickNoteLead, setQuickNoteLead] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [bulutfonCallingId, setBulutfonCallingId] = useState(null);

  const fetchLeads = async () => {
    if (!notification?.id) return;
    setLoading(true);
    try {
      const res = await getNotificationLeads(notification.id);
      setLeads(res.data || []);
    } catch (err) {
      console.error("Atanan işletmeler yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && notification) {
      fetchLeads();
    }
  }, [isOpen, notification]);

  if (!isOpen || !notification) return null;

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
      const callerName = authUser?.name || currentUser?.name || 'Personel';
      await recordCall(lead.id, {
        status: lead.status || 'arama_listesi',
        notes: quickNoteText.trim(),
        score: lead.score || 3,
        caller_name: callerName
      });
      setQuickNoteText('');
      setQuickNoteLead(null);
      fetchLeads();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      alert(`Not kaydedilemedi: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  const handleBulutfonCall = async (lead) => {
    if (!lead.phone) return;
    setBulutfonCallingId(lead.id);
    try {
      const res = await triggerBulutfonCallApi({
        phone: lead.phone,
        lead_id: lead.id,
        user_id: authUser?.id,
        caller_name: authUser?.name || currentUser?.name || 'Operatör'
      });
      alert(res.message || 'Bulutfon araması başlatıldı.');
    } catch (err) {
      alert(`Arama başlatılamadı: ${err.response?.data?.error || err.message}`);
    } finally {
      setBulutfonCallingId(null);
    }
  };

  const isBulutfonActive = Boolean(
    authUser?.bulutfon_enabled === 1 || 
    authUser?.bulutfon_enabled === true || 
    authUser?.bulutfon_ext || 
    authUser?.bulutfon_api_key
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* Üst Başlık & Bildirim Bilgisi */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shrink-0 relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 shrink-0">
                <PhoneCall className="w-5 h-5 text-blue-200" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                  <span>{notification.title || 'Yeni Atanan Aramalar'}</span>
                  <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-black">
                    {leads.length} İşletme
                  </span>
                </h3>
                <p className="text-xs text-blue-100/90 font-medium line-clamp-1 mt-0.5">
                  {notification.message}
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alt Hızlı İşlem & Arama Kutusu */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-white/15">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="İşletme adı, ilçe, sektör veya telefon ile filtrele..."
                className="w-full bg-white text-slate-800 placeholder-slate-400 pl-9 pr-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-inner"
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
            {onOpenInCallQueue && leads.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInCallQueue(leads.map(l => l.id));
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs rounded-xl backdrop-blur-sm border border-white/30 transition-all cursor-pointer shrink-0 shadow-xs"
                title="Bu işletmeleri ana arama ekranında filtrele"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Çağrı Listesinde Filtrele ({leads.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Liste Alanı */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 divide-y divide-slate-100 bg-slate-50/50">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-xs font-bold text-slate-600">Atanan işletmeler yükleniyor...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-sm text-slate-600">
                {searchFilter ? 'Arama kriterine uygun işletme bulunamadı.' : 'Bu bildirime ait işletme kaydı bulunamadı.'}
              </p>
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                >
                  Filtreyi Temizle
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredLeads.map((lead, idx) => (
                <div 
                  key={lead.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all flex flex-col gap-3 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                          {lead.name}
                        </h4>

                        {lead.district && (
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                            <MapPin className="w-2.5 h-2.5 text-slate-500" />
                            {lead.district}
                          </span>
                        )}

                        {lead.category && (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                            {lead.category}
                          </span>
                        )}

                        {lead.score > 0 && (
                          <span className="bg-amber-50 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-200">
                            ★ {lead.score}/5 Puan
                          </span>
                        )}
                      </div>

                      {lead.address && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {lead.address}
                        </p>
                      )}

                      {lead.call_notes && (
                        <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 line-clamp-2">
                          <span className="font-bold text-slate-800">Son Not: </span>
                          {lead.call_notes.split('\n').filter(Boolean).pop()}
                        </div>
                      )}
                    </div>

                    {/* Telefon ve Hızlı Arama Butonları */}
                    <div className="flex items-center gap-2 shrink-0 self-start mt-1 sm:mt-0">
                      {lead.phone ? (
                        <>
                          {/* Doğrudan Arama Linki */}
                          <a
                            href={`tel:${lead.phone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            title="Telefon ile Ara"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{lead.phone}</span>
                          </a>

                          {/* Bulutfon VoIP Arama */}
                          {isBulutfonActive && (
                            <button
                              type="button"
                              onClick={() => handleBulutfonCall(lead)}
                              disabled={bulutfonCallingId === lead.id}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                              title="Bulutfon VoIP ile Ara"
                            >
                              <PhoneCall className={`w-3.5 h-3.5 ${bulutfonCallingId === lead.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}

                          {/* WhatsApp Linki */}
                          {lead.is_mobile === 1 && (
                            <a
                              href={`https://wa.me/90${lead.phone.replace(/[^0-9]/g, '').slice(-10)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-colors"
                              title="WhatsApp Mesaj Gönder"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium italic">
                          Numara Yok
                        </span>
                      )}

                      {/* Hızlı Not Ekle Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          if (quickNoteLead?.id === lead.id) {
                            setQuickNoteLead(null);
                          } else {
                            setQuickNoteLead(lead);
                            setQuickNoteText('');
                          }
                        }}
                        className={`p-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          quickNoteLead?.id === lead.id 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                        title="Hızlı Not Ekle"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Hızlı Not Giriş Alanı */}
                  {quickNoteLead?.id === lead.id && (
                    <div className="mt-1 pt-2 border-t border-slate-100 flex items-center gap-2 animate-fade-in">
                      <input
                        type="text"
                        value={quickNoteText}
                        onChange={(e) => setQuickNoteText(e.target.value)}
                        placeholder="Bu görüşme için not girin (örn: Yarın tekrar aramamı istedi)..."
                        className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveQuickNote(lead);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveQuickNote(lead)}
                        disabled={savingNote || !quickNoteText.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
                      >
                        {savingNote ? 'Kaydediliyor...' : 'Kaydet'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alt Kapatma Çubuğu */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Toplam <b className="text-slate-800">{filteredLeads.length}</b> işletme görüntüleniyor
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
