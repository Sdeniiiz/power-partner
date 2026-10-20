import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Award,
  FileText,
  Star,
  Sparkles,
  RefreshCw,
  Filter,
  Search,
  Plus,
  Building2,
  UserCheck,
  CheckCircle,
  RotateCcw,
  ExternalLink,
  Layers,
  X
} from 'lucide-react';
import InstagramIcon from './InstagramIcon';
import {
  getFieldRoute,
  reorderFieldRoute,
  assignToFieldRoute,
  recordFieldVisit,
  getLeads,
  parseCallNote,
  isFieldStaffRole,
  isAdminOrManagerRole
} from '../api';

const PRODUCT_OPTIONS = [
  'Web Sitesi Tasarımı',
  'E-Ticaret Sitesi',
  'SEO Çalışması',
  'Sosyal Medya Yönetimi',
  'Meta Reklamları',
  'Reels / Video Çekimi',
  'QR Menü Kurulumu',
  'Powercoffee Kurulumu',
  'Fiziki Baskı / Tabela',
  'Influencer Marketing'
];

export default function FieldRouteView({ currentUser, authUser, teamMembers = [], onLeadUpdated }) {
  const isAdmin = isAdminOrManagerRole(authUser?.role) || isAdminOrManagerRole(currentUser?.role);
  const isFieldStaff = isFieldStaffRole(authUser?.role) || isFieldStaffRole(currentUser?.role);
  const canAccess = isAdmin || isFieldStaff;

  // Saha personellerini filtrele
  const fieldMembers = teamMembers.filter(m => isFieldStaffRole(m.role));

  // Giriş yapan saha personeliyse kendi ID'sini bul, yöneticiyse tümünü veya ilk saha personelini seçebilsin
  const [selectedFieldMemberId, setSelectedFieldMemberId] = useState(() => {
    if (!isAdmin && currentUser?.id) return String(currentUser.id);
    const matched = teamMembers.find(m => m.name?.toLowerCase() === authUser?.name?.toLowerCase());
    if (!isAdmin && matched?.id) return String(matched.id);
    return 'all';
  });

  const [pendingStops, setPendingStops] = useState([]);
  const [completedStops, setCompletedStops] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [districtFilter, setDistrictFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Sürükle-bırak state
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Ziyaret Notu ve Sonuçlandırma Modalı
  const [activeVisitModal, setActiveVisitModal] = useState(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [visitScore, setVisitScore] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [recallDate, setRecallDate] = useState('');
  const [recallTime, setRecallTime] = useState('14:00');
  const [submittingVisit, setSubmittingVisit] = useState(false);

  // Yönetici İçin Hızlı Sahaya İşletme Paslama Modalı
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateLeads, setCandidateLeads] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [assignTargetMemberId, setAssignTargetMemberId] = useState('');
  const [assignVisitDate, setAssignVisitDate] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigningLeadId, setAssigningLeadId] = useState(null);

  useEffect(() => {
    if (!isAdmin) {
      const matched = teamMembers.find(m => m.name?.toLowerCase() === (authUser?.name || currentUser?.name || '').toLowerCase());
      if (matched?.id) {
        setSelectedFieldMemberId(String(matched.id));
      } else if (currentUser?.id) {
        setSelectedFieldMemberId(String(currentUser.id));
      }
    }
  }, [isAdmin, authUser, currentUser, teamMembers]);

  useEffect(() => {
    if (fieldMembers.length > 0 && !assignTargetMemberId) {
      setAssignTargetMemberId(String(fieldMembers[0].id));
    }
  }, [fieldMembers, assignTargetMemberId]);

  const loadRoute = async () => {
    if (!canAccess) return;
    setLoading(true);
    try {
      const res = await getFieldRoute({
        field_member_id: selectedFieldMemberId === 'all' ? undefined : selectedFieldMemberId,
        district: districtFilter === 'all' ? undefined : districtFilter
      });
      setPendingStops(res.pending || []);
      setCompletedStops(res.completed || []);
      if (districtFilter === 'all') {
        setDistricts(res.districts || []);
      }
    } catch (err) {
      console.error('Saha rotası yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoute();
  }, [selectedFieldMemberId, districtFilter, canAccess]);

  const showToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // Sıralamayı değiştir ve veritabanına kaydet
  const applyNewOrder = async (newList, toastText = 'Rota sıralaması güncellendi.') => {
    setPendingStops(newList);
    setReordering(true);
    try {
      await reorderFieldRoute(newList.map(item => item.id));
      showToast(toastText);
    } catch (err) {
      console.error('Sıralama kaydedilemedi:', err);
      loadRoute();
    } finally {
      setReordering(false);
    }
  };

  // Durağı 1. sıraya (En Başa) al
  const moveToFirst = (index) => {
    if (index <= 0) return;
    const updated = [...pendingStops];
    const [moved] = updated.splice(index, 1);
    updated.unshift(moved);
    applyNewOrder(updated, `"${moved.name}" 1. sıraya (İlk Gidilecek Durak) alındı!`);
  };

  // Durağı 1 basamak yukarı / aşağı taşı
  const moveStep = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pendingStops.length) return;
    const updated = [...pendingStops];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    applyNewOrder(updated, `"${temp.name}" ${targetIndex + 1}. sıraya taşındı.`);
  };

  // Durağı doğrudan seçilen sıra numarasına taşı
  const moveToPosition = (currentIndex, newPositionNumber) => {
    const targetIndex = Number(newPositionNumber) - 1;
    if (targetIndex === currentIndex || targetIndex < 0 || targetIndex >= pendingStops.length) return;
    const updated = [...pendingStops];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);
    applyNewOrder(updated, `"${moved.name}" ${targetIndex + 1}. sıraya yerleştirildi.`);
  };

  // Drag & Drop işleyicileri
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    const updated = [...pendingStops];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setDraggedIndex(null);
    applyNewOrder(updated, `"${moved.name}" ${targetIndex + 1}. sıraya taşındı.`);
  };

  // Ziyaret Notu Modalını Aç
  const openVisitModal = (lead) => {
    setActiveVisitModal(lead);
    setVisitNotes('');
    setVisitScore(lead.score || 0);
    try {
      const parsedProds = lead.products ? JSON.parse(lead.products) : [];
      setSelectedProducts(Array.isArray(parsedProds) ? parsedProds : []);
    } catch {
      setSelectedProducts([]);
    }
    setNextVisitDate('');
    setRecallDate('');
    setRecallTime('14:00');
  };

  const toggleProduct = (prod) => {
    setSelectedProducts(prev =>
      prev.includes(prod) ? prev.filter(p => p !== prod) : [...prev, prod]
    );
  };

  const handleVisitOutcomeSubmit = async (outcome) => {
    if (!activeVisitModal) return;

    if (outcome === 'tekrar_ziyaret' && !nextVisitDate) {
      alert('Lütfen tekrar ziyaret edilecek tarihi seçiniz.');
      return;
    }
    if (outcome === 'randevu_arama' && !recallDate) {
      alert('Lütfen telefonla tekrar aranacak tarihi seçiniz.');
      return;
    }
    if (outcome === 'sadece_not' && !visitNotes.trim()) {
      alert('Lütfen kaydedilecek ziyaret notunu yazınız.');
      return;
    }

    setSubmittingVisit(true);
    try {
      const visitorName = authUser?.name || currentUser?.name || activeVisitModal.field_member_name || 'Saha Personeli';
      const res = await recordFieldVisit(activeVisitModal.id, {
        outcome,
        notes: visitNotes,
        visitor_name: visitorName,
        score: visitScore,
        products: selectedProducts.length > 0 ? selectedProducts : undefined,
        next_visit_date: nextVisitDate || undefined,
        recall_date: recallDate || undefined,
        recall_time: recallTime || undefined
      });

      showToast(res.message || 'Ziyaret notu kaydedildi.');
      setActiveVisitModal(null);
      await loadRoute();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      alert(`Kayıt hatası: ${err.response?.data?.error || err.message}`);
    } finally {
      setSubmittingVisit(false);
    }
  };

  // Yönetici için işletme arama ve sahaya paslama
  const searchCandidatesToAssign = async (e) => {
    if (e) e.preventDefault();
    setLoadingCandidates(true);
    try {
      const res = await getLeads({
        search: candidateSearch.trim() || undefined,
        limit: 40
      });
      setCandidateLeads(res.data || []);
    } catch (err) {
      console.error('İşletmeler aranamadı:', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleQuickAssignLead = async (lead) => {
    setAssigningLeadId(lead.id);
    try {
      const res = await assignToFieldRoute({
        lead_ids: [lead.id],
        field_member_id: assignTargetMemberId || undefined,
        visit_date: assignVisitDate || undefined,
        notes: assignNote || undefined,
        assigned_by: authUser?.name || currentUser?.name || 'Yönetici'
      });
      showToast(res.message || `"${lead.name}" saha rotasına paslandı.`);
      setAssignNote('');
      await loadRoute();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      alert(`Paslama hatası: ${err.response?.data?.error || err.message}`);
    } finally {
      setAssigningLeadId(null);
    }
  };

  // Google Haritalar Yol Tarifi URL oluşturucu
  const getNavigationUrl = (lead) => {
    if (lead.lat && lead.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lead.lat},${lead.lng}`;
    }
    if (lead.maps_url) {
      return lead.maps_url;
    }
    const q = encodeURIComponent(`${lead.name} ${lead.address || ''} ${lead.district || ''} ${lead.city || ''}`.trim());
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };

  if (!canAccess) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-rose-200 text-center space-y-3 max-w-lg mx-auto my-8">
        <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-extrabold text-slate-800">Yetkisiz Erişim</h2>
        <p className="text-xs text-slate-500">
          Saha Rotam ekranı yalnızca <strong>Yönetici (Admin)</strong> ve <strong>Saha Personeli</strong> yetkisine sahip kullanıcılar tarafından görüntülenebilir.
        </p>
      </div>
    );
  }

  const displayedList = (activeTab === 'pending' ? pendingStops : completedStops).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.district || '').toLowerCase().includes(q) ||
      (item.address || '').toLowerCase().includes(q) ||
      (item.phone || '').toLowerCase().includes(q) ||
      (item.call_notes || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      {/* ÜST BAŞLIK & SAHA KONTROL PANELİ */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />
                <span>Saha Operasyon & Rota Yönetimi</span>
              </span>
              {reordering && (
                <span className="bg-amber-500/20 text-amber-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                  Sıralama kaydediliyor...
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              🚗 Saha Rotam & Ziyaret Sıralaması
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
              Size paslanan işletmeleri gideceğiniz sıraya göre dizin (<strong>İlk gideceğinizi 1. sıraya alın</strong>), tek tıkla yol tarifi açın ve ziyaret sonrası hemen notunuzu kaydedin.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowAddStopModal(true);
                  searchCandidatesToAssign();
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>İşletme Seç & Sahaya Pasla</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadRoute}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl border border-white/15 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
          </div>
        </div>

        {/* Hızlı Özet Kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] text-emerald-200 font-bold uppercase">Gidilecek Durak</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {pendingStops.length} <span className="text-xs font-semibold text-emerald-300">İşletme</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] text-emerald-200 font-bold uppercase">Sıradaki (1. Durak)</span>
            <div className="text-sm sm:text-base font-extrabold text-amber-300 mt-1 truncate">
              {pendingStops[0] ? `🥇 ${pendingStops[0].name}` : 'Bekleyen durak yok'}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
            <span className="text-[11px] text-emerald-200 font-bold uppercase">Tamamlanan Ziyaret</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">
              {completedStops.length} <span className="text-xs font-semibold text-emerald-200">Ziyaret</span>
            </div>
          </div>
        </div>
      </div>

      {/* BİLDİRİM MESAJI */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold p-3.5 rounded-2xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* FİLTRE & SEKME ÇUBUĞU */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Sekmeler: Gidilecek Duraklar vs Tamamlananlar */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Gidilecek Duraklar</span>
              <span className={`px-2 py-0.2 rounded-full text-[11px] font-black ${
                activeTab === 'pending' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {pendingStops.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tamamlanan Ziyaretler</span>
              <span className={`px-2 py-0.2 rounded-full text-[11px] font-black ${
                activeTab === 'completed' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {completedStops.length}
              </span>
            </button>
          </div>

          {/* Sağ Filtreler: Saha Personeli (Admin için), İlçe ve Arama */}
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-500">Saha Personeli:</span>
                <select
                  value={selectedFieldMemberId}
                  onChange={(e) => setSelectedFieldMemberId(e.target.value)}
                  className="text-xs font-extrabold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="all">Tüm Saha Ekibi</option>
                  {(fieldMembers.length > 0 ? fieldMembers : teamMembers).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* İlçe Filtresi */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500">İlçe:</span>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="text-xs font-extrabold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">Tüm İlçeler ({districts.length})</option>
                {districts.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Hızlı Arama */}
            <div className="relative flex-1 sm:w-56 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Durak veya not ara..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DURAK LİSTESİ */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Saha rotanız hazırlanıyor...</p>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
          <Navigation className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-extrabold text-slate-700">
            {activeTab === 'pending' ? 'Şu Anda Bekleyen Saha Ziyareti Bulunmuyor' : 'Henüz Tamamlanmış Ziyaret Yok'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {activeTab === 'pending'
              ? 'Çağrı personeli "Randevu (Yüz Yüze Ziyaret)" aldığında veya yönetici sahaya iş pasladığında işletmeler otomatik olarak buraya düşer.'
              : 'Ziyaret edip not aldığınız işletmeler burada listelenir.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedList.map((lead, index) => {
            const isFirstStop = activeTab === 'pending' && index === 0;
            const noteLines = (lead.call_notes || '')
              .split('\n')
              .map(l => l.trim())
              .filter(Boolean);

            let parsedProducts = [];
            try {
              parsedProducts = lead.products ? JSON.parse(lead.products) : [];
            } catch {
              parsedProducts = [];
            }

            return (
              <div
                key={lead.id}
                draggable={activeTab === 'pending' && !searchQuery}
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isFirstStop
                    ? 'border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10'
                    : 'border-slate-200 shadow-xs hover:border-slate-300'
                }`}
              >
                {/* 1. DURAK ÖZEL BANNER */}
                {isFirstStop && (
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-1.5 text-xs font-black flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                      <span>🥇 SIRADAKİ HEDEFİNİZ (1. DURAK — İLK GİDİLECEK İŞLETME)</span>
                    </div>
                    <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-md">
                      Aktif Rota Başı
                    </span>
                  </div>
                )}

                <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-stretch justify-between gap-4">
                  {/* SOL: SIRA NUMARASI & SIRALAMA KONTROLLERİ */}
                  {activeTab === 'pending' && (
                    <div className="flex lg:flex-col items-center justify-between lg:justify-start gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 lg:w-28 shrink-0">
                      <div className="flex items-center lg:flex-col gap-2 lg:text-center">
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center shadow-xs ${
                            isFirstStop
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-white'
                          }`}
                        >
                          #{index + 1}
                        </div>
                        <div className="text-left lg:text-center">
                          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Rota Sırası
                          </span>
                          <select
                            value={index + 1}
                            onChange={(e) => moveToPosition(index, e.target.value)}
                            className="mt-0.5 text-xs font-extrabold text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            title="Gideceğiniz sırayı seçin"
                          >
                            {pendingStops.map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}. Durak
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Yukarı / Aşağı / En Başa Al Butonları */}
                      <div className="flex lg:flex-col items-center gap-1.5 w-auto lg:w-full">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => moveToFirst(index)}
                            className="px-2.5 py-1.5 lg:w-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer"
                            title="İlk gideceğim yer olarak en başa (1. sıraya) al"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>1. Sıraya Al</span>
                          </button>
                        )}
                        <div className="flex items-center gap-1 lg:w-full">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveStep(index, -1)}
                            className="flex-1 p-1.5 bg-white hover:bg-slate-100 disabled:opacity-35 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                            title="Bir sıra yukarı taşı"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === pendingStops.length - 1}
                            onClick={() => moveStep(index, 1)}
                            className="flex-1 p-1.5 bg-white hover:bg-slate-100 disabled:opacity-35 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                            title="Bir sıra aşağı taşı"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ORTA: İŞLETME DETAYLARI & ÇAĞRI ÖN NOTLARI */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-black text-slate-900">
                            {lead.name}
                          </h2>
                          {lead.district && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                              📍 {lead.district}
                            </span>
                          )}
                          {lead.category && (
                            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                              {lead.category}
                            </span>
                          )}
                          {lead.field_member_name && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                              🚗 Saha: {lead.field_member_name}
                            </span>
                          )}
                        </div>

                        {lead.address && (
                          <p className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{lead.address}</span>
                          </p>
                        )}
                      </div>

                      {/* Randevu Tarihi / Saati Rozeti */}
                      {lead.visit_date && (
                        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            Randevu: {lead.visit_date.replace('T', ' ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Müşteri İlgi Puanı & İlgilenilen Ürünler */}
                    {(lead.score > 0 || parsedProducts.length > 0) && (
                      <div className="flex items-center gap-3 flex-wrap">
                        {lead.score > 0 && (
                          <div className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= lead.score ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                                }`}
                              />
                            ))}
                            <span className="text-[11px] font-extrabold text-amber-800 ml-1">
                              ({lead.score}/5)
                            </span>
                          </div>
                        )}
                        {parsedProducts.map(prod => (
                          <span
                            key={prod}
                            className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-lg"
                          >
                            ✦ {prod}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ÇAĞRI PERSONELİNİN ALDIĞI ÖN NOTLAR VE GEÇMİŞ NOTLAR */}
                    <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          <span>Görüşme & Saha Notları ({noteLines.length})</span>
                        </span>
                      </div>
                      {noteLines.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          Henüz ön görüşme notu girilmemiş.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {noteLines.map((line, idx) => {
                            const parsed = parseCallNote(line);
                            return (
                              <div
                                key={idx}
                                className="bg-white/90 border border-amber-200/70 rounded-lg p-2 text-xs text-slate-800"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  {parsed.author && (
                                    <span className="font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded text-[11px]">
                                      {parsed.author}
                                    </span>
                                  )}
                                  {parsed.date && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                      📅 {parsed.date}
                                      {isAdmin && parsed.time ? ` ⏰ ${parsed.time}` : ''}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                                  {parsed.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SAĞ: SAHA AKSİYON BUTONLARI (YOL TARİFİ, ARA, ZİYARET NOTU GİR) */}
                  <div className="flex flex-col justify-between gap-2 lg:w-56 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-4">
                    <div className="space-y-2">
                      {/* 1. ZİYARET NOTU GİR & SONUÇLANDIR */}
                      <button
                        type="button"
                        onClick={() => openVisitModal(lead)}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>Ziyaret Notu Gir / Sonuçla</span>
                      </button>

                      {/* 2. TEK TIKLA YOL TARİFİ (HARİTA) */}
                      <a
                        href={getNavigationUrl(lead)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span>Yol Tarifi Al (Harita)</span>
                      </a>

                      {/* 3. TELEFON & WHATSAPP */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {lead.phone && lead.phone !== 'Numara Yok' ? (
                          <a
                            href={`tel:${lead.phone.replace(/[^0-9+]/g, '')}`}
                            className="py-2 px-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 text-center"
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>Ara</span>
                          </a>
                        ) : (
                          <span className="py-2 px-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center">
                            Numara Yok
                          </span>
                        )}

                        {lead.whatsapp_link ? (
                          <a
                            href={lead.whatsapp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <span className="py-2 px-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center">
                            WP Yok
                          </span>
                        )}
                      </div>
                    </div>

                    {lead.phone && (
                      <div className="text-[11px] font-bold text-slate-500 text-center bg-slate-50 rounded-lg py-1 px-2 border border-slate-200/60">
                        📞 {lead.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* ZİYARET NOTU GİRİŞ & SONUÇLANDIRMA MODALI */}
      {/* ============================================================== */}
      {activeVisitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  🚗 Saha Ziyaret Kaydı
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {activeVisitModal.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeVisitModal.district} • {activeVisitModal.address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVisitModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ziyaret Notu Alanı */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                ✍️ Saha Ziyaret Notunuz (Ne Konuşuldu, Kimle Görüşüldü?)
              </label>
              <textarea
                rows={4}
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                placeholder="Örn: İşletme sahibi Ahmet Bey ile yüz yüze görüşüldü, QR menü ve sosyal medya paketlerimiz anlatıldı, fiyat teklifi bırakıldı..."
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-2xl p-3 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Müşteri İlgi Derecesi */}
            <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200 rounded-2xl p-3">
              <span className="text-xs font-extrabold text-amber-900">
                ⭐ Müşteri İlgi Puanı:
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVisitScore(visitScore === val ? 0 : val)}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        val <= visitScore ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* İlgilenilen Hizmetler */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                📦 Müşterinin İlgilendiği Hizmet / Paketler (İsteğe Bağlı):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_OPTIONS.map(prod => {
                  const active = selectedProducts.includes(prod);
                  return (
                    <button
                      key={prod}
                      type="button"
                      onClick={() => toggleProduct(prod)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}{prod}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* İleri Tarih Seçicileri (Tekrar Ziyaret veya Tekrar Arama İçin) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  🔄 Tekrar Gidilecekse Yeni Ziyaret Tarihi:
                </label>
                <input
                  type="datetime-local"
                  value={nextVisitDate}
                  onChange={(e) => setNextVisitDate(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-800"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  📞 Telefonla Aranacaksa Tarih & Saat:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={recallDate}
                    onChange={(e) => setRecallDate(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800"
                  />
                  <input
                    type="time"
                    value={recallTime}
                    onChange={(e) => setRecallTime(e.target.value)}
                    className="w-24 text-xs bg-white border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* ZİYARET SONUÇ BUTONLARI */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Ziyaret Sonucunu Seçin & Kaydedin:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={submittingVisit}
                  onClick={() => handleVisitOutcomeSubmit('ziyaret_olumlu')}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>✅ Olumlu / Satış Havuzuna Aktar</span>
                </button>

                <button
                  type="button"
                  disabled={submittingVisit}
                  onClick={() => handleVisitOutcomeSubmit('sadece_not')}
                  className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>📝 Sadece Notu Kaydet (Rota Kalsın)</span>
                </button>

                <button
                  type="button"
                  disabled={submittingVisit}
                  onClick={() => handleVisitOutcomeSubmit('tekrar_ziyaret')}
                  className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>🔄 Tekrar Ziyaret Edilecek</span>
                </button>

                <button
                  type="button"
                  disabled={submittingVisit}
                  onClick={() => handleVisitOutcomeSubmit('randevu_arama')}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>📞 Telefonla Tekrar Aranacak</span>
                </button>

                <button
                  type="button"
                  disabled={submittingVisit}
                  onClick={() => handleVisitOutcomeSubmit('ziyaret_olumsuz')}
                  className="sm:col-span-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>❌ Ziyaret Olumsuz (İlgilenmiyor)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* YÖNETİCİ İÇİN HIZLI İŞLETME SEÇ & SAHAYA PASLA MODALI */}
      {/* ============================================================== */}
      {showAddStopModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  🚗 Saha Personeline İşletme Pasla
                </h3>
                <p className="text-xs text-slate-500">
                  İstediğiniz işletmeyi arayıp doğrudan saha personelinin rotasına ekleyebilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStopModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Atama Ayarları */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-emerald-50/70 border border-emerald-200 p-3 rounded-2xl">
              <div>
                <label className="block text-[11px] font-extrabold text-emerald-900 mb-1">
                  Paslanacak Saha Personeli:
                </label>
                <select
                  value={assignTargetMemberId}
                  onChange={(e) => setAssignTargetMemberId(e.target.value)}
                  className="w-full text-xs bg-white border border-emerald-300 rounded-xl px-2.5 py-2 font-bold text-slate-800"
                >
                  {(fieldMembers.length > 0 ? fieldMembers : teamMembers).map(m => (
                    <option key={m.id} value={m.id}>
                      🚗 {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-emerald-900 mb-1">
                  Ziyaret Tarihi (Opsiyonel):
                </label>
                <input
                  type="datetime-local"
                  value={assignVisitDate}
                  onChange={(e) => setAssignVisitDate(e.target.value)}
                  className="w-full text-xs bg-white border border-emerald-300 rounded-xl px-2.5 py-2 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-emerald-900 mb-1">
                  Saha Personeline Not (Opsiyonel):
                </label>
                <input
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Örn: Bugün saat 15:00 gibi uğra..."
                  className="w-full text-xs bg-white border border-emerald-300 rounded-xl px-2.5 py-2 font-medium text-slate-800"
                />
              </div>
            </div>

            {/* İşletme Arama */}
            <form onSubmit={searchCandidatesToAssign} className="flex gap-2">
              <input
                type="text"
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                placeholder="İşletme adı, ilçe veya telefon ara..."
                className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium"
              />
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Ara
              </button>
            </form>

            {/* Aday Listesi */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {loadingCandidates ? (
                <div className="text-center py-8 text-xs text-slate-500 font-bold">
                  İşletmeler yükleniyor...
                </div>
              ) : candidateLeads.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Arama kriterine uygun işletme bulunamadı.
                </div>
              ) : (
                candidateLeads.map(lead => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 bg-slate-50/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {lead.name}
                        </span>
                        {lead.district && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            {lead.district}
                          </span>
                        )}
                        {lead.field_member_name && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            Saha: {lead.field_member_name}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {lead.phone || 'Tel Yok'} • {lead.address || ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={assigningLeadId === lead.id}
                      onClick={() => handleQuickAssignLead(lead)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {assigningLeadId === lead.id ? 'Paslanıyor...' : '🚗 Sahaya Pasla'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
