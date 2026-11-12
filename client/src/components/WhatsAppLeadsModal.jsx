import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Phone,
  PhoneCall,
  Search,
  MapPin,
  Calendar,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  ArrowRight,
  Filter
} from 'lucide-react';
import { getWhatsAppRequests, recordCall, getBulutfonDialUrl } from '../api';

export default function WhatsAppLeadsModal({
  isOpen,
  onClose,
  authUser,
  currentUser,
  onLeadUpdated,
  onOpenLeadInCallQueue,
  onOpenCallModal
}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [callerFilter, setCallerFilter] = useState('all');
  const [quickNoteLead, setQuickNoteLead] = useState(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const activeUserName = (authUser?.name || currentUser?.name || '').trim();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await getWhatsAppRequests();
      setLeads(res.data || []);
    } catch (err) {
      console.error('WhatsApp talepleri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeads();
      setSearchFilter('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Benzersiz arayan personel listesi
  const callersList = Array.from(new Set(leads.map(l => l.caller_name).filter(Boolean)));

  const filteredLeads = leads.filter(lead => {
    if (callerFilter === 'mine') {
      if (!lead.caller_name || lead.caller_name.toLowerCase().trim() !== activeUserName.toLowerCase()) {
        return false;
      }
    } else if (callerFilter !== 'all') {
      if (!lead.caller_name || lead.caller_name.toLowerCase().trim() !== callerFilter.toLowerCase()) {
        return false;
      }
    }

    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (lead.name && lead.name.toLowerCase().includes(q)) ||
      (lead.phone && lead.phone.includes(q)) ||
      (lead.district && lead.district.toLowerCase().includes(q)) ||
      (lead.category && lead.category.toLowerCase().includes(q)) ||
      (lead.latest_note && lead.latest_note.toLowerCase().includes(q)) ||
      (lead.call_notes && lead.call_notes.toLowerCase().includes(q)) ||
      (lead.caller_name && lead.caller_name.toLowerCase().includes(q))
    );
  });

  const myLeadsCount = leads.filter(
    l => l.caller_name && l.caller_name.toLowerCase().trim() === activeUserName.toLowerCase()
  ).length;

  const handleQuickSaveNote = async (lead) => {
    if (!quickNoteText.trim()) return;
    setSavingNote(true);
    try {
      await recordCall(lead.id, {
        outcome: 'whatsapp_bilgi',
        notes: quickNoteText.trim(),
        caller_name: activeUserName || 'Operatör'
      });
      setQuickNoteLead(null);
      setQuickNoteText('');
      fetchLeads();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      alert(`Not kaydedilemedi: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* ÜST BAŞLIK */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  💬 WhatsApp Mesaj & Bilgi İsteyen İşletmeler
                </h2>
                <span className="bg-emerald-400 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs">
                  {leads.length} İşletme
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Telefon görüşmesinde WhatsApp'tan detaylı bilgi, katalog veya fiyat teklifi isteyen işletmeler
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLeads}
              disabled={loading}
              className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              title="Listeyi Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FİLTRE VE ARAMA ÇUBUĞU */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          {/* Arama Inputu */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="İşletme adı, ilçe, telefon veya not ara..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
            />
          </div>

          {/* Personel Filtre Butonları */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setCallerFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                callerFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tümü ({leads.length})
            </button>

            {activeUserName && myLeadsCount > 0 && (
              <button
                type="button"
                onClick={() => setCallerFilter('mine')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  callerFilter === 'mine'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                ⭐ Benimkiler ({myLeadsCount})
              </button>
            )}

            {callersList.map(caller => {
              const count = leads.filter(l => l.caller_name === caller).length;
              return (
                <button
                  key={caller}
                  type="button"
                  onClick={() => setCallerFilter(caller)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer capitalize ${
                    callerFilter === caller
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {caller} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* LİSTE ALANI */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 scrollbar-thin">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-xs font-bold text-slate-600">WhatsApp talepleri yükleniyor...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-600" />
              <p className="text-sm font-extrabold text-slate-700">WhatsApp bilgi talebi bulunamadı</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchFilter ? 'Arama kriterlerinize uygun işletme bulunamadı.' : 'Arama esnasında "WhatsApp Bilgi İstedi" işaretlenen işletmeler burada listelenir.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredLeads.map(item => {
                const cleanPhone = (item.raw_phone || item.phone || '').replace(/\D/g, '');
                const waNumber = cleanPhone.startsWith('90')
                  ? cleanPhone
                  : cleanPhone.startsWith('0')
                  ? '9' + cleanPhone
                  : '90' + cleanPhone;
                const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
                  `Merhaba ${item.name}, Power Partner adına telefonla görüşmüştük. İstediğiniz detaylı bilgilendirmeyi ve sunumu buradan iletiyoruz.`
                )}`;

                return (
                  <div
                    key={item.log_id || item.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      {/* Üst Satır: İşletme Adı & Rozetler */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                            {item.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {item.district && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" />
                                <span>{item.district}</span>
                              </span>
                            )}
                            {item.category && (
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                                {item.category}
                              </span>
                            )}
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                              💬 WhatsApp İstedi
                            </span>
                          </div>
                        </div>

                        {/* Arayan Personel & Tarih */}
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 block">
                            Arayan Personel:
                          </span>
                          <span className="text-xs font-black text-slate-800 capitalize">
                            {item.caller_name || 'Bahar'}
                          </span>
                          {item.request_date && (
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {item.request_date.slice(0, 10).split('-').reverse().join('.')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Müşteri Talep Notu */}
                      <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-2.5 text-xs text-emerald-950 font-medium">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-1">
                          📝 Görüşme Notu & İstenen Bilgi:
                        </span>
                        <p className="line-clamp-3 leading-relaxed italic">
                          "{item.latest_note || item.call_notes || 'WhatsApp üzerinden sunum ve fiyat bilgisi istedi.'}"
                        </p>
                      </div>

                      {/* Hızlı Not Ekleme Açılır Kutusu */}
                      {quickNoteLead === item.id ? (
                        <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                          <textarea
                            rows={2}
                            value={quickNoteText}
                            onChange={(e) => setQuickNoteText(e.target.value)}
                            placeholder="Örn: WhatsApp'tan sunum ve fiyat teklifi iletildi..."
                            className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setQuickNoteLead(null);
                                setQuickNoteText('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Vazgeç
                            </button>
                            <button
                              type="button"
                              disabled={savingNote || !quickNoteText.trim()}
                              onClick={() => handleQuickSaveNote(item)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg transition-all cursor-pointer disabled:opacity-50"
                            >
                              {savingNote ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Alt Aksiyon Butonları & Telefon */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{item.phone || 'Numara Yok'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1-Click WhatsApp Butonu */}
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                          title="WhatsApp Web'de doğrudan sohbet başlat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp Aç</span>
                        </a>

                        {/* Klasik Arama (tel:) */}
                        {item.phone && (
                          <a
                            href={`tel:${item.phone.replace(/[^0-9]/g, '')}`}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 transition-all flex items-center gap-1"
                            title="Telefonu Ara"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Ara</span>
                          </a>
                        )}

                        {/* Hızlı Not Ekle Butonu */}
                        <button
                          type="button"
                          onClick={() => {
                            if (quickNoteLead === item.id) {
                              setQuickNoteLead(null);
                            } else {
                              setQuickNoteLead(item.id);
                              setQuickNoteText('');
                            }
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 transition-all cursor-pointer"
                          title="WhatsApp durumuna dair hızlı not ekle"
                        >
                          Not Ekle
                        </button>

                        {/* Arama Kuyruğunda Aç */}
                        {onOpenLeadInCallQueue && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenLeadInCallQueue(item.id);
                              onClose();
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black px-2.5 py-1.5 rounded-xl border border-blue-200 transition-all cursor-pointer"
                            title="Arama ekranında bu işletmeyi aç"
                          >
                            Kuyrukta Aç →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ALT BİLGİ */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>💡 <strong>İpucu:</strong> "WhatsApp Aç" butonuna basarak müşteriye doğrudan WhatsApp Web üzerinden kurumsal sunum veya teklifinizi gönderebilirsiniz.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold rounded-xl transition-all cursor-pointer"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
