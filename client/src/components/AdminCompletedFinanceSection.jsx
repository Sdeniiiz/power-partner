import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Tag,
  Wallet,
  ArrowUpRight,
  Building2,
  Calendar,
  Sparkles,
  X
} from 'lucide-react';
import {
  updateJob,
  deleteJob,
  getServicePricing,
  saveServicePricing,
  updateServicePricing,
  deleteServicePricing
} from '../api';

const PAYMENT_METHODS = [
  'Havale / EFT',
  'Nakit',
  'Kredi Kartı',
  'Taksitli / Vadeli',
  'Çek / Senet'
];

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12];

export default function AdminCompletedFinanceSection({
  jobs = [],
  categories = [],
  onJobsChanged,
  onOpenEditJob,
  standalone = false
}) {
  const [pricingList, setPricingList] = useState([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [selectedPricingCategory, setSelectedPricingCategory] = useState('all');
  const [showPricingPanel, setShowPricingPanel] = useState(standalone);
  const [scopeFilter, setScopeFilter] = useState('completed'); // 'completed' | 'all'
  const [notice, setNotice] = useState('');

  // Yeni Ürün/Hizmet Fiyat Kalemi Ekleme State
  const [newCategoryName, setNewCategoryName] = useState('Sosyal Medya');
  const [newServiceName, setNewServiceName] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [savingNewPricing, setSavingNewPricing] = useState(false);

  // Katalog satır düzenleme state'i: { [id]: { sale_price, cost, saving } }
  const [pricingEdits, setPricingEdits] = useState({});

  // Tamamlanan İş Finans & Ödeme Düzenleme Modalı
  const [financeModalJob, setFinanceModalJob] = useState(null);
  const [savingFinanceJob, setSavingFinanceJob] = useState(false);

  const loadPricing = async () => {
    setLoadingPricing(true);
    try {
      const res = await getServicePricing();
      const items = res.data || [];
      setPricingList(items);
      const editMap = {};
      items.forEach(item => {
        editMap[item.id] = {
          sale_price: item.sale_price ?? 0,
          cost: item.cost ?? 0,
          saving: false
        };
      });
      setPricingEdits(editMap);
    } catch (err) {
      console.error('Fiyat kataloğu yüklenemedi:', err);
    } finally {
      setLoadingPricing(false);
    }
  };

  useEffect(() => {
    loadPricing();
  }, []);

  const showTempNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  // Tamamlanan işler ve tüm işler ayrımı
  const completedJobs = jobs.filter(j => j.status === 'tamamlandi');
  const displayedJobs = scopeFilter === 'all' ? jobs : completedJobs;

  // Finansal Özet Hesaplamaları (Seçili kapsama göre: varsayılan Tamamlanan İşler)
  const totals = displayedJobs.reduce(
    (acc, j) => {
      const sale = Number(j.sale_price) || 0;
      const cost = Number(j.cost) || 0;
      const paid = Number(j.paid_amount) || 0;
      const remaining = Math.max(0, sale - paid);
      const profit = sale - cost;

      acc.totalSale += sale;
      acc.totalCost += cost;
      acc.totalProfit += profit;
      acc.totalPaid += paid;
      acc.totalRemaining += remaining;
      return acc;
    },
    { totalSale: 0, totalCost: 0, totalProfit: 0, totalPaid: 0, totalRemaining: 0 }
  );

  const overallCollectionPct =
    totals.totalSale > 0
      ? Math.min(100, Math.round((totals.totalPaid / totals.totalSale) * 100))
      : 0;

  const formatTL = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₺';
  };

  // Katalog satırı güncelleme
  const handlePricingFieldChange = (id, field, val) => {
    setPricingEdits(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: val
      }
    }));
  };

  const handleSavePricingRow = async (item, applyToExisting = false) => {
    const rowEdit = pricingEdits[item.id] || { sale_price: item.sale_price, cost: item.cost };
    setPricingEdits(prev => ({
      ...prev,
      [item.id]: { ...rowEdit, saving: true }
    }));
    try {
      const res = await updateServicePricing(item.id, {
        category_name: item.category_name,
        service_name: item.service_name,
        sale_price: Number(rowEdit.sale_price) || 0,
        cost: Number(rowEdit.cost) || 0,
        apply_to_existing: applyToExisting
      });
      showTempNotice(res.message || `"${item.service_name}" fiyatı ve maliyeti güncellendi.`);
      await loadPricing();
      if (applyToExisting && onJobsChanged) {
        onJobsChanged();
      }
    } catch (err) {
      alert(`Fiyat güncellenemedi: ${err.response?.data?.error || err.message}`);
    } finally {
      setPricingEdits(prev => ({
        ...prev,
        [item.id]: { ...(prev[item.id] || {}), saving: false }
      }));
    }
  };

  const handleAddPricingItem = async (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    setSavingNewPricing(true);
    try {
      const res = await saveServicePricing({
        category_name: newCategoryName,
        service_name: newServiceName.trim(),
        sale_price: Number(newSalePrice) || 0,
        cost: Number(newCostPrice) || 0
      });
      setNewServiceName('');
      setNewSalePrice('');
      setNewCostPrice('');
      showTempNotice(res.message || 'Yeni hizmet/ürün fiyat kataloğuna eklendi.');
      await loadPricing();
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingNewPricing(false);
    }
  };

  const handleDeletePricingItem = async (id, name) => {
    if (!confirm(`"${name}" fiyat kalemini katalogdan silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteServicePricing(id);
      await loadPricing();
    } catch (err) {
      alert(`Silinemedi: ${err.message}`);
    }
  };

  // İşin finans modalını aç
  const openFinanceModal = (job) => {
    setFinanceModalJob({
      id: job.id,
      title: job.title,
      lead_name: job.lead_name,
      category_id: job.category_id,
      category_name: job.category_name,
      products: job.products,
      status: job.status,
      sale_price: Number(job.sale_price) || 0,
      cost: Number(job.cost) || 0,
      payment_method: job.payment_method || 'Havale / EFT',
      installment_count: Math.max(1, Number(job.installment_count) || 1),
      paid_amount: Number(job.paid_amount) || 0,
      notes: job.notes || ''
    });
  };

  // Katalogdan bu iş için eşleşen fiyatı çek
  const applyCatalogPriceToModalJob = () => {
    if (!financeModalJob) return;
    let prods = [];
    try {
      prods = financeModalJob.products ? JSON.parse(financeModalJob.products) : [];
    } catch {
      prods = [];
    }

    let matchedSale = 0;
    let matchedCost = 0;
    let found = false;

    if (Array.isArray(prods) && prods.length > 0) {
      for (const pName of prods) {
        const hit = pricingList.find(
          item => String(item.service_name).toLowerCase() === String(pName).toLowerCase()
        );
        if (hit && (Number(hit.sale_price) > 0 || Number(hit.cost) > 0)) {
          matchedSale += Number(hit.sale_price) || 0;
          matchedCost += Number(hit.cost) || 0;
          found = true;
        }
      }
    }

    if (!found && financeModalJob.category_name) {
      const catLower = String(financeModalJob.category_name).toLowerCase();
      const hit = pricingList.find(
        item =>
          String(item.service_name).toLowerCase() === `${catLower} (genel paket)` ||
          String(item.service_name).toLowerCase() === catLower ||
          (String(item.category_name).toLowerCase() === catLower &&
            (Number(item.sale_price) > 0 || Number(item.cost) > 0))
      );
      if (hit) {
        matchedSale = Number(hit.sale_price) || 0;
        matchedCost = Number(hit.cost) || 0;
        found = true;
      }
    }

    if (!found) {
      alert('Bu işin kategorisi veya alt hizmeti için henüz katalogda 0 ₺ üzeri bir fiyat tanımlanmamış. Üstteki "Ürün / Hizmet Fiyat & Maliyet Kataloğu"ndan tanımlayabilirsiniz.');
      return;
    }

    setFinanceModalJob(prev => ({
      ...prev,
      sale_price: matchedSale,
      cost: matchedCost
    }));
  };

  const handleSaveFinanceModal = async (e) => {
    e.preventDefault();
    if (!financeModalJob) return;
    setSavingFinanceJob(true);
    try {
      await updateJob(financeModalJob.id, {
        sale_price: Number(financeModalJob.sale_price) || 0,
        cost: Number(financeModalJob.cost) || 0,
        payment_method: financeModalJob.payment_method,
        installment_count: Math.max(1, Number(financeModalJob.installment_count) || 1),
        paid_amount: Math.max(0, Number(financeModalJob.paid_amount) || 0),
        notes: financeModalJob.notes,
        status: financeModalJob.status
      });
      showTempNotice(`"${financeModalJob.title}" finans ve ödeme bilgileri kaydedildi!`);
      setFinanceModalJob(null);
      if (onJobsChanged) onJobsChanged();
    } catch (err) {
      alert(`Finans bilgisi güncellenemedi: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingFinanceJob(false);
    }
  };

  // Hızlı +1 Taksit veya Tamamını Tahsil Et
  const handleQuickCollectPayment = async (job, mode = 'full') => {
    const sale = Number(job.sale_price) || 0;
    if (sale <= 0) {
      openFinanceModal(job);
      return;
    }
    const currentPaid = Number(job.paid_amount) || 0;
    const installments = Math.max(1, Number(job.installment_count) || 1);
    const singleInstallment = sale / installments;

    const nextPaid =
      mode === 'full'
        ? sale
        : Math.min(sale, Math.round((currentPaid + singleInstallment) * 100) / 100);

    try {
      await updateJob(job.id, { paid_amount: nextPaid });
      showTempNotice(
        mode === 'full'
          ? `"${job.title}" için ödemenin tamamı (${formatTL(sale)}) tahsil edildi olarak işaretlendi.`
          : `"${job.title}" için +1 taksit eklendi (Toplam Alınan: ${formatTL(nextPaid)}).`
      );
      if (onJobsChanged) onJobsChanged();
    } catch (err) {
      alert(`Ödeme güncellenemedi: ${err.message}`);
    }
  };

  const handleReopenJob = async (job) => {
    try {
      await updateJob(job.id, { status: 'devam_ediyor' });
      showTempNotice(`"${job.title}" tekrar Devam Eden İşler listesine taşındı.`);
      if (onJobsChanged) onJobsChanged();
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  const handleDeleteCompletedJob = async (jobId) => {
    if (!confirm('Bu tamamlanan iş kaydını tamamen silmek istediğinize emin misiniz?')) return;
    try {
      await deleteJob(jobId);
      if (onJobsChanged) onJobsChanged();
    } catch (err) {
      alert(`Silinemedi: ${err.message}`);
    }
  };

  const distinctPricingCategories = Array.from(
    new Set([
      ...categories.map(c => c.name),
      ...pricingList.map(p => p.category_name)
    ].filter(Boolean))
  );

  const filteredPricingList =
    selectedPricingCategory === 'all'
      ? pricingList
      : pricingList.filter(p => p.category_name === selectedPricingCategory);

  return (
    <div className="space-y-6 mt-8">
      {/* ÜST BAŞLIK BANNERI (YALNIZCA ADMİN) */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-emerald-800/40">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider">
                🔒 Sadece Admin Görebilir
              </span>
              <span className="bg-white/10 text-slate-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Finans, Maliyet, Tahsilat & Fiyatlandırma Merkezi
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Tamamlanan İşler, Hizmet Maliyetleri & Ödeme Takibi
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl">
              Tamamlandı olarak işaretlenen işler otomatik olarak buraya düşer. Her ürün/hizmet için standart <strong>Satış Fiyatı</strong> ve <strong>Maliyet</strong> belirleyebilir; iş bazında <strong>Ödeme Şekli, Taksit Sayısı, Alınan/Kalan Ödeme, Yüzdelik Tahsilat Barı</strong> ve <strong>Toplam Net Kazancı</strong> takip edebilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPricingPanel(prev => !prev)}
              className={`text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                showPricingPanel
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-white text-slate-900 hover:bg-emerald-50'
              }`}
            >
              <Tag className="w-4 h-4 text-emerald-700" />
              <span>
                {showPricingPanel
                  ? 'Ürün / Hizmet Fiyat Kataloğunu Gizle'
                  : '🏷️ Ürün / Hizmet Satış Fiyatı & Maliyet Belirle'}
              </span>
            </button>
          </div>
        </div>

        {/* FİNANSAL GENEL ÖZET KARTLARI (TOPLAM SATIŞ, MALİYET, NET KAZANÇ, ALINAN, KALAN) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          {/* 1. Toplam Satış (Ciro) */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
              <span>Toplam Hizmet Satışı</span>
              <DollarSign className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white mt-1">
              {formatTL(totals.totalSale)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {displayedJobs.length} işin toplam satış bedeli
            </div>
          </div>

          {/* 2. Toplam Maliyet */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-rose-200 flex items-center justify-between">
              <span>Toplam Maliyet</span>
              <Layers className="w-3.5 h-3.5 text-rose-300" />
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-300 mt-1">
              {formatTL(totals.totalCost)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Hizmet / üretim maliyetleri toplamı
            </div>
          </div>

          {/* 3. Toplam Net Kazanç (Kâr) */}
          <div className="bg-emerald-500/20 backdrop-blur-xs border border-emerald-400/40 rounded-xl p-3.5">
            <div className="text-[11px] font-extrabold text-emerald-200 flex items-center justify-between">
              <span>Toplam Net Kazanç (Kâr)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-300 mt-1">
              {formatTL(totals.totalProfit)}
            </div>
            <div className="text-[10px] text-emerald-200/80 mt-0.5">
              Satış ({formatTL(totals.totalSale)}) - Maliyet ({formatTL(totals.totalCost)})
            </div>
          </div>

          {/* 4. Alınan Ödeme (Tahsilat) */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-sky-200 flex items-center justify-between">
              <span>Alınan Toplam Ödeme</span>
              <Wallet className="w-3.5 h-3.5 text-sky-300" />
            </div>
            <div className="text-lg sm:text-xl font-black text-sky-300 mt-1">
              {formatTL(totals.totalPaid)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Kasaya giren toplam tahsilat
            </div>
          </div>

          {/* 5. Kalan Ödeme (Alacak) + Genel Yüzdelik Bar */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5 col-span-2 md:col-span-1">
            <div className="text-[11px] font-bold text-amber-200 flex items-center justify-between">
              <span>Kalan Ödeme (Alacak)</span>
              <span className="text-[11px] font-black text-emerald-300">%{overallCollectionPct}</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-300 mt-1">
              {formatTL(totals.totalRemaining)}
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-1.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300"
                style={{ width: `${overallCollectionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold p-3.5 rounded-xl flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* ======================================================================= */}
      {/* BÖLÜM A: ÜRÜN / HİZMET SATIŞ FİYATI VE MALİYET KATALOĞU (ADMİN GİRİŞİ) */}
      {/* ======================================================================= */}
      {showPricingPanel && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 bg-indigo-50/70 border-b border-indigo-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">
                Admin Hizmet & Ürün Fiyatlandırma Masası
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                🏷️ Ürün / Hizmet Satış Fiyatı, Maliyet ve Birim Kazanç Tablosu
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Örn: <strong>Sosyal Medya</strong> veya <strong>Web Sitesi Tasarımı</strong> için standart satış fiyatını ve maliyetini buraya girdiğinizde birim kâr otomatik hesaplanır ve yeni/mevcut işlere uygulanır.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-600">Kategori:</span>
              <select
                value={selectedPricingCategory}
                onChange={(e) => setSelectedPricingCategory(e.target.value)}
                className="text-xs font-extrabold bg-white border border-indigo-300 text-slate-800 rounded-xl px-3 py-2 cursor-pointer"
              >
                <option value="all">Tüm Hizmet Kategorileri ({pricingList.length})</option>
                {distinctPricingCategories.map(catName => (
                  <option key={catName} value={catName}>
                    {catName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Yeni Ürün/Hizmet Fiyat Kalemi Ekleme Formu */}
          <form
            onSubmit={handleAddPricingItem}
            className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end"
          >
            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                Hizmet Kategorisi
              </label>
              <select
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
              >
                {distinctPricingCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Genel Hizmet">Genel Hizmet</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                Ürün / Hizmet Adı (Örn: Sosyal Medya Yönetimi)
              </label>
              <input
                type="text"
                required
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Yeni ürün veya paket adı yazın..."
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                  Satış Fiyatı (₺)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newSalePrice}
                  onChange={(e) => setNewSalePrice(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                  Maliyeti (₺)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newCostPrice}
                  onChange={(e) => setNewCostPrice(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingNewPricing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer h-[34px]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Hizmet Kalemi Ekle</span>
            </button>
          </form>

          {/* Katalog Tablosu */}
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-extrabold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Ürün / Hizmet Adı</th>
                  <th className="p-3">Satış Fiyatı (₺)</th>
                  <th className="p-3">Maliyeti (₺)</th>
                  <th className="p-3">Net Kazanç (Satış - Maliyet)</th>
                  <th className="p-3 text-right">Kaydet / Mevcut İşlere Uygula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {loadingPricing ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                      Fiyat kataloğu yükleniyor...
                    </td>
                  </tr>
                ) : filteredPricingList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      Kayıtlı hizmet kalemi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredPricingList.map(item => {
                    const editState = pricingEdits[item.id] || {
                      sale_price: item.sale_price ?? 0,
                      cost: item.cost ?? 0,
                      saving: false
                    };
                    const saleVal = Number(editState.sale_price) || 0;
                    const costVal = Number(editState.cost) || 0;
                    const unitProfit = saleVal - costVal;

                    return (
                      <tr key={item.id} className="hover:bg-indigo-50/30">
                        <td className="p-3">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px]">
                            {item.category_name}
                          </span>
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">
                          {item.service_name}
                        </td>
                        <td className="p-3">
                          <div className="relative w-32">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editState.sale_price}
                              onChange={(e) => handlePricingFieldChange(item.id, 'sale_price', e.target.value)}
                              className="w-full text-xs bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 font-extrabold text-slate-900 pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₺</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="relative w-32">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editState.cost}
                              onChange={(e) => handlePricingFieldChange(item.id, 'cost', e.target.value)}
                              className="w-full text-xs bg-white border border-slate-300 focus:border-rose-500 rounded-lg px-2.5 py-1.5 font-extrabold text-rose-700 pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₺</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-xs ${
                              unitProfit > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : unitProfit < 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {unitProfit >= 0 ? '+' : ''}
                            {formatTL(unitProfit)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={editState.saving}
                              onClick={() => handleSavePricingRow(item, false)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                              title="Standart fiyatı kaydet"
                            >
                              <Save className="w-3 h-3" />
                              <span>Kaydet</span>
                            </button>
                            <button
                              type="button"
                              disabled={editState.saving}
                              onClick={() => handleSavePricingRow(item, true)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                              title="Kaydet ve bu ürünü/kategoriyi içeren mevcut işlerin satış fiyatı/maliyetine de uygula"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Mevcut İşlere de Uygula</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePricingItem(item.id, item.service_name)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                              title="Katalogdan Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* ======================================================================= */}
      {/* BÖLÜM B: TAMAMLANAN İŞLER & MALİYET / ÖDEME / YÜZDELİK BAR TABLOSU */}
      {/* ======================================================================= */}
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-emerald-200 bg-emerald-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                Tamamlanan İşler & Finansal Ödeme Takibi ({completedJobs.length} Tamamlanan İş)
              </h3>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                Yalnızca Admin
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Üstteki "Alınan ve Devam Eden İşler" tablosunda <strong>Tamamlandı</strong> olarak işaretlenen işler buraya aktarılır. Maliyet, satış fiyatı, ödeme şekli, kaça bölündüğü, alınan/kalan ödeme ve yüzdelik barı buradan yönetebilirsiniz.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setScopeFilter('completed')}
              className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Sadece Tamamlanan İşler ({completedJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`text-xs font-extrabold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tüm İşleri Göster ({jobs.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 uppercase font-extrabold border-b border-slate-200 tracking-wider">
              <tr>
                <th className="p-3.5">Tamamlanan İş & Müşteri</th>
                <th className="p-3.5">Kategori & Sorumlu</th>
                <th className="p-3.5">Satış Fiyatı / Maliyet / Kazanç</th>
                <th className="p-3.5">Ödeme Şekli & Taksit</th>
                <th className="p-3.5">Alınan & Kalan Ödeme</th>
                <th className="p-3.5 min-w-[210px]">Ödeme Yüzdelik Barı (%)</th>
                <th className="p-3.5 text-right">Finans & İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 font-medium">
              {displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-1">
                      <div className="font-extrabold text-slate-600 text-sm">
                        Henüz "Tamamlandı" olarak işaretlenmiş bir iş bulunmuyor.
                      </div>
                      <p className="text-xs text-slate-400">
                        Üstteki "Alınan ve Devam Eden İşler" tablosundan herhangi bir işin durumunu <strong>Tamamlandı</strong> yaptığınızda otomatik olarak bu alt bölüme düşer. Tüm işlerin finansal durumunu görmek için sağ üstten <strong>"Tüm İşleri Göster"</strong> butonuna da tıklayabilirsiniz.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedJobs.map(job => {
                  const sale = Number(job.sale_price) || 0;
                  const cost = Number(job.cost) || 0;
                  const profit = sale - cost;
                  const paid = Number(job.paid_amount) || 0;
                  const remaining = Math.max(0, sale - paid);
                  const installments = Math.max(1, Number(job.installment_count) || 1);
                  const perInstallment = sale > 0 ? sale / installments : 0;
                  const pct = sale > 0 ? Math.min(100, Math.round((paid / sale) * 100)) : 0;

                  let parsedProds = [];
                  try {
                    parsedProds = job.products ? JSON.parse(job.products) : [];
                  } catch {
                    parsedProds = [];
                  }

                  return (
                    <tr key={job.id} className="hover:bg-emerald-50/20 transition-colors">
                      {/* 1. İş & Müşteri */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {job.title}
                          </span>
                          {job.status === 'tamamlandi' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                              ✓ Tamamlandı
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Devam Ediyor
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 font-bold text-xs mt-0.5">
                          {job.lead_name} <span className="text-slate-400 font-normal">• {job.lead_district}</span>
                        </div>
                        {parsedProds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parsedProds.map(p => (
                              <span
                                key={p}
                                className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-1.5 py-0.2 rounded"
                              >
                                ✦ {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* 2. Kategori & Sorumlu */}
                      <td className="p-3.5">
                        <span
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md text-white mb-1"
                          style={{ backgroundColor: job.category_color || '#6366f1' }}
                        >
                          {job.category_name || 'Hizmet'}
                        </span>
                        <div className="text-xs font-bold text-slate-800">
                          {job.member_name || 'Atanmadı'}
                        </div>
                      </td>

                      {/* 3. Satış Fiyatı / Maliyet / Net Kazanç */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 text-[11px]">Satış Fiyatı:</span>
                            <span className="font-black text-slate-900">{formatTL(sale)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 text-[11px]">Maliyet:</span>
                            <span className="font-bold text-rose-600">{formatTL(cost)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-100">
                            <span className="text-slate-700 font-extrabold text-[11px]">Net Kazanç:</span>
                            <span
                              className={`font-black text-xs px-1.5 py-0.2 rounded ${
                                profit > 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : profit < 0
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              {profit >= 0 ? '+' : ''}
                              {formatTL(profit)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Ödeme Şekli & Kaça Bölündüğü */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 font-extrabold text-[11px] px-2.5 py-1 rounded-lg border border-slate-200">
                            <CreditCard className="w-3 h-3 text-indigo-600" />
                            <span>{job.payment_method || 'Havale / EFT'}</span>
                          </span>
                          <div className="text-[11px] font-bold text-slate-700">
                            {installments === 1 ? (
                              <span className="text-emerald-700">Tek Çekim / Peşin (1)</span>
                            ) : (
                              <span className="text-indigo-700">
                                {installments}'e Bölündü ({formatTL(perInstallment)} / taksit)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Alınan Ödeme & Kalan Ödeme */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">Alınan:</span>
                            <span className="font-black text-emerald-700">{formatTL(paid)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">Kalan:</span>
                            <span
                              className={`font-black ${
                                remaining > 0 ? 'text-amber-600' : 'text-slate-400'
                              }`}
                            >
                              {formatTL(remaining)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 6. Ödeme Yüzdelik Barı */}
                      <td className="p-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={`font-black ${
                                pct >= 100
                                  ? 'text-emerald-700'
                                  : pct > 0
                                  ? 'text-blue-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              %{pct} Ödendi
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {sale > 0 ? `${formatTL(paid)} / ${formatTL(sale)}` : 'Fiyat Girilmedi'}
                            </span>
                          </div>

                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                pct >= 100
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                  : pct >= 50
                                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                  : pct > 0
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="flex items-center gap-1 pt-0.5">
                            {sale > 0 && remaining > 0 && installments > 1 && (
                              <button
                                type="button"
                                onClick={() => handleQuickCollectPayment(job, 'installment')}
                                className="text-[10px] font-extrabold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded cursor-pointer"
                                title="Bir taksit tutarı kadar tahsilat ekle"
                              >
                                +1 Taksit Al
                              </button>
                            )}
                            {sale > 0 && remaining > 0 && (
                              <button
                                type="button"
                                onClick={() => handleQuickCollectPayment(job, 'full')}
                                className="text-[10px] font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer"
                                title="Kalan ödemenin tamamını tahsil edildi yap"
                              >
                                ✓ Tamamı Alındı
                              </button>
                            )}
                            {sale === 0 && (
                              <button
                                type="button"
                                onClick={() => openFinanceModal(job)}
                                className="text-[10px] font-extrabold text-indigo-600 hover:underline cursor-pointer"
                              >
                                + Fiyat / Maliyet Gir
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 7. İşlem Butonları */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openFinanceModal(job)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                            title="Maliyet, Satış Fiyatı, Ödeme Şekli, Taksit ve Alınan Ödemeyi Düzenle"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Finans & Ödeme</span>
                          </button>

                          {onOpenEditJob && (
                            <button
                              type="button"
                              onClick={() => onOpenEditJob(job)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] px-2 py-1.5 rounded-lg cursor-pointer"
                              title="İş Başlığını / Kategorisini / Etiketlerini Düzenle"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {job.status === 'tamamlandi' && (
                            <button
                              type="button"
                              onClick={() => handleReopenJob(job)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-2 py-1.5 rounded-lg cursor-pointer shrink-0"
                              title="Bu işi tekrar Devam Ediyor listesine geri taşı"
                            >
                              Geri Al
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteCompletedJob(job.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg cursor-pointer"
                            title="İşi Sil"
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

      {/* ======================================================================= */}
      {/* İŞ BAZLI FİNANS, MALİYET, ÖDEME ŞEKLİ, TAKSİT VE TAHSİLAT MODALI */}
      {/* ======================================================================= */}
      {financeModalJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                  İş Finansmanı, Maliyet & Tahsilat Yönetimi
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                  {financeModalJob.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Müşteri: <strong>{financeModalJob.lead_name}</strong> • Kategori: <strong>{financeModalJob.category_name || 'Genel'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinanceModalJob(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinanceModal} className="mt-4 space-y-4">
              {/* Katalogdan Otomatik Fiyat Çekme Çubuğu */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-indigo-950">
                  🏷️ Katalogda tanımlı standart satış fiyatı ve maliyeti kullanmak ister misiniz?
                </span>
                <button
                  type="button"
                  onClick={applyCatalogPriceToModalJob}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg cursor-pointer shrink-0"
                >
                  Katalog Fiyatını Getir
                </button>
              </div>

              {/* Satış Fiyatı & Maliyet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Hizmet Satış Fiyatı (Toplam Bedel ₺):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={financeModalJob.sale_price}
                    onChange={(e) =>
                      setFinanceModalJob(prev => ({ ...prev, sale_price: e.target.value }))
                    }
                    className="w-full text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-black text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-rose-700 mb-1">
                    İşin Maliyeti (₺):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={financeModalJob.cost}
                    onChange={(e) =>
                      setFinanceModalJob(prev => ({ ...prev, cost: e.target.value }))
                    }
                    className="w-full text-sm bg-rose-50/40 focus:bg-white border border-rose-300 rounded-xl px-3 py-2.5 font-black text-rose-800"
                  />
                </div>
              </div>

              {/* Ödeme Şekli & Ödemenin Kaça Bölündüğü */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Ödeme Şekli:
                  </label>
                  <select
                    value={financeModalJob.payment_method}
                    onChange={(e) =>
                      setFinanceModalJob(prev => ({ ...prev, payment_method: e.target.value }))
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 cursor-pointer"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Ödemenin Kaça Bölündüğü (Taksit / Bölüm):
                  </label>
                  <select
                    value={financeModalJob.installment_count}
                    onChange={(e) =>
                      setFinanceModalJob(prev => ({
                        ...prev,
                        installment_count: Number(e.target.value) || 1
                      }))
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-900 cursor-pointer"
                  >
                    {INSTALLMENT_OPTIONS.map(n => (
                      <option key={n} value={n}>
                        {n === 1 ? '1 (Peşin / Tek Ödeme)' : `${n} Bölüme / Taksite Bölündü`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Alınan Ödeme & Hızlı Taksit Seçimi */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-extrabold text-emerald-800">
                    Alınan Ödeme (Tahsil Edilen Tutar ₺):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFinanceModalJob(prev => ({
                          ...prev,
                          paid_amount: Math.round(((Number(prev.sale_price) || 0) / 2) * 100) / 100
                        }))
                      }
                      className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer"
                    >
                      %50'si Alındı
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFinanceModalJob(prev => ({
                          ...prev,
                          paid_amount: Number(prev.sale_price) || 0
                        }))
                      }
                      className="text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded cursor-pointer"
                    >
                      %100 Tamamı Alındı
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={financeModalJob.paid_amount}
                  onChange={(e) =>
                    setFinanceModalJob(prev => ({ ...prev, paid_amount: e.target.value }))
                  }
                  className="w-full text-sm bg-emerald-50/40 focus:bg-white border border-emerald-300 rounded-xl px-3 py-2.5 font-black text-emerald-800"
                />
              </div>

              {/* Canlı Finansal Özet & Yüzdelik Ödeme Barı Önizlemesi */}
              {(() => {
                const sale = Number(financeModalJob.sale_price) || 0;
                const cost = Number(financeModalJob.cost) || 0;
                const profit = sale - cost;
                const paid = Number(financeModalJob.paid_amount) || 0;
                const remaining = Math.max(0, sale - paid);
                const inst = Math.max(1, Number(financeModalJob.installment_count) || 1);
                const perInst = sale > 0 ? sale / inst : 0;
                const pct = sale > 0 ? Math.min(100, Math.round((paid / sale) * 100)) : 0;

                return (
                  <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/10 rounded-xl p-2">
                        <div className="text-[10px] text-slate-300">Net Kazanç (Kâr)</div>
                        <div className="text-sm font-black text-emerald-300">
                          {formatTL(profit)}
                        </div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2">
                        <div className="text-[10px] text-slate-300">Kalan Ödeme</div>
                        <div className="text-sm font-black text-amber-300">
                          {formatTL(remaining)}
                        </div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2">
                        <div className="text-[10px] text-slate-300">Taksit Başına</div>
                        <div className="text-sm font-black text-sky-300">
                          {formatTL(perInst)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="text-emerald-300">Tahsilat İlerleme Yüzdesi: %{pct}</span>
                        <span className="text-slate-300">
                          Alınan: {formatTL(paid)} / Toplam: {formatTL(sale)}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/15">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFinanceModalJob(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingFinanceJob}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingFinanceJob ? 'Kaydediliyor...' : 'Finans & Ödeme Bilgilerini Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
