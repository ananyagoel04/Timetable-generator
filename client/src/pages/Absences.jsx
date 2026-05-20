import { useState, useEffect } from 'react';
import { Plus, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function Absences() {
  const [absences, setAbsences] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ teacher: '', date: '', absenceType: 'full_day', reason: '' });

  useEffect(() => { fetchAbsences(); api.get('/teachers').then(r => setTeachers(r.data || [])); }, []);
  const fetchAbsences = () => api.get('/absences').then(r => { setAbsences(r.data || []); setLoading(false); });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await api.post('/absences', form); toast.success('Recorded'); setModalOpen(false); fetchAbsences(); }
    catch (err) { toast.error(err.message); }
  };

  const updateStatus = async (id, status) => {
    try { await api.put(`/absences/${id}`, { status }); toast.success(`Marked ${status}`); fetchAbsences(); }
    catch (err) { toast.error(err.message); }
  };

  const statusCfg = { pending: { icon: Clock, color: 'badge-warning' }, approved: { icon: CheckCircle, color: 'badge-success' }, rejected: { icon: XCircle, color: 'badge-danger' }, adjusted: { icon: CheckCircle, color: 'badge-info' } };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Absences</h1><p className="page-subtitle">{absences.length} records</p></div>
        <button onClick={() => { setForm({ teacher: '', date: '', absenceType: 'full_day', reason: '' }); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Record Absence</button>
      </div>
      <div className="table-container">
        <table className="w-full"><thead className="table-header"><tr><th className="text-left px-5 py-3">Teacher</th><th className="text-left px-5 py-3">Date</th><th className="text-left px-5 py-3">Type</th><th className="text-left px-5 py-3">Reason</th><th className="text-left px-5 py-3">Status</th><th className="text-right px-5 py-3">Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} className="text-center py-12 text-dark-400">Loading...</td></tr> : absences.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-dark-400">No absences</td></tr> : absences.map(a => {
          const cfg = statusCfg[a.status] || statusCfg.pending;
          return (
            <tr key={a._id} className="table-row">
              <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-xs font-bold">{a.teacher?.name?.charAt(0) || '?'}</div><span className="font-medium text-white">{a.teacher?.name || '?'}</span></div></td>
              <td className="px-5 py-4 text-dark-300 text-sm flex items-center gap-1.5"><Calendar size={14} className="text-dark-500" />{new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td className="px-5 py-4 text-dark-300 text-xs">{a.absenceType?.replace(/_/g, ' ')}</td>
              <td className="px-5 py-4 text-dark-300 text-sm">{a.reason || '—'}</td>
              <td className="px-5 py-4"><span className={cfg.color}>{a.status}</span></td>
              <td className="px-5 py-4 text-right">{a.status === 'pending' && (<div className="flex justify-end gap-2"><button onClick={() => updateStatus(a._id, 'approved')} className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Approve</button><button onClick={() => updateStatus(a._id, 'rejected')} className="text-xs px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">Reject</button></div>)}</td>
            </tr>);
        })}</tbody></table>
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Record Absence">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-xs text-dark-400 mb-1 block">Teacher *</label><select value={form.teacher} onChange={e => setForm(f => ({...f, teacher: e.target.value}))} required className="select-field"><option value="">Select</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-dark-400 mb-1 block">Date *</label><input value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} type="date" required className="input-field" /></div>
            <div><label className="text-xs text-dark-400 mb-1 block">Type</label><select value={form.absenceType} onChange={e => setForm(f => ({...f, absenceType: e.target.value}))} className="select-field"><option value="full_day">Full Day</option><option value="selected_periods">Selected Periods</option><option value="date_range">Date Range</option></select></div>
          </div>
          <div><label className="text-xs text-dark-400 mb-1 block">Reason</label><input value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} className="input-field" /></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Submit</button></div>
        </form>
      </Modal>
    </div>
  );
}
