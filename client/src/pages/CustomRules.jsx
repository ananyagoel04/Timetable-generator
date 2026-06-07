import { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, AlertTriangle, Info, CheckCircle, ToggleLeft, ToggleRight, Edit3 } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ruleTypes = [
  { value: 'max_subject_per_day', label: 'Max same subject per day', desc: 'Limit how many times a subject appears in one day', category: 'distribution' },
  { value: 'morning_preference', label: 'Morning slot preference', desc: 'Schedule specific subjects before break', category: 'preference' },
  { value: 'afternoon_preference', label: 'Afternoon slot preference', desc: 'Schedule specific subjects after lunch', category: 'preference' },
  { value: 'no_consecutive', label: 'No consecutive periods', desc: 'Prevent a subject from being scheduled back-to-back', category: 'distribution' },
  { value: 'teacher_max_continuous', label: 'Teacher max continuous', desc: 'Limit consecutive periods for a teacher', category: 'workload' },
  { value: 'subject_not_on_day', label: 'Subject blocked on day', desc: 'Prevent a subject on a specific day', category: 'restriction' },
  { value: 'teacher_not_on_day', label: 'Teacher unavailable day', desc: 'Block a teacher from a specific day', category: 'restriction' },
  { value: 'pair_subjects', label: 'Pair subjects together', desc: 'Two subjects should be adjacent', category: 'preference' },
  { value: 'even_distribution', label: 'Even weekly distribution', desc: 'Spread subject evenly across the week', category: 'distribution' },
  { value: 'lab_after_theory', label: 'Lab after theory', desc: 'Schedule lab period after theory class', category: 'preference' },
];

const severityConfig = {
  hard: { color: 'badge-danger', icon: AlertTriangle, label: 'Hard Constraint' },
  soft: { color: 'badge-warning', icon: Info, label: 'Soft Constraint' },
  preference: { color: 'badge-info', icon: CheckCircle, label: 'Preference' },
};

const categoryColors = {
  distribution: 'bg-purple-500/20 text-purple-400',
  preference: 'bg-blue-500/20 text-blue-400',
  workload: 'bg-amber-500/20 text-amber-400',
  restriction: 'bg-red-500/20 text-red-400',
};

export default function CustomRules() {
  const { selectedSchool, selectedSession } = useAuth();
  const [rules, setRules] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'max_subject_per_day', severity: 'soft', isActive: true,
    config: {}, subject: '', subjects: [], teacher: '', day: '', value: 2
  });

  useEffect(() => {
    Promise.all([
      api.get('/rules/custom').then(r => setRules(r.data?.data || r.data || [])),
      api.get('/subjects').then(r => setSubjects(r.data?.data || r.data || [])),
      api.get('/teachers').then(r => setTeachers(r.data?.data || r.data || []))
    ]).finally(() => setLoading(false));
  }, [selectedSchool, selectedSession]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const ruleInfo = ruleTypes.find(r => r.value === form.type);
      const payload = {
        name: form.name || ruleInfo?.label,
        type: form.type,
        severity: form.severity,
        isActive: form.isActive,
        config: {
          subject: isMultiSubject ? undefined : (form.subject || undefined),
          subjects: isMultiSubject && form.subjects.length ? form.subjects : undefined,
          teacher: form.teacher || undefined,
          day: form.day || undefined,
          value: form.value
        }
      };
      if (editingId) {
        await api.put(`/rules/custom/${editingId}`, payload);
        toast.success('Rule updated');
      } else {
        await api.post('/rules/custom', payload);
        toast.success('Rule created');
      }
      setModalOpen(false);
      setEditingId(null);
      api.get('/rules/custom').then(r => setRules(r.data?.data || r.data || []));
    } catch (err) { toast.error(err.message); }
  };

  const toggleRule = async (id, current) => {
    try {
      await api.put(`/rules/custom/${id}`, { isActive: !current });
      setRules(rules.map(r => r._id === id ? { ...r, isActive: !current } : r));
      toast.success(!current ? 'Rule enabled' : 'Rule disabled');
    } catch (err) { toast.error(err.message); }
  };

  const deleteRule = async (id) => {
    try {
      await api.delete(`/rules/custom/${id}`);
      setRules(rules.filter(r => r._id !== id));
      toast.success('Rule deleted');
    } catch (err) { toast.error(err.message); }
  };

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setForm({
      name: rule.name || '',
      type: rule.type || 'max_subject_per_day',
      severity: rule.severity || 'soft',
      isActive: rule.isActive !== false,
      config: rule.config || {},
      subject: rule.config?.subject || '',
      subjects: rule.config?.subjects || [],
      teacher: rule.config?.teacher || '',
      day: rule.config?.day || '',
      value: rule.config?.value || 2
    });
    setModalOpen(true);
  };

  const needsSubject = ['max_subject_per_day','morning_preference','afternoon_preference','no_consecutive','subject_not_on_day','pair_subjects','even_distribution','lab_after_theory'].includes(form.type);
  const isMultiSubject = ['morning_preference','afternoon_preference'].includes(form.type);
  const needsTeacher = ['teacher_max_continuous','teacher_not_on_day'].includes(form.type);
  const needsDay = ['subject_not_on_day','teacher_not_on_day'].includes(form.type);
  const needsValue = ['max_subject_per_day','teacher_max_continuous'].includes(form.type);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Rules & Preferences</h1><p className="page-subtitle">{rules.length} custom rules · {rules.filter(r => r.isActive).length} active</p></div>
        <button onClick={() => { setEditingId(null); setForm({ name: '', type: 'max_subject_per_day', severity: 'soft', isActive: true, config: {}, subject: '', subjects: [], teacher: '', day: '', value: 2 }); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Rule</button>
      </div>

      {/* Rule Templates */}
      <div className="glass-card p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-dark-400 mb-3">Quick Add Templates</p>
        <div className="flex flex-wrap gap-2">
          {ruleTypes.map(rt => (
            <button key={rt.value} onClick={() => { setForm(f => ({ ...f, type: rt.value, name: rt.label })); setModalOpen(true); }}
              className={`text-xs px-3 py-1.5 rounded-lg border border-slate-400/50 dark:border-dark-600/50 ${categoryColors[rt.category] || 'bg-white dark:bg-dark-800 text-slate-600 dark:text-dark-300'} hover:opacity-80 transition-all`}>
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Rules */}
      {loading ? <p className="text-center py-12 text-slate-500 dark:text-dark-400">Loading...</p> : rules.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Shield size={48} className="mx-auto text-slate-400 dark:text-dark-600 mb-3" />
          <p className="text-slate-500 dark:text-dark-400">No custom rules yet. Add rules to fine-tune timetable generation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const sev = severityConfig[rule.severity] || severityConfig.soft;
            const SevIcon = sev.icon;
            const ruleInfo = ruleTypes.find(r => r.value === rule.type);
            return (
              <div key={rule._id} className={`glass-card p-4 flex items-center gap-4 transition-all ${rule.isActive ? '' : 'opacity-50'}`}>
                <button onClick={() => toggleRule(rule._id, rule.isActive)} className="shrink-0">
                  {rule.isActive ? <ToggleRight size={28} className="text-emerald-400" /> : <ToggleLeft size={28} className="text-slate-400 dark:text-dark-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-slate-900 dark:text-dark-50 text-sm truncate">{rule.name}</p>
                    <span className={sev.color}><SevIcon size={10} className="inline mr-1" />{sev.label}</span>
                    {ruleInfo && <span className={`text-[9px] px-1.5 py-0.5 rounded ${categoryColors[ruleInfo.category]}`}>{ruleInfo.category}</span>}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-dark-500">{ruleInfo?.desc || rule.type}</p>
                  {rule.config && (
                    <div className="flex gap-2 mt-1">
                      {rule.config.subject && <span className="text-[10px] text-slate-500 dark:text-dark-400">Subject: {subjects.find(s => s._id === rule.config.subject)?.name || rule.config.subject}</span>}
                      {rule.config.teacher && <span className="text-[10px] text-slate-500 dark:text-dark-400">Teacher: {teachers.find(t => t._id === rule.config.teacher)?.name || rule.config.teacher}</span>}
                      {rule.config.day && <span className="text-[10px] text-slate-500 dark:text-dark-400">Day: {rule.config.day}</span>}
                      {rule.config.value && <span className="text-[10px] text-slate-500 dark:text-dark-400">Value: {rule.config.value}</span>}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteRule(rule._id)} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 dark:text-dark-500 hover:text-red-400 transition-colors shrink-0"><Trash2 size={16} /></button>
                <button onClick={() => startEdit(rule)} className="p-2 rounded-lg hover:bg-blue-500/20 text-slate-400 dark:text-dark-500 hover:text-blue-400 transition-colors shrink-0"><Edit3 size={16} /></button>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? 'Edit Custom Rule' : 'Add Custom Rule'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Rule Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="e.g., Max 2 Maths per day" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Rule Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="select-field">
                {ruleTypes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="select-field">
                <option value="hard">Hard (must obey)</option><option value="soft">Soft (try to obey)</option><option value="preference">Preference (nice to have)</option>
              </select>
            </div>
          </div>
          {needsSubject && !isMultiSubject && <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Subject</label>
            <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="select-field">
              <option value="">All subjects</option>{subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>}
          {isMultiSubject && <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Select Subjects (multi-select)</label>
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-dark-700 rounded-xl p-2 space-y-1 scrollbar-thin">
              {subjects.map(s => (
                <label key={s._id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-dark-800/50 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20 transition-all">
                  <input type="checkbox" checked={form.subjects.includes(s._id)} onChange={e => {
                    setForm(f => ({ ...f, subjects: e.target.checked ? [...f.subjects, s._id] : f.subjects.filter(id => id !== s._id) }));
                  }} className="w-4 h-4 rounded accent-primary-500" />
                  <span className="text-sm text-slate-700 dark:text-dark-200">{s.name}</span>
                  {s.type && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-700 text-slate-400 dark:text-dark-500">{s.type}</span>}
                </label>
              ))}
            </div>
            {form.subjects.length > 0 && <p className="text-[10px] text-primary-500 mt-1">{form.subjects.length} selected</p>}
          </div>}
          {needsTeacher && <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Teacher</label>
            <select value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} className="select-field">
              <option value="">All teachers</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>}
          {needsDay && <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Day</label>
            <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} className="select-field">
              <option value="">Select day</option>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>}
          {needsValue && <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Max Value</label>
            <input value={form.value} onChange={e => setForm(f => ({ ...f, value: +e.target.value }))} type="number" min="1" max="10" className="input-field" />
          </div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setModalOpen(false); setEditingId(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingId ? 'Update Rule' : 'Create Rule'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
