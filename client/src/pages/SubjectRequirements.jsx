import { useState, useEffect, useCallback } from 'react';
import { Save, Copy, BarChart3, Lightbulb, Filter, X, ChevronDown, Check, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function SubjectRequirements() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [streamFilter, setStreamFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [showClassPicker, setShowClassPicker] = useState(false);

  // Modals
  const [showWorkload, setShowWorkload] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSource, setCloneSource] = useState('');
  const [cloneTargets, setCloneTargets] = useState([]);

  // Grid state - map of "classId_subjectId" -> requirement data
  const [gridData, setGridData] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [classRes, subjectRes, teacherRes, reqRes] = await Promise.all([
        api.get('/classes'),
        api.get('/subjects'),
        api.get('/teachers'),
        api.get('/requirements')
      ]);
      const cls = classRes.data?.data || classRes.data || [];
      const subs = subjectRes.data?.data || subjectRes.data || [];
      const tchs = teacherRes.data?.data || teacherRes.data || [];
      const reqs = reqRes.data?.data || reqRes.data || [];

      setClasses(cls);
      setSubjects(subs);
      setTeachers(tchs);
      setRequirements(reqs);

      // Select all classes by default
      if (selectedClasses.length === 0) {
        setSelectedClasses(cls.map(c => c._id));
      }

      // Build grid
      const grid = {};
      reqs.forEach(r => {
        const key = `${r.class?._id || r.class}_${r.subject?._id || r.subject}`;
        grid[key] = {
          _id: r._id,
          periodsPerWeek: r.periodsPerWeek,
          teacher: r.teacher?._id || r.teacher,
          teacherName: r.teacher?.name,
          consecutivePreference: r.consecutivePreference || 'none',
          allowDoublePeriod: r.allowDoublePeriod || false,
          preferredRoom: r.preferredRoom?._id || r.preferredRoom,
          studentGroup: r.studentGroup
        };
      });
      setGridData(grid);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkload = async () => {
    try {
      const res = await api.get('/requirements/workload-summary');
      setWorkload(res.data?.data || []);
      setShowWorkload(true);
    } catch (err) { toast.error('Failed to load workload'); }
  };

  const loadSuggestions = async () => {
    try {
      const res = await api.get('/requirements/balancing');
      setSuggestions(res.data?.data || []);
      setShowSuggestions(true);
    } catch (err) { toast.error('Failed to load suggestions'); }
  };

  const updateCell = (classId, subjectId, field, value) => {
    const key = `${classId}_${subjectId}`;
    setGridData(prev => ({
      ...prev,
      [key]: { ...(prev[key] || { periodsPerWeek: 0, teacher: '', consecutivePreference: 'none' }), [field]: value }
    }));
    setDirty(true);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const reqs = [];
      Object.entries(gridData).forEach(([key, data]) => {
        if (data.periodsPerWeek > 0 && data.teacher) {
          const [classId, subjectId] = key.split('_');
          reqs.push({
            class: classId,
            subject: subjectId,
            teacher: data.teacher,
            periodsPerWeek: Number(data.periodsPerWeek),
            consecutivePreference: data.consecutivePreference || 'none',
            allowDoublePeriod: data.allowDoublePeriod || false,
            preferredRoom: data.preferredRoom || undefined,
            studentGroup: data.studentGroup || undefined
          });
        }
      });

      await api.post('/requirements/bulk', { requirements: reqs });
      toast.success(`Saved ${reqs.length} requirements`);
      setDirty(false);
      loadAll();
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async () => {
    if (!cloneSource || cloneTargets.length === 0) {
      toast.error('Select source and target classes');
      return;
    }
    try {
      await api.post('/requirements/clone', { sourceClass: cloneSource, targetClasses: cloneTargets });
      toast.success('Cloned successfully');
      setShowCloneModal(false);
      loadAll();
    } catch (err) { toast.error('Clone failed'); }
  };

  // Filter logic
  const filteredClasses = classes.filter(c => {
    if (!selectedClasses.includes(c._id)) return false;
    if (streamFilter && c.stream !== streamFilter) return false;
    return true;
  });

  const filteredSubjects = subjects.filter(s => {
    if (!s.isActive) return false;
    if (subjectFilter && s._id !== subjectFilter) return false;
    return true;
  });

  const streams = [...new Set(classes.map(c => c.stream).filter(Boolean))];

  // Compute class period capacity from period structure
  const getClassMaxPeriods = (cls) => cls.totalPeriodsPerDay || 8;

  const getTotalAssigned = (classId) => {
    return filteredSubjects.reduce((sum, sub) => {
      const key = `${classId}_${sub._id}`;
      return sum + (gridData[key]?.periodsPerWeek || 0);
    }, 0);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-primary-500" size={32} />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Weekly Subject Periods</h1>
          <p className="page-subtitle">Centralized period allocation for all classes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadWorkload} className="btn-secondary flex items-center gap-2 text-sm">
            <BarChart3 size={15} /> Workload
          </button>
          <button onClick={loadSuggestions} className="btn-secondary flex items-center gap-2 text-sm">
            <Lightbulb size={15} /> Suggestions
          </button>
          <button onClick={() => setShowCloneModal(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Copy size={15} /> Clone
          </button>
          <button onClick={saveAll} disabled={!dirty || saving} className="btn-primary flex items-center gap-2 text-sm">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="relative">
          <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Classes</label>
          <button onClick={() => setShowClassPicker(!showClassPicker)}
            className="select-field text-sm min-w-[200px] text-left flex items-center justify-between">
            <span>{selectedClasses.length === classes.length ? 'All Classes' : `${selectedClasses.length} selected`}</span>
            <ChevronDown size={14} />
          </button>
          {showClassPicker && (
            <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl shadow-xl z-50 p-2">
              <button onClick={() => { setSelectedClasses(classes.map(c => c._id)); }} className="text-xs text-primary-500 mb-1 block">Select All</button>
              <button onClick={() => { setSelectedClasses([]); }} className="text-xs text-red-500 mb-2 block">Clear All</button>
              {classes.map(c => (
                <label key={c._id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-dark-700 rounded cursor-pointer">
                  <input type="checkbox" checked={selectedClasses.includes(c._id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedClasses(prev => [...prev, c._id]);
                      else setSelectedClasses(prev => prev.filter(id => id !== c._id));
                    }}
                    className="w-4 h-4 rounded text-primary-600" />
                  <span className="text-sm">{c.name}</span>
                  {c.stream && <span className="text-[10px] text-slate-400">({c.stream})</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {streams.length > 0 && (
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Stream</label>
            <select value={streamFilter} onChange={e => setStreamFilter(e.target.value)} className="select-field text-sm">
              <option value="">All Streams</option>
              {streams.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Subject</label>
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="select-field text-sm min-w-[160px]">
            <option value="">All Subjects</option>
            {subjects.filter(s => s.isActive).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>

        <button onClick={loadAll} className="btn-secondary p-2.5" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Main Grid */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="table-header">
                <th className="p-3 text-left text-xs sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 min-w-[160px]">Subject</th>
                {filteredClasses.map(cls => (
                  <th key={cls._id} className="p-3 text-center text-xs min-w-[140px]">
                    <div>{cls.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      {getTotalAssigned(cls._id)} assigned
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map(sub => (
                <tr key={sub._id} className="table-row">
                  <td className="p-3 sticky left-0 bg-white dark:bg-dark-900 z-10 border-r border-slate-200 dark:border-dark-700">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color || '#6366f1' }} />
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-dark-100">{sub.name}</p>
                        <p className="text-[10px] text-slate-400">{sub.code} · {sub.type}</p>
                      </div>
                    </div>
                  </td>
                  {filteredClasses.map(cls => {
                    const key = `${cls._id}_${sub._id}`;
                    const cell = gridData[key] || {};
                    return (
                      <td key={cls._id} className="p-2 text-center">
                        <div className="space-y-1">
                          <input
                            type="number" min="0" max="15"
                            value={cell.periodsPerWeek || ''}
                            onChange={e => updateCell(cls._id, sub._id, 'periodsPerWeek', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-14 mx-auto text-center bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                          />
                          <select
                            value={cell.teacher || ''}
                            onChange={e => updateCell(cls._id, sub._id, 'teacher', e.target.value)}
                            className="w-full text-[10px] bg-transparent border border-slate-200 dark:border-dark-700 rounded px-1 py-0.5 focus:ring-1 focus:ring-primary-500/50"
                          >
                            <option value="">— teacher —</option>
                            {teachers.filter(t => t.status === 'active').map(t => (
                              <option key={t._id} value={t._id}>{t.shortName || t.name}</option>
                            ))}
                          </select>
                          <label className="flex items-center justify-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cell.consecutivePreference === 'preferred' || cell.consecutivePreference === 'required'}
                              onChange={e => updateCell(cls._id, sub._id, 'consecutivePreference', e.target.checked ? 'preferred' : 'none')}
                              className="w-3 h-3 rounded text-primary-600"
                            />
                            <span className="text-[9px] text-slate-400">consec.</span>
                          </label>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredClasses.length === 0 && (
          <div className="p-12 text-center text-slate-400 dark:text-dark-500">Select at least one class to view the grid</div>
        )}
      </div>

      {dirty && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <button onClick={saveAll} disabled={saving}
            className="btn-primary shadow-2xl shadow-primary-500/30 flex items-center gap-2 px-6 py-3 text-base">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      )}

      {/* Workload Modal */}
      {showWorkload && (
        <Modal isOpen={showWorkload} onClose={() => setShowWorkload(false)} title="Teacher Workload Summary">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {workload.map(w => (
              <div key={w.teacher._id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-dark-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-dark-100 truncate">{w.teacher.name}</p>
                  <p className="text-[10px] text-slate-400">{w.teacher.department} · {w.classCount} classes · {w.subjectCount} subjects</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${w.status === 'overloaded' ? 'text-red-500' : w.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {w.totalPeriods}/{w.maxPeriodsPerWeek}
                  </p>
                  <div className="w-20 h-1.5 bg-slate-200 dark:bg-dark-700 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${w.status === 'overloaded' ? 'bg-red-500' : w.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, w.utilizationPercent)}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {workload.length === 0 && <p className="text-center text-slate-400 py-6">No workload data</p>}
          </div>
        </Modal>
      )}

      {/* Suggestions Modal */}
      {showSuggestions && (
        <Modal isOpen={showSuggestions} onClose={() => setShowSuggestions(false)} title="Balancing Suggestions">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {suggestions.map((s, i) => (
              <div key={i} className={`p-3 rounded-xl border ${s.type === 'overload' ? 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10' : 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-900/10'}`}>
                {s.type === 'overload' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{s.teacher} is overloaded ({s.currentLoad}/{s.maxLoad})</p>
                    </div>
                    {s.candidates?.map((c, ci) => (
                      <p key={ci} className="text-xs text-slate-600 dark:text-dark-300 ml-5 mt-1">→ Move {c.subject} ({c.class}) to {c.toTeacher.name}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-blue-700 dark:text-blue-400">{s.message}</p>
                )}
              </div>
            ))}
            {suggestions.length === 0 && <p className="text-center text-slate-400 py-6">No suggestions — all balanced!</p>}
          </div>
        </Modal>
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <Modal isOpen={showCloneModal} onClose={() => setShowCloneModal(false)} title="Clone Period Configuration">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Source Class</label>
              <select value={cloneSource} onChange={e => setCloneSource(e.target.value)} className="select-field">
                <option value="">Select source...</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Target Classes</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-dark-700 rounded-xl p-2 space-y-1">
                {classes.filter(c => c._id !== cloneSource).map(c => (
                  <label key={c._id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-dark-700 rounded cursor-pointer">
                    <input type="checkbox" checked={cloneTargets.includes(c._id)}
                      onChange={e => {
                        if (e.target.checked) setCloneTargets(prev => [...prev, c._id]);
                        else setCloneTargets(prev => prev.filter(id => id !== c._id));
                      }}
                      className="w-4 h-4 rounded text-primary-600" />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCloneModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleClone} className="btn-primary flex items-center gap-2">
                <Copy size={15} /> Clone
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
