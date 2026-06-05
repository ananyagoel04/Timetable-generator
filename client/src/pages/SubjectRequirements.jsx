import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Save, Copy, BarChart3, Lightbulb, Filter, X, ChevronDown, Check,
  AlertTriangle, Loader2, RefreshCw, Grid3X3, Users, BookOpen,
  Settings, Shield, Zap, Plus, Trash2, CheckCircle, XCircle, Info,
  Clock, Layers, Sparkles, ArrowUpDown
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import WeeklyLoadModal from '../components/WeeklyLoadModal';
import TimetablePreview from '../components/TimetablePreview';
import { dedupeBreaks, getDuration, computeStats } from '../utils/breakUtils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TABS = [
  { id: 'subjects', label: 'Class Subjects', icon: BookOpen, desc: 'Which subjects each class studies', accent: 'from-emerald-500 to-teal-500' },
  { id: 'periods', label: 'Weekly Periods', icon: Grid3X3, desc: 'Period allocation & teacher assignment', accent: 'from-primary-500 to-indigo-500' },
  { id: 'eligibility', label: 'Eligibility', icon: Users, desc: 'Teacher eligibility overview', accent: 'from-blue-500 to-cyan-500' },
  { id: 'workload', label: 'Workload', icon: BarChart3, desc: 'Teacher workload analysis', accent: 'from-purple-500 to-pink-500' },
  { id: 'validation', label: 'Validation', icon: Shield, desc: 'Readiness checks', accent: 'from-amber-500 to-orange-500' }
];

// ── Reusable Class Picker Dropdown (overflow-safe) ──
function ClassPickerDropdown({ classes, selectedClasses, setSelectedClasses }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Classes</label>
      <button onClick={() => setOpen(!open)}
        className="select-field text-xs min-w-[180px] text-left flex items-center justify-between !py-1.5">
        <span>{selectedClasses.length === classes.length ? 'All Classes' : `${selectedClasses.length} selected`}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 max-h-56 overflow-y-auto bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl shadow-2xl p-2"
          style={{ zIndex: 9999 }}>
          <div className="flex gap-2 mb-2 sticky top-0 bg-white dark:bg-dark-800 pb-1 border-b border-slate-100 dark:border-dark-700">
            <button onClick={() => setSelectedClasses(classes.map(c => c._id))} className="text-[10px] px-2 py-0.5 rounded bg-primary-500/10 text-primary-500 hover:bg-primary-500/20">All</button>
            <button onClick={() => setSelectedClasses([])} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20">None</button>
            <span className="ml-auto text-[9px] text-slate-400 dark:text-dark-500 self-center">{selectedClasses.length}/{classes.length}</span>
          </div>
          {classes.map(c => (
            <label key={c._id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-dark-700 rounded-lg cursor-pointer transition-colors">
              <input type="checkbox" checked={selectedClasses.includes(c._id)}
                onChange={e => e.target.checked ? setSelectedClasses(p => [...p, c._id]) : setSelectedClasses(p => p.filter(id => id !== c._id))}
                className="w-3 h-3 rounded text-primary-600 focus:ring-primary-500" />
              <span className="text-xs text-slate-700 dark:text-dark-200">{c.name}</span>
              {c.stream && c.stream !== 'none' && <span className="text-[9px] text-slate-400 dark:text-dark-500 ml-auto">({c.stream})</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubjectRequirements() {
  const [activeTab, setActiveTab] = useState('subjects');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [validationData, setValidationData] = useState(null);
  const [eligibilityMatrix, setEligibilityMatrix] = useState(null);
  const [periodStructures, setPeriodStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Filters
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [streamFilter, setStreamFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  // showClassPicker state moved into ClassPickerDropdown component

  // Modals
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [weeklyLoadReq, setWeeklyLoadReq] = useState(null); // requirement for WeeklyLoadModal
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [cloneSource, setCloneSource] = useState('');
  const [cloneTargets, setCloneTargets] = useState([]);

  // Grid states
  const [gridData, setGridData] = useState({});
  const [csmGrid, setCsmGrid] = useState({});
  const [dirty, setDirty] = useState(false);
  const [csmDirty, setCsmDirty] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [classRes, subjectRes, teacherRes, reqRes, csmRes, psRes] = await Promise.all([
        api.get('/classes'),
        api.get('/subjects'),
        api.get('/teachers'),
        api.get('/requirements'),
        api.get('/requirements/class-subjects').catch(() => ({ data: { data: [] } })),
        api.get('/setup/period-structures').catch(() => ({ data: [] }))
      ]);
      const cls = classRes.data?.data || classRes.data || [];
      const subs = subjectRes.data?.data || subjectRes.data || [];
      const tchs = teacherRes.data?.data || teacherRes.data || [];
      const reqs = reqRes.data?.data || reqRes.data || [];
      const csm = csmRes.data?.data || [];
      const ps = psRes.data?.data || psRes.data || [];

      setClasses(cls);
      setSubjects(subs);
      setTeachers(tchs);
      setRequirements(reqs);
      setClassSubjects(csm);
      setPeriodStructures(ps);

      if (selectedClasses.length === 0) setSelectedClasses(cls.map(c => c._id));

      // Build periods grid
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

      // Build CSM grid
      const cg = {};
      csm.forEach(m => {
        const key = `${m.class?._id || m.class}_${m.subject?._id || m.subject}`;
        cg[key] = {
          _id: m._id,
          isActive: m.isActive,
          periodsPerWeek: m.periodsPerWeek || 0,
          requiresLab: m.requiresLab || false,
          allowDoublePeriod: m.allowDoublePeriod || false,
          requiredRoomType: m.requiredRoomType || ''
        };
      });
      setCsmGrid(cg);
    } catch (err) { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  // Tab-specific loaders
  const loadWorkload = async () => {
    try {
      const res = await api.get('/requirements/workload-summary');
      setWorkload(res.data?.data || []);
    } catch (err) { toast.error('Failed to load workload'); }
  };

  const loadValidation = async () => {
    try {
      const res = await api.get('/requirements/validation');
      setValidationData(res.data);
    } catch (err) { toast.error('Failed to load validation'); }
  };

  const loadEligibility = async () => {
    try {
      const res = await api.get('/can-teach/matrix');
      setEligibilityMatrix(res.data?.data || null);
    } catch (err) { toast.error('Failed to load eligibility'); }
  };

  const loadSuggestions = async () => {
    try {
      const res = await api.get('/requirements/balancing');
      setSuggestions(res.data?.data || []);
      setShowSuggestions(true);
    } catch (err) { toast.error('Failed to load suggestions'); }
  };

  useEffect(() => {
    if (activeTab === 'workload') loadWorkload();
    if (activeTab === 'validation') loadValidation();
    if (activeTab === 'eligibility') loadEligibility();
  }, [activeTab]);

  // Grid update handlers
  const updateCell = (classId, subjectId, field, value) => {
    const key = `${classId}_${subjectId}`;
    setGridData(prev => ({
      ...prev,
      [key]: { ...(prev[key] || { periodsPerWeek: 0, teacher: '', consecutivePreference: 'none' }), [field]: value }
    }));
    setDirty(true);
  };

  const toggleCSM = (classId, subjectId) => {
    const key = `${classId}_${subjectId}`;
    setCsmGrid(prev => ({
      ...prev,
      [key]: prev[key] ? { ...prev[key], isActive: !prev[key].isActive } : { isActive: true, periodsPerWeek: 0 }
    }));
    setCsmDirty(true);
  };

  // Save handlers
  const saveAll = async () => {
    setSaving(true);
    try {
      const reqs = [];
      Object.entries(gridData).forEach(([key, data]) => {
        if (data.periodsPerWeek > 0 && data.teacher) {
          const [classId, subjectId] = key.split('_');
          reqs.push({ class: classId, subject: subjectId, teacher: data.teacher, periodsPerWeek: Number(data.periodsPerWeek), consecutivePreference: data.consecutivePreference || 'none', allowDoublePeriod: data.allowDoublePeriod || false, preferredRoom: data.preferredRoom || undefined, studentGroup: data.studentGroup || undefined });
        }
      });
      await api.post('/requirements/bulk', { requirements: reqs });
      toast.success(`Saved ${reqs.length} requirements`);
      setDirty(false);
      loadAll();
    } catch (err) { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const saveCSM = async () => {
    setSaving(true);
    try {
      const mappings = [];
      Object.entries(csmGrid).forEach(([key, data]) => {
        const [classId, subjectId] = key.split('_');
        mappings.push({ class: classId, subject: subjectId, isActive: data.isActive !== false, periodsPerWeek: data.periodsPerWeek || 0, requiresLab: data.requiresLab || false, allowDoublePeriod: data.allowDoublePeriod || false, requiredRoomType: data.requiredRoomType || undefined });
      });
      await api.post('/requirements/class-subjects/bulk', { mappings });
      toast.success(`Saved ${mappings.length} subject mappings`);
      setCsmDirty(false);
      loadAll();
    } catch (err) { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const generateCSM = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/requirements/class-subjects/generate');
      toast.success(`Generated: ${res.data.created} new, ${res.data.existing} existed`);
      loadAll();
    } catch (err) { toast.error('Failed'); }
    finally { setGenerating(false); }
  };

  const handleClone = async () => {
    if (!cloneSource || cloneTargets.length === 0) return toast.error('Select source and target classes');
    try {
      await api.post('/requirements/clone', { sourceClass: cloneSource, targetClasses: cloneTargets });
      toast.success('Cloned successfully');
      setShowCloneModal(false);
      loadAll();
    } catch (err) { toast.error('Clone failed'); }
  };

  // Filters
  const filteredClasses = classes.filter(c => {
    if (!selectedClasses.includes(c._id)) return false;
    if (streamFilter && c.stream !== streamFilter) return false;
    return true;
  });
  const filteredSubjects = subjects.filter(s => {
    if (s.isActive === false) return false;
    if (subjectFilter && s._id !== subjectFilter) return false;
    return true;
  });
  const streams = [...new Set(classes.map(c => c.stream).filter(Boolean))];

  const getTotalAssigned = (classId) => filteredSubjects.reduce((sum, sub) => sum + (gridData[`${classId}_${sub._id}`]?.periodsPerWeek || 0), 0);
  const getCSMCount = (classId) => filteredSubjects.filter(sub => csmGrid[`${classId}_${sub._id}`]?.isActive).length;

  // Period structure insight for the insight panel
  const activeStructure = periodStructures.find(p => p.status === 'active');
  const structureSlots = activeStructure?.defaultDayTemplate || activeStructure?.timeslots || [];
  const structureStats = useMemo(() => computeStats(structureSlots), [structureSlots]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-primary-500" size={32} />
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles size={24} className="text-primary-400" />
            Requirements Studio
          </h1>
          <p className="page-subtitle">Subject mapping, period allocation, eligibility & validation</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === 'periods' && (
            <>
              <button onClick={loadSuggestions} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"><Lightbulb size={13} /> Suggestions</button>
              <button onClick={() => setShowCloneModal(true)} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"><Copy size={13} /> Clone</button>
              <button onClick={saveAll} disabled={!dirty || saving} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5">
                {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                {saving ? 'Saving...' : 'Save All'}
              </button>
            </>
          )}
          {activeTab === 'subjects' && (
            <>
              <button onClick={generateCSM} disabled={generating} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
                {generating ? <Loader2 className="animate-spin" size={13} /> : <Zap size={13} />} Auto-Generate
              </button>
              <button onClick={saveCSM} disabled={!csmDirty || saving} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5">
                {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                {saving ? 'Saving...' : 'Save Mappings'}
              </button>
            </>
          )}
          <button onClick={loadAll} className="btn-secondary p-2" title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* ─── Insight Strip ─── */}
      {activeStructure && (
        <div className="glass-card px-4 py-3 flex items-center gap-4 text-xs overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Clock size={14} className="text-primary-400" />
            <span className="font-medium text-slate-700 dark:text-dark-200">Period Info</span>
          </div>
          <div className="h-5 w-px bg-slate-200 dark:bg-dark-700 shrink-0" />
          <span className="text-slate-500 dark:text-dark-400 shrink-0">
            <span className="font-semibold text-primary-500">{structureStats.teachingPeriods}</span> periods/day
          </span>
          <span className="text-slate-500 dark:text-dark-400 shrink-0">
            <span className="font-semibold text-emerald-500">{structureStats.teachingMinutes}</span> min teaching
          </span>
          <span className="text-slate-500 dark:text-dark-400 shrink-0">
            <span className="font-semibold text-amber-500">{structureStats.breakCount}</span> breaks
          </span>
          <div className="h-5 w-px bg-slate-200 dark:bg-dark-700 shrink-0" />
          {/* Mini period labels */}
          <div className="flex gap-1 overflow-x-auto shrink-0">
            {structureSlots.map((slot, i) => (
              <span
                key={i}
                className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap ${slot.isSchedulable
                  ? 'bg-primary-500/10 text-primary-500'
                  : slot.type === 'lunch'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                  }`}
                title={`${slot.startTime}–${slot.endTime}`}
              >
                {slot.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-white dark:bg-dark-800 rounded-xl p-1 border border-slate-200 dark:border-dark-700 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-gradient-to-r ' + tab.accent + ' text-white shadow-md' : 'text-slate-500 dark:text-dark-400 hover:bg-slate-50 dark:hover:bg-dark-700'}`}>
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Filters ─── */}
      {['subjects', 'periods'].includes(activeTab) && (
        <div className="glass-card p-3 flex flex-wrap gap-3 items-end" style={{ overflow: 'visible' }}>
          <ClassPickerDropdown
            classes={classes}
            selectedClasses={selectedClasses}
            setSelectedClasses={setSelectedClasses}
          />
          {streams.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Stream</label>
              <select value={streamFilter} onChange={e => setStreamFilter(e.target.value)} className="select-field text-xs !py-1.5">
                <option value="">All Streams</option>
                {streams.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Subject</label>
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="select-field text-xs min-w-[140px] !py-1.5">
              <option value="">All Subjects</option>
              {subjects.filter(s => s.isActive !== false).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ═══ TAB: CLASS SUBJECTS ═══ */}
      {activeTab === 'subjects' && (
        <div className="glass-card overflow-hidden z-10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="table-header">
                  <th className="p-3 text-left text-xs sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 min-w-[150px]">Subject</th>
                  {filteredClasses.map(cls => (
                    <th key={cls._id} className="p-2 text-center text-xs min-w-[70px]">
                      <div className="text-[11px]">{cls.name}</div>
                      <div className="text-[9px] text-slate-400 font-normal">{getCSMCount(cls._id)} subj</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map(sub => (
                  <tr key={sub._id} className="table-row">
                    <td className="p-2.5 sticky left-0 bg-white dark:bg-dark-900 z-10 border-r border-slate-200 dark:border-dark-700">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color || '#6366f1' }} />
                        <div>
                          <p className="text-xs font-medium text-slate-800 dark:text-dark-100">{sub.name}</p>
                          <p className="text-[9px] text-slate-400">{sub.code} · {sub.type}</p>
                        </div>
                      </div>
                    </td>
                    {filteredClasses.map(cls => {
                      const key = `${cls._id}_${sub._id}`;
                      const cell = csmGrid[key];
                      const isActive = cell?.isActive;
                      return (
                        <td key={cls._id} className="p-1 text-center">
                          <button onClick={() => toggleCSM(cls._id, sub._id)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 ${isActive ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-dark-800 text-slate-300 dark:text-dark-600 hover:bg-slate-100 dark:hover:bg-dark-700'}`}>
                            {isActive ? <Check size={14} strokeWidth={3} /> : <X size={10} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredClasses.length === 0 && <div className="p-12 text-center text-slate-400 text-sm">Select classes to view</div>}
          <div className="px-4 py-2 border-t border-slate-200 dark:border-dark-700 text-[10px] text-slate-400 dark:text-dark-500 flex items-center gap-3">
            <span className="flex items-center gap-1"><CheckCircle size={10} className="text-emerald-500" /> Active</span>
            <span className="flex items-center gap-1"><XCircle size={10} className="text-slate-300" /> Not mapped</span>
            <span>Click to toggle. "Auto-Generate" creates mappings from existing requirements.</span>
          </div>
        </div>
      )}

      {/* ═══ TAB: WEEKLY PERIODS ═══ */}
      {activeTab === 'periods' && (
        <div className="glass-card overflow-hidden z-10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="table-header">
                  <th className="p-3 text-left text-xs sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 min-w-[150px]">Subject</th>
                  {filteredClasses.map(cls => (
                    <th key={cls._id} className="p-2 text-center text-xs min-w-[140px]">
                      <div>{cls.name}</div>
                      <div className="text-[9px] text-slate-400 font-normal mt-0.5">
                        {getTotalAssigned(cls._id)} / {structureStats.teachingPeriods * (activeStructure?.workingDays?.length || 6)} assigned
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map(sub => (
                  <tr key={sub._id} className="table-row">
                    <td className="p-2.5 sticky left-0 bg-white dark:bg-dark-900 z-10 border-r border-slate-200 dark:border-dark-700">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color || '#6366f1' }} />
                        <div>
                          <p className="text-xs font-medium text-slate-800 dark:text-dark-100">{sub.name}</p>
                          <p className="text-[9px] text-slate-400">{sub.code}</p>
                        </div>
                      </div>
                    </td>
                    {filteredClasses.map(cls => {
                      const key = `${cls._id}_${sub._id}`;
                      const cell = gridData[key] || {};
                      return (
                        <td key={cls._id} className="p-1.5 text-center">
                          <div className="space-y-1">
                            <div className="flex items-center gap-0.5">
                              <input type="number" min="0" max="15" value={cell.periodsPerWeek || ''}
                                onChange={e => updateCell(cls._id, sub._id, 'periodsPerWeek', parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="w-12 mx-auto text-center bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg px-1.5 py-1 text-xs focus:ring-2 focus:ring-primary-500/50 transition-all" />
                              {cell._id && (
                                <button onClick={() => {
                                  const req = requirements.find(r => r._id === cell._id);
                                  if (req) setWeeklyLoadReq({ ...req, _className: cls.name, _subjectName: sub.name });
                                }}
                                  className="p-0.5 rounded hover:bg-primary-500/10 transition-colors" title="Edit weekly load details">
                                  <Layers size={10} className="text-primary-400" />
                                </button>
                              )}
                            </div>
                            <select value={cell.teacher || ''} onChange={e => updateCell(cls._id, sub._id, 'teacher', e.target.value)}
                              className="w-full text-[9px] bg-transparent border border-slate-200 dark:border-dark-700 rounded px-1 py-0.5 focus:ring-1 focus:ring-primary-500/50">
                              <option value="">— teacher —</option>
                              {teachers.filter(t => t.status === 'active').map(t => (
                                <option key={t._id} value={t._id}>{t.shortName || t.name}</option>
                              ))}
                            </select>
                            <label className="flex items-center justify-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={cell.consecutivePreference === 'preferred' || cell.consecutivePreference === 'required'}
                                onChange={e => updateCell(cls._id, sub._id, 'consecutivePreference', e.target.checked ? 'preferred' : 'none')}
                                className="w-2.5 h-2.5 rounded text-primary-600" />
                              <span className="text-[8px] text-slate-400">consec.</span>
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
          {filteredClasses.length === 0 && <div className="p-12 text-center text-slate-400 text-sm">Select classes to view</div>}
        </div>
      )}

      {/* ═══ TAB: ELIGIBILITY ═══ */}
      {activeTab === 'eligibility' && (
        <div className="glass-card overflow-hidden">
          {eligibilityMatrix ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="table-header">
                      <th className="px-3 py-2.5 text-left text-xs sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 w-36">Teacher</th>
                      {eligibilityMatrix.subjects.map(s => (
                        <th key={s._id} className="px-1.5 py-2.5 text-center text-[10px] font-semibold" title={s.name}>
                          <span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ backgroundColor: s.color }} />
                          {s.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eligibilityMatrix.teachers.map(t => (
                      <tr key={t._id} className="table-row">
                        <td className="px-3 py-2 text-xs font-medium text-slate-800 dark:text-dark-100 sticky left-0 bg-white dark:bg-dark-900 z-10">
                          <div className="truncate w-32" title={t.name}>{t.shortName || t.name}</div>
                          <div className="text-[9px] text-slate-400">{t.department}</div>
                        </td>
                        {eligibilityMatrix.subjects.map(s => {
                          const key = `${t._id}_${s._id}`;
                          const cell = eligibilityMatrix.matrix[key];
                          if (!cell) return <td key={s._id} className="px-1 py-2 text-center"><span className="text-slate-200 dark:text-dark-700 text-[9px]">—</span></td>;
                          const colors = { primary: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', secondary: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', substitute_only: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', replacement_only: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' };
                          return (
                            <td key={s._id} className="px-1 py-2 text-center">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold ${colors[cell.eligibilityType] || colors.primary}`} title={`${cell.eligibilityType} (P${cell.priority})`}>
                                {cell.priority}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 dark:border-dark-700 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-500/20" /> Primary</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-500/20" /> Secondary</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-500/20" /> Sub Only</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-500/20" /> Replace Only</span>
                <span>Total: {eligibilityMatrix.totalMappings} mappings</span>
              </div>
            </>
          ) : (
            <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-primary-500 mb-2" size={20} /><p className="text-sm text-slate-400">Loading eligibility matrix...</p></div>
          )}
        </div>
      )}

      {/* ═══ TAB: WORKLOAD ═══ */}
      {activeTab === 'workload' && (
        <div className="space-y-3">
          {workload.length > 0 ? workload.map(w => (
            <div key={w.teacher._id} className="glass-card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-dark-100 truncate">{w.teacher.name}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${w.status === 'overloaded' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : w.status === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                    {w.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{w.teacher.department} · {w.classCount} classes · {w.subjectCount} subjects</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {Object.entries(w.classBreakdown || {}).map(([cls, periods]) => (
                    <span key={cls} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-dark-400">{cls}: {periods}p</span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0 w-24">
                <p className={`text-lg font-bold ${w.status === 'overloaded' ? 'text-red-500' : w.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {w.totalPeriods}/{w.maxPeriodsPerWeek}
                </p>
                <div className="w-20 h-2 bg-slate-200 dark:bg-dark-700 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${w.status === 'overloaded' ? 'bg-red-500' : w.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, w.utilizationPercent)}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{w.utilizationPercent}%</p>
              </div>
            </div>
          )) : (
            <div className="glass-card p-12 text-center"><Loader2 className="animate-spin mx-auto text-primary-500 mb-2" size={20} /><p className="text-sm text-slate-400">Loading workload...</p></div>
          )}
        </div>
      )}

      {/* ═══ TAB: VALIDATION ═══ */}
      {activeTab === 'validation' && (
        <div className="space-y-4">
          {validationData ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`glass-card p-4 text-center ${validationData.ready ? 'ring-2 ring-emerald-500/30' : 'ring-2 ring-red-500/30'}`}>
                  <div className={`text-2xl font-bold ${validationData.ready ? 'text-emerald-500' : 'text-red-500'}`}>
                    {validationData.ready ? '✅' : '❌'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{validationData.ready ? 'Ready to Generate' : 'Issues Found'}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{validationData.summary?.errors || 0}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">{validationData.summary?.warnings || 0}</p>
                  <p className="text-xs text-slate-500">Warnings</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-2xl font-bold text-blue-500">{validationData.summary?.info || 0}</p>
                  <p className="text-xs text-slate-500">Info</p>
                </div>
              </div>

              <div className="space-y-2">
                {(validationData.issues || []).map((issue, i) => (
                  <div key={i} className={`glass-card p-3 flex items-start gap-3 border-l-4 ${issue.severity === 'error' ? 'border-l-red-500' : issue.severity === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
                    {issue.severity === 'error' ? <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" /> :
                      issue.severity === 'warning' ? <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" /> :
                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-sm text-slate-700 dark:text-dark-200">{issue.message}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{issue.type}</p>
                    </div>
                  </div>
                ))}
                {(validationData.issues || []).length === 0 && (
                  <div className="glass-card p-8 text-center">
                    <CheckCircle className="mx-auto text-emerald-500 mb-2" size={32} />
                    <p className="text-sm text-slate-500">All checks passed! Ready for timetable generation.</p>
                  </div>
                )}
              </div>
              <button onClick={loadValidation} className="btn-secondary text-xs flex items-center gap-1.5 mx-auto">
                <RefreshCw size={12} /> Re-run Validation
              </button>
            </>
          ) : (
            <div className="glass-card p-12 text-center"><Loader2 className="animate-spin mx-auto text-primary-500 mb-2" size={20} /><p className="text-sm text-slate-400">Running validation checks...</p></div>
          )}
        </div>
      )}

      {/* ─── Floating save buttons ─── */}
      {(dirty && activeTab === 'periods') && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <button onClick={saveAll} disabled={saving} className="btn-primary shadow-2xl shadow-primary-500/30 flex items-center gap-2 px-5 py-2.5 text-sm">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      )}
      {(csmDirty && activeTab === 'subjects') && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <button onClick={saveCSM} disabled={saving} className="btn-primary shadow-2xl shadow-primary-500/30 flex items-center gap-2 px-5 py-2.5 text-sm">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Subject Mappings'}
          </button>
        </div>
      )}

      {/* ─── Suggestions Modal ─── */}
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

      {/* ─── Clone Modal ─── */}
      <Modal isOpen={showCloneModal} onClose={() => setShowCloneModal(false)} title="Clone Period Configuration">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Source Class</label>
            <select value={cloneSource} onChange={e => setCloneSource(e.target.value)} className="select-field text-sm">
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
                    onChange={e => e.target.checked ? setCloneTargets(p => [...p, c._id]) : setCloneTargets(p => p.filter(id => id !== c._id))}
                    className="w-4 h-4 rounded text-primary-600" />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCloneModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleClone} className="btn-primary flex items-center gap-2"><Copy size={15} /> Clone</button>
          </div>
        </div>
      </Modal>

      {/* Weekly Load Edit Modal */}
      <WeeklyLoadModal
        isOpen={!!weeklyLoadReq}
        onClose={() => setWeeklyLoadReq(null)}
        requirement={weeklyLoadReq}
        className={weeklyLoadReq?._className || ''}
        subjectName={weeklyLoadReq?._subjectName || ''}
        onSaved={() => {
          // Refresh requirements data
          api.get('/requirements').then(r => {
            const reqs = r.data.data || r.data || [];
            setRequirements(reqs);
          }).catch(() => { });
        }}
      />
    </div>
  );
}
