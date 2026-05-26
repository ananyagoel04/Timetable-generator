import { useState, useEffect } from 'react';
import { Plus, ArrowRight, CheckCircle, AlertTriangle, Users, Loader2, BarChart3, Zap } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function TeacherReplacements() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [oldTeacher, setOldTeacher] = useState(null);
  const [affected, setAffected] = useState([]);
  const [selected, setSelected] = useState([]);
  const [newTeacher, setNewTeacher] = useState('');
  const [replType, setReplType] = useState('permanent');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [suggestions, setSuggestions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/teachers').then(r => setTeachers(r.data || []));
    api.get('/classes').then(r => setClasses(r.data || []));
    api.get('/subjects').then(r => setSubjects(r.data || []));
    api.get('/rules/requirements').then(r => setRequirements(r.data || []));
  }, []);

  const startReplacement = (teacher) => {
    setOldTeacher(teacher);
    const teacherReqs = requirements.filter(r => (r.teacher?._id || r.teacher) === teacher._id);
    setAffected(teacherReqs);
    setSelected(teacherReqs.map(r => r._id));
    setStep(1);
    setModalOpen(true);
  };

  const findSuggestions = () => {
    const selectedReqs = affected.filter(r => selected.includes(r._id));
    const neededSubjects = [...new Set(selectedReqs.map(r => r.subject?._id || r.subject))];
    const capable = teachers.filter(t => {
      if (t._id === oldTeacher._id) return false;
      const caps = t.capabilities?.map(c => c.subject?._id || c.subject) || [];
      return neededSubjects.some(s => caps.includes(s));
    }).map(t => {
      const caps = t.capabilities?.map(c => c.subject?._id || c.subject) || [];
      const matchCount = neededSubjects.filter(s => caps.includes(s)).length;
      const currentLoad = requirements.filter(r => (r.teacher?._id || r.teacher) === t._id)
        .reduce((sum, r) => sum + r.periodsPerWeek, 0);
      return { ...t, matchCount, currentLoad, matchPercent: Math.round(matchCount / neededSubjects.length * 100) };
    }).sort((a, b) => b.matchPercent - a.matchPercent || a.currentLoad - b.currentLoad);
    setSuggestions(capable);
    setPreview(null);
    setStep(2);
  };

  const fetchPreview = async (teacherId) => {
    setNewTeacher(teacherId);
    try {
      const r = await api.post(`/teachers/${oldTeacher._id}/replace/preview`, {
        assignmentIds: selected, newTeacherId: teacherId, type: replType
      });
      setPreview(r.data);
    } catch { setPreview(null); }
    setStep(3);
  };

  const applyReplacement = async () => {
    setApplying(true);
    try {
      const r = await api.post(`/teachers/${oldTeacher._id}/replace`, {
        assignmentIds: selected,
        newTeacherId: newTeacher,
        type: replType,
        effectiveDate,
        reason: `Replaced ${oldTeacher.name} with ${teachers.find(t => t._id === newTeacher)?.name}`
      });
      setResult(r.data);
      setStep(4);
      toast.success(`Replacement applied: ${r.data?.requirementsUpdated || 0} assignments, ${r.data?.blocksUpdated || 0} blocks updated`);
    } catch (err) { toast.error(err.response?.data?.error || 'Replacement failed'); }
    setApplying(false);
  };

  const getSubjectName = (id) => subjects.find(s => s._id === id)?.name || '?';
  const getClassName = (id) => classes.find(c => c._id === id)?.name || '?';

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="page-title">Teacher Replacements</h1><p className="page-subtitle">Replace teachers and reassign workload</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teachers.map(t => {
          const load = requirements.filter(r => (r.teacher?._id || r.teacher) === t._id);
          const totalPeriods = load.reduce((s, r) => s + r.periodsPerWeek, 0);
          return (
            <div key={t._id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-900 dark:text-dark-50 font-bold" style={{ backgroundColor: t.color || '#6366f1' }}>{t.name.charAt(0)}</div>
                  <div><p className="font-medium text-slate-900 dark:text-dark-50 text-sm">{t.name}</p><p className="text-[10px] text-slate-400 dark:text-dark-500">{t.department}</p></div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-primary-500/20 text-primary-400">{totalPeriods}/wk</span>
                <span className="badge bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 border border-slate-400 dark:border-dark-600">{load.length} classes</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {t.capabilities?.slice(0, 4).map((c, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 bg-white dark:bg-dark-800 rounded text-slate-500 dark:text-dark-400">{c.subject?.name || '?'}</span>
                ))}
                {t.capabilities?.length > 4 && <span className="text-[9px] text-slate-400 dark:text-dark-500">+{t.capabilities.length - 4}</span>}
              </div>
              <button onClick={() => startReplacement(t)} className="w-full btn-secondary text-xs py-1.5 flex items-center justify-center gap-1.5">
                <Users size={13} /> Replace
              </button>
            </div>
          );
        })}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Replace ${oldTeacher?.name || ''}`} size="lg">
        {step === 1 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-dark-50">Step 1: Select assignments to transfer</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {affected.map(r => (
                <label key={r._id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.includes(r._id) ? 'bg-primary-500/10 border-primary-500/30' : 'bg-white/40 dark:bg-dark-800/40 border-slate-300/50 dark:border-dark-700/50'}`}>
                  <input type="checkbox" checked={selected.includes(r._id)} onChange={e => e.target.checked ? setSelected(p => [...p, r._id]) : setSelected(p => p.filter(x => x !== r._id))} className="w-4 h-4 rounded" />
                  <div><span className="text-sm text-slate-900 dark:text-dark-50">{r.subject?.name || '?'}</span><span className="text-slate-400 dark:text-dark-500 mx-1.5">·</span><span className="text-xs text-slate-500 dark:text-dark-400">{r.class?.name || '?'}</span></div>
                  <span className="ml-auto badge bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 text-[10px]">{r.periodsPerWeek}/wk</span>
                </label>
              ))}
            </div>
            {affected.length === 0 && <p className="text-slate-500 dark:text-dark-400 text-sm text-center py-4">No assignments found for this teacher.</p>}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Type</label><select value={replType} onChange={e => setReplType(e.target.value)} className="select-field"><option value="permanent">Permanent</option><option value="temporary">Temporary</option></select></div>
              <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Effective Date</label><input value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} type="date" className="input-field" /></div>
            </div>
            <div className="flex justify-end gap-3"><button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button onClick={findSuggestions} disabled={selected.length === 0} className="btn-primary">Find Replacements →</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-dark-50">Step 2: Choose replacement teacher</h4>
            <p className="text-xs text-slate-500 dark:text-dark-400">Ranked by subject match and current workload</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {suggestions.length === 0 ? <p className="text-slate-500 dark:text-dark-400 text-center py-4">No capable teachers found.</p> : suggestions.map(s => (
                <label key={s._id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${newTeacher === s._id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/40 dark:bg-dark-800/40 border-slate-300/50 dark:border-dark-700/50'}`}>
                  <input type="radio" name="replacement" checked={newTeacher === s._id} onChange={() => setNewTeacher(s._id)} className="w-4 h-4" />
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-900 dark:text-dark-50 text-xs font-bold" style={{ backgroundColor: s.color || '#6366f1' }}>{s.name.charAt(0)}</div>
                  <div className="flex-1"><p className="text-sm text-slate-900 dark:text-dark-50">{s.name}</p><p className="text-[10px] text-slate-400 dark:text-dark-500">{s.department}</p></div>
                  <div className="text-right">
                    <span className={`badge text-[10px] ${s.matchPercent === 100 ? 'badge-success' : s.matchPercent >= 50 ? 'badge-warning' : 'badge-danger'}`}>{s.matchPercent}% match</span>
                    <p className="text-[10px] text-slate-400 dark:text-dark-500 mt-0.5">{s.currentLoad}/wk load</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between gap-3"><button onClick={() => setStep(1)} className="btn-secondary">← Back</button><button onClick={() => fetchPreview(newTeacher)} disabled={!newTeacher} className="btn-primary">Preview →</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-dark-50">Step 3: Impact Preview & Apply</h4>
            <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-red-400">{oldTeacher?.name}</span>
                <ArrowRight size={14} className="text-slate-400 dark:text-dark-500" />
                <span className="text-emerald-400">{teachers.find(t => t._id === newTeacher)?.name}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-dark-400">
                <p>{selected.length} assignments · {replType} · Effective {effectiveDate}</p>
              </div>
              {affected.filter(r => selected.includes(r._id)).map(r => (
                <div key={r._id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-dark-300 pl-2 border-l-2 border-emerald-500/30">
                  <span>{r.subject?.name}</span><span className="text-slate-400 dark:text-dark-600">·</span><span>{r.class?.name}</span><span className="text-slate-400 dark:text-dark-600">·</span><span>{r.periodsPerWeek}/wk</span>
                </div>
              ))}
            </div>

            {/* Preview Data */}
            {preview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-blue-400">{preview.workloadAfter || 0}</p>
                  <p className="text-[9px] text-slate-400 dark:text-dark-500">New Workload/wk</p>
                </div>
                <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-purple-400">{preview.affectedBlocks || 0}</p>
                  <p className="text-[9px] text-slate-400 dark:text-dark-500">Blocks Changed</p>
                </div>
                <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                  <p className={`text-lg font-bold ${preview.potentialConflicts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{preview.potentialConflicts || 0}</p>
                  <p className="text-[9px] text-slate-400 dark:text-dark-500">Conflicts</p>
                </div>
                <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                  <p className={`text-lg font-bold ${preview.allCapable ? 'text-emerald-400' : 'text-amber-400'}`}>{preview.allCapable ? '✓' : '⚠'}</p>
                  <p className="text-[9px] text-slate-400 dark:text-dark-500">Capability</p>
                </div>
              </div>
            )}

            {preview?.potentialConflicts > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{preview.potentialConflicts} scheduling conflict(s) will be created. These can be resolved later in the Conflict Center.</p>
              </div>
            )}
            {preview?.overloaded && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-400">New teacher will be overloaded ({preview.workloadAfter} periods/week). Consider distributing across teachers.</p>
              </div>
            )}

            <div className="flex justify-between gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
              <button onClick={applyReplacement} disabled={applying} className="btn-primary flex items-center gap-2">
                {applying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {applying ? 'Applying...' : 'Apply Replacement'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
              <CheckCircle size={32} className="text-white" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-dark-50">Replacement Applied Successfully</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto">
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-emerald-400">{result.requirementsUpdated}</p>
                <p className="text-[9px] text-slate-400 dark:text-dark-500">Assignments</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-blue-400">{result.blocksUpdated}</p>
                <p className="text-[9px] text-slate-400 dark:text-dark-500">Blocks</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                <p className={`text-lg font-bold ${result.conflictsCreated > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{result.conflictsCreated}</p>
                <p className="text-[9px] text-slate-400 dark:text-dark-500">Conflicts</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-purple-400">{result.substitutionsCreated}</p>
                <p className="text-[9px] text-slate-400 dark:text-dark-500">Substitutions</p>
              </div>
            </div>
            {result.conflictsCreated > 0 && (
              <a href="/conflicts" className="text-xs text-red-400 hover:text-red-300 transition-colors">→ Review conflicts in Conflict Center</a>
            )}
            <div className="pt-2">
              <button onClick={() => { setModalOpen(false); window.location.reload(); }} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
