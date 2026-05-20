import { useState, useEffect } from 'react';
import { Search, Filter, Clock, User, FileText } from 'lucide-react';
import api from '../api/axios';

const actionColors = {
  login: 'text-blue-400', logout: 'text-dark-400', failed_login: 'text-red-400',
  create: 'text-emerald-400', update: 'text-amber-400', delete: 'text-red-400',
  generate: 'text-purple-400', publish: 'text-emerald-400', manual_edit: 'text-amber-400',
  lock: 'text-orange-400', unlock: 'text-blue-400', teacher_replacement: 'text-pink-400',
  absence_create: 'text-red-400', substitution_approve: 'text-emerald-400',
  school_switch: 'text-cyan-400', rule_change: 'text-violet-400',
};

const actionIcons = {
  login: '🔑', logout: '🚪', create: '➕', update: '✏️', delete: '🗑️',
  generate: '⚡', publish: '📤', manual_edit: '🔧', lock: '🔒', unlock: '🔓',
  teacher_replacement: '🔄', absence_create: '📋', school_switch: '🏫',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchLogs(); }, [page, filters]);

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 25 });
    if (filters.action) params.set('action', filters.action);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    api.get(`/audit-logs?${params}`).then(r => {
      setLogs(r.data || []);
      setTotal(r.total || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const allActions = ['login','logout','create','update','delete','generate','publish','manual_edit','lock','unlock','teacher_replacement','absence_create','substitution_approve','school_switch','rule_change'];
  const allEntities = ['user','school','class','subject','teacher','room','timetable','lesson_block','absence','substitution','replacement','requirement','combination_rule'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">{total} total entries</p></div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-2"><Filter size={16} /> Filters</button>
      </div>

      {showFilters && (
        <div className="glass-card p-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
          <div><label className="text-xs text-dark-400 mb-1 block">Action</label>
            <select value={filters.action} onChange={e => { setFilters(f => ({...f, action: e.target.value})); setPage(1); }} className="select-field text-xs">
              <option value="">All</option>{allActions.map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-dark-400 mb-1 block">Entity</label>
            <select value={filters.entityType} onChange={e => { setFilters(f => ({...f, entityType: e.target.value})); setPage(1); }} className="select-field text-xs">
              <option value="">All</option>{allEntities.map(e => <option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-dark-400 mb-1 block">From</label>
            <input value={filters.from} onChange={e => { setFilters(f => ({...f, from: e.target.value})); setPage(1); }} type="date" className="input-field text-xs" />
          </div>
          <div><label className="text-xs text-dark-400 mb-1 block">To</label>
            <input value={filters.to} onChange={e => { setFilters(f => ({...f, to: e.target.value})); setPage(1); }} type="date" className="input-field text-xs" />
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {loading ? <p className="text-center py-12 text-dark-400">Loading...</p> : logs.length === 0 ? <p className="text-center py-12 text-dark-400">No audit logs yet</p> : (
          <div className="divide-y divide-dark-700/30">
            {logs.map((log, i) => (
              <div key={log._id || i} className="px-5 py-3 hover:bg-dark-800/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{actionIcons[log.action] || '📝'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${actionColors[log.action] || 'text-white'}`}>{log.action?.replace(/_/g, ' ')}</span>
                        {log.entityType && <span className="badge bg-dark-700 text-dark-300 border border-dark-600 text-[9px]">{log.entityType.replace(/_/g, ' ')}</span>}
                        {log.source && log.source !== 'manual' && <span className="text-[9px] text-dark-500 px-1.5 py-0.5 bg-dark-800 rounded">{log.source}</span>}
                      </div>
                      {log.entityName && <p className="text-xs text-dark-300 mt-0.5">{log.entityName}</p>}
                      {log.reason && <p className="text-xs text-dark-500 mt-0.5 italic">"{log.reason}"</p>}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-dark-500">
                        {log.userName && <span className="flex items-center gap-1"><User size={10} />{log.userName}</span>}
                        {log.userRole && <span>({log.userRole})</span>}
                        {(log.affectedTeacher || log.affectedClass) && <span>· {log.affectedTeacher?.name || ''} {log.affectedClass?.name || ''}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-dark-500 flex items-center gap-1"><Clock size={10} />{new Date(log.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {total > 25 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary text-xs px-3 py-1.5">← Prev</button>
          <span className="text-xs text-dark-400 py-1.5">Page {page} of {Math.ceil(total/25)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/25)} className="btn-secondary text-xs px-3 py-1.5">Next →</button>
        </div>
      )}
    </div>
  );
}
