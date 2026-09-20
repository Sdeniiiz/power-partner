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
  X
} from 'lucide-react';

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
  onLogout
}) {
  const isAdmin = authUser?.role === 'admin';
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Dışarı tıklandığında profil menüsünü kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showProfileMenu]);

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
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative" ref={profileMenuRef}>
            
            {/* Giriş Yapan Hesap Bilgisi / Profil Butonu (Tıklanabilir - Menü Açar) */}
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
    </header>
  );
}

