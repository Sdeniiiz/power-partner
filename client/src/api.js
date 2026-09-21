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
export const deleteLead = (id) => api.delete(`/leads/${id}`).then(res => res.data);

export const updateLead = (id, data) => api.put(`/leads/${id}`, data).then(res => res.data);
export const getCampaigns = () => api.get('/leads/campaigns/summary').then(res => res.data);
export const renameCampaign = (data) => api.put('/leads/campaigns/rename', data).then(res => res.data);
export const deleteCampaign = (data) => api.delete('/leads/campaigns/delete', { data }).then(res => res.data);

export const getJobs = (params) => api.get('/jobs', { params }).then(res => res.data);
export const createJob = (data) => api.post('/jobs', data).then(res => res.data);
export const updateJob = (id, data) => api.put(`/jobs/${id}`, data).then(res => res.data);
export const deleteJob = (id) => api.delete(`/jobs/${id}`).then(res => res.data);

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
export const updateUserPassword = (id, newPassword) => api.put(`/team/users/${id}/password`, { newPassword }).then(res => res.data);
export const deleteUser = (id) => api.delete(`/team/users/${id}`).then(res => res.data);
export const deleteTeamMember = (id) => api.delete(`/team/members/${id}`).then(res => res.data);
export const getTeamRoles = () => api.get('/team/roles').then(res => res.data);
export const addCustomRole = (role) => api.post('/team/roles', { role }).then(res => res.data);

// Admin Temizleme İşlemleri
export const clearCallQueue = () => api.post('/leads/admin/clear-queue').then(res => res.data);
export const clearAllLeads = () => api.post('/leads/admin/clear-all').then(res => res.data);

export default api;


