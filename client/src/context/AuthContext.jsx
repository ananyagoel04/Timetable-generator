import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('tc_token');
    if (token) {
      api.get('/auth/me').then(r => {
        setUser(r.data);
        setIsAuthenticated(true);
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem('tc_token');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('tc_token', res.data.token);
    setUser(res.data.user);
    setIsAuthenticated(true);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('tc_token', res.data.token);
    setUser(res.data.user);
    setIsAuthenticated(true);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('tc_token');
    localStorage.removeItem('tc_school');
    localStorage.removeItem('tc_session');
    setUser(null);
    setIsAuthenticated(false);
  };

  const switchSchool = async (schoolId, sessionId) => {
    await api.put('/auth/switch-school', { schoolId, sessionId });
    localStorage.setItem('tc_school', schoolId);
    if (sessionId) localStorage.setItem('tc_session', sessionId);
    setUser(u => ({ ...u, activeSchool: schoolId, activeSession: sessionId }));
  };

  const isPlatformUser = () => {
    if (!user) return false;
    return ['platform_owner', 'platform_support', 'platform_developer', 'platform_qa', 'deployment_manager'].includes(user.role);
  };

  const hasPermission = (perm) => {
    if (!user) return false;
    if (isPlatformUser()) return true;
    const membership = user.schools?.find(s =>
      (s.school?._id || s.school) === user.activeSchool?.toString()
    );
    if (membership?.role === 'school_owner') return true;
    return membership?.permissions?.includes(perm) || false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, login, register, logout, switchSchool, hasPermission, isPlatformUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
