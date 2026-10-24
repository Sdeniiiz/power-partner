import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000
});

export const getSettings = () => api.get('/settings').then(res => res.data);
export const saveSettings = (data) => api.post('/settings', data).then(res => res.data);
export const testApiKey = (key) => api.post('/settings/test-key', { key }).then(res => res.data);

export const searchPlaces = (params) => api.post('/leads/search', params).then(res => res.data);
export const importLeads = (data) => api.post('/leads/import', data.places ? data : { places: data }).then(res => res.data);
export const distributeLeads = (data) => api.post('/leads/distribute', data).then(res => res.data);
export const batchAssignLeads = (lead_ids, caller_id) => api.put('/leads/batch/assign', { lead_ids, caller_id }).then(res => res.data);
export const getLeads = (params) => api.get('/leads', { params }).then(res => res.data);
export const getLead = (id) => api.get(`/leads/${id}`).then(res => res.data);
export const recordCall = (id, data) => api.post(`/leads/${id}/call`, data).then(res => res.data);
export const requeueUnreachable = () => api.post('/leads/requeue-unreachable').then(res => res.data);
export const updateBatchStatus = (leadIds, status) => api.post('/leads/batch-status', { leadIds, status }).then(res => res.data);
export const getLeadFilterMeta = () => api.get('/leads/meta/filters').then(res => res.data);
export const getDailyActivity = (params) => api.get('/leads/daily-activity', { params }).then(res => res.data);
export const getFieldRoute = (params) => api.get('/leads/field-route', { params }).then(res => res.data);
export const reorderFieldRoute = (ordered_ids) => api.put('/leads/field-route/reorder', { ordered_ids }).then(res => res.data);
export const assignToFieldRoute = (data) => api.post('/leads/field-route/assign', data).then(res => res.data);
export const recordFieldVisit = (id, data) => api.post(`/leads/${id}/field-visit`, data).then(res => res.data);
export const deleteLead = (id) => api.delete(`/leads/${id}`).then(res => res.data);

export const isFieldStaffRole = (role) => {
  if (!role || typeof role !== 'string') return false;
  return /saha/i.test(role);
};

export const isAdminOrManagerRole = (role) => {
  if (!role || typeof role !== 'string') return false;
  return role === 'admin' || /yönetici|yonetici|müdür|mudur|admin/i.test(role);
};

export const updateLead = (id, data) => api.put(`/leads/${id}`, data).then(res => res.data);
export const getCampaigns = () => api.get('/leads/campaigns/summary').then(res => res.data);
export const renameCampaign = (data) => api.put('/leads/campaigns/rename', data).then(res => res.data);
export const deleteCampaign = (data) => api.delete('/leads/campaigns/delete', { data }).then(res => res.data);

export const getJobs = (params) => api.get('/jobs', { params }).then(res => res.data);
export const createJob = (data) => api.post('/jobs', data).then(res => res.data);
export const updateJob = (id, data) => api.put(`/jobs/${id}`, data).then(res => res.data);
export const deleteJob = (id, data) => api.delete(`/jobs/${id}`, { data }).then(res => res.data);

export const getServicePricing = () => api.get('/jobs/pricing').then(res => res.data);
export const saveServicePricing = (data) => api.post('/jobs/pricing', data).then(res => res.data);
export const updateServicePricing = (id, data) => api.put(`/jobs/pricing/${id}`, data).then(res => res.data);
export const deleteServicePricing = (id) => api.delete(`/jobs/pricing/${id}`).then(res => res.data);

export const getTeamMembers = () => api.get('/team/members').then(res => res.data);
export const addTeamMember = (data) => api.post('/team/members', data).then(res => res.data);
export const getCategories = () => api.get('/team/categories').then(res => res.data);
export const addCategory = (data) => api.post('/team/categories', data).then(res => res.data);

export const getCalendarEvents = (params) => api.get('/calendar/events', { params }).then(res => res.data);

export const getBackupData = () => api.get('/settings/backup').then(res => res.data);
export const restoreBackupData = (data) => api.post('/settings/restore', data).then(res => res.data);

// Auth & Users & Roles
export const loginUser = (credentials) => api.post('/team/login', credentials).then(res => res.data);
export const getUsers = () => api.get('/team/users').then(res => res.data);
export const createUser = (data) => api.post('/team/users', data).then(res => res.data);
export const updateUser = (id, data) => api.put(`/team/users/${id}`, data).then(res => res.data);
export const updateUserBulutfon = (id, data) => api.put(`/team/users/${id}/bulutfon`, data).then(res => res.data);
export const updateUserPassword = (id, newPassword) => api.put(`/team/users/${id}/password`, { newPassword }).then(res => res.data);
export const deleteUser = (id) => api.delete(`/team/users/${id}`).then(res => res.data);
export const updateTeamMember = (id, data) => api.put(`/team/members/${id}`, data).then(res => res.data);
export const deleteTeamMember = (id) => api.delete(`/team/members/${id}`).then(res => res.data);
export const getTeamRoles = () => api.get('/team/roles').then(res => res.data);
export const addCustomRole = (role) => api.post('/team/roles', { role }).then(res => res.data);

// Notifications (Step 2)
export const getNotifications = (user, isAdmin = false) => api.get('/notifications', { params: { user: user || undefined, is_admin: isAdmin ? 'true' : 'false' } }).then(res => res.data);
export const getNotificationLeads = (id) => api.get(`/notifications/${id}/leads`).then(res => res.data);
export const markNotificationsRead = (data) => api.post('/notifications/mark-read', data || {}).then(res => res.data);
export const createNotification = (data) => api.post('/notifications', data).then(res => res.data);
export const deleteNotification = (id) => api.delete(`/notifications/${id}`).then(res => res.data);

// Bulutfon VoIP (Step 3 & Seçenek B)
export const triggerBulutfonCallApi = (data) => api.post('/bulutfon/call', data).then(res => res.data);
export const getBulutfonStatus = () => api.get('/bulutfon/status').then(res => res.data);

// Bulutfon Plus mobil uygulama ve masaüstü VoIP derin bağlantı oluşturucu
export const getBulutfonDialUrl = (phone) => {
  if (!phone || phone === 'Numara Yok') return 'tel:';
  const clean = phone.toString().replace(/[^0-9]/g, '');
  if (!clean) return 'tel:';

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    return `intent:${clean}#Intent;action=android.intent.action.DIAL;scheme=tel;package=com.bulutfon.plus;S.browser_fallback_url=${encodeURIComponent('tel:' + clean)};end`;
  }
  // Windows / Mac / iOS için softphone / VoIP protokolü
  return `callto:${clean}`;
};

// Admin Temizleme İşlemleri
export const clearCallQueue = () => api.post('/leads/admin/clear-queue').then(res => res.data);
export const clearAllLeads = () => api.post('/leads/admin/clear-all').then(res => res.data);

// Görüşme notu satırını yazar, tarih, saat ve içerik olarak ayrıştırıcı
export function parseCallNote(line) {
  if (!line || typeof line !== 'string') return { author: null, date: null, time: null, content: '' };

  const trimmed = line.trim();

  // 1. Standart Format: "Yazar [Tarih Saat]: İçerik" veya "Yazar [Tarih]: İçerik"
  const bracketMatch = trimmed.match(/^([^\[:]+?)\s*\[(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*:\s*(.*)$/);
  if (bracketMatch) {
    return {
      author: bracketMatch[1].trim(),
      date: bracketMatch[2].trim(),
      time: bracketMatch[3] ? bracketMatch[3].trim().slice(0, 5) : null,
      content: bracketMatch[4].trim()
    };
  }

  // 2. Köşeli Parantez Başta: "[Tarih Saat] Yazar: İçerik" veya "[Tarih Saat]: İçerik"
  const bracketFirstMatch = trimmed.match(/^\[(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(?:([^:]+?)\s*:\s*)?(.*)$/);
  if (bracketFirstMatch) {
    return {
      author: bracketFirstMatch[3] ? bracketFirstMatch[3].trim() : null,
      date: bracketFirstMatch[1].trim(),
      time: bracketFirstMatch[2] ? bracketFirstMatch[2].trim().slice(0, 5) : null,
      content: bracketFirstMatch[4].trim()
    };
  }

  // 3. Klasik / Eski Format: "Yazar: İçerik"
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > -1 && colonIdx < 35) {
    const author = trimmed.slice(0, colonIdx).trim();
    const content = trimmed.slice(colonIdx + 1).trim();

    let date = null;
    const embeddedDateMatch = content.match(/\b(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})\b/);
    if (embeddedDateMatch) {
      date = embeddedDateMatch[1];
    }

    return {
      author,
      date,
      time: null,
      content
    };
  }

  // 4. Düz Satır (Yazarsız)
  let date = null;
  const embeddedDateMatch = trimmed.match(/\b(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})\b/);
  if (embeddedDateMatch) {
    date = embeddedDateMatch[1];
  }

  return {
    author: null,
    date,
    time: null,
    content: trimmed
  };
}

export default api;


