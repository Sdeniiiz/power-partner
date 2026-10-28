import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LeadFinder from './components/LeadFinder';
import CallQueue from './components/CallQueue';
import SalesPool from './components/SalesPool';
import MemberDashboard from './components/MemberDashboard';
import CalendarView from './components/CalendarView';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';
import TodayRecallsModal from './components/TodayRecallsModal';
import AssignedLeadsModal from './components/AssignedLeadsModal';
import DailyActivityModal from './components/DailyActivityModal';
import FieldRouteView from './components/FieldRouteView';
import AdminCockpit from './components/AdminCockpit';
import { getSettings, getLeads, getTeamMembers, getCategories, isFieldStaffRole, isAdminOrManagerRole } from './api';

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
  const [isTodayRecallsOpen, setIsTodayRecallsOpen] = useState(false);
  const [isDailyActivityOpen, setIsDailyActivityOpen] = useState(false);
  const [assignedLeadsNotif, setAssignedLeadsNotif] = useState(null);
  const [filterNotificationLeadIds, setFilterNotificationLeadIds] = useState(null);
  const [activityDateFilter, setActivityDateFilter] = useState('');

  const isAdmin = authUser?.role === 'admin';
  const canAccessFieldRoute =
    isAdmin ||
    isAdminOrManagerRole(authUser?.role) ||
    isFieldStaffRole(authUser?.role) ||
    isFieldStaffRole(currentUser?.role);

  // Oturum açıldığında veya değiştiğinde aktif tab ve kullanıcı ayarla
  useEffect(() => {
    if (authUser) {
      if (authUser.role === 'admin') {
        setActiveTab('cockpit');
      } else if (isFieldStaffRole(authUser.role)) {
        setActiveTab('field_route');
      } else {
        setActiveTab('calls');
      }
    }
  }, [authUser]);

  const handleLogout = () => {
    localStorage.removeItem('powerpartner_auth_user');
    setAuthUser(null);
  };

  const handleUpdateAuthUser = (updatedUser) => {
    setAuthUser(updatedUser);
    localStorage.setItem('powerpartner_auth_user', JSON.stringify(updatedUser));
    refreshGlobalData();
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
        onUpdateAuthUser={handleUpdateAuthUser}
        onOpenTodayRecalls={() => setIsTodayRecallsOpen(true)}
        onOpenAssignedLeads={(notif) => setAssignedLeadsNotif(notif)}
        onOpenDailyActivity={() => setIsDailyActivityOpen(true)}
      />

      {/* Ana İçerik Alanı */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6 py-3.5 sm:py-6 min-w-0 overflow-x-hidden">
        
        {/* YÖNETİCİ KOKPİTİ: CANLI NABIZ, SOĞUK ARAMA (BAHAR & ASLI), SAHA SATIŞ (YİĞİT), ALARMLAR VE BRİFİNG */}
        {activeTab === 'cockpit' && isAdmin && (
          <AdminCockpit
            authUser={authUser}
            teamMembers={teamMembers}
            onOpenLeadInCallQueue={(leadId) => {
              setFilterNotificationLeadIds([leadId]);
              setActiveTab('calls');
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

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
            filterNotificationLeadIds={filterNotificationLeadIds}
            onClearNotificationFilter={() => setFilterNotificationLeadIds(null)}
            activityDateFilter={activityDateFilter}
            onActivityDateChange={setActivityDateFilter}
          />
        )}

        {/* 7. ADIM: SATIŞ HAVUZU VE KATEGORİ DAĞITIMI */}
        {activeTab === 'sales' && (
          <SalesPool
            currentUser={currentUser}
            authUser={authUser}
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

        {/* SAHA ROTAM & ZİYARET SIRALAMASI (YALNIZCA YÖNETİCİ VE SAHA PERSONELİ) */}
        {activeTab === 'field_route' && canAccessFieldRoute && (
          <FieldRouteView
            currentUser={currentUser}
            authUser={authUser}
            teamMembers={teamMembers}
            onLeadUpdated={refreshGlobalData}
          />
        )}

        {/* 8. ADIM: TAKVİM (TESLİM TARİHLERİ VE RANDEVULAR) */}
        {activeTab === 'calendar' && (
          <CalendarView />
        )}

        {/* ADMİN ÖZEL: TAMAMLANAN İŞLER, MALİYET, FİNANS & HİZMET FİYAT KATALOĞU */}
        {activeTab === 'finance' && isAdmin && (
          <SalesPool
            currentUser={currentUser}
            authUser={authUser}
            onJobCreated={refreshGlobalData}
            onlyFinanceView={true}
          />
        )}

      </main>

      {/* Bugün Aranacak Randevular & Hatırlatmalar Modalı */}
      <TodayRecallsModal
        isOpen={isTodayRecallsOpen}
        onClose={() => setIsTodayRecallsOpen(false)}
        authUser={authUser}
        currentUser={currentUser}
        onLeadUpdated={refreshGlobalData}
      />

      {/* Yeni Atanan Aramalar & İşletmeler Modalı */}
      <AssignedLeadsModal
        isOpen={Boolean(assignedLeadsNotif)}
        onClose={() => setAssignedLeadsNotif(null)}
        notification={assignedLeadsNotif}
        authUser={authUser}
        currentUser={currentUser}
        onLeadUpdated={refreshGlobalData}
        onOpenInCallQueue={(leadIds) => {
          setFilterNotificationLeadIds(leadIds);
          setActiveTab('calls');
        }}
      />

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

      {/* Yönetici Günlük Faaliyet & Analiz Paneli Modalı (Navbar'dan tetiklenen) */}
      <DailyActivityModal
        isOpen={isDailyActivityOpen}
        onClose={() => setIsDailyActivityOpen(false)}
        initialDate={activityDateFilter || new Date().toISOString().slice(0, 10)}
        teamMembers={teamMembers}
        authUser={authUser}
        onOpenInCallQueue={(dateStr) => {
          setActivityDateFilter(dateStr);
          setIsDailyActivityOpen(false);
          setActiveTab('calls');
        }}
      />

      {/* Alt Bilgi */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <p>PowerPartner CRM • Google Maps Aday Avcısı & İş Dağıtım Sistemi</p>
      </footer>

    </div>
  );
}
