import axios from 'axios';
import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_KEY = import.meta.env.VITE_API_KEY || 'your-secret-api-key-change-this';

// ── Axios instance with auth header ─────────────────────────────
export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { Authorization: `Bearer ${API_KEY}` },
});

// ── Socket.IO connection (shared singleton) ──────────────────────
export const socket = io(BASE_URL, { autoConnect: false });

// ── Fences ──────────────────────────────────────────────────────
export const fenceApi = {
  getAll: (params = {}) => api.get('/fences', { params }),
  getById: (id) => api.get(`/fences/${id}`),
  create: (data) => api.post('/fences', data),
  update: (id, data) => api.put(`/fences/${id}`, data),
  remove: (id) => api.delete(`/fences/${id}`),
  getAlerts: (id) => api.get(`/fences/${id}/alerts`),
};

// ── Owners ──────────────────────────────────────────────────────
export const ownerApi = {
  getStats: () => api.get('/fences/owners/stats'),
};

// ── Locations ───────────────────────────────────────────────────
export const locationApi = {
  report: (deviceId, data) => api.post(`/locations/${deviceId}`, data),
  state: (deviceId) => api.get(`/locations/${deviceId}/state`),
};

// ── Alerts ──────────────────────────────────────────────────────
export const alertApi = {
  getAll: (params = {}) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  stats: () => api.get('/alerts/stats'),
};

// ── Webhooks ────────────────────────────────────────────────────
export const webhookApi = {
  getAll: () => api.get('/webhooks'),
  create: (data) => api.post('/webhooks', data),
  update: (id, data) => api.put(`/webhooks/${id}`, data),
  remove: (id) => api.delete(`/webhooks/${id}`),
};
