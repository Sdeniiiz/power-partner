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
  Pencil,
  X,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  Send,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { getLeads, getJobs, createJob, updateJob, deleteJob, getCategories, getTeamMembers, parseCallNote, updateSalesPoolLeadStatus, isFieldStaffRole } from '../api';
import AdminCompletedFinanceSection from './AdminCompletedFinanceSection';

// Kategori bazlı ürün/hizmet paketleri
const CATEGORY_PRODUCTS = {
  'Web Hizmetleri': ['Web Sitesi Tasarımı', 'E-Ticaret Sitesi', 'SEO Çalışması', 'Kurumsal E-Posta Kurulumu', 'Hosting & Bakım'],
  'Sosyal Medya': ['Sosyal Medya İçerik Yönetimi', 'Meta (Instagram/FB) Reklamları', 'Reels / Video Çekimi', 'Hikaye Tasarımları', 'Topluluk Yönetimi'],
  'Influencer Marketing': ['Influencer İşbirliği Kampanyası', 'Blogger Daveti', 'Mikro-Influencer Ziyaretleri', 'Etkinlik Tanıtımı'],
  'Powercoffee': ['Powercoffee Bayilik / Konsept', 'Kurumsal Kahve Tedariği', 'Barista Eğitimi', 'Kahve Köşesi Kurulumu'],
  'QR Menü': ['QR Menü Kurulumu', 'Self-Order Entegrasyonu', 'Menü Fotoğraf Çekimi', 'Masa Standı & QR Kod Baskısı'],
  'Fiziki Baskı': ['Kartvizit Baskısı', 'Broşür & El İlanı', 'Işıklı/Işıksız Tabela', 'Yelken Bayrak / Rollup', 'Ambalaj & Poşet Tasarımı']
};

export default function SalesPool({ currentUser, authUser, onJobCreated, onlyFinanceView = false }) {
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

  // Mevcut İşi Düzenleme Modalı
  const [editingJob, setEditingJob] = useState(null);
  const [customProductInput, setCustomProductInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // 1. Satış Havuzu Alt Filtresi (Dağıtım Bekleyenler / Haber Beklenenler / Tümü)
  const [salesPoolSubTab, setSalesPoolSubTab] = useState('all'); // 'all' | 'satis_havuzu' | 'haber_bekleniyor'

  // 2. Satış Havuzu: Haber Bekleniyor Modalı State
  const [waitingNewsModalLead, setWaitingNewsModalLead] = useState(null);
  const [waitingNewsDate, setWaitingNewsDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [waitingNewsNote, setWaitingNewsNote] = useState('');
  const [savingWaitingNews, setSavingWaitingNews] = useState(false);

  // 3. Satış Havuzu: Olumsuza Al Modalı State
  const [negativeModalLead, setNegativeModalLead] = useState(null);
  const [negativeReason, setNegativeReason] = useState('Fiyat yüksek bulundu');
  const [negativeNote, setNegativeNote] = useState('');
  const [negativePassToField, setNegativePassToField] = useState(false);
  const [negativeFieldMemberId, setNegativeFieldMemberId] = useState('');
  const [savingNegative, setSavingNegative] = useState(false);

  // 4. İş Dağıtım Masası (Jobs): Tab Filtresi
  const [jobsSubTab, setJobsSubTab] = useState('active'); // 'active' | 'haber_bekleniyor' | 'tamamlandi' | 'iptal_edildi' | 'all'

  // 5. İş Dağıtım Masası: İşi İptal Et / Olumsuz Modalı State
  const [cancelJobModalJob, setCancelJobModalJob] = useState(null);
  const [cancelJobReason, setCancelJobReason] = useState('');
  const [cancelJobAlsoNegativeLead, setCancelJobAlsoNegativeLead] = useState(false);
  const [savingCancelJob, setSavingCancelJob] = useState(false);

  // 6. İş Dağıtım Masası: İş İçin Haber Bekleniyor Modalı State
  const [waitingJobModalJob, setWaitingJobModalJob] = useState(null);
  const [waitingJobNote, setWaitingJobNote] = useState('');
  const [savingWaitingJob, setSavingWaitingJob] = useState(false);

  const getDefaultDueDate = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadsRes, jobsRes, catsRes, membersRes] = await Promise.all([
        getLeads({ status: 'satis_havuzu,haber_bekleniyor' }),
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
      if (newStatus === 'tamamlandi') {
        setSuccessNotice(
          isAdmin
            ? 'İş "Tamamlandı" olarak işaretlendi ve alttaki Tamamlanan İşler & Finans bölümüne taşındı.'
            : 'İş "Tamamlandı" olarak işaretlendi ve yönetici onay/finans ekranına aktarıldı.'
        );
        setTimeout(() => setSuccessNotice(''), 4000);
      }
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

  // 1. Satış Havuzu: Haber Bekleniyor Aç
  const openWaitingNewsModal = (lead) => {
    setWaitingNewsModalLead(lead);
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setWaitingNewsDate(lead.recall_date ? String(lead.recall_date).split('T')[0] : d.toISOString().split('T')[0]);
    setWaitingNewsNote('');
  };

  const handleSaveWaitingNews = async (e) => {
    e.preventDefault();
    if (!waitingNewsModalLead) return;
    setSavingWaitingNews(true);
    try {
      await updateSalesPoolLeadStatus(waitingNewsModalLead.id, {
        status: 'haber_bekleniyor',
        notes: waitingNewsNote,
        recall_date: waitingNewsDate,
        user_name: authUser?.name || currentUser?.name || 'Yönetici'
      });
      setSuccessNotice(`"${waitingNewsModalLead.name}" için haber bekleme durumu ve notu kaydedildi.`);
      setWaitingNewsModalLead(null);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingWaitingNews(false);
    }
  };

  // 2. Satış Havuzu: Olumsuza Al Aç
  const openNegativeModal = (lead) => {
    setNegativeModalLead(lead);
    setNegativeReason('Fiyat yüksek bulundu');
    setNegativeNote('');
    setNegativePassToField(false);
    const fieldMembers = teamMembers.filter(m => isFieldStaffRole(m.role));
    setNegativeFieldMemberId(lead.field_member_id || fieldMembers[0]?.id || '');
  };

  const handleSaveNegative = async (e) => {
    e.preventDefault();
    if (!negativeModalLead) return;
    setSavingNegative(true);
    try {
      await updateSalesPoolLeadStatus(negativeModalLead.id, {
        status: 'olumsuz',
        reason: negativeReason,
        notes: negativeNote,
        pass_to_field: negativePassToField,
        field_member_id: negativePassToField ? negativeFieldMemberId : undefined,
        user_name: authUser?.name || currentUser?.name || 'Yönetici'
      });
      const msg = negativePassToField
        ? `"${negativeModalLead.name}" sahaya ziyaret görevi olarak paslandı.`
        : `"${negativeModalLead.name}" Satış Havuzundan Olumsuz havuzuna aktarıldı.`;
      setSuccessNotice(msg);
      setNegativeModalLead(null);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingNegative(false);
    }
  };

  // 3. Satış Havuzu: Haber Beklenenden Tekrar Satışa Aktar
  const handleReactivateToSalesPool = async (lead) => {
    try {
      await updateSalesPoolLeadStatus(lead.id, {
        status: 'satis_havuzu',
        notes: 'Haber beklemeden tekrar satış havuzuna alındı',
        user_name: authUser?.name || currentUser?.name || 'Yönetici'
      });
      setSuccessNotice(`"${lead.name}" tekrar aktif Satış Havuzuna alındı.`);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    }
  };

  // 4. İş Durum Değişikliği Tetikleyicisi (İş Masası)
  const handleJobStatusChange = (job, newStatus) => {
    if (newStatus === 'haber_bekleniyor') {
      setWaitingJobModalJob(job);
      setWaitingJobNote('');
    } else if (newStatus === 'iptal_edildi') {
      setCancelJobModalJob(job);
      setCancelJobReason('');
      setCancelJobAlsoNegativeLead(false);
    } else {
      handleUpdateStatus(job.id, newStatus);
    }
  };

  // 5. İş: Haber Bekleniyor Kaydet
  const handleSaveWaitingJob = async (e) => {
    e.preventDefault();
    if (!waitingJobModalJob) return;
    setSavingWaitingJob(true);
    try {
      const now = new Date();
      const trDate = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const trTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const author = authUser?.name || currentUser?.name || 'Yönetici';
      const cleanNote = waitingJobNote.trim() || 'Müşteriden haber / onay bekleniyor';
      const waitingPrefix = `[${author} - ${trDate} ${trTime} ⏳ Haber Bekleniyor]: ${cleanNote}`;
      const finalNotes = waitingJobModalJob.notes ? `${waitingPrefix}\n${waitingJobModalJob.notes}` : waitingPrefix;

      await updateJob(waitingJobModalJob.id, {
        status: 'haber_bekleniyor',
        notes: finalNotes
      });
      setSuccessNotice(`"${waitingJobModalJob.title}" işi Haber Bekleniyor durumuna alındı.`);
      setWaitingJobModalJob(null);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingWaitingJob(false);
    }
  };

  // 6. İş: İptal Et Kaydet
  const handleSaveCancelJob = async (e) => {
    e.preventDefault();
    if (!cancelJobModalJob) return;
    setSavingCancelJob(true);
    try {
      const now = new Date();
      const trDate = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const trTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const author = authUser?.name || currentUser?.name || 'Yönetici';
      const cleanReason = cancelJobReason.trim() || 'İş iptal edildi';
      const cancelPrefix = `[${author} - ${trDate} ${trTime} ❌ İptal]: ${cleanReason}`;
      const finalNotes = cancelJobModalJob.notes ? `${cancelPrefix}\n${cancelJobModalJob.notes}` : cancelPrefix;

      await updateJob(cancelJobModalJob.id, {
        status: 'iptal_edildi',
        notes: finalNotes,
        cancel_reason: cleanReason,
        lead_status: cancelJobAlsoNegativeLead ? 'olumsuz' : undefined,
        user_name: author
      });
      setSuccessNotice(
        cancelJobAlsoNegativeLead
          ? `"${cancelJobModalJob.title}" işi iptal edildi ve müşteri işletme Olumsuz havuzuna aktarıldı.`
          : `"${cancelJobModalJob.title}" işi iptal edildi.`
      );
      setCancelJobModalJob(null);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingCancelJob(false);
    }
  };

  // Mevcut bir işi düzenleme modalını aç
  const openEditJobModal = (job) => {
    let parsedProds = [];
    try {
      parsedProds = job.products ? JSON.parse(job.products) : [];
    } catch {
      parsedProds = [];
    }
    setCustomProductInput('');
    setEditingJob({
      id: job.id,
      lead_id: job.lead_id,
      lead_name: job.lead_name,
      title: job.title || '',
      category_id: Number(job.category_id) || categories[0]?.id || 1,
      assigned_member_id: job.assigned_member_id || '',
      due_date: job.due_date ? String(job.due_date).split('T')[0] : getDefaultDueDate(),
      status: job.status || 'devam_ediyor',
      products: Array.isArray(parsedProds) ? parsedProds : [],
      notes: job.notes || '',
      customTitleEdited: false
    });
  };

  // Tablo üzerinden tek tıkla "Yelken Bayrak / Rollup" vb. bir alt hizmet etiketini kaldırma
  const handleQuickRemoveProduct = async (job, prodToRemove) => {
    let parsedProds = [];
    try {
      parsedProds = job.products ? JSON.parse(job.products) : [];
    } catch {
      parsedProds = [];
    }
    const nextProds = parsedProds.filter(p => p !== prodToRemove);
    const cat = categories.find(c => c.id === Number(job.category_id));
    const nextSuffix = nextProds.length > 0 ? nextProds.join(' + ') : (cat?.name || job.category_name || 'Hizmet');
    const nextTitle = `${job.lead_name} - ${nextSuffix}`;

    try {
      await updateJob(job.id, {
        products: nextProds,
        title: nextTitle
      });
      setSuccessNotice(`"${prodToRemove}" etiketi kaldırıldı ve iş başlığı güncellendi.`);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 3500);
    } catch (err) {
      alert(`Etiket kaldırılamadı: ${err.message}`);
    }
  };

  const handleEditCategoryChange = (newCatId) => {
    if (!editingJob) return;
    const cat = categories.find(c => c.id === Number(newCatId));
    const nextMemberId = cat?.default_member_id || editingJob.assigned_member_id;
    const nextTitle = editingJob.customTitleEdited
      ? editingJob.title
      : `${editingJob.lead_name} - ${cat?.name || 'Hizmet'}`;

    setEditingJob(prev => ({
      ...prev,
      category_id: Number(newCatId),
      assigned_member_id: nextMemberId,
      products: [],
      title: nextTitle
    }));
  };

  const toggleEditJobProduct = (prod) => {
    if (!editingJob) return;
    const exists = editingJob.products.includes(prod);
    const nextProds = exists
      ? editingJob.products.filter(p => p !== prod)
      : [...editingJob.products, prod];

    const cat = categories.find(c => c.id === Number(editingJob.category_id));
    const autoSuffix = nextProds.length > 0 ? nextProds.join(' + ') : (cat?.name || 'Hizmet');
    const nextTitle = editingJob.customTitleEdited
      ? editingJob.title
      : `${editingJob.lead_name} - ${autoSuffix}`;

    setEditingJob(prev => ({
      ...prev,
      products: nextProds,
      title: nextTitle
    }));
  };

  const handleAddCustomProductToEdit = () => {
    const clean = customProductInput.trim();
    if (!clean || !editingJob) return;
    if (!editingJob.products.includes(clean)) {
      const nextProds = [...editingJob.products, clean];
      const nextTitle = editingJob.customTitleEdited
        ? editingJob.title
        : `${editingJob.lead_name} - ${nextProds.join(' + ')}`;
      setEditingJob(prev => ({
        ...prev,
        products: nextProds,
        title: nextTitle
      }));
    }
    setCustomProductInput('');
  };

  const handleSaveEditedJob = async (e) => {
    e.preventDefault();
    if (!editingJob) return;
    setSavingEdit(true);
    try {
      await updateJob(editingJob.id, {
        title: editingJob.title.trim(),
        category_id: Number(editingJob.category_id),
        assigned_member_id: editingJob.assigned_member_id ? Number(editingJob.assigned_member_id) : null,
        due_date: editingJob.due_date,
        status: editingJob.status,
        products: editingJob.products,
        notes: editingJob.notes
      });
      setSuccessNotice(`"${editingJob.title}" işi başarıyla güncellendi!`);
      setEditingJob(null);
      loadData();
      if (onJobCreated) onJobCreated();
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err) {
      alert(`İş güncellenemedi: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingEdit(false);
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

  // Satış Havuzundaki işletmelerin dağılımı (Dağıtım Bekleyenler / Haber Beklenenler)
  const pendingSalesLeads = salesLeads.filter(l => l.status === 'satis_havuzu');
  const waitingNewsSalesLeads = salesLeads.filter(l => l.status === 'haber_bekleniyor');
  const displayedSalesLeads = (() => {
    if (salesPoolSubTab === 'satis_havuzu') return pendingSalesLeads;
    if (salesPoolSubTab === 'haber_bekleniyor') return waitingNewsSalesLeads;
    return salesLeads;
  })();

  // İşlerin durum bazlı ayrımı
  const activeJobs = jobs.filter(j => j.status === 'devam_ediyor' || j.status === 'revizyonda');
  const waitingJobs = jobs.filter(j => j.status === 'haber_bekleniyor');
  const completedJobs = jobs.filter(j => j.status === 'tamamlandi');
  const cancelledJobs = jobs.filter(j => j.status === 'iptal_edildi');
  const activeAndWaitingJobs = jobs.filter(j => j.status !== 'tamamlandi' && j.status !== 'iptal_edildi');

  const displayedJobs = (() => {
    if (jobsSubTab === 'active') return activeAndWaitingJobs;
    if (jobsSubTab === 'haber_bekleniyor') return waitingJobs;
    if (jobsSubTab === 'tamamlandi') return completedJobs;
    if (jobsSubTab === 'iptal_edildi') return cancelledJobs;
    return jobs;
  })();
  const completedJobsCount = completedJobs.length;

  return (
    <div className="space-y-6">
      {!onlyFinanceView && (
        <>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>Satış Havuzu</span>
                <span className="bg-purple-100 text-purple-800 text-xs font-black px-2 py-0.5 rounded-full">
                  {salesLeads.length} İşletme
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Arama veya ziyaretten olumlu çıkan işletmeler: Teklif/karar takibi yapın, işe dönüştürün veya olumsuza aktarın
              </p>
            </div>
          </div>

          {/* Alt Sekmeler: Tümü / Dağıtım Bekleyenler / Haber Beklenenler */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSalesPoolSubTab('all')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                salesPoolSubTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Tümü</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.2 rounded-full">
                {salesLeads.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSalesPoolSubTab('satis_havuzu')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                salesPoolSubTab === 'satis_havuzu'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              <span>Dağıtım Bekleyen</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                salesPoolSubTab === 'satis_havuzu' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
              }`}>
                {pendingSalesLeads.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSalesPoolSubTab('haber_bekleniyor')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                salesPoolSubTab === 'haber_bekleniyor'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <span>⏳ Haber Beklenen</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                salesPoolSubTab === 'haber_bekleniyor' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {waitingNewsSalesLeads.length}
              </span>
            </button>
          </div>
        </div>

        {displayedSalesLeads.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
            {salesPoolSubTab === 'haber_bekleniyor'
              ? 'Şu anda haber beklenen işletme kaydı bulunmuyor.'
              : salesPoolSubTab === 'satis_havuzu'
              ? 'Şu anda dağıtım bekleyen taze satış bulunmuyor.'
              : 'Şu anda satış havuzunda herhangi bir işletme bulunmuyor.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedSalesLeads.map((lead) => {
              const isWaitingNews = lead.status === 'haber_bekleniyor';

              return (
                <div 
                  key={lead.id}
                  className={`rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                    isWaitingNews
                      ? 'bg-amber-50/50 border-2 border-amber-300 shadow-2xs'
                      : 'bg-purple-50/40 border border-purple-200/80'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        {lead.name}
                      </h3>
                      {isWaitingNews ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                          <span>⏳ Haber Bekleniyor</span>
                        </span>
                      ) : (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          Satış Onaylandı
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      {lead.district} • {lead.phone}
                    </p>

                    {/* Karar / Haber Tarihi Varsa */}
                    {isWaitingNews && lead.recall_date && (
                      <div className="bg-amber-100/90 text-amber-950 border border-amber-300/80 rounded-xl px-2.5 py-1.5 text-xs font-black flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-700" />
                          <span>Karar / Takip:</span>
                        </span>
                        <span>{new Date(lead.recall_date).toLocaleDateString('tr-TR')}</span>
                      </div>
                    )}

                    {lead.call_notes && (
                      <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                        {lead.call_notes.split('\n').filter(Boolean).map((noteLine, idx) => {
                          const parsed = parseCallNote(noteLine);
                          return (
                            <div key={idx} className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-0.5">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {parsed.author || 'Operatör'}
                                </span>
                                {(parsed.date || (isAdmin && parsed.time)) && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {parsed.date && <span>📅 {parsed.date}</span>}
                                    {isAdmin && parsed.time && (
                                      <span className="text-purple-700 font-semibold ml-0.5 pl-1 border-l border-slate-200" title="Sadece Yöneticiler Görebilir">
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

                  {/* Aksiyon Butonları */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => openDistributeModal(lead)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isWaitingNews ? '✓ Anlaşıldı & İşe Dağıt' : 'Kategori & Çalışana İş Dağıt'}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      {isWaitingNews ? (
                        <button
                          type="button"
                          onClick={() => openWaitingNewsModal(lead)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold text-[11px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                          title="Haber bekleme notunu ve tarihini güncelle"
                        >
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>Notu Güncelle</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openWaitingNewsModal(lead)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-extrabold text-[11px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                          title="Müşteriden haber / teklif onayı bekleniyor olarak işaretle"
                        >
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Haber Bekleniyor</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openNegativeModal(lead)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-[11px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Müşteri vazgeçti / olumsuz olduysa olumsuz havuzuna aktar veya sahaya pasla"
                      >
                        <XCircle className="w-3 h-3 text-rose-600" />
                        <span>Olumsuza At</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. KISIM: ALINAN VE DEVAM EDEN İŞLER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Filtreleme Başlığı */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2 flex-wrap">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>İş Dağıtım Masası ({jobs.length} Toplam İş)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              İşletmelerden alınan her hizmet satırı burada takip edilir. Durumu haber bekleniyor veya iptal/olumsuz olarak değiştirebilirsiniz.
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

        {/* Tab Filtreleri: Aktif / Haber Beklenen / Tamamlanan / İptal / Tümü */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setJobsSubTab('active')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              jobsSubTab === 'active'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>Aktif İşler</span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
              jobsSubTab === 'active' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {activeAndWaitingJobs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setJobsSubTab('haber_bekleniyor')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              jobsSubTab === 'haber_bekleniyor'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>⏳ Haber Beklenenler</span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
              jobsSubTab === 'haber_bekleniyor' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {waitingJobs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setJobsSubTab('tamamlandi')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              jobsSubTab === 'tamamlandi'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>✓ Tamamlananlar</span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
              jobsSubTab === 'tamamlandi' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {completedJobs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setJobsSubTab('iptal_edildi')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              jobsSubTab === 'iptal_edildi'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>❌ İptal / Olumsuz</span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
              jobsSubTab === 'iptal_edildi' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              {cancelledJobs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setJobsSubTab('all')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              jobsSubTab === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>Tümü</span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
              jobsSubTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {jobs.length}
            </span>
          </button>
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
              {displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {jobsSubTab === 'haber_bekleniyor'
                      ? 'Haber beklenen iş bulunmuyor.'
                      : jobsSubTab === 'iptal_edildi'
                      ? 'İptal edilen veya olumsuza alınan iş bulunmuyor.'
                      : jobsSubTab === 'tamamlandi'
                      ? 'Tamamlanmış iş bulunmuyor.'
                      : 'Seçili filtrelere uygun iş kaydı bulunamadı.'}
                  </td>
                </tr>
              ) : (
                displayedJobs.map((job) => {
                  const isCompleted = job.status === 'tamamlandi';
                  const isRevision = job.status === 'revizyonda';
                  const isWaiting = job.status === 'haber_bekleniyor';
                  const isCancelled = job.status === 'iptal_edildi';
                  
                  // Teslim tarihine kalan gün kontrolü
                  const due = new Date(job.due_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const diffTime = due.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const isOverdue = diffDays < 0 && !isCompleted && !isCancelled;

                  let parsedProds = [];
                  try {
                    parsedProds = job.products ? JSON.parse(job.products) : [];
                  } catch {
                    parsedProds = [];
                  }

                  const totalJobsForThisLead = jobCountByLeadId[job.lead_id] || 1;

                  return (
                    <tr key={job.id} className={`transition-colors ${isCancelled ? 'bg-rose-50/20' : isWaiting ? 'bg-amber-50/20' : 'hover:bg-slate-50'}`}>
                      
                      {/* İş Başlığı ve Alt Hizmet Rozetleri */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{job.title}</span>
                          {isWaiting && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-1">
                              <span>⏳ Haber Bekleniyor</span>
                            </span>
                          )}
                          {isCancelled && (
                            <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-1">
                              <span>❌ İptal Edildi</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditJobModal(job)}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors cursor-pointer"
                            title="İş Başlığını, Etiketlerini ve Detaylarını Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {parsedProds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parsedProds.map(p => (
                              <span
                                key={p}
                                className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold pl-2 pr-1 py-0.5 rounded-md inline-flex items-center gap-1"
                              >
                                <span>✦ {p}</span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickRemoveProduct(job, p)}
                                  className="text-indigo-400 hover:text-rose-600 hover:bg-rose-50 rounded px-0.5 font-black cursor-pointer transition-colors"
                                  title={`"${p}" etiketini bu işten kaldır`}
                                >
                                  ✕
                                </button>
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
                            ) : isCancelled ? (
                              <span className="text-rose-600 text-[10px] font-bold">İptal Edildi</span>
                            ) : isWaiting ? (
                              <span className="text-amber-700 text-[10px] font-bold bg-amber-50 px-1.5 py-0.5 rounded-sm">
                                Haber bekleniyor
                              </span>
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
                          onChange={(e) => handleJobStatusChange(job, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-hidden cursor-pointer ${
                            isCompleted 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : isRevision
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : isWaiting
                              ? 'bg-amber-100 text-amber-900 border-amber-400 font-black'
                              : isCancelled
                              ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}
                        >
                          <option value="devam_ediyor">Devam Ediyor</option>
                          <option value="revizyonda">Revizyonda</option>
                          <option value="haber_bekleniyor">⏳ Haber / Onay Bekleniyor</option>
                          <option value="tamamlandi">✓ Tamamlandı</option>
                          <option value="iptal_edildi">❌ İptal Edildi / Olumsuz</option>
                        </select>
                      </td>

                      {/* Düzenle, Ek İş Ekle & Sil */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditJobModal(job)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            title="Bu işin başlığını, alt hizmet etiketlerini (Yelken Bayrak, Rollup vb.), sorumlusunu veya tarihini düzenle"
                          >
                            <Pencil className="w-3 h-3 stroke-[2.5]" />
                            <span>Düzenle</span>
                          </button>

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
        </>
      )}

      {/* 3. KISIM A (YALNIZCA ADMİN): TAMAMLANAN İŞLER, MALİYET, ÖDEME TAKİBİ VE FİYAT KATALOĞU */}
      {isAdmin && (
        <AdminCompletedFinanceSection
          jobs={jobs}
          categories={categories}
          standalone={onlyFinanceView}
          onJobsChanged={() => {
            loadData();
            if (onJobCreated) onJobCreated();
          }}
          onOpenEditJob={openEditJobModal}
        />
      )}

      {/* 3. KISIM B (PERSONEL İÇİN): TAMAMLANAN İŞLER (FİYAT VE MALİYET BİLGİSİ GÖSTERİLMEZ, DEVAM EDEN İŞLERLE AYNI GÖRÜNÜM) */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mt-6">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-emerald-50/40 flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Tamamlanan İşler ({completedJobs.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Başarıyla teslim edilen ve tamamlanan işlerin listesi
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 uppercase font-bold border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="p-3.5">Tamamlanan İş / Hizmet Başlığı</th>
                  <th className="p-3.5">Müşteri İşletme</th>
                  <th className="p-3.5">Hizmet Kategorisi</th>
                  <th className="p-3.5">Sorumlu Kişi</th>
                  <th className="p-3.5">Teslim Tarihi</th>
                  <th className="p-3.5">Durum</th>
                  <th className="p-3.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 font-medium">
                {completedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Henüz tamamlanan iş bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  completedJobs.map((job) => {
                    let parsedProds = [];
                    try {
                      parsedProds = job.products ? JSON.parse(job.products) : [];
                    } catch {
                      parsedProds = [];
                    }
                    const totalJobsForThisLead = jobCountByLeadId[job.lead_id] || 1;

                    return (
                      <tr key={job.id} className="hover:bg-slate-50 transition-colors bg-emerald-50/10">
                        {/* İş Başlığı ve Rozetler */}
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
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(job.due_date).toLocaleDateString('tr-TR')}</span>
                          </div>
                          <span className="text-emerald-700 text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                            ✓ Tamamlandı
                          </span>
                        </td>

                        {/* Durum */}
                        <td className="p-3.5">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold px-2.5 py-1 rounded-lg inline-block">
                            Tamamlandı
                          </span>
                        </td>

                        {/* Ek İş Ekle */}
                        <td className="p-3.5 text-right">
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
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-extrabold text-[11px] px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title={`${job.lead_name} işletmesi için yeni/ek bir iş daha ekle`}
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                            <span>Ek İş Ekle</span>
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
      )}

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

      {/* ============================================================== */}
      {/* MEVCUT İŞİ DÜZENLEME MODALI (BAŞLIK, KATEGORİ, ALT ETİKETLER VB.) */}
      {/* ============================================================== */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Mevcut İşi & Etiketleri Düzenle
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  {editingJob.lead_name}
                </h3>
                <p className="text-xs text-slate-500">
                  İş başlığını, kategorisini, alt hizmet etiketlerini (Örn: Yelken Bayrak, Rollup, Web Sitesi vb.), sorumlu kişiyi ve teslim tarihini düzenleyebilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedJob} className="mt-4 space-y-4">
              {/* İş Başlığı */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  İş / Proje Başlığı (Listede Gözükecek Ad):
                </label>
                <input
                  type="text"
                  required
                  value={editingJob.title}
                  onChange={(e) =>
                    setEditingJob(prev => ({
                      ...prev,
                      title: e.target.value,
                      customTitleEdited: true
                    }))
                  }
                  className="w-full text-xs bg-slate-50 focus:bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Hizmet Kategorisi */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Hizmet Kategorisi:
                  </label>
                  <select
                    value={editingJob.category_id}
                    onChange={(e) => handleEditCategoryChange(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 cursor-pointer"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sorumlu Ekip Üyesi */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Sorumlu Ekip Üyesi:
                  </label>
                  <select
                    value={editingJob.assigned_member_id}
                    onChange={(e) =>
                      setEditingJob(prev => ({
                        ...prev,
                        assigned_member_id: e.target.value
                      }))
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 cursor-pointer"
                  >
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teslim Tarihi */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Teslim Tarihi (Deadline):
                  </label>
                  <input
                    type="date"
                    required
                    value={editingJob.due_date}
                    onChange={(e) =>
                      setEditingJob(prev => ({
                        ...prev,
                        due_date: e.target.value
                      }))
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900"
                  />
                </div>

                {/* Durum */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    İş Durumu:
                  </label>
                  <select
                    value={editingJob.status}
                    onChange={(e) =>
                      setEditingJob(prev => ({
                        ...prev,
                        status: e.target.value
                      }))
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="devam_ediyor">Devam Ediyor</option>
                    <option value="revizyonda">Revizyonda</option>
                    <option value="haber_bekleniyor">⏳ Haber / Onay Bekleniyor</option>
                    <option value="tamamlandi">✓ Tamamlandı</option>
                    <option value="iptal_edildi">❌ İptal Edildi / Olumsuz</option>
                  </select>
                </div>
              </div>

              {/* Alt Hizmet / Ürün Paketleri Düzenleme */}
              {(() => {
                const editCat = categories.find(c => c.id === Number(editingJob.category_id));
                const categoryProds = editCat?.name ? (CATEGORY_PRODUCTS[editCat.name] || []) : [];
                // Mevcut seçili olup standart listede olmayan özel etiketleri de dahil et
                const allDisplayedProds = Array.from(new Set([...categoryProds, ...(editingJob.products || [])]));

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="text-xs font-extrabold text-slate-800">
                        Alt Hizmet / Etiket Seçimi ({editingJob.products.length} seçili):
                      </label>
                      {editingJob.products.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const catName = editCat?.name || 'Hizmet';
                            setEditingJob(prev => ({
                              ...prev,
                              products: [],
                              title: prev.customTitleEdited ? prev.title : `${prev.lead_name} - ${catName}`
                            }));
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Tüm Etiketleri Temizle
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {allDisplayedProds.map(prod => {
                        const checked = editingJob.products.includes(prod);
                        return (
                          <button
                            key={prod}
                            type="button"
                            onClick={() => toggleEditJobProduct(prod)}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                              checked
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {checked ? '✓ ' : '+ '}{prod}
                          </button>
                        );
                      })}
                    </div>

                    {/* Özel Etiket / Hizmet Ekleme */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={customProductInput}
                        onChange={(e) => setCustomProductInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomProductToEdit();
                          }
                        }}
                        placeholder="Özel alt hizmet / etiket yazıp ekleyin..."
                        className="flex-1 text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomProductToEdit}
                        className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer shrink-0"
                      >
                        + Etiket Ekle
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Proje Notları */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Proje Notları:
                </label>
                <textarea
                  rows={2}
                  value={editingJob.notes}
                  onChange={(e) =>
                    setEditingJob(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MODAL: SATIŞ HAVUZU - HABER BEKLENİYOR                                  */}
      {/* ========================================================================= */}
      {waitingNewsModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-lg shrink-0">
                  ⏳
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Haber / Karar Bekleniyor
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold truncate max-w-xs">
                    {waitingNewsModalLead.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaitingNewsModalLead(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWaitingNews} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Karar / Haber Beklenen Tarih (Alarm):
                </label>
                <input
                  type="date"
                  required
                  value={waitingNewsDate}
                  onChange={(e) => setWaitingNewsDate(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Bu tarih geldiğinde sistem hatırlatma yapacak ve işletme takvimde öncelikli görünecektir.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Yönetici Görüşme / Bekleme Notu:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Örn: Müşteriye teklif sunumu iletildi, Pazartesi günü ortaklarıyla bütçe toplantısı yapıp geri dönüş yapacak..."
                  value={waitingNewsNote}
                  onChange={(e) => setWaitingNewsNote(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWaitingNewsModalLead(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingWaitingNews}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{savingWaitingNews ? 'Kaydediliyor...' : 'Haber Beklemeye Al'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL: SATIŞ HAVUZU - OLUMSUZA AL / SAHAYA PASLA                        */}
      {/* ========================================================================= */}
      {negativeModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-black text-lg shrink-0">
                  🔴
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Satışı Olumsuza Al
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold truncate max-w-xs">
                    {negativeModalLead.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNegativeModalLead(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNegative} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Olumsuzluk Gerekçesi:
                </label>
                <select
                  value={negativeReason}
                  onChange={(e) => setNegativeReason(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 cursor-pointer"
                >
                  <option value="Fiyat yüksek bulundu">Fiyat yüksek bulundu / Pazarlık sağlanamadı</option>
                  <option value="Bütçe yetersiz / Karar ertelendi">Bütçe yetersiz / Karar ileri tarihe ertelendi</option>
                  <option value="Başka firmayla anlaştı">Başka bir ajans / firmayla anlaştı</option>
                  <option value="Teklifi onaylamadı / Vazgeçti">Teklif onaylanmadı / Projeden vazgeçti</option>
                  <option value="İletişim koptu / Yanıt vermiyor">İletişim koptu / Geri dönüş alınamadı</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Yönetici Detay Notu:
                </label>
                <textarea
                  rows={2}
                  placeholder="Müşterinin belirttiği özel durumlar ve notlar..."
                  value={negativeNote}
                  onChange={(e) => setNegativeNote(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              {/* Sahaya Pasla Checkbox */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={negativePassToField}
                    onChange={(e) => setNegativePassToField(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="text-xs font-black text-purple-900">
                    🔁 Bu işletmeyi sahaya (yüz yüze ziyarete) pasla
                  </span>
                </label>
                <p className="text-[11px] text-purple-700/80 pl-6 leading-relaxed">
                  İşletme Satış Havuzundan çıkarılır ve saha personeline rotada ziyaret edilmesi için atanır.
                </p>

                {negativePassToField && (
                  <div className="pl-6 pt-1">
                    <label className="block text-[11px] font-bold text-purple-900 mb-1">
                      Atanacak Saha Personeli:
                    </label>
                    <select
                      value={negativeFieldMemberId}
                      onChange={(e) => setNegativeFieldMemberId(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-purple-300 rounded-xl px-3 py-2 text-purple-950 cursor-pointer"
                    >
                      {teamMembers
                        .filter(m => isFieldStaffRole(m.role))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.role})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNegativeModalLead(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingNegative}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{savingNegative ? 'İşleniyor...' : (negativePassToField ? 'Sahaya Pasla' : 'Olumsuza Al')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL: İŞ MASASI - İŞ İÇİN HABER / ONAY BEKLENİYOR                       */}
      {/* ========================================================================= */}
      {waitingJobModalJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-lg shrink-0">
                  ⏳
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    İşi Beklemeye Al
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold truncate max-w-xs">
                    {waitingJobModalJob.title} — {waitingJobModalJob.lead_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaitingJobModalJob(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWaitingJob} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Bekleme Konusu & Yönetici Notu:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Örn: Müşteriden web sitesi ürün fotoğrafları ve kurumsal renk kodları bekleniyor, iş geçici olarak donduruldu..."
                  value={waitingJobNote}
                  onChange={(e) => setWaitingJobNote(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWaitingJobModalJob(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingWaitingJob}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{savingWaitingJob ? 'Kaydediliyor...' : 'Haber Bekleniyor Olarak Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: İŞ MASASI - İŞİ İPTAL ET / OLUMSUZ                                */}
      {/* ========================================================================= */}
      {cancelJobModalJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-black text-lg shrink-0">
                  ❌
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    İşi İptal Et / Olumsuza Al
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold truncate max-w-xs">
                    {cancelJobModalJob.title} — {cancelJobModalJob.lead_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelJobModalJob(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCancelJob} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  İptal Gerekçesi / Not:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Örn: Müşteri projeden vazgeçti, bütçe onaylanmadı..."
                  value={cancelJobReason}
                  onChange={(e) => setCancelJobReason(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              {/* İşletmeyi de Olumsuza Al Checkbox */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cancelJobAlsoNegativeLead}
                    onChange={(e) => setCancelJobAlsoNegativeLead(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-xs font-black text-rose-900">
                    ⚠️ İşletmeyi de genel "Olumsuz" havuzuna aktar
                  </span>
                </label>
                <p className="text-[11px] text-rose-700/80 pl-6 leading-relaxed">
                  İşletmenin sistem durumu "olumsuz" olarak güncellenir ve arama/saha personelleri işletmenin olumsuz olduğunu görür.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelJobModalJob(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingCancelJob}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{savingCancelJob ? 'İptal Ediliyor...' : 'İşi İptal Et'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
