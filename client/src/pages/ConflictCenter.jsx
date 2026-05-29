import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, CheckCircle, Users, DoorOpen, Clock, AlertTriangle, BookOpen,
  XCircle, Filter, Zap, ChevronDown, ChevronUp, Check, X, Wrench,
  RotateCcw, Layers, ArrowRight, Eye, EyeOff, LayoutGrid, List, Loader2
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import PermissionGate from '../components/ui/PermissionGate';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';

const TYPE_CONFIG = {
  teacher_clash: { icon: Users, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Teacher Double-Booked' },
  room_clash: { icon: DoorOpen, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Room Double-Booked' },
  class_clash: { icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Class Clash' },
  teacher_overload: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Teacher Overload' },
  missing_teacher: { icon: XCircle, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Missing Teacher' },
  subject_shortage: { icon: AlertTriangle, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', label: 'Subject Shortage' },
  room_capacity: { icon: DoorOpen, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', label: 'Room Capacity' },
  rule_violation: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'Rule Violation' },
  capability_mismatch: { icon: XCircle, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', label: 'Capability Mismatch' },
  unavailable_slot: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: 'Unavailable Slot' },
  unassigned_lesson: { icon: AlertTriangle, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', label: 'Unassigned Lesson' },
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, warning: 4 };
const SEVERITY_COLORS = {
  critical: 'bg-red-500/20 text-red-300 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  warning: 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
};

const FIX_ICONS = { move_to_period: ArrowRight, swap_teacher: Users, change_room: DoorOpen, split_combined: Layers };

export default function ConflictCenter() {
  const [conflicts, setConflicts] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [selectedTT, setSelectedTT] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [batchSelected, setBatchSelected] = useState(new Set());
  const [revalidating, setRevalidating] = useState(false);
  const [resolveReason, setResolveReason] = useState('');

  // Group-by-type view
  const [viewGrouped, setViewGrouped] = useState(false);

  // Fix preview
  const [fixPreview, setFixPreview] = useState(null); // { conflict, fixIndex, fix }
  const [fixPreviewLoading, setFixPreviewLoading] = useState(false);

  // Batch confirm
  const [confirmBatch, setConfirmBatch] = useState(null); // { autoFix: bool }

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterDay, setFilterDay] = useState('');

  useEffect(() => {
    api.get('/timetable/list').then(r => {
      const tts = r.data || [];
      setTimetables(tts);
      if (tts.length) setSelectedTT(tts[0]._id);
    });
  }, []);

  useEffect(() => { if (selectedTT) fetchConflicts(); }, [selectedTT, showResolved]);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ resolved: showResolved ? 'true' : 'false' });
      const r = await api.get(`/timetable/${selectedTT}/conflicts?${params}`);
      setConflicts(r.data || []);
    } catch { setConflicts([]); }
    setLoading(false);
  };

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = [...conflicts];
    if (filterType) list = list.filter(c => c.type === filterType);
    if (filterSeverity) list = list.filter(c => c.severity === filterSeverity);
    if (filterDay) list = list.filter(c => c.day === filterDay);
    return list.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  }, [conflicts, filterType, filterSeverity, filterDay]);

  // Stats
  const stats = useMemo(() => ({
    total: conflicts.length,
    critical: conflicts.filter(c => c.severity === 'critical').length,
    high: conflicts.filter(c => c.severity === 'high').length,
    autoFixable: conflicts.filter(c => c.autoResolvable && c.suggestedFixes?.length > 0).length,
  }), [conflicts]);

  // Actions
  const handleResolve = async (conflictId) => {
    setResolving(conflictId);
    try {
      await api.put(`/timetable/${selectedTT}/conflicts/${conflictId}/resolve`, { reason: resolveReason || 'Manually resolved' });
      toast.success('Conflict resolved');
      setResolveReason('');
      fetchConflicts();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to resolve'); }
    setResolving(null);
  };

  const handleAutoFix = async (conflictId, fixIndex = 0) => {
    setResolving(conflictId);
    try {
      const r = await api.post(`/timetable/${selectedTT}/conflicts/${conflictId}/auto-fix`, { fixIndex });
      if (r.data?.data?.fixResult?.success) {
        toast.success('Auto-fix applied successfully');
      } else {
        toast.error(r.data?.data?.fixResult?.error || 'Fix could not be applied');
      }
      fetchConflicts();
    } catch (err) { toast.error(err.response?.data?.error || 'Auto-fix failed'); }
    setResolving(null); setFixPreview(null);
  };

  const openFixPreview = (conflict, fixIndex, fix) => {
    setFixPreview({ conflict, fixIndex, fix });
  };

  const handleIgnore = async (conflictId) => {
    setResolving(conflictId);
    try {
      await api.put(`/timetable/${selectedTT}/conflicts/${conflictId}/resolve`, { reason: resolveReason || 'Acknowledged and ignored' });
      toast.success('Conflict acknowledged');
      setResolveReason('');
      fetchConflicts();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setResolving(null);
  };

  const handleBatchResolve = async (autoFix = false) => {
    if (batchSelected.size === 0) return toast.error('Select conflicts first');
    try {
      const r = await api.post(`/timetable/${selectedTT}/conflicts/batch-resolve`, {
        conflictIds: [...batchSelected],
        autoFix
      });
      toast.success(`Resolved: ${r.data?.data?.resolved}, Failed: ${r.data?.data?.failed}`);
      setBatchSelected(new Set());
      fetchConflicts();
    } catch (err) { toast.error('Batch resolve failed'); }
    setConfirmBatch(null);
  };

  // Group by type
  const groupedConflicts = useMemo(() => {
    const groups = {};
    for (const c of filtered) {
      const key = c.type || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const handleRevalidate = async () => {
    setRevalidating(true);
    try {
      const r = await api.post(`/timetable/${selectedTT}/conflicts/revalidate`);
      const d = r.data?.data;
      toast.success(`Re-scan complete: ${d?.conflictsFound || 0} conflict(s) found`);
      fetchConflicts();
    } catch (err) { toast.error('Re-validation failed'); }
    setRevalidating(false);
  };

  const toggleBatch = (id) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (batchSelected.size === filtered.length) setBatchSelected(new Set());
    else setBatchSelected(new Set(filtered.map(c => c._id)));
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const types = [...new Set(conflicts.map(c => c.type))];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Conflict Resolution Center</h1>
          <p className="page-subtitle">{stats.total} issue{stats.total !== 1 ? 's' : ''} detected{stats.critical > 0 ? ` · ${stats.critical} critical` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {timetables.length > 0 && (
            <select value={selectedTT} onChange={e => setSelectedTT(e.target.value)} className="select-field w-44 text-xs">
              {timetables.map(t => <option key={t._id} value={t._id}>{t.name || `TT-${t._id.slice(-6)}`}</option>)}
            </select>
          )}
          <button onClick={() => setShowResolved(!showResolved)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showResolved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/50 dark:bg-dark-800/50 border-slate-300/50 dark:border-dark-700/50 text-slate-500 dark:text-dark-400'}`}>
            {showResolved ? 'Showing Resolved' : 'Show Resolved'}
          </button>
          <button onClick={handleRevalidate} disabled={revalidating} className="btn-secondary flex items-center gap-2 text-xs">
            <RotateCcw size={14} className={revalidating ? 'animate-spin' : ''} />
            Re-scan
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {!showResolved && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-dark-50">{stats.total}</p>
            <p className="text-[10px] text-slate-500 dark:text-dark-400 uppercase">Total</p>
          </div>
          <div className="glass-card p-3 text-center border-red-500/20">
            <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
            <p className="text-[10px] text-red-400/60 uppercase">Critical</p>
          </div>
          <div className="glass-card p-3 text-center border-orange-500/20">
            <p className="text-2xl font-bold text-orange-400">{stats.high}</p>
            <p className="text-[10px] text-orange-400/60 uppercase">High</p>
          </div>
          <div className="glass-card p-3 text-center border-emerald-500/20">
            <p className="text-2xl font-bold text-emerald-400">{stats.autoFixable}</p>
            <p className="text-[10px] text-emerald-400/60 uppercase">Auto-fixable</p>
          </div>
        </div>
      )}

      {/* Filters + Batch Actions */}
      {conflicts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400 dark:text-dark-500" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select-field text-xs w-36">
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{TYPE_CONFIG[t]?.label || t}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="select-field text-xs w-28">
            <option value="">All Severity</option>
            {['critical', 'high', 'medium', 'low', 'warning'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="select-field text-xs w-28">
            <option value="">All Days</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {!showResolved && filtered.length > 0 && (
            <>
              <div className="h-5 w-px bg-slate-300 dark:bg-dark-700 mx-1" />
              <button onClick={toggleSelectAll} className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors">
                {batchSelected.size === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              {batchSelected.size > 0 && (
                <PermissionGate permissions={['edit_timetable']}>
                  <>
                    <button onClick={() => setConfirmBatch({ autoFix: true })} className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                      <Zap size={10} className="inline mr-1" />Auto-fix {batchSelected.size}
                    </button>
                    <button onClick={() => setConfirmBatch({ autoFix: false })} className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-500/20 text-slate-400 dark:text-dark-300 hover:bg-slate-500/30 transition-colors">
                      Override {batchSelected.size}
                    </button>
                  </>
                </PermissionGate>
              )}
              <div className="h-5 w-px bg-slate-300 dark:bg-dark-700 mx-1" />
              <button onClick={() => setViewGrouped(!viewGrouped)} className={`p-1.5 rounded-lg transition-colors ${viewGrouped ? 'bg-primary-500/20 text-primary-400' : 'text-slate-400 dark:text-dark-500 hover:bg-slate-100 dark:hover:bg-dark-800'}`} title={viewGrouped ? 'Flat view' : 'Group by type'}>
                {viewGrouped ? <List size={14} /> : <LayoutGrid size={14} />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Conflict List */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-dark-400">Scanning...</div>
      ) : !selectedTT ? (
        <div className="glass-card p-12 text-center text-slate-500 dark:text-dark-400">No timetable generated yet.</div>
      ) : conflicts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-dark-50 mb-2">
            {showResolved ? 'No Resolved Conflicts' : 'No Conflicts Found'}
          </h2>
          <p className="text-slate-500 dark:text-dark-400">
            {showResolved ? 'No previously resolved conflicts.' : 'Your timetable is conflict-free!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => {
            const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.teacher_clash;
            const Icon = cfg.icon;
            const isExpanded = expandedId === c._id;
            const isSelected = batchSelected.has(c._id);

            return (
              <div key={c._id || i}
                className={`glass-card border transition-all duration-200 ${cfg.bg} ${isSelected ? 'ring-2 ring-primary-500/40' : ''} animate-slide-up`}
                style={{ animationDelay: `${i * 30}ms` }}>

                {/* Main row */}
                <div className="p-4 flex items-start gap-3">
                  {!showResolved && (
                    <input type="checkbox" checked={isSelected} onChange={() => toggleBatch(c._id)}
                      className="w-4 h-4 rounded mt-0.5 shrink-0 accent-primary-500" />
                  )}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon size={18} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-slate-900 dark:text-dark-50 text-sm">{c.title || cfg.label}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${SEVERITY_COLORS[c.severity] || SEVERITY_COLORS.medium}`}>{c.severity}</span>
                      {c.autoResolvable && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Auto-fixable</span>}
                      {c.isResolved && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">✓ Resolved</span>}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-dark-300">{c.message}</p>
                    {c.day && <p className="text-xs text-slate-400 dark:text-dark-500 mt-1">{c.day} · Period {c.period}</p>}
                    {c.teacher?.name && <p className="text-xs text-slate-400 dark:text-dark-500">Teacher: {c.teacher.name}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PermissionGate permissions={['edit_timetable']}>
                      {!showResolved && c.suggestedFixes?.length > 0 && (
                        <button onClick={() => openFixPreview(c, 0, c.suggestedFixes[0])} disabled={resolving === c._id}
                          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center gap-1">
                          <Zap size={10} />Fix
                        </button>
                      )}
                      {!showResolved && (
                        <>
                          <button onClick={() => handleIgnore(c._id)} disabled={resolving === c._id}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-500/20 text-slate-400 dark:text-dark-300 hover:bg-slate-500/30 transition-colors flex items-center gap-1">
                            <EyeOff size={10} />Ignore
                          </button>
                          <button onClick={() => handleResolve(c._id)} disabled={resolving === c._id}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1">
                            <Check size={10} />Override
                          </button>
                        </>
                      )}
                    </PermissionGate>
                    <button onClick={() => setExpandedId(isExpanded ? null : c._id)}
                      className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-dark-700/50 text-slate-400 dark:text-dark-500 transition-colors">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-200/30 dark:border-dark-700/30 px-4 py-3 space-y-3 bg-white/30 dark:bg-dark-800/30 rounded-b-xl">
                    {/* Suggested Fixes */}
                    {c.suggestedFixes?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 dark:text-dark-400 uppercase tracking-wider mb-2">Suggested Fixes</p>
                        <div className="space-y-1.5">
                          {c.suggestedFixes.map((fix, fi) => {
                            const FixIcon = FIX_ICONS[fix.action] || Wrench;
                            return (
                              <div key={fi} className="flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-dark-800/50 border border-slate-200/30 dark:border-dark-700/30">
                                <FixIcon size={12} className="text-emerald-400 shrink-0" />
                                <span className="text-xs text-slate-700 dark:text-dark-200 flex-1">{fix.description || fix.action}</span>
                                <span className="text-[10px] text-slate-400 dark:text-dark-500">{fix.confidence}% confidence</span>
                                {!showResolved && (
                                  <PermissionGate permissions={['edit_timetable']}>
                                    <button onClick={() => openFixPreview(c, fi, fix)} disabled={resolving === c._id}
                                      className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center gap-1">
                                      <Eye size={9} />Preview
                                    </button>
                                    <button onClick={() => handleAutoFix(c._id, fi)} disabled={resolving === c._id}
                                      className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                                      Apply
                                    </button>
                                  </PermissionGate>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Manual Override */}
                    {!showResolved && (
                      <div className="flex items-center gap-2">
                        <input value={resolveReason} onChange={e => setResolveReason(e.target.value)}
                          placeholder="Override reason (optional)"
                          className="input-field text-xs flex-1" />
                        <button onClick={() => handleResolve(c._id)} disabled={resolving === c._id}
                          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                          <Check size={12} />Override
                        </button>
                      </div>
                    )}

                    {/* Resolution info */}
                    {c.isResolved && c.resolution && (
                      <div className="text-xs text-emerald-400/70 bg-emerald-500/5 rounded-lg p-2">
                        <span className="font-medium">Resolution:</span> {c.resolution}
                        {c.resolvedAt && <span className="text-slate-400 dark:text-dark-500 ml-2">({new Date(c.resolvedAt).toLocaleString()})</span>}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-3 text-[10px] text-slate-400 dark:text-dark-500">
                      {c.groupId && <span>Group: {c.groupId}</span>}
                      {c.subject?.name && <span>Subject: {c.subject.name}</span>}
                      {c.room?.name && <span>Room: {c.room.name}</span>}
                      {c.classes?.map(cl => <span key={cl._id}>Class: {cl.name}</span>)}
                      <span>ID: {c._id?.slice(-8)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
           })}
        </div>
      )}

      {/* Fix Preview Modal */}
      {fixPreview && (
        <Modal isOpen={!!fixPreview} onClose={() => setFixPreview(null)} title="Fix Preview" size="md">
          <div className="space-y-4">
            <div className="bg-white/40 dark:bg-dark-800/40 rounded-xl p-3 space-y-2">
              <p className="text-xs text-slate-500 dark:text-dark-400 uppercase tracking-wider">Conflict</p>
              <p className="text-sm font-medium text-slate-900 dark:text-dark-50">{fixPreview.conflict?.title || TYPE_CONFIG[fixPreview.conflict?.type]?.label}</p>
              <p className="text-xs text-slate-600 dark:text-dark-300">{fixPreview.conflict?.message}</p>
              {fixPreview.conflict?.day && <p className="text-[10px] text-slate-400 dark:text-dark-500">{fixPreview.conflict.day} · Period {fixPreview.conflict.period}</p>}
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2">
              <p className="text-xs text-emerald-400 uppercase tracking-wider">Proposed Fix</p>
              <p className="text-sm text-slate-900 dark:text-dark-50">{fixPreview.fix?.description || fixPreview.fix?.action}</p>
              <div className="flex gap-3 text-[10px] text-slate-500 dark:text-dark-400">
                <span>Confidence: <strong className={fixPreview.fix?.confidence >= 80 ? 'text-emerald-400' : fixPreview.fix?.confidence >= 50 ? 'text-amber-400' : 'text-red-400'}>{fixPreview.fix?.confidence}%</strong></span>
                <span>Action: {fixPreview.fix?.action?.replace(/_/g, ' ')}</span>
              </div>
              {fixPreview.fix?.target && (
                <div className="text-[10px] text-slate-500 dark:text-dark-400">
                  {fixPreview.fix.target.day && <span>→ {fixPreview.fix.target.day} P{fixPreview.fix.target.period}</span>}
                  {fixPreview.fix.target.teacher && <span> · Teacher: {fixPreview.fix.target.teacher}</span>}
                  {fixPreview.fix.target.room && <span> · Room: {fixPreview.fix.target.room}</span>}
                </div>
              )}
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5">
              <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle size={10} />Applying this fix may create new conflicts which will appear in a re-scan.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setFixPreview(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={() => handleAutoFix(fixPreview.conflict._id, fixPreview.fixIndex)} disabled={resolving === fixPreview.conflict._id}
                className="btn-primary text-sm flex items-center gap-2">
                {resolving === fixPreview.conflict._id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Apply Fix
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmBatch}
        onClose={() => setConfirmBatch(null)}
        onConfirm={() => confirmBatch && handleBatchResolve(confirmBatch.autoFix)}
        title={confirmBatch?.autoFix ? `Auto-fix ${batchSelected.size} conflicts?` : `Override ${batchSelected.size} conflicts?`}
        message={confirmBatch?.autoFix ? 'The system will attempt to apply the best fix for each selected conflict.' : 'Selected conflicts will be marked as resolved/overridden.'}
        confirmText={confirmBatch?.autoFix ? 'Auto-fix All' : 'Override All'}
        variant={confirmBatch?.autoFix ? 'default' : 'warning'}
      />
    </div>
  );
}
