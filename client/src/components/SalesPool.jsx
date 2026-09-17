import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  CheckCircle2, 
  UserCheck, 
  Calendar, 
  Clock, 
  Plus, 
  Filter, 
  Sparkles, 
  Layers, 
  AlertCircle,
  ExternalLink,
  Phone,
  Building2,
  Trash2
} from 'lucide-react';
import { getLeads, getJobs, createJob, updateJob, deleteJob, getCategories, getTeamMembers } from '../api';

export default function SalesPool({ currentUser, onJobCreated }) {
  const [salesLeads, setSalesLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kategori Filtresi (7. Adım: Belirleyeceğim kategorilerde listeleyebileyim)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('all');

  // İş Atama Modalı
  const [distributeModalLead, setDistributeModalLead] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [assignedMemberId, setAssignedMemberId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [jobNotes, setJobNotes] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');

  // Örnek projedeki kategori bazlı ürün/hizmet paketleri
  const CATEGORY_PRODUCTS = {
    'Web Hizmetleri': ['Web Sitesi Tasarımı', 'E-Ticaret Sitesi', 'SEO Çalışması', 'Kurumsal E-Posta Kurulumu', 'Hosting & Bakım'],
    'Sosyal Medya': ['Sosyal Medya İçerik Yönetimi', 'Meta (Instagram/FB) Reklamları', 'Reels / Video Çekimi', 'Hikaye Tasarımları', 'Topluluk Yönetimi'],
    'Influencer Marketing': ['Influencer İşbirliği Kampanyası', 'Blogger Daveti', 'Mikro-Influencer Ziyaretleri', 'Etkinlik Tanıtımı'],
    'Powercoffee': ['Powercoffee Bayilik / Konsept', 'Kurumsal Kahve Tedariği', 'Barista Eğitimi', 'Kahve Köşesi Kurulumu'],
    'QR Menü': ['QR Menü Kurulumu', 'Self-Order Entegrasyonu', 'Menü Fotoğraf Çekimi', 'Masa Standı & QR Kod Baskısı'],
    'Fiziki Baskı': ['Kartvizit Baskısı', 'Broşür & El İlanı', 'Işıklı/Işıksız Tabela', 'Yelken Bayrak / Rollup', 'Ambalaj & Poşet Tasarımı']
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadsRes, jobsRes, catsRes, membersRes] = await Promise.all([
        getLeads({ status: 'satis_havuzu' }),
        getJobs({
          category_id: selectedCategoryFilter === 'all' ? undefined : selectedCategoryFilter,
          member_id: selectedMemberFilter === 'all' ? undefined : selectedMemberFilter
        }),
        getCategories(),
        getTeamMembers()
      ]);

      setSalesLeads(leadsRes.data || []);
      setJobs(jobsRes.data || []);
      setCategories(catsRes.data || []);
      setTeamMembers(membersRes.data || []);

      if (catsRes.data && catsRes.data.length > 0 && !categoryId) {
        setCategoryId(catsRes.data[0].id);
        if (catsRes.data[0].default_member_id) {
          setAssignedMemberId(catsRes.data[0].default_member_id);
        }
      }
    } catch (err) {
      console.error('Veri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategoryFilter, selectedMemberFilter]);

  // Kategori seçildiğinde diyagramdaki varsayılan kişiyi otomatik seç
  const handleCategoryChange = (catId) => {
    setCategoryId(catId);
    setSelectedProducts([]);
    const cat = categories.find(c => c.id === Number(catId));
    if (cat && cat.default_member_id) {
      setAssignedMemberId(cat.default_member_id);
    }
  };

  const toggleProduct = (prod) => {
    setSelectedProducts(prev => 
      prev.includes(prod) ? prev.filter(p => p !== prod) : [...prev, prod]
    );
  };

  const openDistributeModal = (lead) => {
    setDistributeModalLead(lead);
    setJobTitle(`${lead.name} - Dijital Dönüşüm Paketi`);
    setSelectedProducts([]);
    // Teslim tarihi için varsayılan 7 gün sonrasını ayarla
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDueDate(nextWeek.toISOString().split('T')[0]);
    setJobNotes(lead.call_notes || '');
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!distributeModalLead || !dueDate) {
      alert('Lütfen teslim tarihi belirleyiniz.');
      return;
    }

    setSubmitting(true);
    try {
      await createJob({
        lead_id: distributeModalLead.id,
        category_id: Number(categoryId),
        assigned_member_id: Number(assignedMemberId),
        title: jobTitle,
        due_date: dueDate,
        notes: jobNotes,
        products: selectedProducts
      });


      setSuccessNotice(`İş başarıyla atandı ve ${dueDate} teslim tarihi takvime işlendi!`);
      setDistributeModalLead(null);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err) {
      alert(`İş atama hatası: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (jobId, newStatus) => {
    try {
      await updateJob(jobId, { status: newStatus });
      loadData();
    } catch (err) {
      alert(`Güncelleme hatası: ${err.message}`);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Bu iş kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await deleteJob(jobId);
      loadData();
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Üst Banner */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <span className="bg-white/20 text-purple-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
          Adım 7 & 8: Satış Havuzu, Kategori Sınıflandırma & Ekip İş Dağıtımı
        </span>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
          Satış Havuzu ve İş Dağıtım Masası
        </h1>
        <p className="text-purple-100/90 text-sm max-w-3xl leading-relaxed">
          Görüşmesi olumlu tamamlanan veya doğrudan satışa dönen işletmeleri hizmet kategorilerine (Web, Sosyal Medya, Influencer, QR Menü, Baskı) ayırın; Sezai, Yeş, Burak veya Emre'ye <strong>kesin teslim tarihi (deadline)</strong> ile atayın.
        </p>
      </div>

      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 1. KISIM: SATIŞ HAVUZUNDA DAĞITIM BEKLEYEN İŞLETMELER */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Dağıtım Bekleyen Satış Havuzu ({salesLeads.length})
              </h2>
              <p className="text-xs text-slate-500">
                Arama veya ziyaretten olumlu çıkan işletmelere iş kategorisi ve çalışan atayınız
              </p>
            </div>
          </div>
        </div>

        {salesLeads.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
            Şu anda dağıtım bekleyen yeni satış bulunmuyor. 'Günlük Arama' panelinden olumlu sonuçlanan işletmeler buraya düşecektir.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesLeads.map((lead) => (
              <div 
                key={lead.id}
                className="bg-purple-50/40 border border-purple-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      {lead.name}
                    </h3>
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Satış Onaylandı
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {lead.district} • {lead.phone}
                  </p>
                  {lead.call_notes && (
                    <p className="text-xs text-slate-700 bg-white p-2 rounded-lg mt-2 border border-purple-100 italic">
                      "{lead.call_notes}"
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openDistributeModal(lead)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Kategori & Çalışana İşi Dağıt</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. KISIM: ATANMIŞ İŞLER VE KATEGORİYE GÖRE LİSTELEME (7. Adım) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Filtreleme Başlığı */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Alınan ve Devam Eden İşler ({jobs.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hizmet kategorisi, sorumlu ekip üyesi ve teslim tarihi takibi
            </p>
          </div>

          {/* Kategori ve Kişi Filtresi */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Kategori Filtresi (7. Adım) */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500">Kategori:</span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
              >
                <option value="all">Tüm Kategoriler</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Çalışan Filtresi (8. Adım) */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500">Çalışan:</span>
              <select
                value={selectedMemberFilter}
                onChange={(e) => setSelectedMemberFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
              >
                <option value="all">Tüm Ekip</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* İş Tablosu */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-600 uppercase font-bold border-b border-slate-200 tracking-wider">
              <tr>
                <th className="p-3.5">İş / Proje Başlığı</th>
                <th className="p-3.5">Müşteri İşletme</th>
                <th className="p-3.5">Hizmet Kategorisi</th>
                <th className="p-3.5">Sorumlu Kişi</th>
                <th className="p-3.5">Teslim Tarihi (Deadline)</th>
                <th className="p-3.5">Durum</th>
                <th className="p-3.5 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 font-medium">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Seçili filtrelere uygun iş bulunamadı.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const isCompleted = job.status === 'tamamlandi';
                  const isRevision = job.status === 'revizyonda';
                  
                  // Teslim tarihine kalan gün kontrolü
                  const due = new Date(job.due_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const diffTime = due.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const isOverdue = diffDays < 0 && !isCompleted;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      
                      {/* İş Başlığı */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {job.title}
                        </div>
                        {job.notes && (
                          <div className="text-slate-500 text-[11px] truncate max-w-xs mt-0.5">
                            {job.notes}
                          </div>
                        )}
                      </td>

                      {/* Müşteri */}
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">
                          {job.lead_name}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {job.lead_district} • {job.lead_phone}
                        </div>
                      </td>

                      {/* Hizmet Kategorisi (7. Adım) */}
                      <td className="p-3.5">
                        <span 
                          className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-lg text-white shadow-2xs"
                          style={{ backgroundColor: job.category_color || '#6366f1' }}
                        >
                          {job.category_name}
                        </span>
                      </td>

                      {/* Sorumlu Kişi (8. Adım) */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-2xs"
                            style={{ backgroundColor: job.member_color || '#2563eb' }}
                          >
                            {job.member_name ? job.member_name.slice(0, 2).toUpperCase() : '?'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {job.member_name || 'Atanmadı'}
                            </div>
                            <div className="text-slate-400 text-[10px]">
                              {job.member_role?.split('&')[0]}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Teslim Tarihi */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(job.due_date).toLocaleDateString('tr-TR')}</span>
                          </div>
                          <div>
                            {isCompleted ? (
                              <span className="text-emerald-600 text-[10px] font-bold">Tamamlandı</span>
                            ) : isOverdue ? (
                              <span className="text-red-600 text-[10px] font-bold bg-red-50 px-1.5 py-0.5 rounded-sm">
                                {Math.abs(diffDays)} gün gecikti!
                              </span>
                            ) : diffDays === 0 ? (
                              <span className="text-amber-600 text-[10px] font-bold bg-amber-50 px-1.5 py-0.5 rounded-sm">
                                Bugün teslim!
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">
                                {diffDays} gün kaldı
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Durum Değiştirici */}
                      <td className="p-3.5">
                        <select
                          value={job.status}
                          onChange={(e) => handleUpdateStatus(job.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-hidden cursor-pointer ${
                            isCompleted 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : isRevision
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}
                        >
                          <option value="devam_ediyor">Devam Ediyor</option>
                          <option value="revizyonda">Revizyonda</option>
                          <option value="tamamlandi">Tamamlandı</option>
                        </select>
                      </td>

                      {/* Silme */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteJob(job.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                          title="İşi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* İŞ DAĞITIMI MODALI (8. Adım) */}
      {distributeModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                  Diyagram: Satış Havuzu → İş Dağıtımı
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  {distributeModalLead.name}
                </h3>
              </div>
              <button
                onClick={() => setDistributeModalLead(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="mt-4 space-y-3.5">
              
              {/* İş Başlığı */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  İş / Proje Başlığı:
                </label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              {/* Hizmet Kategorisi (Diyagram: Web, Sosyal Medya, Influencer, QR Menü, Baskı) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hizmet Kategorisi:
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden cursor-pointer"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Örnek Proje Özelliği: Kategoriye Özel Teslim Edilecek Ürünler / Paketler */}
              {(() => {
                const currentCatName = categories.find(c => c.id === Number(categoryId))?.name;
                const prods = currentCatName ? CATEGORY_PRODUCTS[currentCatName] : [];
                if (!prods || prods.length === 0) return null;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Teslim Edilecek Hizmetler / Ürünler ({selectedProducts.length} seçildi):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {prods.map(prod => {
                        const checked = selectedProducts.includes(prod);
                        return (
                          <label 
                            key={prod} 
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              checked 
                                ? 'bg-purple-100/70 border-purple-300 text-purple-900' 
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(prod)}
                              className="w-3.5 h-3.5 text-purple-600 rounded-sm border-slate-300"
                            />
                            <span>{prod}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Atanacak Ekip Üyesi (Diyagram: Sezai, Yeş, Burak, Emre) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Atanacak Çalışma Arkadaşı:
                </label>
                <select
                  value={assignedMemberId}
                  onChange={(e) => setAssignedMemberId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden cursor-pointer"
                >
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Teslim Tarihi (Deadline) - 8. Adım */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                  Kesin Teslim Tarihi (Teslimat Takvimine Eklenir):
                </label>
                <input
                  type="date"

                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Müşteri Beklentileri & Proje Notları:
                </label>
                <textarea
                  rows={2}
                  value={jobNotes}
                  onChange={(e) => setJobNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDistributeModalLead(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Atanıyor...' : 'İşi Onayla ve Takvime Ekle'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
