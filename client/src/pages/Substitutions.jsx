import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, CheckCircle, Clock, Search, Calendar, Printer, FileText, ChevronDown, ChevronUp, Link, XCircle, Users, AlertTriangle, BarChart3 } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PermissionGate from '../components/ui/PermissionGate';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Substitutions() {
  const { selectedSchool, selectedSession } = useAuth();
  const [subs, setSubs] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ originalTeacher: '', substituteTeacher: '', class: '', subject: '', date: '', period: 1, notes: '' });
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({ teachers: '', date: new Date().toISOString().split('T')[0], absenceType: 'full_day', reason: '' });
  const [bulkResult, setBulkResult] = useState(null);

  // Daily sheet state
  const [view, setView] = useState('list'); // 'list' | 'daily'
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(null); // sub to approve
  const [requirements, setRequirements] = useState([]);

  useEffect(() => {
    fetchSubs();
    api.get('/teachers').then(r => setTeachers(r.data));
    api.get('/classes').then(r => setClasses(r.data));
    api.get('/subjects').then(r => setSubjects(r.data));
    api.get('/rules/requirements').then(r => setRequirements(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { if (view === 'daily') fetchDaily(); }, [dailyDate, view]);

  const fetchSubs = () => api.get('/substitutions').then(r => { setSubs(r.data); setLoading(false); });

  const fetchDaily = async () => {
    setDailyLoading(true);
    try {
      const r = await api.get(`/substitutions/daily/${dailyDate}`);
      setDailyData(r.data);
    } catch { setDailyData(null); }
    setDailyLoading(false);
  };

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
      if (view === 'daily') fetchDaily();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      if (status === 'confirmed') {
        await api.post(`/substitutions/${id}/approve`);
      } else {
        await api.put(`/substitutions/${id}`, { status });
      }
      toast.success(`Marked as ${status}`);
      fetchSubs();
      if (view === 'daily') fetchDaily();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
    setConfirmApprove(null);
  };

  // Compute teacher workload
  const getTeacherLoad = (teacherId) => {
    return requirements.filter(r => (r.teacher?._id || r.teacher) === teacherId)
      .reduce((sum, r) => sum + (r.periodsPerWeek || 0), 0);
  };

  // Determine fallback tier for a suggestion
  const getTier = (t, subjectId) => {
    if (!subjectId || !t) return { label: 'Available', tier: 3, color: 'text-slate-400' };
    const caps = t.capabilities?.map(c => c.subject?._id || c.subject) || [];
    const teachesSubject = requirements.some(r => (r.teacher?._id || r.teacher) === t._id && (r.subject?._id || r.subject) === subjectId);
    if (teachesSubject) return { label: 'Same Subject', tier: 1, color: 'text-emerald-400' };
    if (caps.includes(subjectId)) return { label: 'Can Teach', tier: 2, color: 'text-blue-400' };
    return { label: 'Free Period', tier: 3, color: 'text-slate-400' };
  };

  const filteredSubs = useMemo(() => {
    let list = [...subs];
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    return list;
  }, [subs, statusFilter]);

  const statusColors = {
    pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    confirmed: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30'
  };

  const printDaily = () => {
    const w = window.open('', '_blank');
    const rows = (dailyData?.data || []).map(s => `
      <tr>
        <td style="padding:6px;border:1px solid #ccc">P${s.period}</td>
        <td style="padding:6px;border:1px solid #ccc">${s.originalTeacher?.name || '—'}</td>
        <td style="padding:6px;border:1px solid #ccc">${s.substituteTeacher?.name || '—'}</td>
        <td style="padding:6px;border:1px solid #ccc">${s.class?.name || '—'}</td>
        <td style="padding:6px;border:1px solid #ccc">${s.subject?.name || '—'}</td>
        <td style="padding:6px;border:1px solid #ccc">${s.status}</td>
      </tr>`).join('');
    w.document.write(`<html><head><title>Daily Substitution Sheet — ${dailyDate}</title><style>body{font-family:Arial;margin:20px}table{border-collapse:collapse;width:100%}th{background:#f0f0f0;padding:8px;border:1px solid #ccc;text-align:left}</style></head><body>
      <h2>Daily Substitution Sheet</h2><p>Date: ${new Date(dailyDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <table><thead><tr><th>Period</th><th>Original Teacher</th><th>Substitute</th><th>Class</th><th>Subject</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:20px;font-size:12px;color:#999">Generated ${new Date().toLocaleString()}</p></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Substitutions</h1>
          <p className="page-subtitle">{subs.length} total · {subs.filter(s => s.status === 'pending').length} pending approval</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-white/50 dark:bg-dark-800/50 rounded-lg border border-slate-300/50 dark:border-dark-700/50 p-0.5">
            <button onClick={() => setView('list')} className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-primary-500 text-white' : 'text-slate-500 dark:text-dark-400'}`}>List View</button>
            <button onClick={() => setView('daily')} className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${view === 'daily' ? 'bg-primary-500 text-white' : 'text-slate-500 dark:text-dark-400'}`}>
              <Calendar size={12} />Daily Sheet
            </button>
          </div>
          <PermissionGate permissions={['approve_substitutions']}>
            <button onClick={() => { setBulkForm({ teachers: '', date: new Date().toISOString().split('T')[0], absenceType: 'full_day', reason: '' }); setBulkResult(null); setBulkModal(true); }} className="btn-secondary flex items-center gap-2 text-sm">
              <Users size={16} />Bulk Absence
            </button>
            <button onClick={() => { setForm({ originalTeacher: '', substituteTeacher: '', class: '', subject: '', date: '', period: 1, notes: '' }); setAvailable([]); setModalOpen(true); }} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} />New Substitution
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Daily Sheet View */}
      {view === 'daily' && (
        <div className="space-y-4">
          {/* Date picker + stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="input-field w-44 text-sm" />
            <button onClick={() => setDailyDate(new Date().toISOString().split('T')[0])} className="btn-secondary text-xs">Today</button>
            <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate() - 1); setDailyDate(d.toISOString().split('T')[0]); }} className="btn-secondary text-xs px-2">←</button>
            <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate() + 1); setDailyDate(d.toISOString().split('T')[0]); }} className="btn-secondary text-xs px-2">→</button>
            <div className="h-5 w-px bg-slate-300 dark:bg-dark-700" />
            <button onClick={printDaily} className="btn-secondary text-xs flex items-center gap-1"><Printer size={12} />Print</button>

            {dailyData && (
              <div className="flex items-center gap-2 ml-auto text-[10px]">
                <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400">{dailyData.summary?.pending || 0} pending</span>
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">{dailyData.summary?.confirmed || 0} confirmed</span>
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">{dailyData.summary?.completed || 0} completed</span>
                <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-400 dark:text-dark-300">{dailyData.absencesCount || 0} absences</span>
              </div>
            )}
          </div>

          {/* Daily table */}
          <div className="glass-card overflow-hidden">
            {dailyLoading ? (
              <div className="p-12 text-center text-slate-500 dark:text-dark-400">Loading...</div>
            ) : !dailyData || (dailyData.count === 0 && !dailyData.absencesCount) ? (
              <div className="p-12 text-center">
                <Calendar size={40} className="mx-auto text-slate-300 dark:text-dark-600 mb-3" />
                <p className="text-slate-500 dark:text-dark-400">No substitutions for {new Date(dailyDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
            ) : dailyData.count === 0 && dailyData.absencesCount > 0 ? (
              <div className="p-8 text-center space-y-3">
                <AlertTriangle size={36} className="mx-auto text-amber-400 mb-2" />
                <p className="text-amber-400 font-medium">{dailyData.absencesCount} teacher{dailyData.absencesCount > 1 ? 's' : ''} absent but no substitutions assigned</p>
                <p className="text-xs text-slate-500 dark:text-dark-400">Create substitutions to cover the absent teachers' periods.</p>
                <PermissionGate permissions={['approve_substitutions']}>
                  <button onClick={() => { setForm({ originalTeacher: '', substituteTeacher: '', class: '', subject: '', date: dailyDate, period: 1, notes: '' }); setAvailable([]); setModalOpen(true); }} className="btn-primary text-sm inline-flex items-center gap-1.5 mt-2">
                    <Plus size={14} />Create Substitution
                  </button>
                </PermissionGate>
              </div>
            ) : (
              <table className="w-full">
                <thead className="table-header">
                  <tr>
                    <th className="text-left px-5 py-3">Period</th>
                    <th className="text-left px-5 py-3">Original Teacher</th>
                    <th className="text-left px-5 py-3">Substitute</th>
                    <th className="text-left px-5 py-3">Class</th>
                    <th className="text-left px-5 py-3">Subject</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Source</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.data.map(s => (
                    <tr key={s._id} className="table-row">
                      <td className="px-5 py-4 font-mono text-sm text-slate-900 dark:text-dark-50">P{s.period}</td>
                      <td className="px-5 py-4 text-red-400 font-medium text-sm">{s.originalTeacher?.name || '—'}</td>
                      <td className="px-5 py-4 text-emerald-400 font-medium text-sm">{s.substituteTeacher?.name || '—'}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-dark-300 text-sm">{s.class?.name || '—'}</td>
                      <td className="px-5 py-4 text-sm">
                        {s.subject?.name && <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: s.subject.color ? s.subject.color + '20' : '#3b82f620', color: s.subject.color || '#3b82f6' }}>{s.subject.shortName || s.subject.name}</span>}
                      </td>
                      <td className="px-5 py-4"><span className={`text-[10px] px-2 py-1 rounded-full ${statusColors[s.status] || ''}`}>{s.status}</span></td>
                      <td className="px-5 py-4">
                        {s.linkedAbsence ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1 w-fit">
                            <Link size={8} />Absence
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-dark-500">Manual</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <PermissionGate permissions={['approve_substitutions']}>
                          {s.status === 'pending' && (
                            <button onClick={() => setConfirmApprove({ id: s._id, status: 'confirmed', name: `P${s.period} - ${s.substituteTeacher?.name || '?'}` })} className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">Approve</button>
                          )}
                          {s.status === 'confirmed' && (
                            <button onClick={() => updateStatus(s._id, 'completed')} className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Complete</button>
                          )}
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <>
          {/* Status filter */}
          <div className="flex items-center gap-2">
            {['', 'pending', 'confirmed', 'completed', 'cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s ? 'bg-primary-500/20 border-primary-500/30 text-primary-400' : 'bg-white/50 dark:bg-dark-800/50 border-slate-300/50 dark:border-dark-700/50 text-slate-500 dark:text-dark-400'}`}>
                {s || 'All'}
              </button>
            ))}
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
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500 dark:text-dark-400">Loading...</td></tr>
                ) : filteredSubs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500 dark:text-dark-400">No substitutions{statusFilter ? ` with status "${statusFilter}"` : ''}</td></tr>
                ) : filteredSubs.map(s => (
                  <tr key={s._id} className="table-row">
                    <td className="px-5 py-4 text-slate-600 dark:text-dark-300 text-sm">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-dark-300 font-mono">P{s.period}</td>
                    <td className="px-5 py-4 text-slate-900 dark:text-dark-50 font-medium text-sm">{s.originalTeacher?.name || '—'}</td>
                    <td className="px-5 py-4 text-emerald-400 font-medium text-sm">{s.substituteTeacher?.name || '—'}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-dark-300 text-sm">{s.class?.name || '—'}</td>
                    <td className="px-5 py-4"><span className={`text-[10px] px-2 py-1 rounded-full ${statusColors[s.status] || ''}`}>{s.status}</span></td>
                    <td className="px-5 py-4 text-right space-x-1">
                      <PermissionGate permissions={['approve_substitutions']}>
                        {s.status === 'pending' && (
                          <button onClick={() => setConfirmApprove({ id: s._id, status: 'confirmed', name: `P${s.period} - ${s.substituteTeacher?.name || '?'}` })} className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">Approve</button>
                        )}
                        {s.status === 'confirmed' && (
                          <button onClick={() => updateStatus(s._id, 'completed')} className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Complete</button>
                        )}
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* New Substitution Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Substitution" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Date *</label>
              <input value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} type="date" required className="input-field" />
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Period *</label>
              <select value={form.period} onChange={e => { const p = +e.target.value; setForm(f => ({...f, period: p})); if (form.date) { const d = new Date(form.date); const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; checkAvailable(days[d.getDay()], p); }}} className="select-field">
                {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>Period {p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Absent Teacher *</label>
              <select value={form.originalTeacher} onChange={e => setForm(f => ({...f, originalTeacher: e.target.value}))} required className="select-field">
                <option value="">Select</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Substitute Teacher *</label>
              <select value={form.substituteTeacher} onChange={e => setForm(f => ({...f, substituteTeacher: e.target.value}))} required className="select-field">
                <option value="">Select</option>
                {available.length > 0 ? available.map(t => {
                  const tier = getTier(t, form.subject);
                  const load = getTeacherLoad(t._id);
                  return <option key={t._id} value={t._id}>{'★'.repeat(Math.max(1, Math.ceil((t.suitabilityScore || 0) / 25)))} {t.name} ({t.suitabilityScore}%) — {tier.label} — {load}/wk</option>;
                }) : teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
              {/* Confidence & Tier Display */}
              {available.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] text-emerald-400">{available.length} teachers available (ranked by suitability)</p>
                  {form.substituteTeacher && (() => {
                    const sel = available.find(a => a._id === form.substituteTeacher);
                    if (!sel) return null;
                    const tier = getTier(sel, form.subject);
                    const load = getTeacherLoad(sel._id);
                    const score = sel.suitabilityScore || 0;
                    return (
                      <div className="bg-white/40 dark:bg-dark-800/40 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${tier.tier === 1 ? 'bg-emerald-500/20 text-emerald-400' : tier.tier === 2 ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                            Tier {tier.tier}: {tier.label}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-dark-400">{load} periods/wk current load</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${score}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold ${score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{score}%</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Class *</label>
              <select value={form.class} onChange={e => setForm(f => ({...f, class: e.target.value}))} required className="select-field">
                <option value="">Select</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Subject</label>
              <select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} className="select-field">
                <option value="">Any</option>
                {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="input-field" placeholder="Optional notes" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      {/* Approve ConfirmDialog */}
      <ConfirmDialog
        open={!!confirmApprove}
        onClose={() => setConfirmApprove(null)}
        onConfirm={() => confirmApprove && updateStatus(confirmApprove.id, confirmApprove.status)}
        title="Approve Substitution?"
        message={`Confirm approval of substitution: ${confirmApprove?.name || ''}. The substitute teacher will be notified.`}
        confirmText="Approve"
        variant="default"
      />

      {/* Bulk Absence Modal */}
      <Modal isOpen={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Mark Absent" size="md">
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await api.post('/absences/bulk', bulkForm);
            setBulkResult(r.data?.data);
            toast.success(`${r.data?.data?.created?.length || 0} absences created`);
          } catch (err) { toast.error(err.response?.data?.error || err.message); }
        }} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Teacher Names (comma-separated)</label>
            <textarea value={bulkForm.teachers} onChange={e => setBulkForm(f => ({...f, teachers: e.target.value}))}
              className="input-field" rows={4} placeholder="e.g., Sunita Sharma, Rajesh Kumar, Priya Singh"
              required />
            {bulkForm.teachers && (
              <p className="text-[10px] text-primary-500 mt-1">
                {bulkForm.teachers.split(',').map(t => t.trim()).filter(Boolean).length} teacher(s) entered
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Date</label>
              <input type="date" value={bulkForm.date} onChange={e => setBulkForm(f => ({...f, date: e.target.value}))} className="input-field" required /></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Absence Type</label>
              <select value={bulkForm.absenceType} onChange={e => setBulkForm(f => ({...f, absenceType: e.target.value}))} className="select-field">
                <option value="full_day">Full Day</option>
                <option value="selected_periods">Selected Periods</option>
                <option value="half_day_morning">Half Day (Morning)</option>
                <option value="half_day_afternoon">Half Day (Afternoon)</option>
              </select></div>
          </div>
          <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Reason (optional)</label>
            <input value={bulkForm.reason} onChange={e => setBulkForm(f => ({...f, reason: e.target.value}))} className="input-field" placeholder="e.g., Staff meeting, Training" /></div>

          {bulkResult && (
            <div className="rounded-xl border border-slate-200 dark:border-dark-700 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{bulkResult.created?.length || 0} absences created</span>
              </div>
              {bulkResult.created?.length > 0 && (
                <div className="text-xs text-slate-500 dark:text-dark-400 space-y-0.5">
                  {bulkResult.created.map((c, i) => <p key={i}>✓ {c.teacher?.name}</p>)}
                </div>
              )}
              {bulkResult.unresolved?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-amber-500 flex items-center gap-1"><AlertTriangle size={12} />{bulkResult.unresolved.length} not found:</p>
                  <div className="text-xs text-amber-400/70 space-y-0.5 mt-1">
                    {bulkResult.unresolved.map((u, i) => <p key={i}>✗ {u}</p>)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setBulkModal(false)} className="btn-secondary">Close</button>
            <button type="submit" className="btn-primary">Mark Absent</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
