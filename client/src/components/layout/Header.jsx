import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, Check, X, Loader2, Users, School, BookOpen, DoorOpen, FileText, Calendar, Shield, Settings, UserMinus, ArrowRight, Command, Clock } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const pageTitles = {
  '/': 'Dashboard', '/setup': 'Setup Wizard', '/timetable': 'Timetable Editor',
  '/generator': 'Timetable Generator', '/conflicts': 'Conflict Center',
  '/teachers': 'Teacher Management', '/classes': 'Class Management',
  '/subjects': 'Subject Management', '/rooms': 'Room Management',
  '/periods': 'Period & Break Structure', '/requirements': 'Weekly Subject Periods',
  '/combinations': 'Combined Classes', '/rules': 'Rules & Preferences',
  '/absences': 'Absence Tracker', '/substitutions': 'Substitution Manager',
  '/staff-availability': 'Staff Availability Center',
  '/replacements': 'Teacher Replacements', '/users': 'User Management',
  '/audit-logs': 'Audit Logs', '/reports': 'Reports',
  '/platform': 'Platform Admin', '/settings': 'Settings',
  '/can-teach': 'Can Teach Manager',
};

const typeIcons = {
  page: FileText, teacher: Users, class: School, subject: BookOpen,
  room: DoorOpen, user: Shield, absence: UserMinus, timetable: Calendar,
  periodStructure: Clock
};

const typeRoutes = {
  teacher: '/teachers', class: '/classes', subject: '/subjects',
  room: '/rooms', user: '/users', absence: '/absences',
  timetable: '/timetable', periodStructure: '/periods'
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionName } = useAuth();
  const title = pageTitles[location.pathname] || 'TimeCraft';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef();

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef();

  // Fetch notifications once on mount + poll every 5 minutes (not on every navigation)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      if (e.key === 'Escape') setShowSearchModal(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (showSearchModal && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (!showSearchModal) {
      setSearchQuery('');
      setSearchResults(null);
      setSelectedIndex(0);
    }
  }, [showSearchModal]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) performSearch();
      else setSearchResults(null);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unread || 0);
    } catch (err) { /* silent */ }
  };

  const markAsRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); fetchNotifications(); } catch (err) { /* silent */ }
  };

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); fetchNotifications(); toast.success('All marked as read'); } catch (err) { toast.error('Failed'); }
  };

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.data);
      setSelectedIndex(0);
    } catch (err) { /* silent */ }
    finally { setIsSearching(false); }
  };

  // Flatten results for keyboard navigation
  const flatResults = searchResults ? Object.entries(searchResults).flatMap(([type, items]) =>
    items.map(item => ({ ...item, category: type }))
  ) : [];

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); }
    else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      handleResultClick(flatResults[selectedIndex]);
    }
  };

  const handleResultClick = (item) => {
    setShowSearchModal(false);
    if (item.type === 'page') navigate(item.path);
    else navigate(typeRoutes[item.type] || '/');
  };

  const severityColors = {
    info: 'bg-blue-500', warning: 'bg-amber-500', error: 'bg-red-500', success: 'bg-emerald-500'
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-50/80 dark:bg-dark-950/80 backdrop-blur-xl border-b border-slate-300/50 dark:border-dark-700/50">
        <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-dark-50 truncate">{title}</h2>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-dark-400 hidden sm:block">Academic Year {sessionName || '—'}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search trigger */}
            <button onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-dark-800 border border-slate-300/50 dark:border-dark-700/50 text-slate-400 dark:text-dark-500 hover:text-slate-700 dark:hover:text-dark-300 hover:border-slate-400 dark:hover:border-dark-600 transition-all text-sm">
              <Search size={15} />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono bg-slate-100 dark:bg-dark-700 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-dark-600">
                <Command size={10} />K
              </kbd>
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-xl bg-white dark:bg-dark-800 border border-slate-300/50 dark:border-dark-700/50 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50 transition-all touch-manipulation">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col z-50">
                  <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-dark-700 bg-slate-50 dark:bg-dark-900">
                    <h3 className="font-semibold text-slate-800 dark:text-dark-100 text-sm">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-primary-500 hover:text-primary-600 font-medium">Mark all read</button>}
                      <button onClick={() => setShowNotifications(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={24} className="text-slate-300 dark:text-dark-600 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">No notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-dark-700/50">
                        {notifications.map(n => (
                          <div key={n._id} className={`p-3 text-sm flex gap-3 hover:bg-slate-50 dark:hover:bg-dark-700/50 transition-colors ${!n.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                            <div className={`w-2 h-2 mt-1.5 shrink-0 rounded-full ${severityColors[n.severity] || 'bg-blue-500'} ${!n.read ? '' : 'opacity-0'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 dark:text-dark-100 text-sm leading-tight">{n.title}</p>
                              <p className="text-slate-500 dark:text-dark-400 text-xs mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                            {!n.read && <button onClick={() => markAsRead(n._id)} className="shrink-0 p-1 text-slate-400 hover:text-primary-500"><Check size={14} /></button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-primary-500/20">
              A
            </div>
          </div>
        </div>
      </header>

      {/* Full-screen Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSearchModal(false); }}>
          <div className="w-full max-w-xl bg-white dark:bg-dark-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-dark-700 overflow-hidden animate-fade-in">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-dark-700">
              <Search size={18} className="text-slate-400 dark:text-dark-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text" placeholder="Search teachers, classes, subjects, pages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-dark-100 text-base placeholder:text-slate-400 dark:placeholder:text-dark-500"
              />
              {isSearching && <Loader2 className="animate-spin text-primary-500" size={16} />}
              <button onClick={() => setShowSearchModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-dark-300">
                <X size={16} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {searchResults ? (
                flatResults.length > 0 ? (
                  <div className="py-2">
                    {Object.entries(searchResults).map(([category, items]) =>
                      items.length > 0 && (
                        <div key={category}>
                          <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-dark-500 uppercase tracking-wider">{category}</div>
                          {items.map((item, idx) => {
                            const globalIdx = flatResults.findIndex(r => r._id === item._id && r.category === category);
                            const Icon = typeIcons[item.type] || FileText;
                            return (
                              <button key={`${item._id}-${idx}`} onClick={() => handleResultClick(item)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${globalIdx === selectedIndex ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-dark-700/50'}`}>
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                                  <Icon size={14} className="text-slate-500 dark:text-dark-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 dark:text-dark-100 truncate">{item.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{item.email || item.code || item.status || item.path || ''}</p>
                                </div>
                                <ArrowRight size={12} className="text-slate-300 dark:text-dark-600 shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Search size={24} className="text-slate-300 dark:text-dark-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No results for "{searchQuery}"</p>
                  </div>
                )
              ) : searchQuery.length < 2 ? (
                <div className="p-6 text-center text-sm text-slate-400 dark:text-dark-500">
                  Type at least 2 characters to search
                </div>
              ) : null}
            </div>

            {/* Footer hints */}
            <div className="px-4 py-2 border-t border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 flex items-center gap-4 text-[10px] text-slate-400 dark:text-dark-500">
              <span><kbd className="px-1 py-0.5 bg-white dark:bg-dark-800 rounded border border-slate-200 dark:border-dark-700 font-mono">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1 py-0.5 bg-white dark:bg-dark-800 rounded border border-slate-200 dark:border-dark-700 font-mono">↵</kbd> Select</span>
              <span><kbd className="px-1 py-0.5 bg-white dark:bg-dark-800 rounded border border-slate-200 dark:border-dark-700 font-mono">esc</kbd> Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
