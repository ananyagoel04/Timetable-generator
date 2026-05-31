import { useEffect, useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, School, DoorOpen, Calendar, Clock,
  Zap, AlertTriangle, UserMinus, RefreshCw, ChevronLeft, ChevronRight,
  GraduationCap, Settings, FileText, Layers, Shield, Wrench,
  Menu, X, LogOut, ClipboardList, BarChart3, Moon, Sun, Monitor, CheckSquare,
  Brain, PenTool, Building2, ChevronDown, CalendarDays
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/axios';

// Roles that can see each item — omit 'roles' = all can see
const PLATFORM_ROLES = ['platform_owner', 'platform_support', 'platform_developer', 'platform_qa', 'deployment_manager'];
const ADMIN_ROLES = [...PLATFORM_ROLES, 'school_owner', 'school_admin', 'principal'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'timetable_manager'];
const STAFF_ROLES = [...MANAGER_ROLES, 'office_staff'];

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/setup', icon: Wrench, label: 'Setup Wizard', roles: ADMIN_ROLES, schoolRequired: true },
  { divider: true, label: 'Scheduling' },
  { path: '/timetable', icon: Calendar, label: 'Timetable Editor', schoolRequired: true },
  { path: '/generator', icon: Zap, label: 'Generator', roles: MANAGER_ROLES, schoolRequired: true },
  { path: '/manual-timetable', icon: PenTool, label: 'Create Manually', roles: MANAGER_ROLES, schoolRequired: true },
  { path: '/conflicts', icon: AlertTriangle, label: 'Conflict Center', roles: MANAGER_ROLES, schoolRequired: true },
  { divider: true, label: 'Master Data', roles: STAFF_ROLES },
  { path: '/teachers', icon: Users, label: 'Teachers', roles: STAFF_ROLES, schoolRequired: true },
  { path: '/classes', icon: School, label: 'Classes', roles: STAFF_ROLES, schoolRequired: true },
  { path: '/subjects', icon: BookOpen, label: 'Subjects', roles: STAFF_ROLES, schoolRequired: true },
  { path: '/rooms', icon: DoorOpen, label: 'Rooms', roles: STAFF_ROLES, schoolRequired: true },
  { path: '/periods', icon: Clock, label: 'Period Structure', roles: MANAGER_ROLES, schoolRequired: true },
  { divider: true, label: 'Rules & Config', roles: MANAGER_ROLES },
  { path: '/requirements', icon: FileText, label: 'Weekly Periods', roles: MANAGER_ROLES, schoolRequired: true },
  { path: '/combinations', icon: Layers, label: 'Combined Classes', roles: MANAGER_ROLES, schoolRequired: true },
  { path: '/rules', icon: Shield, label: 'Rules & Prefs', roles: MANAGER_ROLES, schoolRequired: true },
  { path: '/can-teach', icon: CheckSquare, label: 'Can Teach', roles: MANAGER_ROLES, schoolRequired: true },
  { divider: true, label: 'Operations' },
  { path: '/absences', icon: UserMinus, label: 'Absences', roles: [...MANAGER_ROLES, 'teacher'], schoolRequired: true },
  { path: '/substitutions', icon: RefreshCw, label: 'Substitutions', roles: [...MANAGER_ROLES, 'teacher'], schoolRequired: true },
  { path: '/replacements', icon: Users, label: 'Replacements', roles: MANAGER_ROLES, schoolRequired: true },
  { divider: true, label: 'System', roles: ADMIN_ROLES },
  { path: '/users', icon: Users, label: 'User Management', roles: ADMIN_ROLES, schoolRequired: true },
  { path: '/sessions', icon: CalendarDays, label: 'Sessions', roles: ADMIN_ROLES, schoolRequired: true },
  { path: '/audit-logs', icon: ClipboardList, label: 'Audit Logs', roles: ADMIN_ROLES, schoolRequired: true },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: STAFF_ROLES, schoolRequired: true },
  { path: '/analytics', icon: Brain, label: 'Analytics', roles: MANAGER_ROLES, schoolRequired: true },
  { path: '/roles', icon: Shield, label: 'Roles & Permissions', roles: ADMIN_ROLES, schoolRequired: true },
  { path: '/settings', icon: Settings, label: 'Settings', roles: ADMIN_ROLES, schoolRequired: true },
  { divider: true, label: 'Platform', roles: PLATFORM_ROLES },
  { path: '/platform', icon: GraduationCap, label: 'Platform Admin', roles: PLATFORM_ROLES },
];

export default function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen, sidebarWidth } = useSidebar();
  const { user, logout, isPlatformUser, selectedSchool, selectedSchoolName, switchSchool, sessionName, switchSession, selectedSession, clearSchoolContext } = useAuth();
  const { theme, changeTheme } = useTheme();
  const location = useLocation();

  // Platform school list
  const [platformSchools, setPlatformSchools] = useState([]);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [sessions, setSessions] = useState([]);

  const isPlatform = isPlatformUser();

  // Load platform schools
  useEffect(() => {
    if (!isPlatform) return;
    api.get('/platform/schools').then(r => {
      setPlatformSchools(r.data || []);
    }).catch(() => {});
  }, [isPlatform]);

  // Load sessions for selected school
  useEffect(() => {
    if (!selectedSchool) { setSessions([]); return; }
    api.get('/setup/sessions').then(r => {
      const data = r.data || [];
      setSessions(Array.isArray(data) ? data : []);
    }).catch(() => setSessions([]));
  }, [selectedSchool]);

  // Filter nav items by user role
  const userRole = user?.role || 'viewer';
  const filteredNavItems = useMemo(() => navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  }), [userRole]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Handle school selection for platform users
  const handleSchoolSelect = (school) => {
    const firstSession = sessions.find(s => s.isCurrent) || sessions[0];
    switchSchool(school._id, firstSession?._id, school.name);
    setSchoolDropdownOpen(false);
    // Reload sessions for new school
    api.get('/setup/sessions').then(r => {
      const data = r.data || [];
      setSessions(Array.isArray(data) ? data : []);
      // Auto-select current session
      const current = data.find(s => s.isCurrent);
      if (current) switchSession(current._id, current.name);
    }).catch(() => {});
  };

  const handleSessionSelect = (session) => {
    switchSession(session._id, session.name);
    setSessionDropdownOpen(false);
  };

  const handleClearSchool = () => {
    clearSchoolContext();
    setSchoolDropdownOpen(false);
    setSessions([]);
  };

  // School/Session Context Section
  const SchoolContextSection = ({ isMobile = false }) => {
    if (collapsed && !isMobile) return null;

    return (
      <div className="px-3 py-2 space-y-2 border-b border-slate-300/50 dark:border-dark-700/50">
        {/* School Selector — platform users ONLY */}
        {isPlatform && (
          <div className="relative">
            <button onClick={() => setSchoolDropdownOpen(!schoolDropdownOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 dark:bg-dark-800/60 border border-slate-200/50 dark:border-dark-700/50 hover:border-primary-500/40 transition-all text-left">
              <Building2 size={15} className="text-primary-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-slate-400 dark:text-dark-500 uppercase tracking-wider font-semibold">School</p>
                <p className="text-xs font-medium text-slate-800 dark:text-dark-100 truncate">
                  {selectedSchoolName || (selectedSchool ? 'Loading...' : 'Select a school')}
                </p>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${schoolDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {schoolDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 shadow-xl z-50 max-h-64 overflow-y-auto">
                {selectedSchool && (
                  <button onClick={handleClearSchool}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-b border-slate-200/50 dark:border-dark-700/50 font-medium">
                    ✕ Clear Selection
                  </button>
                )}
                {platformSchools.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400 text-center">No schools found</p>
                ) : platformSchools.map(s => (
                  <button key={s._id} onClick={() => handleSchoolSelect(s)}
                    className={`w-full text-left px-3 py-2.5 text-xs hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center gap-2 ${
                      selectedSchool === s._id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-semibold' : 'text-slate-700 dark:text-dark-200'
                    }`}>
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary-500">{s.name?.charAt(0)}</span>
                    </div>
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* School name (read-only) — school users only */}
        {!isPlatform && selectedSchoolName && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Building2 size={14} className="text-primary-400 shrink-0" />
            <p className="text-xs font-medium text-slate-700 dark:text-dark-200 truncate">{selectedSchoolName}</p>
          </div>
        )}

        {/* Session Selector — all users when school is selected */}
        {selectedSchool && (
          <div className="relative">
            <button onClick={() => setSessionDropdownOpen(!sessionDropdownOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 dark:bg-dark-800/60 border border-slate-200/50 dark:border-dark-700/50 hover:border-emerald-500/40 transition-all text-left">
              <CalendarDays size={15} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-slate-400 dark:text-dark-500 uppercase tracking-wider font-semibold">Session</p>
                <p className="text-xs font-medium text-slate-800 dark:text-dark-100 truncate">
                  {sessionName || 'Select session'}
                </p>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${sessionDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {sessionDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 shadow-xl z-50 max-h-48 overflow-y-auto">
                {sessions.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400 text-center">No sessions found</p>
                ) : sessions.map(s => (
                  <button key={s._id} onClick={() => handleSessionSelect(s)}
                    className={`w-full text-left px-3 py-2.5 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-2 ${
                      selectedSession === s._id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-dark-200'
                    }`}>
                    <CalendarDays size={12} className={s.isCurrent ? 'text-emerald-400' : 'text-slate-400'} />
                    <span className="truncate">{s.name}</span>
                    {s.isCurrent && <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-medium">Current</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* "Select a school" prompt for platform users with no school */}
        {isPlatform && !selectedSchool && (
          <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] text-amber-400 font-medium">⚠ Select a school to access school data</p>
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (isMobile = false) => (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-300/50 dark:border-dark-700/50">
        <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/30">
          <GraduationCap size={20} className="text-slate-900 dark:text-dark-50" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-dark-50 tracking-tight leading-none">TimeCraft</h1>
            <p className="text-[9px] text-slate-500 dark:text-dark-400 uppercase tracking-widest">School ERP</p>
          </div>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 dark:text-dark-400">
            <X size={18} />
          </button>
        )}
      </div>

      {/* School & Session Context */}
      <SchoolContextSection isMobile={isMobile} />

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
        {filteredNavItems.map((item, i) => {
          if (item.divider) {
            return <div key={i} className="pt-3 pb-1">
              {(!collapsed || isMobile) && <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-dark-500 uppercase tracking-wider">{item.label}</p>}
              {(collapsed && !isMobile) && <div className="border-t border-slate-300/40 dark:border-dark-700/40 mx-2" />}
            </div>;
          }
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          // Disable school-required items when platform user has no school selected
          const isDisabled = isPlatform && item.schoolRequired && !selectedSchool;

          if (isDisabled) {
            return (
              <div key={item.path} title={collapsed && !isMobile ? `${item.label} (select school first)` : undefined}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-300 dark:text-dark-600 cursor-not-allowed opacity-50">
                <Icon size={17} className="shrink-0 text-slate-300 dark:text-dark-600" />
                {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
              </div>
            );
          }

          return (
            <NavLink key={item.path} to={item.path} title={collapsed && !isMobile ? item.label : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group
                ${isActive
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50 hover:bg-slate-100/60 dark:hover:bg-dark-800/60'
                }`}>
              <Icon size={17} className={`shrink-0 ${isActive ? 'text-primary-400' : 'text-slate-400 dark:text-dark-500 group-hover:text-slate-600 dark:group-hover:text-dark-300'}`} />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User & Theme section */}
      {user && (!collapsed || isMobile) && (
        <div className="border-t border-slate-300/50 dark:border-dark-700/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 dark:text-dark-50 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-dark-500 truncate">{user.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          
          <div className="flex items-center bg-white dark:bg-dark-800 rounded-lg p-1 mb-2">
            <button onClick={() => changeTheme('light')} className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors ${theme === 'light' ? 'bg-slate-200 dark:bg-dark-700 text-slate-900 dark:text-dark-50 shadow' : 'text-slate-400 dark:text-dark-500 hover:text-slate-600 dark:hover:text-dark-300'}`} title="Light Mode"><Sun size={14} /></button>
            <button onClick={() => changeTheme('system')} className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors ${theme === 'system' ? 'bg-slate-200 dark:bg-dark-700 text-slate-900 dark:text-dark-50 shadow' : 'text-slate-400 dark:text-dark-500 hover:text-slate-600 dark:hover:text-dark-300'}`} title="System Theme"><Monitor size={14} /></button>
            <button onClick={() => changeTheme('dark')} className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors ${theme === 'dark' ? 'bg-slate-200 dark:bg-dark-700 text-slate-900 dark:text-dark-50 shadow' : 'text-slate-400 dark:text-dark-500 hover:text-slate-600 dark:hover:text-dark-300'}`} title="Dark Mode"><Moon size={14} /></button>
          </div>

          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-500 dark:text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors -mb-3">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      )}

      {/* Collapsed user avatar */}
      {user && collapsed && !isMobile && (
        <div className="border-t border-slate-300/50 dark:border-dark-700/50 p-2 flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold" title={user.name}>
            {user.name?.charAt(0) || 'A'}
          </div>
          
          <button onClick={() => changeTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')} className="p-1.5 rounded-lg text-slate-400 dark:text-dark-500 hover:text-slate-900 dark:hover:text-dark-50 transition-colors" title="Toggle Theme">
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
          </button>
          
          <button onClick={logout} className="p-1.5 rounded-lg text-slate-400 dark:text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-colors -mb-3" title="Sign Out">
            <LogOut size={14} />
          </button>
        </div>
      )}

      {!isMobile && (
        <button onClick={() => setCollapsed(c => !c)}
          className="m-2 p-2 rounded-lg bg-white dark:bg-dark-800 border border-slate-300/50 dark:border-dark-700/50 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50 hover:bg-slate-200 dark:hover:bg-dark-700 transition-all flex items-center justify-center">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl bg-white dark:bg-dark-800 border border-slate-300/50 dark:border-dark-700/50 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50 shadow-xl">
        <Menu size={20} />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-slate-100 dark:bg-dark-900 flex flex-col animate-slide-in-left"
            onClick={e => e.stopPropagation()}>
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen z-40 hidden md:flex flex-col bg-slate-100/95 dark:bg-dark-900/95 backdrop-blur-xl border-r border-slate-300/50 dark:border-dark-700/50 transition-all duration-300"
        style={{ width: `${sidebarWidth}px` }}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}
