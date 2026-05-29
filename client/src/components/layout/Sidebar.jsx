import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, School, DoorOpen, Calendar, Clock,
  Zap, AlertTriangle, UserMinus, RefreshCw, ChevronLeft, ChevronRight,
  GraduationCap, Settings, FileText, Layers, Shield, Wrench,
  Menu, X, LogOut, ClipboardList, BarChart3, Moon, Sun, Monitor, CheckSquare,
  Brain, PenTool
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useTheme } from '../../context/ThemeContext';

// Roles that can see each item — omit 'roles' = all can see
const PLATFORM_ROLES = ['platform_owner', 'platform_support', 'platform_developer', 'platform_qa', 'deployment_manager'];
const ADMIN_ROLES = [...PLATFORM_ROLES, 'school_owner', 'school_admin', 'principal'];
const MANAGER_ROLES = [...ADMIN_ROLES, 'timetable_manager'];
const STAFF_ROLES = [...MANAGER_ROLES, 'office_staff'];

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/setup', icon: Wrench, label: 'Setup Wizard', roles: ADMIN_ROLES },
  { divider: true, label: 'Scheduling' },
  { path: '/timetable', icon: Calendar, label: 'Timetable Editor' },
  { path: '/generator', icon: Zap, label: 'Generator', roles: MANAGER_ROLES },
  { path: '/manual-timetable', icon: PenTool, label: 'Create Manually', roles: MANAGER_ROLES },
  { path: '/conflicts', icon: AlertTriangle, label: 'Conflict Center', roles: MANAGER_ROLES },
  { divider: true, label: 'Master Data', roles: STAFF_ROLES },
  { path: '/teachers', icon: Users, label: 'Teachers', roles: STAFF_ROLES },
  { path: '/classes', icon: School, label: 'Classes', roles: STAFF_ROLES },
  { path: '/subjects', icon: BookOpen, label: 'Subjects', roles: STAFF_ROLES },
  { path: '/rooms', icon: DoorOpen, label: 'Rooms', roles: STAFF_ROLES },
  { path: '/periods', icon: Clock, label: 'Period Structure', roles: MANAGER_ROLES },
  { divider: true, label: 'Rules & Config', roles: MANAGER_ROLES },
  { path: '/requirements', icon: FileText, label: 'Weekly Periods', roles: MANAGER_ROLES },
  { path: '/combinations', icon: Layers, label: 'Combined Classes', roles: MANAGER_ROLES },
  { path: '/rules', icon: Shield, label: 'Rules & Prefs', roles: MANAGER_ROLES },
  { path: '/can-teach', icon: CheckSquare, label: 'Can Teach', roles: MANAGER_ROLES },
  { divider: true, label: 'Operations' },
  { path: '/absences', icon: UserMinus, label: 'Absences', roles: [...MANAGER_ROLES, 'teacher'] },
  { path: '/substitutions', icon: RefreshCw, label: 'Substitutions', roles: [...MANAGER_ROLES, 'teacher'] },
  { path: '/replacements', icon: Users, label: 'Replacements', roles: MANAGER_ROLES },
  { divider: true, label: 'System', roles: ADMIN_ROLES },
  { path: '/users', icon: Users, label: 'User Management', roles: ADMIN_ROLES },
  { path: '/audit-logs', icon: ClipboardList, label: 'Audit Logs', roles: ADMIN_ROLES },
  { path: '/reports', icon: BarChart3, label: 'Reports', roles: STAFF_ROLES },
  { path: '/analytics', icon: Brain, label: 'Analytics', roles: MANAGER_ROLES },
  { path: '/roles', icon: Shield, label: 'Roles & Permissions', roles: ADMIN_ROLES },
  { path: '/settings', icon: Settings, label: 'Settings', roles: ADMIN_ROLES },
  { divider: true, label: 'Platform', roles: PLATFORM_ROLES },
  { path: '/platform', icon: GraduationCap, label: 'Platform Admin', roles: PLATFORM_ROLES },
];

export default function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen, sidebarWidth } = useSidebar();
  const { user, logout } = useAuth();
  const { theme, changeTheme } = useTheme();
  const location = useLocation();

  // Filter nav items by user role
  const userRole = user?.role || 'viewer';
  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true; // No restriction = visible to all
    return item.roles.includes(userRole);
  });

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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
