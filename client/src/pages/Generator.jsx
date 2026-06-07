import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, CheckCircle, AlertTriangle, Loader2, Eye, X, Clock, BarChart3, XCircle, RefreshCw, ChevronDown, ChevronRight, Lightbulb, Lock, Unlock, ToggleLeft, ToggleRight, Database, Users, BookOpen, Home, Edit3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STAGE_LABELS = {
  starting: 'Initializing',
  loading: 'Loading data',
  period_structures: 'Period structures',
  pipeline_init: 'Pipeline init',
  generating_blocks: 'Generating blocks',
  resolving_groups: 'Resolving groups',
  locked_blocks: 'Loading locked blocks',
  reserved: 'Reserved rules',
  combined: 'Combined classes',
  split_groups: 'Split groups',
  class_teacher: 'Class teacher slots',
  regular: 'Placing lessons',
  retry: 'Retry sweep',
  breaks: 'Adding breaks',
  saving: 'Saving blocks',
  conflicts: 'Conflict detection',
  scoring: 'Quality scoring',
  complete: 'Complete'
};

const STAGE_ORDER = ['loading', 'generating_blocks', 'resolving_groups', 'locked_blocks', 'reserved', 'combined', 'split_groups', 'regular', 'retry', 'saving', 'scoring', 'complete'];

export default function Generator() {
  const { selectedSchool, selectedSession } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState({ percent: 0, stage: '' });
  const [result, setResult] = useState(null);
  const [timetables, setTimetables] = useState([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [expandedDiag, setExpandedDiag] = useState(null);
  const pollRef = useRef(null);
  const [partialStats, setPartialStats] = useState(null);
  const [jobLogs, setJobLogs] = useState([]);

  // Priority 3: Pre-generation options
  const [showOptions, setShowOptions] = useState(false);
  const [lockedBlocks, setLockedBlocks] = useState([]);
  const [selectedLocked, setSelectedLocked] = useState(new Set());
  const [loadingLocked, setLoadingLocked] = useState(false);
  const [requireTeacher, setRequireTeacher] = useState(true);

  useEffect(() => { api.get('/timetable/list').then(r => setTimetables(r.data || [])); }, [selectedSchool, selectedSession]);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Load locked blocks from published timetable
  const loadLockedBlocks = useCallback(async () => {
    setLoadingLocked(true);
    try {
      const res = await api.get('/generation/locked-blocks');
      const blocks = res.data.lockedBlocks || [];
      setLockedBlocks(blocks);
      setSelectedLocked(new Set(blocks.map(b => b._id)));
    } catch { setLockedBlocks([]); }
    setLoadingLocked(false);
  }, [selectedSchool, selectedSession]);

  const pollJobStatus = useCallback((jid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/generation/jobs/${jid}`);
        const data = res.data?.data || res.data;
        setProgress({ percent: data.progress || 0, stage: data.stage || '' });
        if (data.partialStats) setPartialStats(data.partialStats);
        if (data.logCount > jobLogs.length) {
          // Fetch latest logs
          try {
            const logsRes = await api.get(`/generation/jobs/${jid}/logs`);
            const logsData = logsRes.data?.data?.logs || logsRes.data?.logs || [];
            setJobLogs(logsData.slice(-20));
          } catch { /* ignore */ }
        }

        if (data.status === 'completed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setGenerating(false);
          setResult(data.result);
          toast.success(`Generated ${data.result?.totalBlocks || 0} lesson blocks!`);
          api.get('/timetable/list').then(r => setTimetables(r.data || []));
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setGenerating(false);
          toast.error(data.error || 'Generation failed');
        } else if (data.status === 'cancelled') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setGenerating(false);
          toast('Generation cancelled', { icon: '🚫' });
        }
      } catch { /* ignore poll errors */ }
    }, 1000);
  }, [selectedSchool, selectedSession]);

  const handleGenerate = async () => {
    setGenerating(true); setResult(null); setPartialStats(null); setJobLogs([]); setProgress({ percent: 0, stage: 'starting' });
    try {
      const body = {
        lockedBlockIds: [...selectedLocked],
        keepLockedBlocks: selectedLocked.size > 0,
        requireTeacherForActivities: requireTeacher
      };
      const res = await api.post('/generation/jobs', body);
      if (res.data.success) {
        setJobId(res.data.jobId);
        pollJobStatus(res.data.jobId);
      } else {
        toast.error(res.data.error || 'Failed to start');
        setGenerating(false);
      }
    } catch (err) {
      // Fallback to direct generation
      try {
        const res = await api.post('/timetable/generate');
        setResult(res.data);
        toast.success(`Generated ${res.data.totalBlocks} lesson blocks!`);
        api.get('/timetable/list').then(r => setTimetables(r.data || []));
      } catch (e) { toast.error(e.message); }
      setGenerating(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await api.post(`/generation/jobs/${jobId}/cancel`);
      toast('Cancellation requested...', { icon: '⏹️' });
    } catch { toast.error('Failed to cancel'); }
  };

  const handlePublish = async (id) => {
    try { await api.put(`/timetable/${id}/publish`); toast.success('Published!'); api.get('/timetable/list').then(r => setTimetables(r.data || [])); }
    catch (err) { toast.error(err.message); }
  };

  const toggleLockedBlock = (id) => {
    setSelectedLocked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const statusColors = { generating: 'text-amber-400', draft: 'text-blue-400', review: 'text-amber-400', published: 'text-emerald-400', archived: 'text-slate-400 dark:text-dark-500', failed: 'text-red-400' };

  const diagErrors = result?.diagnostics?.errors || [];
  const analytics = result?.diagnostics?.analytics || result?.score?.analytics || {};
  const factors = result?.diagnostics?.factors || result?.score?.factors || {};

  // Group diagnostics by type
  const diagByType = {};
  for (const err of diagErrors) {
    const t = err.type || 'unknown';
    if (!diagByType[t]) diagByType[t] = [];
    diagByType[t].push(err);
  }

  const currentStageIdx = STAGE_ORDER.indexOf(progress.stage);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="text-center"><h1 className="page-title">Timetable Generator</h1><p className="page-subtitle mt-1">Auto-generate a conflict-free timetable using the scheduling engine</p></div>

      <div className="glass-card p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30"><Zap size={36} className="text-slate-900 dark:text-dark-50" /></div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-dark-50 mb-2">Lesson-Block Scheduling Engine</h2>
        <p className="text-slate-500 dark:text-dark-400 text-sm mb-6 max-w-md mx-auto">Analyzes all classes, teachers, subjects, rooms, combination rules, and constraints to create an optimal schedule.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-left">
          {[{ l: 'No teacher clashes', d: 'Hard constraint' }, { l: 'No room clashes', d: 'Hard constraint' }, { l: 'Combined classes', d: 'Shared subject blocks' }, { l: 'Load balancing', d: 'Soft optimization' }].map((c, i) => (
            <div key={i} className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 border border-slate-300/50 dark:border-dark-700/50"><p className="text-xs font-semibold text-emerald-400">{c.l}</p><p className="text-[10px] text-slate-500 dark:text-dark-400 mt-0.5">{c.d}</p></div>
          ))}
        </div>

        {/* Pre-generation options */}
        {!generating && !result && (
          <div className="mb-6">
            <button onClick={() => { setShowOptions(v => !v); if (!showOptions && lockedBlocks.length === 0) loadLockedBlocks(); }} className="text-xs font-medium text-slate-400 dark:text-dark-400 flex items-center gap-1 mx-auto hover:text-slate-600 dark:hover:text-dark-200 transition-colors">
              ⚙️ Generation Options {showOptions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {showOptions && (
              <div className="mt-3 bg-white/50 dark:bg-dark-800/50 rounded-xl p-4 text-left space-y-4 animate-slide-up max-w-lg mx-auto border border-slate-200/50 dark:border-dark-700/50">
                {/* Activity teacher toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-dark-200">Require teacher for activities/clubs</p>
                    <p className="text-[10px] text-slate-400 dark:text-dark-500">When off, activity/club periods can be placed without a teacher</p>
                  </div>
                  <button onClick={() => setRequireTeacher(v => !v)} className="text-slate-400 hover:text-emerald-500 transition-colors">
                    {requireTeacher ? <ToggleRight size={24} className="text-emerald-500" /> : <ToggleLeft size={24} />}
                  </button>
                </div>

                {/* Locked blocks selection */}
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-dark-200 mb-2 flex items-center gap-1"><Lock size={12} /> Locked Blocks from Published Timetable</p>
                  {loadingLocked ? (
                    <p className="text-[10px] text-slate-400"><Loader2 size={12} className="inline animate-spin mr-1" />Loading...</p>
                  ) : lockedBlocks.length === 0 ? (
                    <p className="text-[10px] text-slate-400">No published timetable with locked blocks found</p>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-2">
                        <button onClick={() => setSelectedLocked(new Set(lockedBlocks.map(b => b._id)))} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Select All ({lockedBlocks.length})</button>
                        <button onClick={() => setSelectedLocked(new Set())} className="text-[10px] px-2 py-0.5 rounded bg-slate-500/10 text-slate-500 hover:bg-slate-500/20">Deselect All</button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {lockedBlocks.map(lb => (
                          <label key={lb._id} className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-slate-100/50 dark:hover:bg-dark-700/50 rounded-lg p-1.5 transition-colors">
                            <input type="checkbox" checked={selectedLocked.has(lb._id)} onChange={() => toggleLockedBlock(lb._id)} className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
                            <span className="font-medium text-slate-700 dark:text-dark-200">{lb.subject?.name || 'Reserved'}</span>
                            <span className="text-slate-400 dark:text-dark-500">• {lb.day} P{lb.periods?.join(',')}</span>
                            {lb.teacher && <span className="text-slate-400 dark:text-dark-500">• {lb.teacher.name}</span>}
                            {lb.classes?.length > 0 && <span className="text-slate-400 dark:text-dark-500">• {lb.classes.map(c => c.name).join(', ')}</span>}
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{selectedLocked.size} of {lockedBlocks.length} locked blocks will be preserved</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!generating ? (
          <button onClick={handleGenerate} className="btn-primary px-8 py-3 text-lg inline-flex items-center gap-3">
            <Zap size={22} /> Generate Timetable
          </button>
        ) : (
          <div className="space-y-4">
            {/* Stage timeline */}
            <div className="flex items-center justify-center gap-1 mb-3 flex-wrap">
              {STAGE_ORDER.map((stage, i) => {
                const isDone = currentStageIdx > i;
                const isCurrent = currentStageIdx === i;
                return (
                  <div key={stage} className="flex items-center gap-0.5">
                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-400' : isCurrent ? 'bg-amber-400 animate-pulse ring-2 ring-amber-400/30' : 'bg-slate-300 dark:bg-dark-600'}`}
                      title={STAGE_LABELS[stage] || stage} />
                    {i < STAGE_ORDER.length - 1 && <div className={`w-3 h-px ${isDone ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-dark-600'}`} />}
                  </div>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-xs text-slate-400 dark:text-dark-400 mb-1.5">
                <span className="font-medium">{STAGE_LABELS[progress.stage] || progress.stage || 'Starting...'}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-dark-700 rounded-full h-2.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button disabled className="btn-primary px-6 py-2.5 opacity-70 cursor-not-allowed inline-flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Generating...
              </button>
              <button onClick={handleCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors inline-flex items-center gap-2">
                <XCircle size={16} /> Cancel
              </button>
            </div>

            {/* Live Partial Stats */}
            {partialStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 max-w-xl mx-auto animate-fade-in">
                <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 text-center border border-slate-200/40 dark:border-dark-700/40">
                  <p className="text-lg font-bold text-emerald-400">{partialStats.totalBlocks || 0}</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500">Total</p>
                </div>
                <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 text-center border border-slate-200/40 dark:border-dark-700/40">
                  <p className="text-lg font-bold text-blue-400">{partialStats.placedBlocks || 0}</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500">Placed</p>
                </div>
                <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 text-center border border-slate-200/40 dark:border-dark-700/40">
                  <p className={`text-lg font-bold ${(partialStats.unplacedBlocks || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{partialStats.unplacedBlocks || 0}</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500">Unplaced</p>
                </div>
                <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 text-center border border-slate-200/40 dark:border-dark-700/40">
                  <p className={`text-lg font-bold ${(partialStats.conflicts || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{partialStats.conflicts || '—'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500">Conflicts</p>
                </div>
                <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 text-center border border-slate-200/40 dark:border-dark-700/40">
                  <p className="text-lg font-bold text-slate-500 dark:text-dark-300">{partialStats.qualityScore || '—'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500">Quality</p>
                </div>
              </div>
            )}

            {/* Live Logs */}
            {jobLogs.length > 0 && (
              <div className="mt-4 max-w-xl mx-auto">
                <details className="text-left">
                  <summary className="text-[10px] text-slate-400 dark:text-dark-500 cursor-pointer hover:text-slate-600 dark:hover:text-dark-300">Generation Logs ({jobLogs.length})</summary>
                  <div className="mt-1 max-h-32 overflow-y-auto bg-slate-50/50 dark:bg-dark-800/50 rounded-lg p-2 space-y-0.5">
                    {jobLogs.map((log, i) => (
                      <div key={i} className="text-[9px] text-slate-400 dark:text-dark-500 font-mono flex gap-2">
                        <span className="text-slate-300 dark:text-dark-600 shrink-0">{new Date(log.ts).toLocaleTimeString()}</span>
                        <span className="text-emerald-400/70">{log.stage}</span>
                        {log.percent != null && <span>{log.percent}%</span>}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generation Result */}
      {result && (
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={24} className="text-emerald-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-dark-50">Generation Complete</h3>
            {result.timeMs && <span className="ml-auto text-xs text-slate-400 dark:text-dark-500 flex items-center gap-1"><Clock size={12} /> {(result.timeMs / 1000).toFixed(1)}s</span>}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{result.totalBlocks}</p><p className="text-xs text-slate-500 dark:text-dark-400">Blocks</p></div>
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-slate-900 dark:text-dark-50 capitalize">{result.status}</p><p className="text-xs text-slate-500 dark:text-dark-400">Status</p></div>
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className={`text-2xl font-bold ${result.unplaced > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{result.unplaced}</p><p className="text-xs text-slate-500 dark:text-dark-400">Unplaced</p></div>
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className={`text-2xl font-bold ${result.conflicts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{result.conflicts}</p><p className="text-xs text-slate-500 dark:text-dark-400">Conflicts</p></div>
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className={`text-2xl font-bold ${(result.score?.total || 0) >= 90 ? 'text-emerald-400' : (result.score?.total || 0) >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{result.score?.total || 0}</p><p className="text-xs text-slate-500 dark:text-dark-400">Quality</p></div>
          </div>

          {/* Quality factors breakdown */}
          {Object.keys(factors).length > 0 && (
            <div className="mb-4">
              <button onClick={() => setShowDiagnostics(v => !v)} className="text-xs font-medium text-slate-500 dark:text-dark-400 flex items-center gap-1 mb-2 hover:text-slate-900 dark:hover:text-dark-200 transition-colors">
                <BarChart3 size={14} /> Quality Factors
                {showDiagnostics ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {showDiagnostics && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-slide-up">
                  {Object.entries(factors).map(([key, val]) => (
                    <div key={key} className="bg-white/50 dark:bg-dark-800/50 rounded-lg p-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 dark:text-dark-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={`text-xs font-bold ${val >= 90 ? 'text-emerald-400' : val >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{val}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Workload + Room analytics */}
          {(analytics.maxLoad > 0 || analytics.roomUtilization) && (
            <div className="mb-4 p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-xl border border-blue-500/20">
              <p className="text-xs font-medium text-blue-400 mb-2">📊 Analytics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div><span className="font-bold text-slate-900 dark:text-dark-50">{analytics.avgLoad}</span><br /><span className="text-slate-400 dark:text-dark-500">Avg Load</span></div>
                <div><span className="font-bold text-slate-900 dark:text-dark-50">{analytics.maxLoad}</span><br /><span className="text-slate-400 dark:text-dark-500">Max Load</span></div>
                <div><span className="font-bold text-slate-900 dark:text-dark-50">{analytics.variance}</span><br /><span className="text-slate-400 dark:text-dark-500">Variance</span></div>
                {analytics.roomUtilization && (
                  <div><span className="font-bold text-slate-900 dark:text-dark-50">{analytics.roomUtilization.percentage}%</span><br /><span className="text-slate-400 dark:text-dark-500">Room Util.</span></div>
                )}
              </div>
              {analytics.overloadedTeachers?.length > 0 && (
                <p className="text-[10px] text-amber-400 mt-2">⚠ Overloaded: {analytics.overloadedTeachers.map(t => t.name).join(', ')}</p>
              )}
              {analytics.underutilizedTeachers?.length > 0 && (
                <p className="text-[10px] text-blue-300 mt-1">ℹ Underutilized: {analytics.underutilizedTeachers.map(t => t.name).join(', ')}</p>
              )}
            </div>
          )}

          {/* Diagnostics drawer — grouped by type */}
          {diagErrors.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-amber-400 flex items-center gap-1 mb-2"><AlertTriangle size={14} /> {diagErrors.length} Unplaced Block{diagErrors.length > 1 ? 's' : ''} — Diagnostics</p>
              {Object.entries(diagByType).map(([type, errors]) => (
                <div key={type} className="mb-3">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-dark-400 mb-1 capitalize">{type.replace(/_/g, ' ')} ({errors.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {errors.map((err, i) => {
                      const diagKey = `${type}_${i}`;
                      return (
                        <div key={diagKey} className="bg-amber-500/5 dark:bg-amber-500/10 rounded-lg border border-amber-500/20 overflow-hidden">
                          <button onClick={() => setExpandedDiag(expandedDiag === diagKey ? null : diagKey)} className="w-full flex items-center justify-between p-3 text-left">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-900 dark:text-dark-100 font-medium truncate">{err.rootCause || err.message}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {err.affectedClass && <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded bg-blue-500/10 text-[9px] text-blue-400"><Users size={8} />{err.affectedClass}</span>}
                                {err.affectedSubject && <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded bg-purple-500/10 text-[9px] text-purple-400"><BookOpen size={8} />{err.affectedSubject}</span>}
                                {err.affectedTeacher && <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded bg-teal-500/10 text-[9px] text-teal-400">{err.affectedTeacher}</span>}
                                {err.affectedRoom && <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded bg-orange-500/10 text-[9px] text-orange-400"><Home size={8} />{err.affectedRoom}</span>}
                              </div>
                            </div>
                            {err.confidenceScore != null && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-2 ${err.confidenceScore >= 60 ? 'bg-emerald-500/20 text-emerald-400' : err.confidenceScore >= 40 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{err.confidenceScore}%</span>
                            )}
                            {expandedDiag === diagKey ? <ChevronDown size={14} className="text-slate-400 ml-1 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 ml-1 flex-shrink-0" />}
                          </button>
                          {expandedDiag === diagKey && (
                            <div className="px-3 pb-3 space-y-2 animate-slide-up">
                              <p className="text-[10px] text-slate-400 dark:text-dark-500">Code: {err.reason}</p>
                              {err.details?.failedReasons?.length > 0 && (
                                <div className="text-[10px] text-slate-400 dark:text-dark-500">
                                  <span className="font-medium">Root causes: </span>{err.details.failedReasons.join(', ')}
                                </div>
                              )}
                              {err.details?.failedSlots?.length > 0 && (
                                <div className="text-[10px] text-slate-400 dark:text-dark-500">
                                  <span className="font-medium">Failed slots: </span>
                                  {err.details.failedSlots.slice(0, 5).map((s, j) => (
                                    <span key={j} className="block ml-2">• {s.day} P{s.period}: {s.reason}</span>
                                  ))}
                                </div>
                              )}
                              {err.suggestions?.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-slate-500 dark:text-dark-400 flex items-center gap-1"><Lightbulb size={10} /> Suggestions</p>
                                  {err.suggestions.map((s, j) => (
                                    <div key={j} className="flex items-center gap-2 text-[10px]">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.confidence >= 70 ? 'bg-emerald-500/20 text-emerald-400' : s.confidence >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>{s.confidence}%</span>
                                      <span className="text-slate-500 dark:text-dark-300">{s.description}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Link to="/timetable" className="btn-primary flex items-center gap-2"><Eye size={16} /> View Timetable</Link>
            {result.timetableId && <Link to={`/timetable?id=${result.timetableId}&edit=1`} className="btn-secondary flex items-center gap-2"><Edit3 size={16} /> Open in Editor</Link>}
            {result.conflicts > 0 && <Link to="/conflicts" className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-2"><AlertTriangle size={16} /> View Conflicts</Link>}
            <button onClick={handleGenerate} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-500/10 text-slate-600 dark:text-dark-300 hover:bg-slate-500/20 transition-colors flex items-center gap-2"><RefreshCw size={14} /> Regenerate</button>
          </div>
        </div>
      )}

      {timetables.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-300/50 dark:border-dark-700/50"><h3 className="font-semibold text-slate-900 dark:text-dark-50 text-sm">Generated Timetables</h3></div>
          <div className="divide-y divide-dark-700/30">
            {timetables.map(t => (
              <div key={t._id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-100/30 dark:hover:bg-dark-800/30">
                <div>
                  <p className="text-sm text-slate-900 dark:text-dark-50 font-medium">{t.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500">{new Date(t.createdAt).toLocaleString()} · {t.stats?.totalBlocks || 0} blocks · {t.stats?.generationTimeMs || 0}ms · Quality: {t.stats?.softRuleScore || 0}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${statusColors[t.status]}`}>{t.status}</span>
                  {t.status === 'draft' && <button onClick={() => handlePublish(t._id)} className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Publish</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
