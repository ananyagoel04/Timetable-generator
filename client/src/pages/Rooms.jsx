import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', roomNumber: '', type: 'classroom', capacity: 40, floor: 0, isAvailable: true });

  useEffect(() => { fetchRooms(); }, []);
  const fetchRooms = () => api.get('/rooms').then(r => { setRooms(r.data || []); setLoading(false); });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      editing ? await api.put(`/rooms/${editing._id}`, form) : await api.post('/rooms', form);
      toast.success(editing ? 'Updated' : 'Added'); setModalOpen(false); fetchRooms();
    } catch (err) { toast.error(err.message); }
  };
  const handleEdit = (r) => { setEditing(r); setForm({ name: r.name, roomNumber: r.roomNumber, type: r.type, capacity: r.capacity, floor: r.floor, isAvailable: r.isAvailable }); setModalOpen(true); };
  const handleDelete = async (id) => { if (!confirm('Delete?')) return; await api.delete(`/rooms/${id}`); fetchRooms(); };
  const filtered = rooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const typeIcons = { classroom: '🏫', lab: '🔬', computer_lab: '💻', library: '📚', auditorium: '🎭', playground: '⚽', art_room: '🎨', music_room: '🎵', other: '🏢' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Rooms</h1><p className="page-subtitle">{rooms.length} rooms</p></div>
        <button onClick={() => { setEditing(null); setForm({ name: '', roomNumber: '', type: 'classroom', capacity: 40, floor: 0, isAvailable: true }); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Room</button>
      </div>
      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-9" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? <p className="text-slate-500 dark:text-dark-400 col-span-full text-center py-12">Loading...</p> : filtered.map(r => (
          <div key={r._id} className="glass-card-hover p-5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl">{typeIcons[r.type] || '🏫'}</span>
              <div className="flex gap-1"><button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50"><Edit2 size={14} /></button><button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 dark:text-dark-400 hover:text-red-400"><Trash2 size={14} /></button></div>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-dark-50">{r.name}</h3>
            <p className="text-xs text-slate-500 dark:text-dark-400 mb-2">#{r.roomNumber} · Floor {r.floor}</p>
            <div className="flex items-center gap-2">
              <span className="badge bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 border border-slate-400 dark:border-dark-600">{r.capacity} seats</span>
              <span className={r.isAvailable ? 'badge-success' : 'badge-danger'}>{r.isAvailable ? 'Available' : 'Unavailable'}</span>
            </div>
          </div>
        ))}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Room' : 'Add Room'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required className="input-field" /></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Room # *</label><input value={form.roomNumber} onChange={e => setForm(f => ({...f, roomNumber: e.target.value}))} required className="input-field" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Type</label><select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="select-field"><option value="classroom">Classroom</option><option value="lab">Lab</option><option value="computer_lab">Computer Lab</option><option value="library">Library</option><option value="auditorium">Auditorium</option><option value="playground">Playground</option></select></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Capacity</label><input value={form.capacity} onChange={e => setForm(f => ({...f, capacity: +e.target.value}))} type="number" className="input-field" /></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Floor</label><input value={form.floor} onChange={e => setForm(f => ({...f, floor: +e.target.value}))} type="number" className="input-field" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
