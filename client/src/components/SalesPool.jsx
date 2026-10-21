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
  Trash2,
  Search,
  X
} from 'lucide-react';
import { getLeads, getJobs, createJob, updateJob, deleteJob, getCategories, getTeamMembers, parseCallNote } from '../api';

// Kategori bazlı ürün/hizmet paketleri
const CATEGORY_PRODUCTS = {
  'Web Hizmetleri': ['Web Sitesi Tasarımı', 'E-Ticaret Sitesi', 'SEO Çalışması', 'Kurumsal E-Posta Kurulumu', 'Hosting & Bakım'],
  'Sosyal Medya': ['Sosyal Medya İçerik Yönetimi', 'Meta (Instagram/FB) Reklamları', 'Reels / Video Çekimi', 'Hikaye Tasarımları', 'Topluluk Yönetimi'],
  'Influencer Marketing': ['Influencer İşbirliği Kampanyası', 'Blogger Daveti', 'Mikro-Influencer Ziyaretleri', 'Etkinlik Tanıtımı'],
  'Powercoffee': ['Powercoffee Bayilik / Konsept', 'Kurumsal Kahve Tedariği', 'Barista Eğitimi', 'Kahve Köşesi Kurulumu'],
  'QR Menü': ['QR Menü Kurulumu', 'Self-Order Entegrasyonu', 'Menü Fotoğraf Çekimi', 'Masa Standı & QR Kod Baskısı'],
  'Fiziki Baskı': ['Kartvizit Baskısı', 'Broşür & El İlanı', 'Işıklı/Işıksız Tabela', 'Yelken Bayrak / Rollup', 'Ambalaj & Poşet Tasarımı']
};

export default function SalesPool({ currentUser, authUser, onJobCreated }) {
  const isAdmin = authUser?.role === 'admin';
  const [salesLeads, setSalesLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kategori ve Personel Filtresi
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('all');

  // Çoklu Ayrı İş Atama Modalı
  const [distributeModalLead, setDistributeModalLead] = useState(null);
  const [jobEntries, setJobEntries] = useState([]);
  const [splitProductsAsSeparateJobs, setSplitProductsAsSeparateJobs] = useState(true);
  const [keepInPool, setKeepInPool] = useState(false);
  const [jobNotes, setJobNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');

  // Herhangi Bir İşletmeye Yeni İş Ekleme Arama Modalı
  const [showPickBusinessModal, setShowPickBusinessModal] = useState(false);
  const [businessSearchQuery, setBusinessSearchQuery] = useState('');
  const [searchedBusinesses, setSearchedBusinesses] = useState([]);
  const [searchingBusinesses, setSearchingBusinesses] = useState(false);

  const getDefaultDueDate = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
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
    } catch (err) {
      console.error('Veri yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategoryFilter, selectedMemberFilter]);

  // Yeni bir iş satırı objesi üretici
  const createNewJobEntry = (leadName, catObj, customProducts = []) => {
    const targetCat = catObj || categories[0] || { id: 1, name: 'Web Hizmetleri', default_member_id: teamMembers[0]?.id };
    const defaultMemberId = targetCat.default_member_id || teamMembers[0]?.id || '';
    const serviceLabel = customProducts.length === 1 ? customProducts[0] : targetCat.name;
    return {
      key: `${Date.now()}-${Math.random()}`,
      category_id: targetCat.id,
      assigned_member_id: defaultMemberId,
      due_date: getDefaultDueDate(),
      products: customProducts,
      title: `${leadName} - ${serviceLabel}`,
      customTitleEdited: false
    };
  };

  // İş Dağıtım Modalını Aç (İster Satış Havuzundan, İster Mevcut İş Tablosundan "+ Ek İş Ekle" ile)
  const openDistributeModal = (lead, preselectedCatId = null) => {
    setDistributeModalLead(lead);
    setJobNotes(lead.call_notes || lead.notes || '');
    setKeepInPool(false);
    setSplitProductsAsSeparateJobs(true);

    const initialCat = preselectedCatId
      ? categories.find(c => c.id === Number(preselectedCatId)) || categories[0]
      : categories[0];

    setJobEntries([createNewJobEntry(lead.name, initialCat)]);
  };

  // Aynı işletme için 2. / 3. ayrı bir iş kategorisi satırı ekle
  const addAnotherJobEntry = (catId = null) => {
    if (!distributeModalLead) return;
    let targetCat = null;
    if (catId) {
      targetCat = categories.find(c => c.id === Number(catId));
    } else {
      // Henüz seçilmemiş ilk kategoriyi bul
      const usedCatIds = new Set(jobEntries.map(e => Number(e.category_id)));
      targetCat = categories.find(c => !usedCatIds.has(Number(c.id))) || categories[0];
    }
    setJobEntries(prev => [...prev, createNewJobEntry(distributeModalLead.name, targetCat)]);
  };

  const removeJobEntry = (key) => {
    if (jobEntries.length <= 1) return;
    setJobEntries(prev => prev.filter(item => item.key !== key));
  };

  const updateJobEntryCategory = (key, newCatId) => {
    const cat = categories.find(c => c.id === Number(newCatId));
    setJobEntries(prev =>
      prev.map(item => {
        if (item.key !== key) return item;
        const nextMemberId = cat?.default_member_id || item.assigned_member_id;
        const nextTitle = item.customTitleEdited
          ? item.title
          : `${distributeModalLead?.name || ''} - ${cat?.name || 'Hizmet'}`;
        return {
          ...item,
          category_id: Number(newCatId),
          assigned_member_id: nextMemberId,
          products: [],
          title: nextTitle
        };
      })
    );
  };

  const toggleJobEntryProduct = (key, prod) => {
    setJobEntries(prev =>
      prev.map(item => {
        if (item.key !== key) return item;
        const exists = item.products.includes(prod);
        const nextProds = exists
          ? item.products.filter(p => p !== prod)
          : [...item.products, prod];
        const cat = categories.find(c => c.id === Number(item.category_id));
        const autoSuffix = nextProds.length > 0 ? nextProds.join(' + ') : (cat?.name || 'Hizmet');
        const nextTitle = item.customTitleEdited
          ? item.title
          : `${distributeModalLead?.name || ''} - ${autoSuffix}`;
        return {
          ...item,
          products: nextProds,
          title: nextTitle
        };
      })
    );
  };

  const updateJobEntryField = (key, field, value) => {
    setJobEntries(prev =>
      prev.map(item => {
        if (item.key !== key) return item;
        const updated = { ...item, [field]: value };
        if (field === 'title') {
          updated.customTitleEdited = true;
        }
        return updated;
      })
    );
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!distributeModalLead || jobEntries.length === 0) return;

    // Oluşturulacak ayrı işlerin listesini hazırla
    const finalJobsList = [];

    for (const entry of jobEntries) {
      if (!entry.due_date) {
        alert('Lütfen tüm işler için teslim tarihi belirleyiniz.');
        return;
      }
      const cat = categories.find(c => c.id === Number(entry.category_id));
      const catName = cat?.name || 'Hizmet';

      // Eğer bir kategori altında birden fazla alt ürün seçildiyse ve "Ayrı iş olarak böl" aktifse her ürünü de ayrı iş yap
      if (splitProductsAsSeparateJobs && entry.products.length > 1) {
        for (const prod of entry.products) {
          finalJobsList.push({
            category_id: Number(entry.category_id),
            assigned_member_id: Number(entry.assigned_member_id) || null,
            due_date: entry.due_date,
            title: `${distributeModalLead.name} - ${prod}`,
            products: [prod],
            notes: jobNotes
          });
        }
      } else {
        const cleanTitle = (entry.title || `${distributeModalLead.name} - ${entry.products[0] || catName}`).trim();
        finalJobsList.push({
          category_id: Number(entry.category_id),
          assigned_member_id: Number(entry.assigned_member_id) || null,
          due_date: entry.due_date,
          title: cleanTitle,
          products: entry.products,
          notes: jobNotes
        });
      }
    }

    setSubmitting(true);
    try {
      const res = await createJob({
        lead_id: distributeModalLead.id,
        jobs_list: finalJobsList,
        notes: jobNotes,
        keep_in_pool: keepInPool
      });

      setSuccessNotice(
        res.message ||
        `${finalJobsList.length} ayrı iş başarıyla oluşturuldu ve Alınan İşler listesine eklendi!`
      );
      setDistributeModalLead(null);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4500);
    } catch (err) {
      alert(`İş atama hatası: ${err.response?.data?.error || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (jobId, newStatus) => {
    try {
      await updateJob(jobId, { status: newStatus });
      loadData();
      if (onJobCreated) onJobCreated();
    } catch (err) {
      alert(`Güncelleme hatası: ${err.message}`);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Bu iş kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await deleteJob(jobId);
      loadData();
      if (onJobCreated) onJobCreated();
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  // İşletme Arama (Mevcut bir işletmeye yeni iş eklemek için)
  const handleSearchBusinesses = async (e) => {
    if (e) e.preventDefault();
    setSearchingBusinesses(true);
    try {
      const res = await getLeads({
        search: businessSearchQuery.trim() || undefined,
        limit: 30
      });
      setSearchedBusinesses(res.data || []);
    } catch (err) {
      console.error('İşletme aranamadı:', err);
    } finally {
      setSearchingBusinesses(false);
    }
  };

  // Aynı işletmeye ait kaç ayrı iş olduğunu say
  const jobCountByLeadId = jobs.reduce((acc, j) => {
    acc[j.lead_id] = (acc[j.lead_id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      
      {/* Üst Banner */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="bg-white/20 text-purple-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
              Adım 7 & 8: Satış Havuzu, Kategori Sınıflandırma & Çoklu İş Dağıtımı
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
              Satış Havuzu ve İş Dağıtım Masası
            </h1>
            <p className="text-purple-100/90 text-sm max-w-3xl leading-relaxed">
              Bir işletmeden birden fazla iş aldıysanız (örneğin hem <strong>Web Sitesi</strong> hem <strong>Sosyal Medya Yönetimi</strong>), her birini ayrı iş olarak atayabilir ve ayrı ayrı takip edebilirsiniz.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowPickBusinessModal(true);
              handleSearchBusinesses();
            }}
            className="bg-white text-purple-900 hover:bg-purple-50 font-black text-xs px-4 py-3 rounded-xl shadow-md flex items-center gap-2 shrink-0 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5] text-purple-700" />
            <span>İşletme Seç & Yeni İş Ekle</span>
          </button>
        </div>
      </div>

      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 1. KISIM: SATIŞ HAVUZUNDA DAĞITIM BEKLEYEN İŞLETMELER */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Dağıtım Bekleyen Satış Havuzu ({salesLeads.length})
              </h2>
              <p className="text-xs text-slate-500">
                Arama veya ziyaretten olumlu çıkan işletmelere bir veya birden fazla iş kategorisi atayınız
              </p>
            </div>
          </div>
        </div>

        {salesLeads.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
            Şu anda dağıtım bekleyen yeni satış bulunmuyor. Mevcut bir müşteriye ikinci bir iş eklemek için aşağıdaki tablodan <strong>"+ Ek İş Ekle"</strong> butonunu veya üstteki <strong>"İşletme Seç & Yeni İş Ekle"</strong> butonunu kullanabilirsiniz.
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
                    <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                      {lead.call_notes.split('\n').filter(Boolean).map((noteLine, idx) => {
                        const parsed = parseCallNote(noteLine);
                        return (
                          <div key={idx} className="text-xs bg-white p-2 rounded-lg border border-purple-100 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="font-bold text-purple-800 text-[11px]">
                                {parsed.author || 'Operatör'}
                              </span>
                              {(parsed.date || (isAdmin && parsed.time)) && (
                                <div className="text-[10px] text-slate-500 flex items-center gap-1 bg-purple-50/60 px-1.5 py-0.5 rounded border border-purple-100">
                                  {parsed.date && <span>📅 {parsed.date}</span>}
                                  {isAdmin && parsed.time && (
                                    <span className="text-purple-700 font-semibold ml-0.5 pl-1 border-l border-purple-200" title="Sadece Yöneticiler Görebilir">
                                      ⏰ {parsed.time}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-slate-700 italic text-[11px]">
                              "{parsed.content}"
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openDistributeModal(lead)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Kategori & Çalışana İş Dağıt (Tek / Çoklu)</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. KISIM: ALINAN VE DEVAM EDEN İŞLER (HER İŞ AYRI SATIRDA GÖSTERİLİR) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Filtreleme Başlığı */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Alınan ve Devam Eden İşler ({jobs.length} Ayrı İş)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aynı işletmeden alınan her hizmet (Örn: Web Sitesi ve Sosyal Medya) ayrı birer iş satırı olarak takip edilir
            </p>
          </div>

          {/* Kategori ve Kişi Filtresi */}
          <div className="flex flex-wrap items-center gap-2">
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
                <th className="p-3.5">Alınan İş / Hizmet Başlığı</th>
                <th className="p-3.5">Müşteri İşletme</th>
                <th className="p-3.5">Hizmet Kategorisi</th>
                <th className="p-3.5">Sorumlu Kişi</th>
                <th className="p-3.5">Teslim Tarihi (Deadline)</th>
                <th className="p-3.5">Durum</th>
                <th className="p-3.5 text-right">İşlem / Ek İş</th>
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

                  let parsedProds = [];
                  try {
                    parsedProds = job.products ? JSON.parse(job.products) : [];
                  } catch {
                    parsedProds = [];
                  }

                  const totalJobsForThisLead = jobCountByLeadId[job.lead_id] || 1;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      
                      {/* İş Başlığı ve Alt Hizmet Rozetleri */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{job.title}</span>
                        </div>
                        {parsedProds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parsedProds.map(p => (
                              <span
                                key={p}
                                className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold px-2 py-0.2 rounded-md"
                              >
                                ✦ {p}
                              </span>
                            ))}
                          </div>
                        )}
                        {job.notes && (
                          <div className="text-slate-500 text-[11px] truncate max-w-xs mt-1" title={job.notes}>
                            {job.notes}
                          </div>
                        )}
                      </td>

                      {/* Müşteri */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-800">
                            {job.lead_name}
                          </span>
                          {totalJobsForThisLead > 1 && (
                            <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                              {totalJobsForThisLead} Ayrı İş
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {job.lead_district} • {job.lead_phone}
                        </div>
                      </td>

                      {/* Hizmet Kategorisi */}
                      <td className="p-3.5">
                        <span 
                          className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-lg text-white shadow-2xs"
                          style={{ backgroundColor: job.category_color || '#6366f1' }}
                        >
                          {job.category_name || 'Genel Hizmet'}
                        </span>
                      </td>

                      {/* Sorumlu Kişi */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-2xs shrink-0"
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

                      {/* Ek İş Ekle & Sil */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openDistributeModal({
                                id: job.lead_id,
                                name: job.lead_name,
                                district: job.lead_district,
                                phone: job.lead_phone,
                                notes: job.notes
                              })
                            }
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-extrabold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            title={`${job.lead_name} işletmesi için yeni/ek bir iş daha ekle`}
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                            <span>Ek İş Ekle</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job.id)}
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Bu İşi Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ============================================================== */}
      {/* ÇOKLU / AYRI AYRI İŞ DAĞITIMI MODALI */}
      {/* ============================================================== */}
      {distributeModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                  İşletmeye Ayrı Ayrı İş Tanımlama & Dağıtım
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  {distributeModalLead.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Birden fazla iş aldıysanız (Örn: hem <strong>Web Sitesi</strong> hem <strong>Sosyal Medya</strong>), aşağıdaki <strong>"+ Başka Bir İş / Kategori Daha Ekle"</strong> butonuyla hepsini ayrı ayrı ekleyebilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDistributeModalLead(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="mt-4 space-y-4">
              {/* Hızlı Kategori Ekleme Çubuğu */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-extrabold text-purple-950">
                    ⚡ Bu İşletmeden Alınan Diğer İşleri Hızlıca Ekleyin:
                  </span>
                  <button
                    type="button"
                    onClick={() => addAnotherJobEntry()}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>+ Yeni Ayrı İş Satırı Ekle</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => addAnotherJobEntry(cat.id)}
                      className="text-[11px] font-bold bg-white hover:bg-purple-100 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      + {cat.name} İşi Ekle
                    </button>
                  ))}
                </div>
              </div>

              {/* EKLENECEK İŞ SATIRLARI LİSTESİ */}
              <div className="space-y-3">
                {jobEntries.map((entry, idx) => {
                  const currentCat = categories.find(c => c.id === Number(entry.category_id));
                  const prods = currentCat?.name ? (CATEGORY_PRODUCTS[currentCat.name] || []) : [];

                  return (
                    <div
                      key={entry.key}
                      className="bg-slate-50 border-2 border-slate-200/90 rounded-2xl p-4 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-0.5 rounded-lg">
                          {idx + 1}. Ayrı İş Kaydı ({currentCat?.name || 'Hizmet'})
                        </span>

                        {jobEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeJobEntry(entry.key)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Bu İşi Kaldır</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Hizmet Kategorisi */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                            Hizmet Kategorisi:
                          </label>
                          <select
                            value={entry.category_id}
                            onChange={(e) => updateJobEntryCategory(entry.key, e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 cursor-pointer"
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Sorumlu Kişi */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                            Sorumlu Ekip Üyesi:
                          </label>
                          <select
                            value={entry.assigned_member_id}
                            onChange={(e) => updateJobEntryField(entry.key, 'assigned_member_id', e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 cursor-pointer"
                          >
                            {teamMembers.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} — {m.role}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* İş Başlığı */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                            İş / Proje Başlığı (Listede Gözükecek Ad):
                          </label>
                          <input
                            type="text"
                            required
                            value={entry.title}
                            onChange={(e) => updateJobEntryField(entry.key, 'title', e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                          />
                        </div>

                        {/* Teslim Tarihi */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                            Kesin Teslim Tarihi:
                          </label>
                          <input
                            type="date"
                            required
                            value={entry.due_date}
                            onChange={(e) => updateJobEntryField(entry.key, 'due_date', e.target.value)}
                            className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Kategoriye Özel Alt Hizmetler */}
                      {prods.length > 0 && (
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                            Alt Hizmet / Paket Seçimi ({entry.products.length} seçildi):
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {prods.map(prod => {
                              const checked = entry.products.includes(prod);
                              return (
                                <button
                                  key={prod}
                                  type="button"
                                  onClick={() => toggleJobEntryProduct(entry.key, prod)}
                                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                    checked
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {checked ? '✓ ' : '+ '}{prod}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Alt Seçenek: Çoklu Ürünleri Ayrı İş Olarak Böl */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitProductsAsSeparateJobs}
                    onChange={(e) => setSplitProductsAsSeparateJobs(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm"
                  />
                  <span>Birden fazla alt paket seçilirse her birini ayrı iş satırı olarak oluştur</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepInPool}
                    onChange={(e) => setKeepInPool(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm"
                  />
                  <span>İşletmeyi Satış Havuzunda da tut</span>
                </label>
              </div>

              {/* Ortak Proje Notları */}
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
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? 'Kaydediliyor...'
                    : `${jobEntries.length > 1 ? `${jobEntries.length} Ayrı İşi Onayla ve Ekle` : 'İşi Onayla ve Ekle'}`}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* HERHANGİ BİR İŞLETMEYİ SEÇİP YENİ / EK İŞ EKLEME MODALI */}
      {/* ============================================================== */}
      {showPickBusinessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ➕ İşletme Seç & Yeni İş Ekle
                </h3>
                <p className="text-xs text-slate-500">
                  Mevcut veya yeni herhangi bir işletmeyi arayıp birden fazla iş tanımlayabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPickBusinessModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchBusinesses} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={businessSearchQuery}
                  onChange={(e) => setBusinessSearchQuery(e.target.value)}
                  placeholder="İşletme adı ara (Örn: Parla Butik)..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 font-medium"
                />
              </div>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Ara
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {searchingBusinesses ? (
                <div className="text-center py-8 text-xs text-slate-500 font-bold">
                  İşletmeler aranıyor...
                </div>
              ) : searchedBusinesses.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  İşletme bulunamadı.
                </div>
              ) : (
                searchedBusinesses.map(b => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-purple-300 bg-slate-50/60"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs text-slate-900 truncate">
                        {b.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {b.district} • {b.phone || 'Tel Yok'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPickBusinessModal(false);
                        openDistributeModal(b);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shrink-0 cursor-pointer"
                    >
                      + İş Ekle
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
