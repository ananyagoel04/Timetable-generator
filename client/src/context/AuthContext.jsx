import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setLogoutCallback } from '../api/axios';

const AuthContext = createContext(null);

/**
 * Auth State Machine
 * 
 * States flow:
 *   1. Initial: authLoading=true, authReady=false
 *   2. No token: authReady=true, isAuthenticated=false
 *   3. Token found → /auth/me call
 *   4. /auth/me success: authReady=true, permissionsReady=true, user set
 *   5. /auth/me failure: authReady=true, token cleared
 *   6. School/session restored from localStorage: schoolContextReady=true
 */
export function AuthProvider({ children }) {
  // ── Core auth state ──
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ── School/session context ──
  const [selectedSchool, setSelectedSchoolState] = useState(() => localStorage.getItem('tc_school') || null);
  const [selectedSession, setSelectedSessionState] = useState(() => localStorage.getItem('tc_session') || null);
  const [schoolContextReady, setSchoolContextReady] = useState(false);

  // ── Guards ──
  const hydrationDone = useRef(false);
  const navigate = useRef(null);

  // Keep navigate ref in sync via a child component (see below)
  const setNavigateRef = useCallback((nav) => {
    navigate.current = nav;
  }, []);

  // ── Setters that also persist to localStorage ──
  const setSelectedSchool = useCallback((schoolId) => {
    if (schoolId) {
      localStorage.setItem('tc_school', schoolId);
    } else {
      localStorage.removeItem('tc_school');
    }
    setSelectedSchoolState(schoolId);
  }, []);

  const setSelectedSession = useCallback((sessionId) => {
    if (sessionId) {
      localStorage.setItem('tc_session', sessionId);
    } else {
      localStorage.removeItem('tc_session');
    }
    setSelectedSessionState(sessionId);
  }, []);

  // ── Hydration: runs ONCE on mount ──
  useEffect(() => {
    if (hydrationDone.current) return;
    hydrationDone.current = true;

    if (import.meta.env.DEV) console.debug('[Auth] hydrate:start');

    const token = localStorage.getItem('tc_token');
    const storedSchool = localStorage.getItem('tc_school');
    const storedSession = localStorage.getItem('tc_session');

    if (!token) {
      if (import.meta.env.DEV) console.debug('[Auth] hydrate:no-token');
      setAuthLoading(false);
      setAuthReady(true);
      setPermissionsReady(true);
      setSchoolContextReady(true);
      return;
    }

    if (import.meta.env.DEV) console.debug('[Auth] /auth/me:start');

    api.get('/auth/me').then(r => {
      const userData = r.data || r;
      if (import.meta.env.DEV) console.debug('[Auth] /auth/me:success', userData?.email);

      setUser(userData);
      setIsAuthenticated(true);

      // Restore school/session from localStorage if valid
      if (storedSchool) {
        setSelectedSchoolState(storedSchool);
      }
      if (storedSession) {
        setSelectedSessionState(storedSession);
      }

      // All states ready atomically
      setPermissionsReady(true);
      setSchoolContextReady(true);
      setAuthReady(true);
      setAuthLoading(false);

      if (import.meta.env.DEV) {
        console.debug('[Auth] permissions:ready');
        console.debug('[Auth] schoolContext:ready', { school: storedSchool, session: storedSession });
      }
    }).catch((err) => {
      if (import.meta.env.DEV) console.debug('[Auth] /auth/me:failed', err.message);
      localStorage.removeItem('tc_token');
      setPermissionsReady(true);
      setSchoolContextReady(true);
      setAuthReady(true);
      setAuthLoading(false);
    });
  }, []);

  // ── Login ──
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const data = res.data || res;
    localStorage.setItem('tc_token', data.token);

    const userData = data.user;
    setUser(userData);
    setIsAuthenticated(true);
    setPermissionsReady(true);
    setAuthReady(true);

    // If user has an activeSchool, restore it
    if (userData.activeSchool) {
      const schoolId = typeof userData.activeSchool === 'object' ? userData.activeSchool._id : userData.activeSchool;
      setSelectedSchool(schoolId);
    }
    if (userData.activeSession) {
      const sessionId = typeof userData.activeSession === 'object' ? userData.activeSession._id : userData.activeSession;
      setSelectedSession(sessionId);
    }

    setSchoolContextReady(true);
    return userData;
  };

  // ── Register ──
  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    const data = res.data || res;
    localStorage.setItem('tc_token', data.token);

    const userData = data.user;
    setUser(userData);
    setIsAuthenticated(true);
    setPermissionsReady(true);
    setAuthReady(true);

    if (userData.activeSchool) {
      const schoolId = typeof userData.activeSchool === 'object' ? userData.activeSchool._id : userData.activeSchool;
      setSelectedSchool(schoolId);
    }
    if (userData.activeSession) {
      const sessionId = typeof userData.activeSession === 'object' ? userData.activeSession._id : userData.activeSession;
      setSelectedSession(sessionId);
    }

    setSchoolContextReady(true);
    return userData;
  };

  // ── Logout ──
  const logout = useCallback(() => {
    if (import.meta.env.DEV) console.debug('[Auth] logout');
    localStorage.removeItem('tc_token');
    localStorage.removeItem('tc_school');
    localStorage.removeItem('tc_session');
    setUser(null);
    setIsAuthenticated(false);
    setSelectedSchoolState(null);
    setSelectedSessionState(null);
    setPermissionsReady(true);
    setSchoolContextReady(false);
    hydrationDone.current = false;
    // Navigate to login via React router (no full page reload)
    if (navigate.current) {
      navigate.current('/login', { replace: true });
    }
  }, []);

  // Register logout callback for axios 401 handler
  useEffect(() => {
    setLogoutCallback(logout);
    return () => setLogoutCallback(null);
  }, [logout]);

  // ── Switch School ──
  const switchSchool = async (schoolId, sessionId) => {
    await api.put('/auth/switch-school', { schoolId, sessionId });
    setSelectedSchool(schoolId);
    if (sessionId) setSelectedSession(sessionId);
    setUser(u => ({
      ...u,
      activeSchool: schoolId,
      activeSession: sessionId || u?.activeSession
    }));
    if (import.meta.env.DEV) console.debug('[Auth] schoolContext:switched', { schoolId, sessionId });
  };

  // ── Permission helpers ──
  const isPlatformUser = useCallback(() => {
    if (!user) return false;
    return ['platform_owner', 'platform_support', 'platform_developer', 'platform_qa', 'deployment_manager'].includes(user.role);
  }, [user]);

  const hasPermission = useCallback((perm) => {
    if (!user) return false;
    if (isPlatformUser()) return true;
    // Find school membership matching selectedSchool (from context, not just user.activeSchool)
    const activeSchoolId = selectedSchool || user.activeSchool?.toString();
    const membership = user.schools?.find(s =>
      ((s.school?._id || s.school)?.toString()) === activeSchoolId?.toString()
    );
    if (membership?.role === 'school_owner') return true;
    return membership?.permissions?.includes(perm) || false;
  }, [user, isPlatformUser, selectedSchool]);

  const hasAnyPermission = useCallback((perms) => {
    if (!perms || perms.length === 0) return true;
    return perms.some(p => hasPermission(p));
  }, [hasPermission]);

  return (
    <AuthContext.Provider value={{
      // State
      user,
      authLoading,
      authReady,
      isAuthenticated,
      permissionsReady,
      selectedSchool,
      selectedSession,
      schoolContextReady,
      // Legacy compat
      loading: authLoading,
      // Actions
      login,
      register,
      logout,
      switchSchool,
      setSelectedSchool,
      setSelectedSession,
      setNavigateRef,
      // Permission helpers
      hasPermission,
      hasAnyPermission,
      isPlatformUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook that syncs useNavigate() into the AuthContext ref
 * Must be rendered inside BrowserRouter AND AuthProvider
 */
export function AuthNavigateSync() {
  const nav = useNavigate();
  const { setNavigateRef } = useAuth();
  useEffect(() => {
    setNavigateRef(nav);
  }, [nav, setNavigateRef]);
  return null;
}

export const useAuth = () => useContext(AuthContext);
