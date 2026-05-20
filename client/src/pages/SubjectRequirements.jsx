import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function SubjectRequirements() {
  const [reqs, setReqs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ class: '', subject: '', teacher: '', periodsPerWeek: 4 });

  useEffect(() => {
    fetchReqs();
    api.get('/classes').then(r => setClasses(r.data || []));
    api.get('/subjects').then(r => setSubjects(r.data || []));
    api.get('/teachers').then(r => setTeachers(r.data || []));
    api.get('/rooms').then(r => setRooms(r.data || []));
  }, []);

  const fetchReqs = () => api.get('/rules/requirements').then(r => { setReqs(r.data || []); setLoading(false); });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      editing ? await api.put(`/rules/requirements/${editing._id}`, form) : await api.post('/rules/requirements', form);
      toast.success(editing ? 'Updated' : 'Created'); setModalOpen(false); fetchReqs();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => { if (!confirm('Delete?')) return; await api.delete(`/rules/requirements/${id}`); fetchReqs(); };

  const grouped = {};
  reqs.forEach(r => { const cn = r.class?.name || '?'; if (!grouped[cn]) grouped[cn] = []; grouped[cn].push(r); });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Weekly Periods</h1><p className="page-subtitle">{reqs.length} assignments</p></div>
        <button onClick={() => { setEditing(null); setForm({ class: '', subject: '', teacher: '', periodsPerWeek: 4 }); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add</button>
      </div>
      {Object.entries(grouped).map(([cn, items]) => (
        <div key={cn} className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-dark-700/50 bg-dark-800/40"><h3 className="font-semibold text-white text-sm">{cn}</h3></div>
          <div className="divide-y divide-dark-700/30">
            {items.map(r => (
              <div key={r._id} className="flex items-center justify-between px-5 py-3 hover:bg-dark-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.subject?.color || '#6366f1' }} />
                  <span className="text-sm text-white">{r.subject?.name}</span>
                  <span className="text-xs text-dark-500">· {r.teacher?.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge bg-primary-500/20 text-primary-400">{r.periodsPerWeek}/wk</span>
                  <button onClick={() => { setEditing(r); setForm({ class: r.class?._id, subject: r.subject?._id, teacher: r.teacher?._id, periodsPerWeek: r.periodsPerWeek }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"><Edit2 size={13} /></button>
                  <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit' : 'Add Assignment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Class</label><select value={form.class} onChange={e => setForm(f => ({...f, class: e.target.value}))} required className="select-field"><option value="">Select</option>{classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Subject</label><select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} required className="select-field"><option value="">Select</option>{subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Teacher</label><select value={form.teacher} onChange={e => setForm(f => ({...f, teacher: e.target.value}))} required className="select-field"><option value="">Select</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Periods/Week</label><input value={form.periodsPerWeek} onChange={e => setForm(f => ({...f, periodsPerWeek: +e.target.value}))} type="number" min={1} max={15} className="input-field" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
