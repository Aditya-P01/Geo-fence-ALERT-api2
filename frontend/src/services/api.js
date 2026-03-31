import axios from 'axios';

const API_KEY = process.env.REACT_APP_API_KEY || 'geo-fence-secret-key-2024';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
  timeout: 10000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(new Error(err.response?.data?.error?.message || err.message || 'Network error'))
);

export const fenceAPI = {
  getAll:  (params = {}) => api.get('/fences', { params }),
  getById: (id)          => api.get(`/fences/${id}`),
  create:  (data)        => api.post('/fences', data),
  update:  (id, data)    => api.put(`/fences/${id}`, data),
  delete:  (id)          => api.delete(`/fences/${id}`),
};

export const locationAPI = {
  submit:   (deviceId, data) => api.post(`/locations/${deviceId}`, data),
  getState: (deviceId)       => api.get(`/locations/${deviceId}/state`),
};

export const alertAPI = {
  getAll:   (params = {}) => api.get('/alerts', { params }),
  getById:  (id)          => api.get(`/alerts/${id}`),
  getStats: ()            => api.get('/alerts/stats'),
};

export const webhookAPI = {
  getAll:  ()            => api.get('/webhooks'),
  getById: (id)          => api.get(`/webhooks/${id}`),
  create:  (data)        => api.post('/webhooks', data),
  update:  (id, data)    => api.put(`/webhooks/${id}`, data),
  delete:  (id)          => api.delete(`/webhooks/${id}`),
};

export default api;
