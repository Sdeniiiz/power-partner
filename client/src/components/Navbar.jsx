import React, { useState, useRef, useEffect } from 'react';
import { 
  MapPin, 
  PhoneCall, 
  Briefcase, 
  UserCheck, 
  Calendar, 
  Settings, 
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  LogOut,
  Shield,
  User,
  X,
  Bell,
  CheckCheck,
  Phone
} from 'lucide-react';
import { getNotifications, markNotificationsRead, updateUserBulutfon } from '../api';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  stats, 
  currentUser, 
  setCurrentUser, 
  teamMembers,
  onOpenSettings,
  hasApiKey,
  authUser,
  onLogout,
  onUpdateAuthUser
}) {
  const isAdmin = authUser?.role === 'admin';
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Bildirim Sistemi (Step 2)
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifMenuRef = useRef(null);

  const fetchNotifs = async () => {
    try {
      const targetUser = isAdmin ? undefined : (authUser?.name || authUser?.person || authUser?.username);
      const res = await getNotifications(targetUser);
      if (res && res.data) {
        setNotifications(res.data);
        setUnreadCount(res.unread_count || 0);
      }
    } catch (err) {
      console.error('Bildirimler yüklenemedi:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 20000);
    return () => clearInterval(interval);
  }, [authUser]);

  const handleMarkAllRead = async () => {
    try {
      const targetUser = isAdmin ? undefined : (authUser?.name || authUser?.person || authUser?.username);
      await markNotificationsRead({ user: targetUser });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch (err) {
      console.error('Bildirimler okundu yapılamadı:', err);
    }
  };

  // Kişisel Bulutfon VoIP Ayarları Modalı (Seçenek B)
  const isBulutfonActive = Boolean(
    authUser?.bulutfon_enabled === 1 || 
    authUser?.bulutfon_enabled === true ||
    (authUser?.bulutfon_ext && authUser?.bulutfon_api_key) ||
    authUser?.bulutfon_ext
  );

  const [showBulutfonModal, setShowBulutfonModal] = useState(false);
  const [bulutfonEnabled, setBulutfonEnabled] = useState(isBulutfonActive);
  const [bulutfonMode, setBulutfonMode] = useState(authUser?.bulutfon_mode || 'app');
  const [bulutfonKey, setBulutfonKey] = useState(authUser?.bulutfon_api_key || '');
  const [bulutfonExt, setBulutfonExt] = useState(authUser?.bulutfon_ext || '');
  const [savingBulutfon, setSavingBulutfon] = useState(false);
  const [bulutfonMsg, setBulutfonMsg] = useState('');
  const [showKeySecret, setShowKeySecret] = useState(false);

  useEffect(() => {
    if (authUser) {
      setBulutfonEnabled(Boolean(
        authUser.bulutfon_enabled === 1 || 
        authUser.bulutfon_enabled === true || 
        authUser.bulutfon_ext || 
        authUser.bulutfon_api_key
      ));
      setBulutfonMode(authUser.bulutfon_mode || 'app');
      setBulutfonKey(authUser.bulutfon_api_key || '');
      setBulutfonExt(authUser.bulutfon_ext || '');
    }
  }, [authUser, showBulutfonModal]);

  const handleSaveBulutfon = async (e) => {
    if (e) e.preventDefault();
    if (!authUser?.id) return;
    setSavingBulutfon(true);
    try {
      const res = await updateUserBulutfon(authUser.id, {
        bulutfon_enabled: bulutfonEnabled ? 1 : 0,
        bulutfon_mode: bulutfonMode,
        bulutfon_api_key: bulutfonKey.trim(),
        bulutfon_ext: bulutfonExt.trim()
      });
      if (onUpdateAuthUser && res.user) {
        onUpdateAuthUser(res.user);
      }
      setBulutfonMsg('✓ Bulutfon tercihleriniz başarıyla kaydedildi!');
      setTimeout(() => {
        setBulutfonMsg('');
        setShowBulutfonModal(false);
      }, 1400);
    } catch (err) {
      alert(`Kayıt hatası: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingBulutfon(false);
    }
  };

  const handleClearBulutfon = async () => {
    if (!confirm('Bulutfon entegrasyon ayarlarınızı kapatmak istediğinize emin misiniz?')) return;
    if (!authUser?.id) return;
    setSavingBulutfon(true);
    try {
      const res = await updateUserBulutfon(authUser.id, {
        bulutfon_enabled: 0,
        bulutfon_mode: 'app',
        bulutfon_api_key: '',
        bulutfon_ext: ''
      });
      setBulutfonEnabled(false);
      setBulutfonMode('app');
      setBulutfonKey('');
      setBulutfonExt('');
      if (onUpdateAuthUser && res.user) {
        onUpdateAuthUser(res.user);
      }
      setBulutfonMsg('✓ Bulutfon seçeneği kapatıldı.');
      setTimeout(() => {
        setBulutfonMsg('');
        setShowBulutfonModal(false);
      }, 1400);
    } catch (err) {
      alert(`Hata: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingBulutfon(false);
    }
  };

  // Dışarı tıklandığında menüleri kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setShowNotifMenu(false);
      }
    };
    if (showProfileMenu || showNotifMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showProfileMenu, showNotifMenu]);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs w-full max-w-full overflow-visible">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-2">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-200 shrink-0">
              <Layers className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="font-extrabold text-sm sm:text-xl tracking-tight text-slate-900">
                  Power<span className="text-blue-600">Partner</span>
                </span>
                <span className="bg-blue-50 text-blue-700 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-full border border-blue-200 hidden sm:inline-block">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden md:block">
                Harita Aday Bulucu & İş Dağıtım Sistemi
              </p>
            </div>
          </div>

          {/* Navigasyon Sekmeleri */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('finder')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'finder'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>1. Harita Arama</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('calls')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'calls'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              <span>2. Günlük Arama</span>
              {stats?.in_queue > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {stats.in_queue}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'sales'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Briefcase className="w-4 h-4 text-purple-600" />
              <span>3. Satış & İş Dağıtımı</span>
              {stats?.satis_havuzu > 0 && (
                <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                  {stats.satis_havuzu}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('member')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'member'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>4. Çalışan Ekranı</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>5. Takvim</span>
            </button>
          </nav>

          {/* Sağ Alan: Aktif Kullanıcı & Ayarlar & Çıkış */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative">
            
            {/* Bildirim Çanı & Menüsü (Step 2 - 🔔) */}
            <div className="relative shrink-0" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => setShowNotifMenu(prev => !prev)}
                className="relative p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200/80 cursor-pointer shrink-0 flex items-center justify-center"
                title="Bildirimler"
              >
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Bildirim Açılır Çekmecesi (Dropdown) */}
              {showNotifMenu && (
                <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 animate-scale-up overflow-hidden">
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900">📢 Bildirimler</span>
                      {unreadCount > 0 && (
                        <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          {unreadCount} yeni
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Tümünü Oku</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold">Henüz bildirim bulunmuyor.</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 text-xs transition-colors flex items-start gap-2.5 ${
                            notif.read ? 'bg-white opacity-70' : 'bg-blue-50/40 font-medium'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            notif.read ? 'bg-slate-300' : 'bg-blue-600'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 truncate">
                                {notif.title}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                {notif.time || ''}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed break-words">
                              {notif.message}
                            </p>
                            {notif.date && (
                              <span className="text-[9px] text-slate-400 mt-1 inline-block">
                                {notif.date}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Giriş Yapan Hesap Bilgisi / Profil Butonu (Tıklanabilir - Menü Açar) */}
            <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu(prev => !prev)}
              className="flex items-center gap-1 sm:gap-1.5 bg-slate-100/90 hover:bg-slate-200/90 active:bg-slate-300/80 border border-slate-200/90 rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5 shadow-2xs cursor-pointer transition-all active:scale-95 text-left"
              title="Kullanıcı Profili ve Oturum Menüsü"
            >
              <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                isAdmin ? 'bg-gradient-to-tr from-rose-500 to-amber-500 shadow-rose-200 shadow-xs' : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
              }`}>
                {isAdmin ? <Shield className="w-3 h-3 sm:w-4 sm:h-4" /> : <User className="w-3 h-3 sm:w-4 sm:h-4" />}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <span className="text-[10px] sm:text-xs font-black text-slate-800 tracking-tight leading-none truncate max-w-[42px] xs:max-w-[55px] sm:max-w-[100px] md:max-w-none">
                    {authUser?.name?.split(' ')[0] || 'Kullanıcı'}
                  </span>
                  <ChevronDown className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0 transition-transform ${showProfileMenu ? 'rotate-180 text-blue-600' : ''}`} />
                </div>
                <span className={`text-[8px] sm:text-[9px] font-bold uppercase px-1 py-0.2 rounded tracking-wider leading-none hidden sm:inline-block ${
                  isAdmin 
                    ? 'bg-rose-500 text-white' 
                    : 'bg-indigo-600 text-white'
                }`}>
                  {isAdmin ? 'YÖNETİCİ' : (authUser?.role || 'PERSONEL')}
                </span>
              </div>
            </button>

            {/* Profil Açılır Menüsü (Dropdown - Mobilde ve Masaüstünde Kolay Çıkış) */}
            {showProfileMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 animate-scale-up">
                {/* Profil Kartı Başlığı */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 ${
                    isAdmin ? 'bg-gradient-to-tr from-rose-500 to-amber-500 shadow-md' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md'
                  }`}>
                    {isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-sm text-slate-900 truncate">
                      {authUser?.name || 'Kullanıcı'}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">@{authUser?.username}</p>
                    <span className={`inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider leading-none ${
                      isAdmin ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {isAdmin ? 'SİSTEM YÖNETİCİSİ' : (authUser?.role || 'PERSONEL')}
                    </span>
                  </div>
                </div>

                {/* Hızlı İşlemler */}
                <div className="py-2 space-y-1">
                  {/* Kişisel Bulutfon Ayarları (Seçenek B - Tüm personeller ve Admin için) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowBulutfonModal(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <span>Bulutfon Ayarlarım</span>
                    </div>
                    {isBulutfonActive ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        {authUser?.bulutfon_mode === 'api' && authUser?.bulutfon_ext ? `Dahili ${authUser.bulutfon_ext}` : 'Aktif'}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
                        Kapalı
                      </span>
                    )}
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all text-left cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>Yönetim Masası & Ayarlar</span>
                    </button>
                  )}
                </div>

                {/* Büyük ve Vurgulu Çıkış Yap Butonu */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition-all cursor-pointer shadow-2xs"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Hesaptan Çıkış Yap</span>
                  </button>
                </div>
              </div>
            )}
            </div>

            {/* Ayarlar Butonu (Admin için) */}
            {isAdmin && (
              <button
                onClick={onOpenSettings}
                className="relative p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200/80 cursor-pointer shrink-0"
                title="Yönetim Masası & Sistem Ayarları"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {!hasApiKey && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white animate-ping" />
                )}
              </button>
            )}

            {/* Çıkış Yap Butonu (Top Bar - iPhone SE'de Garantili Görünür) */}
            <button
              onClick={onLogout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl transition-all border border-rose-200 cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs active:scale-95"
              title="Hesaptan Çıkış Yap"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs font-semibold hidden md:inline">Çıkış</span>
            </button>
          </div>

        </div>
      </div>

      {/* Mobil Alt Navigasyon (Sekmeler Kayar, Çıkış Butonu Sabit Kalır) */}
      <div className="flex md:hidden border-t border-slate-200 bg-slate-50 items-center justify-between">
        <div className="flex-1 flex overflow-x-auto py-1.5 px-2 gap-1.5 items-center scrollbar-none">
          {isAdmin && (
            <button
              onClick={() => setActiveTab('finder')}
              className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'finder' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              1. Harita
            </button>
          )}
          <button
            onClick={() => setActiveTab('calls')}
            className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'calls' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            2. Arama ({stats?.in_queue || 0})
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'sales' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            3. Havuz ({stats?.satis_havuzu || 0})
          </button>
          <button
            onClick={() => setActiveTab('member')}
            className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'member' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            4. Görevler
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'calendar' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            5. Takvim
          </button>
        </div>

        {/* Mobilde SABİT (Pinned) Çıkış Butonu - Asla Kayıp Olmaz */}
        <div className="shrink-0 border-l border-slate-200 pl-1.5 pr-2 py-1.5 bg-slate-50 shadow-xs">
          <button
            onClick={onLogout}
            className="text-xs px-2 py-1.5 rounded-lg font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 flex items-center gap-1 active:scale-95"
            title="Oturumu Kapat"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>Çıkış</span>
          </button>
        </div>
      </div>

      {/* Kişisel Bulutfon VoIP Ayarları Modalı (Seçenek B) */}
      {showBulutfonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-up">
            {/* Modal Başlığı */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Bulutfon VoIP Ayarlarım</h3>
                  <p className="text-blue-100 text-xs">Kişisel santral ve dahili yapılandırması</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulutfonModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBulutfon} className="p-5 space-y-4">
              {/* Açık / Kapalı Toggle Anahtarı */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Bulutfon Kullanımı</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Kartlarda <strong>"📞 Bulutfon Ara"</strong> butonu görünsün mü?
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulutfonEnabled}
                    onChange={(e) => setBulutfonEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {bulutfonMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold text-center">
                  {bulutfonMsg}
                </div>
              )}

              {bulutfonEnabled ? (
                <div className="space-y-3.5">
                  {/* Arama Şekli Seçimi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Arama Şekli Tercihi:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBulutfonMode('app')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          bulutfonMode === 'app'
                            ? 'bg-blue-50/80 border-blue-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <span>📱 Doğrudan Uygulama</span>
                          {bulutfonMode === 'app' && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">Seçili</span>}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                          <strong>API gerekmez!</strong> Tıkladığınızda telefonunuzdaki Bulutfon Plus arama ekranını açar.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBulutfonMode('api')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          bulutfonMode === 'api'
                            ? 'bg-blue-50/80 border-blue-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <span>🌐 Bulutfon API Santral</span>
                          {bulutfonMode === 'api' && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">Seçili</span>}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                          API anahtarı ve dahili ile santral sizi ve müşteriyi otomatik bağlar.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Eğer API Modu Seçildiyse API ve Dahili Alanları */}
                  {bulutfonMode === 'api' && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Bulutfon API Anahtarı (Token)
                        </label>
                        <div className="relative">
                          <input
                            type={showKeySecret ? 'text' : 'password'}
                            value={bulutfonKey}
                            onChange={(e) => setBulutfonKey(e.target.value)}
                            placeholder="bf_token_..."
                            className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2 pr-10 outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeySecret(prev => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer text-xs"
                          >
                            {showKeySecret ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Dahili Numaranız (Örn: 101, 102)
                        </label>
                        <input
                          type="text"
                          value={bulutfonExt}
                          onChange={(e) => setBulutfonExt(e.target.value)}
                          placeholder="Örn: 101"
                          className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 outline-hidden"
                        />
                      </div>
                    </div>
                  )}

                  {bulutfonMode === 'app' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-800 flex items-start gap-2">
                      <span className="text-base shrink-0">✨</span>
                      <div>
                        <p className="font-bold">Kurulum gerektirmez!</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Telefonunuzda "Bulutfon Plus" uygulaması yüklü ise veya bilgisayarınızda bir VoIP programı varsa, arama butonu numarayı doğrudan o uygulamanın arama ekranında açacaktır.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  Bulutfon arama seçeneği kapalı. Kartlarınızda yalnızca klasik cihaz araması (tel:) ve WhatsApp görünecektir.
                </div>
              )}

              {/* Aksiyon Butonları */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                <div>
                  {isBulutfonActive && (
                    <button
                      type="button"
                      disabled={savingBulutfon}
                      onClick={handleClearBulutfon}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      Kapat & Sıfırla
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulutfonModal(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={savingBulutfon}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingBulutfon ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}

