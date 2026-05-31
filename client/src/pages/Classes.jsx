import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, DoorOpen } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ grade: 9, section: 'A', stream: 'none', studentCount: 35, classTeacher: '', roomPreference: '' });

  useEffect(() => {
    fetchClasses();
    api.get('/teachers').then(r => setTeachers(r.data?.data || r.data || []));
    api.get('/rooms').then(r => setRooms(r.data?.data || r.data || []));
  }, []);
  const fetchClasses = () => api.get('/classes').then(r => { setClasses(r.data || []); setLoading(false); });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      editing ? await api.put(`/classes/${editing._id}`, form) : await api.post('/classes', form);
      toast.success(editing ? 'Updated' : 'Added'); setModalOpen(false); fetchClasses();
    } catch (err) { toast.error(err.message); }
  };
  const handleEdit = (c) => { setEditing(c); setForm({ grade: c.grade, section: c.section, stream: c.stream || 'none', studentCount: c.studentCount, classTeacher: c.classTeacher?._id || '', roomPreference: c.roomPreference?._id || '' }); setModalOpen(true); };
  const handleDelete = async (id) => { if (!confirm('Delete?')) return; await api.delete(`/classes/${id}`); fetchClasses(); };
  const filtered = classes.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Classes</h1><p className="page-subtitle">{classes.length} classes</p></div>
        <button onClick={() => { setEditing(null); setForm({ grade: 9, section: 'A', stream: 'none', studentCount: 35, classTeacher: '', roomPreference: '' }); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Class</button>
      </div>
      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-9" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p className="text-slate-500 dark:text-dark-400 col-span-full text-center py-12">Loading...</p> : filtered.map(c => (
          <div key={c._id} className="glass-card-hover p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">{c.grade}</div>
              <div className="flex gap-1"><button onClick={() => handleEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50"><Edit2 size={14} /></button><button onClick={() => handleDelete(c._id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 dark:text-dark-400 hover:text-red-400"><Trash2 size={14} /></button></div>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-dark-50">{c.name}</h3>
            <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">{c.studentCount} students</p>
            {c.classTeacher && <p className="text-xs text-slate-400 dark:text-dark-500 mt-1">CT: {c.classTeacher.name}</p>}
            {c.roomPreference && <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5 flex items-center gap-1"><DoorOpen size={10} /> Room: {c.roomPreference.name || c.roomPreference}</p>}
            <div className="flex gap-2 mt-2">
              {c.stream !== 'none' && <span className="badge bg-purple-500/20 text-purple-400 text-[10px]">{c.stream}</span>}
              {c.studentGroups?.map((g, i) => <span key={i} className="badge bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 text-[10px]">{g.name}</span>)}
            </div>
          </div>
        ))}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Class' : 'Add Class'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Grade *</label><input value={form.grade} onChange={e => setForm(f => ({...f, grade: +e.target.value}))} type="number" min={1} max={12} required className="input-field" /></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Section *</label><input value={form.section} onChange={e => setForm(f => ({...f, section: e.target.value.toUpperCase()}))} required className="input-field" maxLength={2} /></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Students</label><input value={form.studentCount} onChange={e => setForm(f => ({...f, studentCount: +e.target.value}))} type="number" className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Stream</label><select value={form.stream} onChange={e => setForm(f => ({...f, stream: e.target.value}))} className="select-field"><option value="none">None</option><option value="science">Science</option><option value="commerce">Commerce</option><option value="humanities">Humanities</option></select></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Class Teacher</label><select value={form.classTeacher} onChange={e => setForm(f => ({...f, classTeacher: e.target.value}))} className="select-field"><option value="">None</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Assigned Room (Classroom)</label>
            <select value={form.roomPreference} onChange={e => setForm(f => ({...f, roomPreference: e.target.value}))} className="select-field">
              <option value="">No fixed room</option>
              {rooms.map(r => <option key={r._id} value={r._id}>{r.name}{r.capacity ? ` (${r.capacity} seats)` : ''}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
