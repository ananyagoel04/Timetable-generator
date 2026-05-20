import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', type: 'theory', category: 'core', defaultPeriodsPerWeek: 4, color: '#6366f1', requiresLab: false, preferMorning: false, preferAfternoon: false });

  useEffect(() => { fetchSubjects(); }, []);
  const fetchSubjects = () => api.get('/subjects').then(r => { setSubjects(r.data || []); setLoading(false); });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      editing ? await api.put(`/subjects/${editing._id}`, form) : await api.post('/subjects', form);
      toast.success(editing ? 'Updated' : 'Added'); setModalOpen(false); fetchSubjects();
    } catch (err) { toast.error(err.message); }
  };
  const handleEdit = (s) => { setEditing(s); setForm({ name: s.name, code: s.code, type: s.type, category: s.category, defaultPeriodsPerWeek: s.defaultPeriodsPerWeek, color: s.color, requiresLab: s.requiresLab, preferMorning: s.preferMorning, preferAfternoon: s.preferAfternoon }); setModalOpen(true); };
  const handleDelete = async (id) => { if (!confirm('Delete?')) return; await api.delete(`/subjects/${id}`); fetchSubjects(); };
  const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const typeIcons = { theory: '📖', practical: '🔬', lab: '💻', activity: '🎨', library: '📚', games: '⚽', moral_science: '🕊️', club: '🎭', other: '📋' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Subjects</h1><p className="page-subtitle">{subjects.length} subjects</p></div>
        <button onClick={() => { setEditing(null); setForm({ name: '', code: '', type: 'theory', category: 'core', defaultPeriodsPerWeek: 4, color: '#6366f1', requiresLab: false, preferMorning: false, preferAfternoon: false }); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Subject</button>
      </div>
      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-9" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? <p className="text-dark-400 col-span-full text-center py-12">Loading...</p> : filtered.map(s => (
          <div key={s._id} className="glass-card-hover p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-8 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-lg">{typeIcons[s.type] || '📖'}</span>
              </div>
              <div className="flex gap-1"><button onClick={() => handleEdit(s)} className="p-1 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"><Edit2 size={13} /></button><button onClick={() => handleDelete(s._id)} className="p-1 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400"><Trash2 size={13} /></button></div>
            </div>
            <h3 className="font-semibold text-white text-sm">{s.name}</h3>
            <p className="text-[10px] text-dark-500">{s.code} · {s.defaultPeriodsPerWeek}/wk</p>
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="badge bg-dark-700 text-dark-300 border border-dark-600 text-[9px]">{s.category}</span>
              {s.requiresLab && <span className="badge bg-purple-500/20 text-purple-400 text-[9px]">Lab</span>}
              {s.preferMorning && <span className="badge bg-amber-500/20 text-amber-400 text-[9px]">AM</span>}
              {s.preferAfternoon && <span className="badge bg-blue-500/20 text-blue-400 text-[9px]">PM</span>}
            </div>
          </div>
        ))}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required className="input-field" /></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Code *</label><input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value.toUpperCase()}))} required className="input-field" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Type</label><select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="select-field"><option value="theory">Theory</option><option value="practical">Practical</option><option value="lab">Lab</option><option value="activity">Activity</option><option value="library">Library</option><option value="games">Games</option><option value="club">Club</option></select></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Category</label><select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="select-field"><option value="core">Core</option><option value="elective">Elective</option><option value="co_curricular">Co-Curricular</option><option value="extra_curricular">Extra-Curricular</option></select></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Periods/Week</label><input value={form.defaultPeriodsPerWeek} onChange={e => setForm(f => ({...f, defaultPeriodsPerWeek: +e.target.value}))} type="number" className="input-field" /></div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Color</label><input value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))} type="color" className="w-10 h-10 rounded-lg border border-dark-700 cursor-pointer" /></div>
            <label className="flex items-center gap-2 pt-4"><input type="checkbox" checked={form.requiresLab} onChange={e => setForm(f => ({...f, requiresLab: e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-sm text-dark-300">Requires Lab</span></label>
            <label className="flex items-center gap-2 pt-4"><input type="checkbox" checked={form.preferMorning} onChange={e => setForm(f => ({...f, preferMorning: e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-sm text-dark-300">Prefer Morning</span></label>
            <label className="flex items-center gap-2 pt-4"><input type="checkbox" checked={form.preferAfternoon} onChange={e => setForm(f => ({...f, preferAfternoon: e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-sm text-dark-300">Prefer Afternoon</span></label>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
