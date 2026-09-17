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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  Power<span className="text-blue-600">Partner</span>
                </span>
                <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  v2.0 CRM
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
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

          {/* Sağ Alan: Aktif Kullanıcı & Ayarlar */}
          <div className="flex items-center gap-2.5">
            {/* Giriş Yapan Hesap Bilgisi */}
            <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200/80 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                isAdmin ? 'bg-gradient-to-tr from-rose-500 to-amber-500 shadow-rose-200 shadow-xs' : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
              }`}>
                {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-800 tracking-tight leading-none">
                    {authUser?.name || 'Kullanıcı'}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md tracking-wider leading-none ${
                    isAdmin 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {isAdmin ? 'YÖNETİCİ' : 'PERSONEL'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">
                  @{authUser?.username}
                </span>
              </div>
            </div>

            {/* Personel Görev Seçici (Hangi personel adına işlem yapılıyor) */}
            {isAdmin && (
              <div className="hidden lg:flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <span className="text-[11px] text-slate-400 font-medium">Görünüm:</span>
                <select
                  value={currentUser?.id || ''}
                  onChange={(e) => {
                    const selected = teamMembers.find(m => m.id === Number(e.target.value));
                    if (selected) setCurrentUser(selected);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role.split('&')[0].trim()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Ayarlar Butonu (Admin için tam erişim, personel için de gerekirse görüntülenebilir) */}
            {isAdmin && (
              <button
                onClick={onOpenSettings}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200/80 cursor-pointer"
                title="Yönetim Masası & Sistem Ayarları"
              >
                <Settings className="w-4.5 h-4.5" />
                {!hasApiKey && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-ping" />
                )}
              </button>
            )}

            {/* Çıkış Yap Butonu */}
            <button
              onClick={onLogout}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-rose-100 cursor-pointer"
              title="Çıkış Yap"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>

        </div>
      </div>

      {/* Mobil Alt Navigasyon */}
      <div className="flex md:hidden border-t border-slate-200 overflow-x-auto py-2 px-3 gap-2 bg-slate-50">
        {isAdmin && (
          <button
            onClick={() => setActiveTab('finder')}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium ${
              activeTab === 'finder' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'
            }`}
          >
            1. Harita
          </button>
        )}
        <button
          onClick={() => setActiveTab('calls')}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium ${
            activeTab === 'calls' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
          }`}
        >
          2. Arama ({stats?.in_queue || 0})
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium ${
            activeTab === 'sales' ? 'bg-purple-600 text-white' : 'bg-white text-slate-700'
          }`}
        >
          3. Satış Havuzu ({stats?.satis_havuzu || 0})
        </button>
        <button
          onClick={() => setActiveTab('member')}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium ${
            activeTab === 'member' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
          }`}
        >
          4. Görevlerim
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium ${
            activeTab === 'calendar' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700'
          }`}
        >
          5. Takvim
        </button>
      </div>
    </header>
  );
}
