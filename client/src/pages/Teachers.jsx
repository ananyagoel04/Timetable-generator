import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', department: '', maxPeriodsPerDay: 6, capabilities: [] });
  const [selCaps, setSelCaps] = useState([]);

  useEffect(() => { fetchTeachers(); api.get('/subjects').then(r => setSubjects(r.data || [])); }, []);
  const fetchTeachers = () => api.get('/teachers').then(r => { setTeachers(r.data || []); setLoading(false); });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, capabilities: selCaps.map(id => ({ subject: id, proficiency: 'primary' })) };
    try {
      editing ? await api.put(`/teachers/${editing._id}`, payload) : await api.post('/teachers', payload);
      toast.success(editing ? 'Updated' : 'Added'); setModalOpen(false); fetchTeachers();
    } catch (err) { toast.error(err.message); }
  };

  const handleEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, email: t.email, department: t.department || '', maxPeriodsPerDay: t.maxPeriodsPerDay || 6 });
    setSelCaps(t.capabilities?.map(c => c.subject?._id || c.subject) || []);
    setModalOpen(true);
  };

  const handleDelete = async (id) => { if (!confirm('Delete?')) return; await api.delete(`/teachers/${id}`); fetchTeachers(); };

  const filtered = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Teachers</h1><p className="page-subtitle">{teachers.length} teachers</p></div>
        <button onClick={() => { setEditing(null); setForm({ name: '', email: '', department: '', maxPeriodsPerDay: 6 }); setSelCaps([]); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Teacher</button>
      </div>
      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-9" /></div>
      <div className="table-container">
        <table className="w-full"><thead className="table-header"><tr><th className="text-left px-5 py-3">Teacher</th><th className="text-left px-5 py-3">Department</th><th className="text-left px-5 py-3">Can Teach</th><th className="text-left px-5 py-3">Max/Day</th><th className="text-right px-5 py-3">Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={5} className="text-center py-12 text-dark-400">Loading...</td></tr> : filtered.map(t => (
          <tr key={t._id} className="table-row">
            <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{backgroundColor: t.color || '#6366f1'}}>{t.name.charAt(0)}</div><div><p className="font-medium text-white">{t.name}</p><p className="text-xs text-dark-500">{t.email}</p></div></div></td>
            <td className="px-5 py-4 text-dark-300 text-sm">{t.department || '—'}</td>
            <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{t.capabilities?.map((c, i) => <span key={i} className="badge bg-dark-700 text-dark-300 border border-dark-600 text-[10px]">{c.subject?.name || c.subject}</span>)}</div></td>
            <td className="px-5 py-4 text-dark-300">{t.maxPeriodsPerDay || 6}</td>
            <td className="px-5 py-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => handleEdit(t)} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"><Edit2 size={14} /></button><button onClick={() => handleDelete(t._id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400"><Trash2 size={14} /></button></div></td>
          </tr>))}</tbody></table>
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Teacher' : 'Add Teacher'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required className="input-field" /></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Email *</label><input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required type="email" className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Department</label><input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} className="input-field" /></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Max Periods/Day</label><input value={form.maxPeriodsPerDay} onChange={e => setForm(f => ({...f, maxPeriodsPerDay: +e.target.value}))} type="number" className="input-field" /></div>
          </div>
          <div><label className="text-xs text-dark-400 mb-2 block">Subjects Can Teach</label>
            <div className="flex flex-wrap gap-2">{subjects.map(s => (
              <label key={s._id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm ${selCaps.includes(s._id) ? 'bg-primary-500/20 border-primary-500/40 text-primary-400' : 'bg-dark-800 border-dark-700 text-dark-300'}`}>
                <input type="checkbox" checked={selCaps.includes(s._id)} onChange={e => e.target.checked ? setSelCaps(p => [...p, s._id]) : setSelCaps(p => p.filter(x => x !== s._id))} className="w-3.5 h-3.5 rounded" />{s.name}
              </label>))}</div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
