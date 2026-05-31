import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// ── Logout callback (set by AuthContext to avoid window.location.href reload) ──
let _logoutCallback = null;
let _is401Handling = false;
let _isPlatformUser = false;

export function setLogoutCallback(fn) {
  _logoutCallback = fn;
}

export function setIsPlatformUser(val) {
  _isPlatformUser = val;
}

// Attach auth token and school/session context
api.interceptors.request.use(config => {
  const token = localStorage.getItem('tc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Attach school/session context
  const school = localStorage.getItem('tc_school');
  const session = localStorage.getItem('tc_session');
  
  if (school) {
    // Platform users use X-Selected-School-Id header
    // School users use X-School-Id header
    // Both are handled — backend reads both
    config.headers['X-School-Id'] = school;
    config.headers['X-Selected-School-Id'] = school;
  }
  if (session) {
    config.headers['X-Session-Id'] = session;
  }
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

    // Handle 401: logout only once (prevent infinite loop)
    if (err.response?.status === 401 && !_is401Handling) {
      _is401Handling = true;
      if (import.meta.env.DEV) console.debug('[Auth] 401 intercepted — triggering logout callback');
      localStorage.removeItem('tc_token');
      localStorage.removeItem('tc_school');
      localStorage.removeItem('tc_session');
      localStorage.removeItem('tc_session_name');
      localStorage.removeItem('tc_school_name');
      if (_logoutCallback) {
        _logoutCallback();
      }
      // Reset flag after a short delay so future real 401s can still trigger
      setTimeout(() => { _is401Handling = false; }, 2000);
    }
    return Promise.reject(new Error(message));
  }
);

export default api;
