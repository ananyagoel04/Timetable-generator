import { useState, useEffect } from 'react';
import { Plus, ArrowRight, CheckCircle, AlertTriangle, Users } from 'lucide-react';
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
    setStep(2);
  };

  const applyReplacement = async () => {
    try {
      toast.success('Replacement applied (preview mode)');
      setModalOpen(false);
    } catch (err) { toast.error(err.message); }
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
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: t.color || '#6366f1' }}>{t.name.charAt(0)}</div>
                  <div><p className="font-medium text-white text-sm">{t.name}</p><p className="text-[10px] text-dark-500">{t.department}</p></div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-primary-500/20 text-primary-400">{totalPeriods}/wk</span>
                <span className="badge bg-dark-700 text-dark-300 border border-dark-600">{load.length} classes</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {t.capabilities?.slice(0, 4).map((c, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 bg-dark-800 rounded text-dark-400">{c.subject?.name || '?'}</span>
                ))}
                {t.capabilities?.length > 4 && <span className="text-[9px] text-dark-500">+{t.capabilities.length - 4}</span>}
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
            <h4 className="text-sm font-semibold text-white">Step 1: Select assignments to transfer</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {affected.map(r => (
                <label key={r._id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.includes(r._id) ? 'bg-primary-500/10 border-primary-500/30' : 'bg-dark-800/40 border-dark-700/50'}`}>
                  <input type="checkbox" checked={selected.includes(r._id)} onChange={e => e.target.checked ? setSelected(p => [...p, r._id]) : setSelected(p => p.filter(x => x !== r._id))} className="w-4 h-4 rounded" />
                  <div><span className="text-sm text-white">{r.subject?.name || '?'}</span><span className="text-dark-500 mx-1.5">·</span><span className="text-xs text-dark-400">{r.class?.name || '?'}</span></div>
                  <span className="ml-auto badge bg-dark-700 text-dark-300 text-[10px]">{r.periodsPerWeek}/wk</span>
                </label>
              ))}
            </div>
            {affected.length === 0 && <p className="text-dark-400 text-sm text-center py-4">No assignments found for this teacher.</p>}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-dark-400 mb-1 block">Type</label><select value={replType} onChange={e => setReplType(e.target.value)} className="select-field"><option value="permanent">Permanent</option><option value="temporary">Temporary</option></select></div>
              <div><label className="text-xs text-dark-400 mb-1 block">Effective Date</label><input value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} type="date" className="input-field" /></div>
            </div>
            <div className="flex justify-end gap-3"><button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button onClick={findSuggestions} disabled={selected.length === 0} className="btn-primary">Find Replacements →</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Step 2: Choose replacement teacher</h4>
            <p className="text-xs text-dark-400">Ranked by subject match and current workload</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {suggestions.length === 0 ? <p className="text-dark-400 text-center py-4">No capable teachers found.</p> : suggestions.map(s => (
                <label key={s._id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${newTeacher === s._id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-dark-800/40 border-dark-700/50'}`}>
                  <input type="radio" name="replacement" checked={newTeacher === s._id} onChange={() => setNewTeacher(s._id)} className="w-4 h-4" />
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: s.color || '#6366f1' }}>{s.name.charAt(0)}</div>
                  <div className="flex-1"><p className="text-sm text-white">{s.name}</p><p className="text-[10px] text-dark-500">{s.department}</p></div>
                  <div className="text-right">
                    <span className={`badge text-[10px] ${s.matchPercent === 100 ? 'badge-success' : s.matchPercent >= 50 ? 'badge-warning' : 'badge-danger'}`}>{s.matchPercent}% match</span>
                    <p className="text-[10px] text-dark-500 mt-0.5">{s.currentLoad}/wk load</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between gap-3"><button onClick={() => setStep(1)} className="btn-secondary">← Back</button><button onClick={() => setStep(3)} disabled={!newTeacher} className="btn-primary">Preview →</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Step 3: Review & Apply</h4>
            <div className="bg-dark-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-red-400">{oldTeacher?.name}</span>
                <ArrowRight size={14} className="text-dark-500" />
                <span className="text-emerald-400">{teachers.find(t => t._id === newTeacher)?.name}</span>
              </div>
              <div className="text-xs text-dark-400">
                <p>{selected.length} assignments · {replType} · Effective {effectiveDate}</p>
              </div>
              {affected.filter(r => selected.includes(r._id)).map(r => (
                <div key={r._id} className="flex items-center gap-2 text-xs text-dark-300 pl-2 border-l-2 border-emerald-500/30">
                  <span>{r.subject?.name}</span><span className="text-dark-600">·</span><span>{r.class?.name}</span><span className="text-dark-600">·</span><span>{r.periodsPerWeek}/wk</span>
                </div>
              ))}
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-400">This will update the timetable. Affected periods will be re-optimized.</p>
            </div>
            <div className="flex justify-between gap-3"><button onClick={() => setStep(2)} className="btn-secondary">← Back</button><button onClick={applyReplacement} className="btn-primary flex items-center gap-2"><CheckCircle size={16} /> Apply Replacement</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
