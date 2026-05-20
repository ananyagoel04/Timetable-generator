import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach auth token if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('tc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Attach active school/session context
  const school = localStorage.getItem('tc_school');
  const session = localStorage.getItem('tc_session');
  if (school) config.headers['X-School-Id'] = school;
  if (session) config.headers['X-Session-Id'] = session;
  return config;
});

// Unwrap { success, data } response format
api.interceptors.response.use(
  res => {
    if (res.data && res.data.success !== undefined) {
      return res.data; // Return the full envelope { success, data, count }
    }
    return res.data;
  },
  err => {
    const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong';
    if (err.response?.status === 401) {
      localStorage.removeItem('tc_token');
      window.location.href = '/login';
    }
    return Promise.reject(new Error(message));
  }
);

export default api;
