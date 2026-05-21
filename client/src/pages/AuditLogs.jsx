import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Clock, User, FileText, Loader2, ChevronDown, ChevronRight, Download, RefreshCw, X } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const actionColors = {
  login: 'text-blue-600 dark:text-blue-400', logout: 'text-slate-500 dark:text-dark-400', failed_login: 'text-red-600 dark:text-red-400',
  create: 'text-emerald-600 dark:text-emerald-400', update: 'text-amber-600 dark:text-amber-400', delete: 'text-red-600 dark:text-red-400',
  generate: 'text-purple-600 dark:text-purple-400', publish: 'text-emerald-600 dark:text-emerald-400', manual_edit: 'text-amber-600 dark:text-amber-400',
  lock: 'text-orange-600 dark:text-orange-400', unlock: 'text-blue-600 dark:text-blue-400', teacher_replacement: 'text-pink-600 dark:text-pink-400',
  absence_create: 'text-red-600 dark:text-red-400', substitution_approve: 'text-emerald-600 dark:text-emerald-400',
  school_switch: 'text-cyan-600 dark:text-cyan-400', rule_change: 'text-violet-600 dark:text-violet-400',
  user_create: 'text-blue-600 dark:text-blue-400'
};

const actionIcons = {
  login: '🔑', logout: '🚪', create: '➕', update: '✏️', delete: '🗑️',
  generate: '⚡', publish: '📤', manual_edit: '🔧', lock: '🔒', unlock: '🔓',
  teacher_replacement: '🔄', absence_create: '📋', school_switch: '🏫', user_create: '👤',
  failed_login: '🚫', substitution_approve: '✅', rule_change: '📝'
};

const actionBgColors = {
  login: 'bg-blue-50 dark:bg-blue-900/10', create: 'bg-emerald-50 dark:bg-emerald-900/10',
  update: 'bg-amber-50 dark:bg-amber-900/10', delete: 'bg-red-50 dark:bg-red-900/10',
  generate: 'bg-purple-50 dark:bg-purple-900/10', failed_login: 'bg-red-50 dark:bg-red-900/10',
};

export default function AuditLogs() {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', entityType: '', module: '', source: '', from: '', to: '', userId: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);
  const [users, setUsers] = useState([]);

  const perPage = 25;

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchLogs(); }, [page, filters]);

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: perPage });
    if (filters.action) params.set('action', filters.action);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.module) params.set('module', filters.module);
    if (filters.source) params.set('source', filters.source);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.userId) params.set('userId', filters.userId);
    api.get(`/audit-logs?${params}`).then(r => {
      const data = r.data?.data || r.data || [];
      setLogs(Array.isArray(data) ? data : []);
      setTotal(r.data?.total || data.length || 0);
      setLoading(false);
    }).catch(() => { setLogs([]); setLoading(false); });
  };

  const clearFilters = () => {
    setFilters({ action: '', entityType: '', module: '', source: '', from: '', to: '', userId: '' });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  const exportCSV = () => {
    const csv = ['Timestamp,Action,Entity,User,Module,Source,Details']
      .concat(logs.map(l => [
        new Date(l.createdAt).toLocaleString(),
        l.action, l.entityType, l.userName, l.module, l.source,
        l.entityName || ''
      ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit_logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const allActions = ['login','logout','failed_login','create','update','delete','generate','publish','manual_edit','lock','unlock','teacher_replacement','absence_create','substitution_approve','school_switch','rule_change','user_create'];
  const allEntities = ['user','school','class','subject','teacher','room','timetable','lesson_block','absence','substitution','replacement','requirement','combination_rule'];
  const allModules = ['Authentication', 'Scheduling', 'Master Data', 'Operations', 'System'];
  const allSources = ['manual', 'system', 'mobile_app', 'api'];

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">{total} total entries · Full system activity trail</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm"><Download size={14} /> Export</button>
          <button onClick={fetchLogs} className="btn-secondary p-2.5"><RefreshCw size={16} /></button>
          <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary flex items-center gap-2 text-sm ${hasActiveFilters ? 'ring-2 ring-primary-500/50' : ''}`}>
            <Filter size={14} /> Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-500" />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="glass-card p-4 animate-slide-up">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Module</label>
              <select value={filters.module} onChange={e => { setFilters(f => ({...f, module: e.target.value})); setPage(1); }} className="select-field text-xs">
                <option value="">All</option>{allModules.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Action</label>
              <select value={filters.action} onChange={e => { setFilters(f => ({...f, action: e.target.value})); setPage(1); }} className="select-field text-xs">
                <option value="">All</option>{allActions.map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Entity</label>
              <select value={filters.entityType} onChange={e => { setFilters(f => ({...f, entityType: e.target.value})); setPage(1); }} className="select-field text-xs">
                <option value="">All</option>{allEntities.map(e => <option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">User</label>
              <select value={filters.userId} onChange={e => { setFilters(f => ({...f, userId: e.target.value})); setPage(1); }} className="select-field text-xs">
                <option value="">All Users</option>{users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Source</label>
              <select value={filters.source} onChange={e => { setFilters(f => ({...f, source: e.target.value})); setPage(1); }} className="select-field text-xs">
                <option value="">All</option>{allSources.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">From</label>
              <input value={filters.from} onChange={e => { setFilters(f => ({...f, from: e.target.value})); setPage(1); }} type="date" className="input-field text-xs" />
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">To</label>
              <input value={filters.to} onChange={e => { setFilters(f => ({...f, to: e.target.value})); setPage(1); }} type="date" className="input-field text-xs" />
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-3 text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1">
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Log entries */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="animate-spin text-primary-500 mx-auto" size={24} /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-dark-500">No audit logs found</div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-dark-700/50">
            {logs.map((log, i) => {
              const isExpanded = expandedLog === (log._id || i);
              const bgColor = actionBgColors[log.action] || '';
              return (
                <div key={log._id || i}>
                  <div className={`px-4 sm:px-5 py-3 hover:bg-slate-50 dark:hover:bg-dark-800/30 transition-colors cursor-pointer ${bgColor}`}
                    onClick={() => setExpandedLog(isExpanded ? null : (log._id || i))}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-lg mt-0.5 shrink-0">{actionIcons[log.action] || '📝'}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${actionColors[log.action] || 'text-slate-800 dark:text-dark-100'}`}>
                              {log.action?.replace(/_/g, ' ')}
                            </span>
                            {log.entityType && (
                              <span className="badge bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-dark-300 border border-slate-300 dark:border-dark-600 text-[9px]">
                                {log.entityType.replace(/_/g, ' ')}
                              </span>
                            )}
                            {log.source && log.source !== 'manual' && (
                              <span className="text-[9px] text-slate-400 dark:text-dark-500 px-1.5 py-0.5 bg-white dark:bg-dark-800 rounded border border-slate-200 dark:border-dark-700">
                                {log.source}
                              </span>
                            )}
                          </div>
                          {log.entityName && <p className="text-xs text-slate-600 dark:text-dark-300 mt-0.5 truncate">{log.entityName}</p>}
                          {log.reason && <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5 italic truncate">"{log.reason}"</p>}
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-dark-400">
                            {log.userName && <span className="flex items-center gap-1"><User size={10} />{log.userName}</span>}
                            {log.userRole && <span className="text-slate-400 dark:text-dark-500">({log.userRole.replace(/_/g, ' ')})</span>}
                            {(log.affectedTeacher || log.affectedClass) && <span>· {log.affectedTeacher?.name || ''} {log.affectedClass?.name || ''}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-[10px] text-slate-400 dark:text-dark-500 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(log.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-300 dark:text-dark-600" />}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 py-3 bg-slate-50 dark:bg-dark-800/50 border-t border-slate-200 dark:border-dark-700/50 animate-slide-up">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {log.oldValue && (
                          <div>
                            <p className="font-semibold text-slate-500 dark:text-dark-400 mb-1">Previous Value</p>
                            <pre className="bg-white dark:bg-dark-900 p-2 rounded-lg border border-slate-200 dark:border-dark-700 overflow-auto max-h-32 text-[10px] text-slate-600 dark:text-dark-300">
                              {JSON.stringify(log.oldValue, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newValue && (
                          <div>
                            <p className="font-semibold text-slate-500 dark:text-dark-400 mb-1">New Value</p>
                            <pre className="bg-white dark:bg-dark-900 p-2 rounded-lg border border-slate-200 dark:border-dark-700 overflow-auto max-h-32 text-[10px] text-slate-600 dark:text-dark-300">
                              {JSON.stringify(log.newValue, null, 2)}
                            </pre>
                          </div>
                        )}
                        {!log.oldValue && !log.newValue && (
                          <p className="text-slate-400 dark:text-dark-500 col-span-2">No detailed change data available</p>
                        )}
                      </div>
                      <div className="flex gap-4 mt-2 text-[10px] text-slate-400 dark:text-dark-500">
                        <span>ID: {log._id}</span>
                        {log.ip && <span>IP: {log.ip}</span>}
                        {log.module && <span>Module: {log.module}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button onClick={() => setPage(1)} disabled={page === 1} className="btn-secondary text-xs px-2.5 py-1.5">First</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs px-3 py-1.5">← Prev</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const num = start + i;
            if (num > totalPages) return null;
            return (
              <button key={num} onClick={() => setPage(num)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${num === page ? 'bg-primary-500 text-white' : 'btn-secondary'}`}>
                {num}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-xs px-3 py-1.5">Next →</button>
          <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="btn-secondary text-xs px-2.5 py-1.5">Last</button>
        </div>
      )}
    </div>
  );
}
