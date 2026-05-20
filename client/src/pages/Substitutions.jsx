import { useState, useEffect } from 'react';
import { Plus, RefreshCw, CheckCircle, Clock, Search } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function Substitutions() {
  const [subs, setSubs] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ originalTeacher: '', substituteTeacher: '', class: '', subject: '', date: '', period: 1, notes: '' });

  useEffect(() => {
    fetchSubs();
    api.get('/teachers').then(r => setTeachers(r.data));
    api.get('/classes').then(r => setClasses(r.data));
    api.get('/subjects').then(r => setSubjects(r.data));
  }, []);

  const fetchSubs = () => api.get('/substitutions').then(r => { setSubs(r.data); setLoading(false); });

  const checkAvailable = async (day, period) => {
    if (!day || !period) return;
    try {
      const res = await api.get(`/substitutions/available?day=${day}&period=${period}`);
      setAvailable(res.data);
    } catch { setAvailable([]); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/substitutions', form);
      toast.success('Substitution created');
      setModalOpen(false); fetchSubs();
    } catch (err) { toast.error(err.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/substitutions/${id}`, { status });
      toast.success(`Marked as ${status}`);
      fetchSubs();
    } catch (err) { toast.error(err.message); }
  };

  const statusColors = { pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Substitutions</h1><p className="page-subtitle">{subs.length} substitutions</p></div>
        <button onClick={() => { setForm({ originalTeacher: '', substituteTeacher: '', class: '', subject: '', date: '', period: 1, notes: '' }); setAvailable([]); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> New Substitution</button>
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left px-5 py-3">Date</th>
              <th className="text-left px-5 py-3">Period</th>
              <th className="text-left px-5 py-3">Original</th>
              <th className="text-left px-5 py-3">Substitute</th>
              <th className="text-left px-5 py-3">Class</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-dark-400">Loading...</td></tr>
            ) : subs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-dark-400">No substitutions</td></tr>
            ) : subs.map(s => (
              <tr key={s._id} className="table-row">
                <td className="px-5 py-4 text-dark-300 text-sm">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td className="px-5 py-4 text-dark-300">P{s.period}</td>
                <td className="px-5 py-4 text-white font-medium">{s.originalTeacher?.name || '—'}</td>
                <td className="px-5 py-4 text-emerald-400 font-medium">{s.substituteTeacher?.name || '—'}</td>
                <td className="px-5 py-4 text-dark-300">{s.class?.name || '—'}</td>
                <td className="px-5 py-4"><span className={statusColors[s.status]}>{s.status}</span></td>
                <td className="px-5 py-4 text-right">
                  {s.status === 'pending' && (
                    <button onClick={() => updateStatus(s._id, 'confirmed')} className="text-xs px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Confirm</button>
                  )}
                  {s.status === 'confirmed' && (
                    <button onClick={() => updateStatus(s._id, 'completed')} className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Complete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Substitution" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Date *</label>
              <input value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} type="date" required className="input-field" />
            </div>
            <div><label className="text-xs text-dark-400 mb-1 block">Period *</label>
              <select value={form.period} onChange={e => { const p = +e.target.value; setForm(f => ({...f, period: p})); if (form.date) { const d = new Date(form.date); const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; checkAvailable(days[d.getDay()], p); }}} className="select-field">
                {[1,2,3,5,6,7,8].map(p => <option key={p} value={p}>Period {p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Absent Teacher *</label>
              <select value={form.originalTeacher} onChange={e => setForm(f => ({...f, originalTeacher: e.target.value}))} required className="select-field">
                <option value="">Select</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-dark-400 mb-1 block">Substitute Teacher *</label>
              <select value={form.substituteTeacher} onChange={e => setForm(f => ({...f, substituteTeacher: e.target.value}))} required className="select-field">
                <option value="">Select</option>
                {available.length > 0 ? available.map(t => <option key={t._id} value={t._id}>✓ {t.name} (free)</option>) : teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
              {available.length > 0 && <p className="text-[10px] text-emerald-400 mt-1">{available.length} teachers free at this slot</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Class *</label>
              <select value={form.class} onChange={e => setForm(f => ({...f, class: e.target.value}))} required className="select-field">
                <option value="">Select</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-dark-400 mb-1 block">Subject</label>
              <select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} className="select-field">
                <option value="">Any</option>
                {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-xs text-dark-400 mb-1 block">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="input-field" placeholder="Optional notes" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
