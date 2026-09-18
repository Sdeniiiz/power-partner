import React, { useState, useEffect } from 'react';
import { 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Layers, 
  Plus, 
  ShieldCheck, 
  ExternalLink,
  Save,
  HelpCircle,
  Eye,
  EyeOff,
  Info,
  Download,
  Upload,
  Database,
  Trash2,
  Edit3,
  UserPlus,
  Shield,
  RefreshCw,
  Lock
} from 'lucide-react';
import { 
  getSettings, 
  saveSettings, 
  testApiKey, 
  addTeamMember, 
  addCategory, 
  getBackupData, 
  restoreBackupData, 
  getCampaigns, 
  renameCampaign, 
  deleteCampaign,
  getUsers,
  createUser,
  updateUserPassword,
  deleteUser,
  deleteTeamMember,
  clearCallQueue,
  clearAllLeads,
  getTeamRoles,
  addCustomRole
} from '../api';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated, teamMembers, categories, authUser }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [defaultCity, setDefaultCity] = useState('İstanbul');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Kullanıcı Yönetimi State (Admin)
  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Soğuk Arama');
  const [userActionMsg, setUserActionMsg] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [cleanMsg, setCleanMsg] = useState('');

  // Dinamik Rol Yönetimi State
  const [availableRoles, setAvailableRoles] = useState([
    'Soğuk Arama',
    'Saha Satış',
    'Yazılım',
    'Baskı / İmalat',
    'Dijital Ürünler',
    'Müdür',
    'admin'
  ]);
  const [isAddingCustomRole, setIsAddingCustomRole] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [isAddingMemberCustomRole, setIsAddingMemberCustomRole] = useState(false);
  const [customMemberRoleInput, setCustomMemberRoleInput] = useState('');

  // Şifre Değiştirme State
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeMsg, setPasswordChangeMsg] = useState('');
  const [customPasswordUser, setCustomPasswordUser] = useState(null);
  const [customUserPassword, setCustomUserPassword] = useState('');

  // Kampanya Yönetimi State (Örnekteki Campaign Manager)
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [newCampDistrict, setNewCampDistrict] = useState('');
  const [newCampCategory, setNewCampCategory] = useState('');
  const [campMsg, setCampMsg] = useState('');

  // Yedekleme State
  const [backupMsg, setBackupMsg] = useState('');

  // Yeni ekip üyesi ekleme formu
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Soğuk Arama');
  const [addingMember, setAddingMember] = useState(false);

  // Yeni kategori ekleme formu
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const isAdmin = authUser?.role === 'admin';

  const loadRoles = async () => {
    try {
      const res = await getTeamRoles();
      if (res.data && res.data.length > 0) {
        setAvailableRoles(res.data);
      }
    } catch (err) {
      console.error('Roller yüklenemedi:', err);
    }
  };

  const handleSaveCustomRole = async () => {
    const trimmed = customRoleInput.trim();
    if (!trimmed) return;
    try {
      await addCustomRole(trimmed);
      if (!availableRoles.includes(trimmed)) {
        setAvailableRoles(prev => [...prev, trimmed]);
      }
      setNewUserRole(trimmed);
      setCustomRoleInput('');
      setIsAddingCustomRole(false);
      setUserActionMsg(`✓ "${trimmed}" rolü sisteme eklendi ve seçildi.`);
      setTimeout(() => setUserActionMsg(''), 3000);
    } catch (err) {
      alert(`Rol ekleme hatası: ${err.message}`);
    }
  };

  const handleSaveMemberCustomRole = async () => {
    const trimmed = customMemberRoleInput.trim();
    if (!trimmed) return;
    try {
      await addCustomRole(trimmed);
      if (!availableRoles.includes(trimmed)) {
        setAvailableRoles(prev => [...prev, trimmed]);
      }
      setNewMemberRole(trimmed);
      setCustomMemberRoleInput('');
      setIsAddingMemberCustomRole(false);
    } catch (err) {
      alert(`Rol ekleme hatası: ${err.message}`);
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await getUsers();
      setUsersList(res.data || []);
    } catch (err) {
      console.error('Kullanıcılar yüklenemedi:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const res = await getCampaigns();
      setCampaigns(res.data || []);
      if (res.data && res.data.length > 0 && !selectedCampaign) {
        const first = res.data[0];
        setSelectedCampaign(`${first.district}|||${first.category}`);
        setNewCampDistrict(first.district);
        setNewCampCategory(first.category);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      getSettings().then(res => {
        setApiKey(res.google_maps_api_key || '');
        setDefaultCity(res.default_city || 'İstanbul');
      }).catch(err => console.error(err));
      loadCampaigns();
      loadUsers();
      loadRoles();
    }
  }, [isOpen]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newUserName.trim()) {
      alert('Lütfen kullanıcı adı, şifre ve isim alanlarını doldurun.');
      return;
    }
    try {
      const res = await createUser({
        username: newUsername.trim(),
        password: newPassword.trim(),
        name: newUserName.trim(),
        role: newUserRole,
        person: newUserName.trim()
      });
      setUserActionMsg(`✓ ${res.message || 'Kullanıcı oluşturuldu'}`);
      setNewUsername('');
      setNewPassword('');
      setNewUserName('');
      loadUsers();
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setUserActionMsg(''), 3000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (username === 'admin') {
      alert('Ana yönetici hesabı silinemez!');
      return;
    }
    if (!confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await deleteUser(userId);
      setUserActionMsg(`✓ ${res.message}`);
      loadUsers();
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setUserActionMsg(''), 3000);
    } catch (err) {
      alert(`Silme hatası: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleChangeMyPassword = async (e) => {
    e.preventDefault();
    if (!adminNewPassword.trim()) {
      alert('Lütfen yeni bir şifre girin.');
      return;
    }
    if (!authUser?.id) {
      alert('Kullanıcı oturumu bulunamadı.');
      return;
    }
    setPasswordChangeLoading(true);
    try {
      const res = await updateUserPassword(authUser.id, adminNewPassword.trim());
      setPasswordChangeMsg(`✓ ${res.message || 'Şifreniz başarıyla güncellendi.'}`);
      setAdminNewPassword('');
      setTimeout(() => setPasswordChangeMsg(''), 4000);
    } catch (err) {
      alert(`Şifre güncelleme hatası: ${err.response?.data?.error || err.message}`);
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleUpdateCustomUserPassword = async (e) => {
    e.preventDefault();
    if (!customPasswordUser || !customUserPassword.trim()) return;
    try {
      const res = await updateUserPassword(customPasswordUser.id, customUserPassword.trim());
      setUserActionMsg(`✓ ${res.message || 'Kullanıcı şifresi güncellendi'}`);
      setCustomPasswordUser(null);
      setCustomUserPassword('');
      setTimeout(() => setUserActionMsg(''), 3000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
      case 'Yönetici (Admin)':
        return { label: 'Yönetici (Admin)', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'Müdür':
        return { label: 'Müdür', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold' };
      case 'Soğuk Arama':
        return { label: 'Soğuk Arama', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'Saha Satış':
        return { label: 'Saha Satış', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'Yazılım':
        return { label: 'Yazılım', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'Baskı / İmalat':
        return { label: 'Baskı / İmalat', badgeClass: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'Dijital Ürünler':
        return { label: 'Dijital Ürünler', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200' };
      default:
        return { label: role || 'Personel', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 font-semibold' };
    }
  };

  const handleClearCallQueue = async () => {
    if (!confirm('Günlük arama listesindeki tüm bekleyen adaylar silinecek. Satışa dönen ve personellere atanan işler korunacaktır. Onaylıyor musunuz?')) return;
    try {
      const res = await clearCallQueue();
      setCleanMsg(`✓ ${res.message}`);
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setCleanMsg(''), 4000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleClearAllLeads = async () => {
    if (!confirm('DİKKAT: Sistemdeki TÜM işletmeler, arama kayıtları ve iş havuzu sıfırlanacaktır! Bu işlem geri alınamaz. Onaylıyor musunuz?')) return;
    try {
      const res = await clearAllLeads();
      setCleanMsg(`✓ ${res.message}`);
      loadCampaigns();
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setCleanMsg(''), 4000);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteMember = async (memberId, memberName) => {
    if (!confirm(`"${memberName}" personeli silinecek ve üzerindeki işler boşa çıkarılacak. Emin misiniz?`)) return;
    try {
      await deleteTeamMember(memberId);
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  const handleCampaignSelect = (val) => {
    setSelectedCampaign(val);
    if (!val) {
      setNewCampDistrict('');
      setNewCampCategory('');
      return;
    }
    const [d, c] = val.split('|||');
    setNewCampDistrict(d || '');
    setNewCampCategory(c || '');
  };

  const handleRenameCampaign = async (e) => {
    e.preventDefault();
    if (!selectedCampaign || !newCampDistrict || !newCampCategory) return;
    const [oldD, oldC] = selectedCampaign.split('|||');

    try {
      const res = await renameCampaign({
        oldDistrict: oldD,
        oldCategory: oldC,
        newDistrict: newCampDistrict,
        newCategory: newCampCategory
      });
      setCampMsg(`✓ ${res.message}`);
      loadCampaigns();
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setCampMsg(''), 3000);
    } catch (err) {
      alert(`Hata: ${err.message}`);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return;
    const [d, c] = selectedCampaign.split('|||');
    if (!confirm(`"${d} / ${c}" kampanyasına ait tüm işletmeler ve görevler kalıcı olarak silinecek. Emin misiniz?`)) {
      return;
    }

    try {
      const res = await deleteCampaign({ district: d, category: c });
      setCampMsg(`✓ ${res.message}`);
      setSelectedCampaign('');
      setNewCampDistrict('');
      setNewCampCategory('');
      loadCampaigns();
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setCampMsg(''), 3000);
    } catch (err) {
      alert(`Silme hatası: ${err.message}`);
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await getBackupData();
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `powerpartner-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setBackupMsg('✓ Veritabanı yedeği başarıyla indirildi.');
      setTimeout(() => setBackupMsg(''), 3000);
    } catch (err) {
      alert(`Yedek alma hatası: ${err.message}`);
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        const res = await restoreBackupData(json);
        setBackupMsg(`✓ ${res.message}`);
        if (onSettingsUpdated) onSettingsUpdated();
        setTimeout(() => setBackupMsg(''), 4000);
      } catch (err) {
        alert('Geçersiz yedek JSON dosyası veya sunucu hatası!');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;


  const handleTestKey = async () => {
    const trimmed = (apiKey || '').trim();
    if (!trimmed || trimmed.length < 10) {
      alert('Lütfen test edilecek geçerli bir API anahtarı giriniz (AIzaSy... ile başlar).');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testApiKey(trimmed);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        valid: false,
        message: err.response?.data?.message || 'Google Maps API anahtarı doğrulanamadı.',
        technicalDetails: err.response?.data?.technicalDetails || err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const trimmed = (apiKey || '').trim();
      await saveSettings({
        google_maps_api_key: trimmed,
        default_city: defaultCity
      });
      setSaveMessage('Ayarlar başarıyla kaydedildi!');
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      alert(`Kayıt hatası: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    try {
      await addTeamMember({
        name: newMemberName.trim(),
        role: newMemberRole || 'Soğuk Arama'
      });
      setNewMemberName('');
      setNewMemberRole('Soğuk Arama');
      loadUsers();
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      alert(`Ekip üyesi eklenirken hata: ${err.message}`);
    } finally {
      setAddingMember(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;
    setAddingCat(true);
    try {
      await addCategory({
        name: newCatName,
        description: newCatDesc || '',
        color: '#8b5cf6'
      });
      setNewCatName('');
      setNewCatDesc('');
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      alert(`Kategori eklenirken hata: ${err.message}`);
    } finally {
      setAddingCat(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-scale-up max-h-[90vh] overflow-y-auto">
        
        {/* Başlık */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-slate-900">
                Sistem Ayarları & Google Maps API
              </h2>
              <p className="text-xs text-slate-500">
                API anahtarınızı test edin, kaydedin veya ekip & kategori tanımlamaları yapın
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {saveMessage && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* 1. KISIM: GOOGLE MAPS API ANAHTARI */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Google Maps Places API Anahtarı
              </label>
              <a
                href="https://console.cloud.google.com/google/maps-apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
              >
                <span>Google Cloud Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Sistemimiz hem modern <strong>Places API (New)</strong> hem de klasik <strong>Places API (Legacy)</strong> standartlarını destekler.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showKey ? 'Gizle' : 'Göster'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestKey}
                disabled={testing || !apiKey}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                {testing ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
              </button>
            </div>

            {/* Test Sonucu & Tanılama Rehberi */}
            {testResult && (
              <div className={`p-3.5 rounded-xl text-xs space-y-2 ${
                testResult.valid 
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
                  : 'bg-red-50 text-red-900 border border-red-300'
              }`}>
                <div className="flex items-start gap-2">
                  {testResult.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">{testResult.message}</p>
                    {testResult.apiType && (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        Bağlanan API Türü: {testResult.apiType}
                      </p>
                    )}
                  </div>
                </div>

                {/* Teknik Hata Detayı (Genişletilebilir) */}
                {testResult.technicalDetails && (
                  <div className="mt-2 pt-2 border-t border-red-200 text-[11px] font-mono text-red-800 bg-white/70 p-2 rounded-lg break-all">
                    {testResult.technicalDetails}
                  </div>
                )}
              </div>
            )}

            {/* Google Cloud Gereksinimleri Bilgi Kutusu */}
            <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-3 text-[11px] text-blue-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-blue-800">
                <Info className="w-3.5 h-3.5" />
                <span>Google Maps API'nin Çalışması İçin Gereken 3 Adım:</span>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-800/90 pl-1 font-medium">
                <li>Google Cloud projenizde <strong>Faturalandırma (Billing)</strong> tanımlı olmalıdır (Google aylık 200$ ücretsiz kota verir).</li>
                <li><strong>Places API</strong> veya <strong>Places API (New)</strong> servisi etkinleştirilmiş (Enabled) olmalıdır.</li>
                <li>API Anahtarında kısıtlama varsa <strong>"None (Kısıtlama Yok)"</strong> veya <strong>"IP Kısıtlaması"</strong> seçili olmalıdır (HTTP Referrer kısıtlaması sunucu isteklerini engeller).</li>
              </ol>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {apiKey ? '🟢 Anahtar girilmiş' : '🟡 Anahtar yok (Akıllı Test Modu devrede)'}
              </span>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Kaydediliyor...' : 'Anahtarı Kaydet'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* ŞİFRE DEĞİŞTİRME (GİRİŞ YAPAN YÖNETİCİ / KULLANICI) */}
        <div className="mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>Giriş Yapan Hesap Şifresini Değiştir ({authUser?.name} - {authUser?.role === 'admin' ? 'Yönetici' : authUser?.role})</span>
            </label>
          </div>
          <form onSubmit={handleChangeMyPassword} className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={adminNewPassword}
              onChange={(e) => setAdminNewPassword(e.target.value)}
              placeholder="Yeni şifrenizi girin..."
              className="flex-1 text-xs bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={passwordChangeLoading || !adminNewPassword.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {passwordChangeLoading ? 'Kaydediliyor...' : 'Şifremi Güncelle'}
            </button>
          </form>
          {passwordChangeMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{passwordChangeMsg}</span>
            </div>
          )}
        </div>

        {/* YALNIZCA ADMİN: KULLANICI & PERSONEL HESABI YÖNETİMİ */}
        {isAdmin && (
          <div className="mt-8 border-t-2 border-indigo-100 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Kullanıcı & Personel Yönetimi (Departmanlar & Girişler)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sisteme giriş yapabilecek personelleri, departmanlarını ve şifrelerini tanımlayın.
                </p>
              </div>
              <button
                type="button"
                onClick={loadUsers}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingUsers ? 'animate-spin' : ''}`} />
                Yenile
              </button>
            </div>

            {userActionMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold">
                {userActionMsg}
              </div>
            )}

            {/* Seçili Kullanıcının Şifresini Değiştirme Modalı/Kutusu */}
            {customPasswordUser && (
              <form onSubmit={handleUpdateCustomUserPassword} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-xs font-bold text-amber-900 shrink-0">
                  "{customPasswordUser.name}" İçin Yeni Şifre:
                </span>
                <input
                  type="password"
                  value={customUserPassword}
                  onChange={(e) => setCustomUserPassword(e.target.value)}
                  placeholder="Yeni şifre belirleyin..."
                  className="text-xs bg-white border border-amber-300 rounded-xl px-3 py-1.5 flex-1"
                  autoFocus
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    Şifreyi Güncelle
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCustomPasswordUser(null); setCustomUserPassword(''); }}
                    className="bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    İptal
                  </button>
                </div>
              </form>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3">Kullanıcı Adı</th>
                      <th className="py-2.5 px-3">Adı Soyadı</th>
                      <th className="py-2.5 px-3">Departman / Yetki</th>
                      <th className="py-2.5 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {usersList.map((u) => {
                      const badge = getRoleBadge(u.role);
                      return (
                        <tr key={u.id} className="hover:bg-white transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{u.username}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">{u.name}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomPasswordUser(u);
                                  setCustomUserPassword('');
                                }}
                                className="text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Bu kullanıcının şifresini değiştir"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                              {u.username !== 'admin' ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  className="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Kullanıcıyı Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium italic px-1">Kilitli</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Yeni Personel & Giriş Hesabı Oluştur</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Kullanıcı Adı (Örn: ahmet)"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2"
                />
                <input
                  type="password"
                  placeholder="Giriş Şifresi"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2"
                />
                <input
                  type="text"
                  placeholder="Ad Soyad (Örn: Ahmet Yılmaz)"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2"
                />
                <select
                  value={isAddingCustomRole ? '__custom__' : newUserRole}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsAddingCustomRole(true);
                    } else {
                      setIsAddingCustomRole(false);
                      setNewUserRole(e.target.value);
                    }
                  }}
                  className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800"
                >
                  {availableRoles.map(r => (
                    <option key={r} value={r}>
                      {r === 'admin' ? 'Yönetici (Admin)' : r}
                    </option>
                  ))}
                  <option value="__custom__" className="text-indigo-600 font-bold">
                    + Özel Rol / Departman Ekle...
                  </option>
                </select>
              </div>

              {isAddingCustomRole && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2.5 bg-indigo-100/70 border border-indigo-200 rounded-xl animate-fade-in">
                  <span className="text-xs font-bold text-indigo-900 shrink-0">Yeni Rol Tanımla:</span>
                  <input
                    type="text"
                    placeholder="Örn: Müdür, Satış Müdürü, Operasyon..."
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(e.target.value)}
                    className="text-xs bg-white border border-indigo-300 rounded-xl px-3 py-1.5 flex-1"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveCustomRole}
                      disabled={!customRoleInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      Rolü Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingCustomRole(false); setCustomRoleInput(''); }}
                      className="text-slate-600 hover:text-slate-800 text-xs px-2.5 py-1.5 cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  + Personeli Kaydet
                </button>
              </div>
            </form>
          </div>
        )}

        {/* YALNIZCA ADMİN: SİSTEM TEMİZLEME & ARAMA LİSTESİ SIFIRLAMA */}
        {isAdmin && (
          <div className="mt-8 border-t-2 border-rose-100 pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Yönetici Temizleme Araçları</span>
              </h3>
              <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                YALNIZCA ADMİN
              </span>
            </div>

            {cleanMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold">
                {cleanMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Günlük Arama Listesini Temizle</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Arama havuzunda bekleyen işletmeleri temizler. Personellere atanmış ve satışa dönmüş işler silinmez.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearCallQueue}
                  className="mt-3 w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Arama Listesini Boşalt
                </button>
              </div>

              <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-xs text-rose-900">Tüm İşletme & Arama Verilerini Sıfırla</h4>
                  <p className="text-[11px] text-rose-600/80 mt-1">
                    Tüm taranan işletmeleri, çağrı kayıtlarını ve görevleri tamamen siler.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllLeads}
                  className="mt-3 w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Tüm Arama Kayıtlarını Temizle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. KISIM: EKİP ÜYELERİ YÖNETİMİ (Diyagram: Sezai, Yeş, Burak, Emre) */}
        <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Ekip Arkadaşları</span>
            </h3>
            <span className="text-xs text-slate-400">({teamMembers.length} kişi)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {teamMembers.map((m) => (
              <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center relative group">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(m.id, m.name)}
                    className="absolute top-1 right-1 text-slate-400 hover:text-rose-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Personeli Sil"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <div 
                  className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center mx-auto mb-1.5 shadow-2xs"
                  style={{ backgroundColor: m.color || '#2563eb' }}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="font-bold text-slate-800 text-xs">{m.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{m.role?.split('&')[0]}</div>
              </div>
            ))}
          </div>

          {/* Yeni Ekip Üyesi Ekle (Yalnızca Admin) */}
          {isAdmin && (
            <div className="space-y-2 pt-2">
              <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Yeni Personel Adı"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1"
                />
                <select
                  value={isAddingMemberCustomRole ? '__custom__' : (newMemberRole || 'Soğuk Arama')}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsAddingMemberCustomRole(true);
                    } else {
                      setIsAddingMemberCustomRole(false);
                      setNewMemberRole(e.target.value);
                    }
                  }}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 font-semibold text-slate-800"
                >
                  {availableRoles.filter(r => r !== 'admin').map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="__custom__" className="text-indigo-600 font-bold">
                    + Özel Rol / Departman Ekle...
                  </option>
                </select>
                <button
                  type="submit"
                  disabled={addingMember || !newMemberName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
                >
                  + Ekle
                </button>
              </form>

              {isAddingMemberCustomRole && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl animate-fade-in">
                  <span className="text-xs font-bold text-indigo-900 shrink-0">Yeni Rol Tanımla:</span>
                  <input
                    type="text"
                    placeholder="Örn: Müdür, Satış Müdürü..."
                    value={customMemberRoleInput}
                    onChange={(e) => setCustomMemberRoleInput(e.target.value)}
                    className="text-xs bg-white border border-indigo-300 rounded-xl px-3 py-1.5 flex-1"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveMemberCustomRole}
                      disabled={!customMemberRoleInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      Rolü Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingMemberCustomRole(false); setCustomMemberRoleInput(''); }}
                      className="text-slate-600 hover:text-slate-800 text-xs px-2.5 py-1.5 cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. KISIM: İŞ KATEGORİLERİ YÖNETİMİ (Diyagram: Web, Sosyal Medya, Influencer, QR Menü, Baskı) */}
        <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Hizmet & İş Kategorileri</span>
            </h3>
            <span className="text-xs text-slate-400">({categories.length} kategori)</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <span
                key={c.id}
                className="text-xs font-bold px-2.5 py-1 rounded-lg text-white shadow-2xs"
                style={{ backgroundColor: c.color || '#6366f1' }}
              >
                {c.name}
              </span>
            ))}
          </div>

          {/* Yeni Kategori Ekle (Yalnızca Admin) */}
          {isAdmin && (
            <form onSubmit={handleAddCategory} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Yeni Kategori (Örn: Google Reklam Yönetimi)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1"
              />
              <button
                type="submit"
                disabled={addingCat || !newCatName}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
              >
                + Ekle
              </button>
            </form>
          )}
        </div>

        {/* 4. KISIM: KAMPANYA YÖNETİMİ (Örnek Projedeki İlçe/Sektör Düzenleme & Toplu Silme) */}
        {isAdmin && (
          <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-600" />
                <span>Kampanya Yönetimi (Toplu Düzenle & Sil)</span>
              </h3>
              <span className="text-xs text-slate-400">({campaigns.length} kampanya)</span>
            </div>

          {campaigns.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Henüz taranmış/yüklenmiş kampanya grubu bulunmuyor.</p>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Düzenlenecek / Silinecek Kampanya:
                </label>
                <select
                  value={selectedCampaign}
                  onChange={(e) => handleCampaignSelect(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="">Kampanya Seçin</option>
                  {campaigns.map(c => (
                    <option key={`${c.district}|||${c.category}`} value={`${c.district}|||${c.category}`}>
                      {c.district} / {c.category} ({c.total} işletme — {c.sales || 0} satış)
                    </option>
                  ))}
                </select>
              </div>

              {selectedCampaign && (
                <form onSubmit={handleRenameCampaign} className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Yeni İlçe Adı:</label>
                      <input
                        type="text"
                        value={newCampDistrict}
                        onChange={(e) => setNewCampDistrict(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Yeni Sektör / Kategori:</label>
                      <input
                        type="text"
                        value={newCampCategory}
                        onChange={(e) => setNewCampCategory(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteCampaign}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Bu Kampanyayı ve Kayıtlarını Sil</span>
                    </button>

                    <button
                      type="submit"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      Toplu Güncelle
                    </button>
                  </div>
                </form>
              )}

              {campMsg && (
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                  {campMsg}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* 5. KISIM: VERİTABANI YEDEKLEME & GERİ YÜKLEME (JSON Backup & Restore) */}
        {isAdmin && (
        <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Veri Yedekleme & Geri Yükleme</span>
            </h3>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Tüm işletmeleri, arama kayıtlarını, iş havuzunu ve ayarları tek tıkla JSON olarak indirin veya başka bir cihaza aktarın.
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportBackup}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Yedek İndir (.json)</span>
              </button>

              <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Yedek Yükle</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {backupMsg && (
            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
              {backupMsg}
            </div>
          )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-right">

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
