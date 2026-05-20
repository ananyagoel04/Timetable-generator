import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, School, DoorOpen, Calendar,
  Zap, AlertTriangle, UserMinus, RefreshCw, ChevronLeft, ChevronRight,
  GraduationCap, Settings, FileText, Layers, Shield, Wrench,
  Menu, X, LogOut, ClipboardList, BarChart3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/setup', icon: Wrench, label: 'Setup Wizard' },
  { divider: true, label: 'Scheduling' },
  { path: '/timetable', icon: Calendar, label: 'Timetable Editor' },
  { path: '/generator', icon: Zap, label: 'Generator' },
  { path: '/conflicts', icon: AlertTriangle, label: 'Conflict Center' },
  { divider: true, label: 'Master Data' },
  { path: '/teachers', icon: Users, label: 'Teachers' },
  { path: '/classes', icon: School, label: 'Classes' },
  { path: '/subjects', icon: BookOpen, label: 'Subjects' },
  { path: '/rooms', icon: DoorOpen, label: 'Rooms' },
  { divider: true, label: 'Rules & Config' },
  { path: '/requirements', icon: FileText, label: 'Weekly Periods' },
  { path: '/combinations', icon: Layers, label: 'Combined Classes' },
  { path: '/rules', icon: Shield, label: 'Rules & Prefs' },
  { divider: true, label: 'Operations' },
  { path: '/absences', icon: UserMinus, label: 'Absences' },
  { path: '/substitutions', icon: RefreshCw, label: 'Substitutions' },
  { path: '/replacements', icon: Users, label: 'Replacements' },
  { divider: true, label: 'System' },
  { path: '/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close mobile drawer on resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const sidebarContent = (isMobile = false) => (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-dark-700/50">
        <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/30">
          <GraduationCap size={20} className="text-white" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white tracking-tight leading-none">TimeCraft</h1>
            <p className="text-[9px] text-dark-400 uppercase tracking-widest">School ERP</p>
          </div>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item, i) => {
          if (item.divider) {
            return <div key={i} className="pt-3 pb-1">
              {(!collapsed || isMobile) && <p className="px-3 text-[10px] font-semibold text-dark-500 uppercase tracking-wider">{item.label}</p>}
              {(collapsed && !isMobile) && <div className="border-t border-dark-700/40 mx-2" />}
            </div>;
          }
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.path} to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group
                ${isActive
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800/60'
                }`}>
              <Icon size={17} className={`shrink-0 ${isActive ? 'text-primary-400' : 'text-dark-500 group-hover:text-dark-300'}`} />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      {user && (!collapsed || isMobile) && (
        <div className="border-t border-dark-700/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-dark-500 truncate">{user.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      )}

      {!isMobile && (
        <button onClick={() => setCollapsed(c => !c)}
          className="m-2 p-2 rounded-lg bg-dark-800 border border-dark-700/50 text-dark-400 hover:text-white hover:bg-dark-700 transition-all flex items-center justify-center">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl bg-dark-800 border border-dark-700/50 text-dark-400 hover:text-white shadow-xl">
        <Menu size={20} />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-dark-900 flex flex-col animate-slide-in-left"
            onClick={e => e.stopPropagation()}>
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`fixed left-0 top-0 h-screen z-40 hidden md:flex flex-col transition-all duration-300
        ${collapsed ? 'w-[68px]' : 'w-[250px]'} bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50`}>
        {sidebarContent(false)}
      </aside>
    </>
  );
}
