import React from 'react';
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
  LogOut,
  Shield,
  User
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
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
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
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Giriş Yapan Hesap Bilgisi */}
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-100/90 border border-slate-200/80 rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5 shadow-2xs max-w-[110px] sm:max-w-none">
              <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                isAdmin ? 'bg-gradient-to-tr from-rose-500 to-amber-500 shadow-rose-200 shadow-xs' : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
              }`}>
                {isAdmin ? <Shield className="w-3 h-3 sm:w-4 sm:h-4" /> : <User className="w-3 h-3 sm:w-4 sm:h-4" />}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] sm:text-xs font-black text-slate-800 tracking-tight leading-none truncate max-w-[48px] sm:max-w-[100px] md:max-w-none">
                    {authUser?.name?.split(' ')[0] || 'Kullanıcı'}
                  </span>
                  <span className={`text-[8px] sm:text-[9px] font-bold uppercase px-1 sm:px-1.5 py-0.5 rounded tracking-wider leading-none hidden sm:inline-block ${
                    isAdmin 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-indigo-600 text-white'
                  }`}>
                    {isAdmin ? 'YÖNETİCİ' : (authUser?.role || 'PERSONEL')}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-0.5 leading-none hidden md:block">
                  @{authUser?.username}
                </span>
              </div>
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

            {/* Çıkış Yap Butonu (Top Bar - Vurgulanmış & Asla Kaybolmaz) */}
            <button
              onClick={onLogout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all border border-rose-200 cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs active:scale-95"
              title="Hesaptan Çıkış Yap"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs font-semibold hidden md:inline">Çıkış</span>
            </button>
          </div>

        </div>
      </div>

      {/* Mobil Alt Navigasyon (Her cihazda kusursuz kayar ve Çıkış içerir) */}
      <div className="flex md:hidden border-t border-slate-200 overflow-x-auto py-2 px-2.5 gap-1.5 bg-slate-50 items-center scrollbar-none">
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

        {/* Mobilde Garanti Çıkış Butonu */}
        <button
          onClick={onLogout}
          className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 flex items-center gap-1 active:scale-95 ml-auto"
          title="Oturumu Kapat"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
          <span>Çıkış</span>
        </button>
      </div>
    </header>
  );
}
