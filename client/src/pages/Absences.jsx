import { useState, useEffect } from 'react';
import { UserMinus, AlertTriangle, CheckCircle, Clock, User, ArrowRight, Loader2, X, Shield, RefreshCw, Calendar } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';

const STATUS_BADGES = {
  active: { cls: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Unresolved' },
  partial: { cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20', label: 'Partial' },
  resolved: { cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', label: 'Resolved' },
  cancelled: { cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20', label: 'Cancelled' }
};

export default function Absences() {
  const [absences, setAbsences] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ teacher: '', date: new Date().toISOString().split('T')[0], absenceType: 'full_day', reason: '', endDate: '', affectedPeriods: [] });

  // Detail/Replace modal
  const [selectedAbsence, setSelectedAbsence] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState({});
  const [loadingAvail, setLoadingAvail] = useState({});

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [absRes, teachRes] = await Promise.all([
        api.get('/absences'),
        api.get('/teachers')
      ]);
      setAbsences(absRes.data?.data || []);
      setTeachers(teachRes.data?.data || teachRes.data || []);
    } catch (err) { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.teacher || !form.date) { toast.error('Teacher and date required'); return; }
    setCreating(true);
    try {
      const res = await api.post('/absences', form);
      const created = res.data?.data;
      toast.success('Absence created');
      setShowCreate(false);
      setForm({ teacher: '', date: new Date().toISOString().split('T')[0], absenceType: 'full_day', reason: '', endDate: '', affectedPeriods: [] });
      loadData();

      // If there are unresolved blocks, show the detail modal immediately
      if (created && created.affectedBlocks?.some(b => b.replacementStatus === 'unresolved')) {
        setSelectedAbsence(created);
        setShowDetail(true);
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const handleCancel = async (id) => {
    try {
      await api.put(`/absences/${id}/cancel`);
      toast.success('Absence cancelled');
      loadData();
    } catch (err) { toast.error('Failed to cancel'); }
  };

  const loadAvailableTeachers = async (absenceId, blockIndex) => {
    setLoadingAvail(prev => ({ ...prev, [blockIndex]: true }));
    try {
      const res = await api.get(`/absences/${absenceId}/available-teachers/${blockIndex}`);
      setAvailableTeachers(prev => ({ ...prev, [blockIndex]: res.data?.data || [] }));
    } catch (err) { toast.error('Failed to load available teachers'); }
    finally { setLoadingAvail(prev => ({ ...prev, [blockIndex]: false })); }
  };

  const assignReplacement = async (absenceId, blockIndex, substituteTeacherId) => {
    try {
      const res = await api.put(`/absences/${absenceId}/resolve`, { blockIndex, substituteTeacherId });
      toast.success('Replacement assigned');
      setSelectedAbsence(res.data?.data);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to assign'); }
  };

  const openDetail = async (abs) => {
    try {
      const res = await api.get(`/absences/${abs._id}`);
      setSelectedAbsence(res.data?.data);
      setShowDetail(true);
      setAvailableTeachers({});
    } catch (err) { toast.error('Failed to load details'); }
  };

  const filteredAbsences = absences.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterTeacher && (a.teacher?._id || a.teacher) !== filterTeacher) return false;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-primary-500" size={32} />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Absence Management</h1>
          <p className="page-subtitle">Track absences and manage replacements</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <UserMinus size={15} /> Record Absence
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field text-sm">
            <option value="">All Status</option>
            <option value="active">Unresolved</option>
            <option value="partial">Partial</option>
            <option value="resolved">Resolved</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Teacher</label>
          <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} className="select-field text-sm min-w-[180px]">
            <option value="">All Teachers</option>
            {teachers.filter(t => t.status === 'active').map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <button onClick={loadData} className="btn-secondary p-2.5"><RefreshCw size={16} /></button>
      </div>

      {/* Absence List */}
      <div className="space-y-3">
        {filteredAbsences.map(abs => {
          const badge = STATUS_BADGES[abs.status] || STATUS_BADGES.active;
          const unresolvedCount = abs.affectedBlocks?.filter(b => b.replacementStatus === 'unresolved').length || 0;
          return (
            <div key={abs._id} className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => openDetail(abs)}>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center shrink-0">
                <UserMinus size={18} className={abs.status === 'resolved' ? 'text-emerald-500' : abs.status === 'partial' ? 'text-amber-500' : 'text-red-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800 dark:text-dark-100">{abs.teacher?.name || 'Unknown Teacher'}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-dark-400">
                  <span className="flex items-center gap-1"><Calendar size={11} />{new Date(abs.date).toLocaleDateString()}</span>
                  <span>{abs.absenceType === 'full_day' ? 'Full Day' : abs.absenceType === 'date_range' ? 'Date Range' : 'Selected Periods'}</span>
                  {abs.affectedBlocks?.length > 0 && <span>{abs.affectedBlocks.length} periods</span>}
                </div>
                {abs.reason && <p className="text-[10px] text-slate-400 mt-1 truncate">{abs.reason}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {unresolvedCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded-lg">
                    <AlertTriangle size={12} /> {unresolvedCount} unresolved
                  </span>
                )}
                {abs.status !== 'cancelled' && (
                  <button onClick={(e) => { e.stopPropagation(); handleCancel(abs._id); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Cancel">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredAbsences.length === 0 && (
          <div className="glass-card p-12 text-center text-slate-400 dark:text-dark-500">
            No absences found
          </div>
        )}
      </div>

      {/* Create Absence Modal */}
      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Record Teacher Absence">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Teacher *</label>
              <select value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} className="select-field">
                <option value="">Select teacher...</option>
                {teachers.filter(t => t.status === 'active').map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Type</label>
                <select value={form.absenceType} onChange={e => setForm({ ...form, absenceType: e.target.value })} className="select-field">
                  <option value="full_day">Full Day</option>
                  <option value="selected_periods">Selected Periods</option>
                  <option value="date_range">Date Range</option>
                </select>
              </div>
            </div>
            {form.absenceType === 'date_range' && (
              <div>
                <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="input-field" />
              </div>
            )}
            {form.absenceType === 'selected_periods' && (
              <div>
                <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Periods (comma-separated)</label>
                <input type="text" placeholder="1,2,3" value={form.affectedPeriods.join(',')}
                  onChange={e => setForm({ ...form, affectedPeriods: e.target.value.split(',').map(Number).filter(n => !isNaN(n) && n > 0) })}
                  className="input-field" />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Reason</label>
              <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-field" rows={2} placeholder="Optional reason" />
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                <strong>Auto-replacement:</strong> The system will automatically try to find available substitute teachers. Any unresolved periods can be manually assigned after creation.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="btn-primary flex items-center gap-2">
                {creating ? <Loader2 className="animate-spin" size={15} /> : <UserMinus size={15} />}
                {creating ? 'Processing...' : 'Record Absence'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail / Replacement Modal */}
      {showDetail && selectedAbsence && (
        <Modal isOpen={showDetail} onClose={() => { setShowDetail(false); setSelectedAbsence(null); setAvailableTeachers({}); }}
          title={`Absence: ${selectedAbsence.teacher?.name || 'Teacher'}`}>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 dark:bg-dark-800/50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 mb-0.5">Date</p>
                <p className="font-medium text-slate-800 dark:text-dark-100">{new Date(selectedAbsence.date).toLocaleDateString()}</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800/50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 mb-0.5">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_BADGES[selectedAbsence.status]?.cls}`}>
                  {STATUS_BADGES[selectedAbsence.status]?.label}
                </span>
              </div>
            </div>

            {selectedAbsence.reason && (
              <p className="text-xs text-slate-500 dark:text-dark-400 italic">"{selectedAbsence.reason}"</p>
            )}

            <h4 className="text-sm font-semibold text-slate-700 dark:text-dark-200">Affected Periods</h4>

            {selectedAbsence.affectedBlocks?.length === 0 ? (
              <p className="text-sm text-slate-400">No teaching periods affected</p>
            ) : (
              <div className="space-y-2">
                {selectedAbsence.affectedBlocks?.map((block, idx) => {
                  const isUnresolved = block.replacementStatus === 'unresolved';
                  const avail = availableTeachers[idx];
                  return (
                    <div key={idx} className={`p-3 rounded-xl border transition-all ${
                      isUnresolved ? 'border-red-300 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10' :
                      'border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isUnresolved ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>P{block.period}</div>
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-dark-100">{block.day} · {block.subject?.name || 'Subject'}</p>
                            <p className="text-[10px] text-slate-400">{block.class?.name || 'Class'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {block.replacementStatus === 'replaced' && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle size={12} /> {block.substituteTeacher?.name || 'Auto'}
                            </span>
                          )}
                          {block.replacementStatus === 'manual' && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                              <User size={12} /> {block.substituteTeacher?.name || 'Manual'}
                            </span>
                          )}
                          {isUnresolved && !avail && (
                            <button onClick={() => loadAvailableTeachers(selectedAbsence._id, idx)}
                              disabled={loadingAvail[idx]}
                              className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
                              {loadingAvail[idx] ? <Loader2 className="animate-spin" size={10} /> : <User size={10} />}
                              Find Replacement
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Available teachers dropdown */}
                      {isUnresolved && avail && (
                        <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800/30 space-y-1">
                          <p className="text-[10px] text-slate-500 font-medium">Available Teachers:</p>
                          {avail.length === 0 ? (
                            <p className="text-xs text-red-400">No available teachers found for this period</p>
                          ) : (
                            avail.filter(t => !t.isBusy).slice(0, 8).map(t => (
                              <div key={t._id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-dark-800 hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[9px] font-bold text-primary-600">{t.name?.charAt(0)}</div>
                                  <div>
                                    <p className="text-xs font-medium text-slate-700 dark:text-dark-200">{t.name}</p>
                                    <p className="text-[9px] text-slate-400">{t.department} · {t.dailyPeriods}/{t.maxPeriodsPerDay} periods today</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {t.workloadWarning && <AlertTriangle size={10} className="text-amber-400" title="Near workload limit" />}
                                  {!t.canTeachSubject && <span className="text-[8px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">Other subject</span>}
                                  <button onClick={() => assignReplacement(selectedAbsence._id, idx, t._id)}
                                    className="px-2 py-1 rounded-lg bg-primary-500 text-white text-[10px] font-medium hover:bg-primary-600 transition-colors flex items-center gap-1">
                                    <ArrowRight size={10} /> Assign
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
