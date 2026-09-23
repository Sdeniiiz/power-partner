import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LeadFinder from './components/LeadFinder';
import CallQueue from './components/CallQueue';
import SalesPool from './components/SalesPool';
import MemberDashboard from './components/MemberDashboard';
import CalendarView from './components/CalendarView';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';
import { getSettings, getLeads, getTeamMembers, getCategories } from './api';

export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    try {
      const saved = localStorage.getItem('powerpartner_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('calls');
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isAdmin = authUser?.role === 'admin';

  // Oturum açıldığında veya değiştiğinde aktif tab ve kullanıcı ayarla
  useEffect(() => {
    if (authUser) {
      if (authUser.role === 'admin') {
        setActiveTab('finder');
      } else {
        setActiveTab('calls');
      }
    }
  }, [authUser]);

  const handleLogout = () => {
    localStorage.removeItem('powerpartner_auth_user');
    setAuthUser(null);
  };

  const handleLoginSuccess = (user) => {
    setAuthUser(user);
    if (user) {
      const matched = teamMembers?.find(m => m.name.toLowerCase() === user.name.toLowerCase());
      setCurrentUser(matched || { name: user.name, role: user.role });
    }
  };

  const refreshGlobalData = async () => {
    try {
      const [settingsRes, leadsRes, membersRes, catsRes] = await Promise.all([
        getSettings(),
        getLeads({ limit: 1 }),
        getTeamMembers(),
        getCategories()
      ]);

      setSettings(settingsRes);
      setStats(leadsRes.stats || null);
      setTeamMembers(membersRes.data || []);
      setCategories(catsRes.data || []);

      // Giriş yapan kullanıcıyı her zaman kendi hesabıyla eşle (Asla varsayılan ilk kişiye atama yapma)
      if (authUser) {
        const matched = membersRes.data?.find(m => m.name.toLowerCase() === authUser.name.toLowerCase());
        setCurrentUser(matched || { name: authUser.name, role: authUser.role });
      }
    } catch (err) {
      console.error('Veriler yüklenirken hata:', err);
    }
  };

  useEffect(() => {
    refreshGlobalData();
  }, [authUser]);

  // Kullanıcı giriş yapmamışsa Giriş Modalı Göster
  if (!authUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full max-w-full overflow-x-hidden">
      
      {/* Üst Navigasyon Çubuğu */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        teamMembers={teamMembers}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasApiKey={settings?.has_api_key}
        authUser={authUser}
        onLogout={handleLogout}
      />

      {/* Ana İçerik Alanı */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 min-w-0 max-w-full overflow-x-hidden">
        
        {/* 1-4. ADIM: İŞLETME BULUCU (GOOGLE MAPS - YALNIZCA ADMİN) */}
        {activeTab === 'finder' && isAdmin && (
          <LeadFinder
            hasApiKey={settings?.has_api_key}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onImportComplete={() => {
              refreshGlobalData();
              setActiveTab('calls'); // Otomatik olarak çağrı listesine yönlendir
            }}
          />
        )}

        {/* 5-6. ADIM: GÜNLÜK ARAMA VE ÇAĞRI NOTLARI */}
        {activeTab === 'calls' && (
          <CallQueue
            currentUser={currentUser}
            authUser={authUser}
            onLeadUpdated={refreshGlobalData}
          />
        )}

        {/* 7. ADIM: SATIŞ HAVUZU VE KATEGORİ DAĞITIMI */}
        {activeTab === 'sales' && (
          <SalesPool
            currentUser={currentUser}
            onJobCreated={refreshGlobalData}
          />
        )}

        {/* 8. ADIM: ÇALIŞAN EKRANI (KİŞİSEL GÖREVLER VE TESLİMATLAR) */}
        {activeTab === 'member' && (
          <MemberDashboard
            currentUser={currentUser}
            teamMembers={teamMembers}
            authUser={authUser}
            onJobUpdated={refreshGlobalData}
          />
        )}

        {/* 8. ADIM: TAKVİM (TESLİM TARİHLERİ VE RANDEVULAR) */}
        {activeTab === 'calendar' && (
          <CalendarView />
        )}

      </main>

      {/* Sistem Ayarları ve Google Maps API Anahtarı Modalı */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={refreshGlobalData}
        teamMembers={teamMembers}
        categories={categories}
        authUser={authUser}
        onLogout={handleLogout}
      />

      {/* Alt Bilgi */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <p>PowerPartner CRM • Google Maps Aday Avcısı & İş Dağıtım Sistemi</p>
      </footer>

    </div>
  );
}
