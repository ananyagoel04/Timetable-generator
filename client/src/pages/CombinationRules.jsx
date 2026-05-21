import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Layers } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function CombinationRules() {
  const [rules, setRules] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', subject: '', teacher: '', room: '', appliesTo: [], periodsPerWeek: 1, strictness: 'must_combine' });
  const [selectedClasses, setSelectedClasses] = useState([]);

  useEffect(() => {
    fetchRules();
    api.get('/classes').then(r => setClasses(r.data || []));
    api.get('/subjects').then(r => setSubjects(r.data || []));
    api.get('/teachers').then(r => setTeachers(r.data || []));
    api.get('/rooms').then(r => setRooms(r.data || []));
  }, []);

  const fetchRules = () => api.get('/rules/combinations').then(r => { setRules(r.data || []); setLoading(false); });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, appliesTo: selectedClasses.map(c => ({ class: c })) };
    try {
      editing ? await api.put(`/rules/combinations/${editing._id}`, payload) : await api.post('/rules/combinations', payload);
      toast.success(editing ? 'Updated' : 'Created'); setModalOpen(false); fetchRules();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => { if (!confirm('Delete?')) return; await api.delete(`/rules/combinations/${id}`); fetchRules(); };

  const getSubjectName = (id) => subjects.find(s => s._id === id)?.name || '?';
  const strictColors = { must_combine: 'badge-danger', try_combine: 'badge-warning', combine_if_possible: 'badge-info' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Combined Classes</h1><p className="page-subtitle">{rules.length} combination rules</p></div>
        <button onClick={() => { setEditing(null); setSelectedClasses([]); setForm({ name: '', subject: '', teacher: '', room: '', periodsPerWeek: 1, strictness: 'must_combine' }); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Rule</button>
      </div>

      {loading ? <p className="text-slate-500 dark:text-dark-400 text-center py-12">Loading...</p> : rules.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Layers size={48} className="mx-auto text-slate-400 dark:text-dark-500 mb-4" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-2">No Combination Rules</h2>
          <p className="text-slate-500 dark:text-dark-400 text-sm">Combine multiple classes for shared subjects like Library, Games, or common electives.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r._id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-dark-50">{r.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-dark-400 mt-1">
                    <span className="text-primary-400">{r.subject?.name || '?'}</span> taught by <span className="text-emerald-400">{r.teacher?.name || '?'}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.appliesTo?.map((a, i) => (
                      <span key={i} className="badge bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 border border-slate-400 dark:border-dark-600 text-[10px]">{a.class?.name || '?'}</span>
                    ))}
                  </div>
                  {/* Live Preview */}
                  <p className="text-xs text-slate-400 dark:text-dark-500 mt-2 italic">
                    → {r.subject?.name} will be taught together for {r.appliesTo?.map(a => a.class?.name).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge bg-primary-500/20 text-primary-400">{r.periodsPerWeek}/wk</span>
                  <span className={strictColors[r.strictness] || 'badge-info'}>{r.strictness?.replace(/_/g, ' ')}</span>
                  <button onClick={() => { setEditing(r); setSelectedClasses(r.appliesTo?.map(a => a.class?._id || a.class) || []); setForm({ name: r.name, subject: r.subject?._id, teacher: r.teacher?._id, room: r.room?._id || '', periodsPerWeek: r.periodsPerWeek, strictness: r.strictness }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 dark:text-dark-400 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Rule' : 'New Combination Rule'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Rule Name</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required className="input-field" placeholder="e.g. Library for 9A & 9B" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Subject</label><select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} required className="select-field"><option value="">Select</option>{subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Teacher</label><select value={form.teacher} onChange={e => setForm(f => ({...f, teacher: e.target.value}))} required className="select-field"><option value="">Select</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-2 block">Classes to Combine</label>
            <div className="flex flex-wrap gap-2">
              {classes.map(c => (
                <label key={c._id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${selectedClasses.includes(c._id) ? 'bg-primary-500/20 border-primary-500/40 text-primary-400' : 'bg-white dark:bg-dark-800 border-slate-300 dark:border-dark-700 text-slate-600 dark:text-dark-300 hover:border-dark-500'}`}>
                  <input type="checkbox" checked={selectedClasses.includes(c._id)} onChange={e => { if (e.target.checked) setSelectedClasses(p => [...p, c._id]); else setSelectedClasses(p => p.filter(x => x !== c._id)); }} className="w-3.5 h-3.5 rounded" />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Room</label><select value={form.room} onChange={e => setForm(f => ({...f, room: e.target.value}))} className="select-field"><option value="">Auto</option>{rooms.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}</select></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Periods/Week</label><input value={form.periodsPerWeek} onChange={e => setForm(f => ({...f, periodsPerWeek: +e.target.value}))} type="number" min={1} className="input-field" /></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Strictness</label><select value={form.strictness} onChange={e => setForm(f => ({...f, strictness: e.target.value}))} className="select-field"><option value="must_combine">Must Combine</option><option value="try_combine">Try to Combine</option><option value="combine_if_possible">If Possible</option></select></div>
          </div>
          {selectedClasses.length > 1 && form.subject && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-xs text-emerald-400">✅ Preview: <strong>{getSubjectName(form.subject)}</strong> will be taught together for {selectedClasses.map(id => classes.find(c => c._id === id)?.name).filter(Boolean).join(', ')}</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
