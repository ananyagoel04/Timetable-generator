import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Users, Plus, Trash2, Save, RefreshCw, Loader2, Filter, Grid3X3, List, AlertTriangle, CheckCircle, Upload, X, ChevronDown, Star, Shield, UserCheck } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';

const ELIGIBILITY_TYPES = [
  { value: 'primary', label: 'Primary', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: '🟢' },
  { value: 'secondary', label: 'Secondary', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: '🔵' },
  { value: 'substitute_only', label: 'Substitute Only', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', icon: '🟡' },
  { value: 'replacement_only', label: 'Replacement Only', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400', icon: '🟣' }
];

export default function CanTeachManager() {
  const [viewMode, setViewMode] = useState('matrix'); // matrix | list
  const [matrixData, setMatrixData] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterEligibility, setFilterEligibility] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    teacher: '', subject: '', eligibilityType: 'primary', priority: 8,
    eligibleClasses: [], eligibleStreams: [], maxPeriodsPerWeek: '', maxPeriodsPerDay: '', notes: ''
  });
  const [addSaving, setAddSaving] = useState(false);

  // Bulk assign modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTeachers, setBulkTeachers] = useState([]);
  const [bulkSubjects, setBulkSubjects] = useState([]);
  const [bulkEligibility, setBulkEligibility] = useState('primary');
  const [bulkPriority, setBulkPriority] = useState(5);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [teachersRes, subjectsRes, classesRes, matrixRes] = await Promise.all([
        api.get('/teachers'),
        api.get('/subjects'),
        api.get('/classes'),
        api.get('/can-teach/matrix')
      ]);
      setTeachers(teachersRes.data?.data || teachersRes.data || []);
      setSubjects(subjectsRes.data?.data || subjectsRes.data || []);
      setClasses(classesRes.data?.data || classesRes.data || []);
      setMatrixData(matrixRes.data?.data || null);
      
      const mappingsRes = await api.get('/can-teach');
      setMappings(mappingsRes.data?.data || []);
    } catch (err) { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const syncCapabilities = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/can-teach/sync-capabilities');
      toast.success(`Synced: ${res.data.created} created, ${res.data.existing} existed`);
      loadAll();
    } catch (err) { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  const addMapping = async () => {
    if (!addForm.teacher || !addForm.subject) return toast.error('Teacher and subject required');
    setAddSaving(true);
    try {
      await api.post('/can-teach', {
        ...addForm,
        maxPeriodsPerWeek: addForm.maxPeriodsPerWeek ? parseInt(addForm.maxPeriodsPerWeek) : undefined,
        maxPeriodsPerDay: addForm.maxPeriodsPerDay ? parseInt(addForm.maxPeriodsPerDay) : undefined
      });
      toast.success('Mapping added');
      setShowAddModal(false);
      setAddForm({
        teacher: '', subject: '', eligibilityType: 'primary', priority: 8,
        eligibleClasses: [], eligibleStreams: [], maxPeriodsPerWeek: '', maxPeriodsPerDay: '', notes: ''
      });
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setAddSaving(false); }
  };

  const deleteMapping = async (id) => {
    if (!confirm('Delete this mapping?')) return;
    try {
      await api.delete(`/can-teach/${id}`);
      toast.success('Deleted');
      loadAll();
    } catch (err) { toast.error('Failed'); }
  };

  const updateMapping = async (id, updates) => {
    try {
      await api.put(`/can-teach/${id}`, updates);
      toast.success('Updated');
      loadAll();
    } catch (err) { toast.error('Failed'); }
  };

  const bulkAssign = async () => {
    if (bulkTeachers.length === 0 || bulkSubjects.length === 0) return toast.error('Select teachers and subjects');
    setBulkSaving(true);
    try {
      const mappingsToCreate = [];
      for (const t of bulkTeachers) {
        for (const s of bulkSubjects) {
          mappingsToCreate.push({ teacher: t, subject: s, eligibilityType: bulkEligibility, priority: bulkPriority });
        }
      }
      const res = await api.post('/can-teach/bulk', { mappings: mappingsToCreate });
      toast.success(`Bulk: ${res.data.created} created, ${res.data.updated} updated`);
      setShowBulkModal(false);
      setBulkTeachers([]);
      setBulkSubjects([]);
      loadAll();
    } catch (err) { toast.error('Bulk assign failed'); }
    finally { setBulkSaving(false); }
  };

  // Filtered mappings
  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      if (filterTeacher && m.teacher?._id !== filterTeacher) return false;
      if (filterSubject && m.subject?._id !== filterSubject) return false;
      if (filterEligibility && m.eligibilityType !== filterEligibility) return false;
      if (filterDept && m.teacher?.department !== filterDept) return false;
      return true;
    });
  }, [mappings, filterTeacher, filterSubject, filterEligibility, filterDept]);

  // Unique departments
  const departments = [...new Set(teachers.map(t => t.department).filter(Boolean))].sort();

  // Stats
  const totalMappings = mappings.length;
  const primaryCount = mappings.filter(m => m.eligibilityType === 'primary').length;
  const secondaryCount = mappings.filter(m => m.eligibilityType === 'secondary').length;
  const substituteCount = mappings.filter(m => m.eligibilityType === 'substitute_only').length;
  const replacementCount = mappings.filter(m => m.eligibilityType === 'replacement_only').length;
  const teachersWithMappings = [...new Set(mappings.map(m => m.teacher?._id))].length;

  const getTypeConfig = (type) => ELIGIBILITY_TYPES.find(r => r.value === type) || ELIGIBILITY_TYPES[0];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Teacher Eligibility</h1>
          <p className="page-subtitle">Configure which teachers can teach which subjects, with priority and eligibility settings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={syncCapabilities} disabled={syncing} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            {syncing ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
            Sync from Capabilities
          </button>
          <button onClick={() => setShowBulkModal(true)} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <Grid3X3 size={13} /> Bulk Assign
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5">
            <Plus size={13} /> Add Mapping
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-dark-400">Total Mappings</p>
          <p className="text-lg font-bold text-slate-900 dark:text-dark-50">{totalMappings}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Primary</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{primaryCount}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-blue-600 dark:text-blue-400">Secondary</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{secondaryCount}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-amber-600 dark:text-amber-400">Substitute</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{substituteCount}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-purple-600 dark:text-purple-400">Replacement</p>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{replacementCount}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-purple-600 dark:text-purple-400">Teachers Mapped</p>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{teachersWithMappings}/{teachers.filter(t => t.status === 'active').length}</p>
        </div>
      </div>

      {/* View toggle + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white dark:bg-dark-800 rounded-xl p-1 border border-slate-300 dark:border-dark-700">
          {[{ v: 'matrix', icon: Grid3X3, label: 'Matrix' }, { v: 'list', icon: List, label: 'List' }].map(({ v, icon: Icon, label }) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${viewMode === v ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 dark:text-dark-400'}`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="select-field w-36 text-xs !py-1.5">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={filterEligibility} onChange={e => setFilterEligibility(e.target.value)} className="select-field w-40 text-xs !py-1.5">
          <option value="">All Types</option>
          {ELIGIBILITY_TYPES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
        </select>

        <button onClick={loadAll} className="btn-secondary p-1.5" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Empty State */}
      {!loading && totalMappings === 0 && (
        <div className="glass-card p-8 text-center">
          <UserCheck className="mx-auto text-slate-300 dark:text-dark-600 mb-3" size={48} />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-dark-200 mb-2">No Eligibility Mappings</h3>
          <p className="text-sm text-slate-500 dark:text-dark-400 mb-4">
            Click "Sync from Capabilities" to auto-generate mappings from teacher capabilities,
            or use "Add Mapping" to create them manually.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={syncCapabilities} disabled={syncing} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
              {syncing ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              Sync from Capabilities
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
              <Plus size={14} /> Add Manually
            </button>
          </div>
        </div>
      )}

      {/* MATRIX VIEW */}
      {viewMode === 'matrix' && matrixData && totalMappings > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2.5 text-left text-xs sticky left-0 bg-slate-100 dark:bg-dark-800 z-10 w-40">Teacher</th>
                  {matrixData.subjects.map(s => (
                    <th key={s._id} className="px-2 py-2.5 text-center text-[10px] font-semibold" title={s.name}>
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.color }} />
                      {s.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.teachers
                  .filter(t => !filterDept || t.department === filterDept)
                  .map(t => (
                  <tr key={t._id} className="table-row">
                    <td className="px-3 py-2 text-xs font-medium text-slate-800 dark:text-dark-100 sticky left-0 bg-white dark:bg-dark-900 z-10">
                      <div className="truncate w-36" title={t.name}>{t.shortName || t.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-dark-500">{t.department || ''}</div>
                    </td>
                    {matrixData.subjects.map(s => {
                      const key = `${t._id}_${s._id}`;
                      const cell = matrixData.matrix[key];
                      if (!cell) return (
                        <td key={s._id} className="px-1 py-2 text-center">
                          <span className="text-slate-200 dark:text-dark-700 text-[10px]">—</span>
                        </td>
                      );
                      const rc = getTypeConfig(cell.eligibilityType);
                      return (
                        <td key={s._id} className="px-1 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[9px] font-bold ${rc.color}`} title={`${rc.label} (P${cell.priority})`}>
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
          <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 dark:border-dark-700 text-[10px] text-slate-500 dark:text-dark-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-500/20" /> Primary</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-500/20" /> Secondary</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-500/20" /> Substitute Only</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-500/20" /> Replacement Only</span>
            <span>Numbers = priority (1–10)</span>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && totalMappings > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2.5 text-left text-xs">Teacher</th>
                  <th className="px-4 py-2.5 text-left text-xs">Subject</th>
                  <th className="px-4 py-2.5 text-center text-xs">Eligibility</th>
                  <th className="px-4 py-2.5 text-center text-xs">Priority</th>
                  <th className="px-4 py-2.5 text-left text-xs">Eligible Classes</th>
                  <th className="px-4 py-2.5 text-left text-xs">Streams</th>
                  <th className="px-4 py-2.5 text-center text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8"><Loader2 className="animate-spin mx-auto text-primary-500" size={20} /></td></tr>
                ) : filteredMappings.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400 dark:text-dark-500 text-sm">No mappings found. Use "Sync from Capabilities" or "Add Mapping".</td></tr>
                ) : filteredMappings.map(m => {
                  const rc = getTypeConfig(m.eligibilityType);
                  return (
                    <tr key={m._id} className="table-row">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-slate-800 dark:text-dark-100">{m.teacher?.name || '—'}</p>
                        <p className="text-[10px] text-slate-400 dark:text-dark-500">{m.teacher?.department || ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.subject?.color || '#6366f1' }} />
                          <span className="text-sm text-slate-700 dark:text-dark-200">{m.subject?.name || '—'}</span>
                          <span className="text-[10px] text-slate-400 dark:text-dark-500">({m.subject?.code})</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <select value={m.eligibilityType} onChange={e => updateMapping(m._id, { eligibilityType: e.target.value })}
                          className={`text-xs px-2 py-1 rounded-lg font-medium border-0 cursor-pointer ${rc.color}`}>
                          {ELIGIBILITY_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star key={i} size={10}
                              className={`cursor-pointer transition-colors ${i < Math.ceil(m.priority / 2) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-dark-600'}`}
                              onClick={() => updateMapping(m._id, { priority: (i + 1) * 2 })} />
                          ))}
                          <span className="text-[10px] text-slate-400 ml-1">{m.priority}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {m.eligibleClasses?.length > 0
                          ? <span className="text-[10px] text-slate-500 dark:text-dark-400">{m.eligibleClasses.length} classes</span>
                          : <span className="text-[10px] text-emerald-500">All classes</span>
                        }
                      </td>
                      <td className="px-4 py-2.5">
                        {m.eligibleStreams?.length > 0
                          ? <div className="flex gap-1">{m.eligibleStreams.map(s => <span key={s} className="badge-purple text-[9px]">{s}</span>)}</div>
                          : <span className="text-[10px] text-emerald-500">All</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => deleteMapping(m._id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-200 dark:border-dark-700 text-xs text-slate-400 dark:text-dark-500">
            Showing {filteredMappings.length} of {totalMappings} mappings
          </div>
        </div>
      )}

      {/* ADD MAPPING MODAL */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Eligibility Mapping" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Teacher *</label>
            <select value={addForm.teacher} onChange={e => setAddForm({ ...addForm, teacher: e.target.value })} className="select-field text-sm">
              <option value="">Select teacher</option>
              {teachers.filter(t => t.status === 'active').map(t => <option key={t._id} value={t._id}>{t.name} — {t.department || ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Subject *</label>
            <select value={addForm.subject} onChange={e => setAddForm({ ...addForm, subject: e.target.value })} className="select-field text-sm">
              <option value="">Select subject</option>
              {subjects.filter(s => s.isActive !== false).map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Eligibility Type</label>
              <select value={addForm.eligibilityType} onChange={e => setAddForm({ ...addForm, eligibilityType: e.target.value })} className="select-field text-sm">
                {ELIGIBILITY_TYPES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Priority (1–10)</label>
              <input type="number" min={1} max={10} value={addForm.priority} onChange={e => setAddForm({ ...addForm, priority: parseInt(e.target.value) || 5 })} className="input-field text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Eligible Classes (leave empty for all)</label>
            <div className="border border-slate-200 dark:border-dark-700 rounded-xl max-h-32 overflow-y-auto p-2 space-y-1">
              {classes.map(c => (
                <label key={c._id} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-dark-800 cursor-pointer text-xs">
                  <input type="checkbox" checked={addForm.eligibleClasses.includes(c._id)}
                    onChange={e => setAddForm(prev => ({
                      ...prev,
                      eligibleClasses: e.target.checked ? [...prev.eligibleClasses, c._id] : prev.eligibleClasses.filter(id => id !== c._id)
                    }))}
                    className="rounded border-slate-300 text-primary-500" />
                  <span className="text-slate-700 dark:text-dark-200">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Max Periods/Week</label>
              <input type="number" min={0} value={addForm.maxPeriodsPerWeek} onChange={e => setAddForm({ ...addForm, maxPeriodsPerWeek: e.target.value })} className="input-field text-sm" placeholder="No limit" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Max Periods/Day</label>
              <input type="number" min={0} value={addForm.maxPeriodsPerDay} onChange={e => setAddForm({ ...addForm, maxPeriodsPerDay: e.target.value })} className="input-field text-sm" placeholder="No limit" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Notes</label>
            <input value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} className="input-field text-sm" placeholder="Optional notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAddModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={addMapping} disabled={addSaving} className="btn-primary text-sm flex items-center gap-2">
              {addSaving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add Mapping
            </button>
          </div>
        </div>
      </Modal>

      {/* BULK ASSIGN MODAL */}
      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title="Bulk Assign Eligibility" size="lg">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 text-xs text-blue-700 dark:text-blue-400">
            Select multiple teachers and subjects. A mapping will be created for each teacher-subject combination.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Teachers ({bulkTeachers.length} selected)</label>
              <div className="border border-slate-200 dark:border-dark-700 rounded-xl max-h-40 overflow-y-auto p-2 space-y-1">
                {teachers.filter(t => t.status === 'active').map(t => (
                  <label key={t._id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-dark-800 cursor-pointer text-xs">
                    <input type="checkbox" checked={bulkTeachers.includes(t._id)}
                      onChange={e => setBulkTeachers(prev => e.target.checked ? [...prev, t._id] : prev.filter(id => id !== t._id))}
                      className="rounded border-slate-300 text-primary-500" />
                    <span className="text-slate-700 dark:text-dark-200">{t.name}</span>
                    <span className="text-[10px] text-slate-400">{t.department}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Subjects ({bulkSubjects.length} selected)</label>
              <div className="border border-slate-200 dark:border-dark-700 rounded-xl max-h-40 overflow-y-auto p-2 space-y-1">
                {subjects.filter(s => s.isActive !== false).map(s => (
                  <label key={s._id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-dark-800 cursor-pointer text-xs">
                    <input type="checkbox" checked={bulkSubjects.includes(s._id)}
                      onChange={e => setBulkSubjects(prev => e.target.checked ? [...prev, s._id] : prev.filter(id => id !== s._id))}
                      className="rounded border-slate-300 text-primary-500" />
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-slate-700 dark:text-dark-200">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Eligibility Type</label>
              <select value={bulkEligibility} onChange={e => setBulkEligibility(e.target.value)} className="select-field text-sm">
                {ELIGIBILITY_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Priority</label>
              <input type="number" min={1} max={10} value={bulkPriority} onChange={e => setBulkPriority(parseInt(e.target.value) || 5)} className="input-field text-sm" />
            </div>
          </div>
          {bulkTeachers.length > 0 && bulkSubjects.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-dark-400">
              Will create <strong className="text-primary-600">{bulkTeachers.length * bulkSubjects.length}</strong> mappings
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowBulkModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={bulkAssign} disabled={bulkSaving} className="btn-primary text-sm flex items-center gap-2">
              {bulkSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Assign All
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
