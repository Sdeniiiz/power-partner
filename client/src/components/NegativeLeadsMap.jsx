import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Car,
  Trash2,
  Filter,
  Search,
  CheckCircle2,
  X,
  Phone,
  MessageSquare,
  AlertCircle,
  LocateFixed,
  Layers
} from 'lucide-react';
import { isFieldStaffRole } from '../api';

export default function NegativeLeadsMap({
  leads = [],
  teamMembers = [],
  onPassToField,
  onArchiveToMutlakOlumsuz,
  selectedDistrict = 'all',
  onDistrictChange,
  onClose
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [userLocation, setUserLocation] = useState(null);

  // Paslama Modal State
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [targetLeadsForPass, setTargetLeadsForPass] = useState([]);
  const [selectedFieldMember, setSelectedFieldMember] = useState('');
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.toISOString().slice(0, 10)} 14:00`;
  });
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Saha personelleri
  const fieldStaffMembers = teamMembers.filter(m => isFieldStaffRole(m.role) || /saha|yiğit|yigit|berat/i.test(m.name));

  // İlçeler listesi ve sayıları
  const districtCounts = React.useMemo(() => {
    const counts = {};
    leads.forEach(l => {
      const d = (l.district || 'Belirtilmemiş').trim();
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // Filtrelenmiş Liste
  const filteredLeads = React.useMemo(() => {
    return leads.filter(l => {
      if (!l.lat || !l.lng) return false;
      if (selectedDistrict !== 'all' && (l.district || '').trim().toLowerCase() !== selectedDistrict.trim().toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (l.name || '').toLowerCase().includes(q);
        const matchAddr = (l.address || '').toLowerCase().includes(q);
        const matchCat = (l.category || '').toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchCat) return false;
      }
      return true;
    });
  }, [leads, selectedDistrict, searchQuery]);

  // Haritayı İlklendir
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Varsayılan Samsun merkez koordinatları
      const map = L.map(mapContainerRef.current, {
        center: [41.2867, 36.33],
        zoom: 12,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Marker'ları Güncelle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    if (filteredLeads.length === 0) return;

    const bounds = L.latLngBounds();

    filteredLeads.forEach(lead => {
      const lat = Number(lead.lat);
      const lng = Number(lead.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.extend([lat, lng]);

      const isSelected = selectedLeadIds.has(lead.id);

      const icon = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="
            background: ${isSelected ? '#2563eb' : '#e11d48'};
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <span style="transform: rotate(45deg); font-size: 11px; font-weight: 900;">📍</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
      });

      const marker = L.marker([lat, lng], { icon });

      marker.on('click', () => {
        setSelectedLead(lead);
      });

      marker.addTo(markersLayerRef.current);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [filteredLeads, selectedLeadIds]);

  // Kullanıcı Konumu Al
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Tarayıcınız konum servisini desteklemiyor.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(coords, 14);
          L.marker(coords, {
            icon: L.divIcon({
              className: 'user-pin',
              html: `<div style="background: #0284c7; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #0284c7;"></div>`
            })
          }).addTo(mapInstanceRef.current).bindPopup('📍 Şu Anki Konumunuz').openPopup();
        }
      },
      err => {
        alert('Konum alınamadı: ' + err.message);
      }
    );
  };

  // Tekil veya Toplu Sahaya Paslama Modalını Aç
  const openPassModal = (leadsToPass) => {
    setTargetLeadsForPass(leadsToPass);
    if (fieldStaffMembers.length > 0 && !selectedFieldMember) {
      setSelectedFieldMember(fieldStaffMembers[0].name);
    }
    setPassModalOpen(true);
  };

  // Sahaya Paslama İşlemini Kaydet
  const handleConfirmPassToField = async () => {
    if (!selectedFieldMember) {
      alert('Lütfen bir saha personeli seçiniz.');
      return;
    }
    try {
      setSubmitting(true);
      const matched = fieldStaffMembers.find(m => m.name === selectedFieldMember);
      await onPassToField({
        lead_ids: targetLeadsForPass.map(l => l.id),
        field_member_id: matched?.id || null,
        field_member_name: selectedFieldMember,
        visit_date: visitDate,
        admin_note: adminNote
      });
      setPassModalOpen(false);
      setSelectedLeadIds(new Set());
      setSelectedLead(null);
    } catch (err) {
      alert('Hata oluştu: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  // Toplu Mutlak Olumsuz
  const handleArchiveSelected = async () => {
    if (selectedLeadIds.size === 0) return;
    if (!window.confirm(`Seçilen ${selectedLeadIds.size} işletmeyi Mutlak Olumsuz (Arşiv) durumuna almak istediğinizden emin misiniz?`)) {
      return;
    }
    try {
      setSubmitting(true);
      await onArchiveToMutlakOlumsuz({
        lead_ids: Array.from(selectedLeadIds),
        admin_note: 'Harita üzerinden yönetici kararıyla mutlak olumsuza alındı.'
      });
      setSelectedLeadIds(new Set());
      setSelectedLead(null);
    } catch (err) {
      alert('Hata: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectLead = (id) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[750px] relative text-white animate-fade-in">
      
      {/* 1. ÜST KONTROL BAR */}
      <div className="bg-slate-950/80 backdrop-blur-md p-3.5 sm:p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-black">
            🗺️
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>Olumsuzlar Saha Haritası</span>
              <span className="bg-rose-500/20 text-rose-300 text-[10px] px-2 py-0.5 rounded-full border border-rose-500/30">
                {filteredLeads.length} İşletme
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Telefonda reddedilen ancak yüz yüze görüşmeyle ikna edilebilecek işletmelerin konum analizi.
            </p>
          </div>
        </div>

        {/* İlçe & Arama Filtreleri */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* İlçe Seçimi */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-rose-400" />
            <select
              value={selectedDistrict}
              onChange={(e) => onDistrictChange(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">Tüm İlçeler ({leads.length})</option>
              {districtCounts.map(([dist, count]) => (
                <option key={dist} value={dist} className="bg-slate-900 text-white">
                  {dist} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* İsim Arama */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="İşletme adı veya sektör..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-rose-500 w-44"
            />
          </div>

          {/* Konumumu Bul */}
          <button
            type="button"
            onClick={handleGetLocation}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Şu anki GPS konumumu göster"
          >
            <LocateFixed className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Konumumu Bul</span>
          </button>

          {/* Kapat Butonu */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

      </div>

      {/* 2. TOPLU SEÇİM EYLEM BARI (Eğer seçim varsa) */}
      {selectedLeadIds.size > 0 && (
        <div className="bg-gradient-to-r from-rose-950/90 to-indigo-950/90 border-b border-rose-800/40 p-2.5 px-4 flex items-center justify-between z-10 animate-fade-in">
          <span className="text-xs font-black text-rose-200">
            ✅ {selectedLeadIds.size} işletme seçildi
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openPassModal(leads.filter(l => selectedLeadIds.has(l.id)))}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Car className="w-3.5 h-3.5" />
              <span>Seçilenleri Sahaya Pasla</span>
            </button>
            <button
              type="button"
              onClick={handleArchiveSelected}
              className="bg-rose-700 hover:bg-rose-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Mutlak Olumsuz Yap</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedLeadIds(new Set())}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer px-2"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* 3. ANA HARİTA ALANI VE DETAY ÇEKMECESİ */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* Leaflet Harita */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full z-0" />

        {/* Tıklanan İşletme Detay Paneli (Sağ Kenar Çekmecesi) */}
        {selectedLead && (
          <div className="w-80 sm:w-96 bg-slate-950/95 backdrop-blur-md border-l border-slate-800 p-5 flex flex-col justify-between absolute right-0 top-0 bottom-0 z-20 shadow-2xl animate-fade-in overflow-y-auto">
            <div className="space-y-4">
              
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30 inline-block mb-1">
                    {selectedLead.district || 'Samsun'} • {selectedLead.category || 'İşletme'}
                  </span>
                  <h4 className="text-base font-black text-white leading-tight">
                    {selectedLead.name}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Adres ve Telefon */}
              <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{selectedLead.address || 'Adres bilgisi bulunamadı'}</span>
                </div>
                {selectedLead.phone && (
                  <div className="flex items-center gap-2 text-slate-300 pt-1 border-t border-slate-800">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold">{selectedLead.phone}</span>
                  </div>
                )}
              </div>

              {/* Telefon Arama Notu (Personelin yazdığı) */}
              <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Telefonda Alınan Not:
                </span>
                <p className="text-xs text-slate-200 italic leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {selectedLead.call_notes || 'Özel bir görüşme notu bulunmuyor.'}
                </p>
              </div>

              {/* Seçim Butonu */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleSelectLead(selectedLead.id)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    selectedLeadIds.has(selectedLead.id)
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{selectedLeadIds.has(selectedLead.id) ? 'Seçildi' : 'Toplu İşleme Ekle'}</span>
                </button>
              </div>

            </div>

            {/* Alt Eylem Butonları */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              
              {/* Sahaya Pasla Butonu */}
              <button
                type="button"
                onClick={() => openPassModal([selectedLead])}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Car className="w-4 h-4" />
                <span>🚗 Sahaya Pasla (Saha Personeline Ata)</span>
              </button>

              {/* Google Haritalar Yol Tarifi */}
              <a
                href={
                  selectedLead.lat && selectedLead.lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedLead.lat},${selectedLead.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLead.name + ' ' + (selectedLead.address || ''))}`
                }
                target="_blank"
                rel="noreferrer"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-700"
              >
                <Navigation className="w-3.5 h-3.5 text-sky-400" />
                <span>Google Haritalarda Yol Tarifi Al</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              {/* Mutlak Olumsuza Al Butonu */}
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`${selectedLead.name} işletmesini Mutlak Olumsuza (Arşiv) almak istediğinizden emin misiniz?`)) {
                    await onArchiveToMutlakOlumsuz({
                      lead_ids: [selectedLead.id],
                      admin_note: 'Yönetici incelemesiyle mutlak olumsuza alındı.'
                    });
                    setSelectedLead(null);
                  }
                }}
                className="w-full text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 font-bold text-[11px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Mutlak Olumsuza Al (Kalıcı İptal)</span>
              </button>

            </div>

          </div>
        )}

      </div>

      {/* 4. SAHAYA PASLAMA ONAY MODALI */}
      {passModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-400" />
                <span>Sahaya Pasla & Rota Planla</span>
              </h3>
              <button
                type="button"
                onClick={() => setPassModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Toplam <strong>{targetLeadsForPass.length} işletme</strong> olumsuz havuzundan çıkartılarak saha satış randevularına aktarılacak.
            </p>

            {/* Saha Personeli Seçimi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Saha Satış Sorumlusu:</label>
              <select
                value={selectedFieldMember}
                onChange={(e) => setSelectedFieldMember(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-bold focus:ring-2 focus:ring-emerald-500"
              >
                {fieldStaffMembers.length === 0 ? (
                  <option value="Yiğit dalkılıç">Yiğit dalkılıç (Saha Satış)</option>
                ) : (
                  fieldStaffMembers.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role || 'Saha Satış'})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Planlanan Ziyaret Tarihi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Planlanan Ziyaret Zamanı:</label>
              <input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Yönetici Notu */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Saha Personeline Not / Yönerge:</label>
              <textarea
                rows={2}
                placeholder="Örn: Telefonda ilgilenmedi ama dükkanın tabelası eski, yüz yüze konuşulursa ikna olur..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Butonlar */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPassModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmPassToField}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Aktarılıyor...' : 'Sahaya Aktar & Bildir'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
