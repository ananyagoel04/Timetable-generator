import { useState, useEffect } from 'react';
import { CalendarDays, Plus, Edit, Archive, CheckCircle, Copy, Loader2, RefreshCw, AlertTriangle, Play } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

export default function SessionManagement() {
  const { switchSession, selectedSession, sessionName } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', startDate: '', endDate: '' });

  // Copy setup modal
  const [showCopy, setShowCopy] = useState(false);
  const [copyTarget, setCopyTarget] = useState(null);
  const [copySource, setCopySource] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sessions');
      setSessions(res.data || []);
    } catch (err) { toast.error(err.message || 'Failed to load sessions'); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Session name is required');
    setCreating(true);
    try {
      await api.post('/sessions', form);
      toast.success('Session created');
      setShowCreate(false);
      setForm({ name: '', startDate: '', endDate: '' });
      fetchSessions();
    } catch (err) { toast.error(err.message || 'Failed to create session'); }
    setCreating(false);
  };

  const handleEdit = async () => {
    try {
      await api.put(`/sessions/${editSession._id}`, editForm);
      toast.success('Session updated');
      setShowEdit(false);
      fetchSessions();
    } catch (err) { toast.error(err.message || 'Failed to update'); }
  };

  const handleActivate = async (id, name) => {
    if (!window.confirm(`Activate "${name}" and archive all other sessions?`)) return;
    try {
      await api.put(`/sessions/${id}/activate`);
      toast.success(`"${name}" is now the active session`);
      switchSession(id, name);
      fetchSessions();
    } catch (err) { toast.error(err.message || 'Failed to activate'); }
  };

  const handleArchive = async (id, name) => {
    if (!window.confirm(`Archive session "${name}"? Data will be preserved.`)) return;
    try {
      await api.put(`/sessions/${id}/archive`);
      toast.success('Session archived');
      fetchSessions();
    } catch (err) { toast.error(err.message || 'Failed to archive'); }
  };

  const handleCopySetup = async () => {
    if (!copySource) return toast.error('Select a source session');
    setCopying(true);
    try {
      const res = await api.post(`/sessions/${copyTarget._id}/copy-setup`, { sourceSessionId: copySource });
      const c = res.data?.copied || res.copied || {};
      toast.success(`Copied: ${c.classes || 0} classes, ${c.requirements || 0} requirements, ${c.periodStructures || 0} period structures`);
      setShowCopy(false);
      setCopySource('');
    } catch (err) { toast.error(err.message || 'Failed to copy setup'); }
    setCopying(false);
  };

  const openEdit = (s) => {
    setEditSession(s);
    setEditForm({
      name: s.name,
      startDate: s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : '',
      endDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : ''
    });
    setShowEdit(true);
  };

  const openCopy = (s) => {
    setCopyTarget(s);
    setCopySource('');
    setShowCopy(true);
  };

  const statusColors = {
    active: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
    draft: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
    archived: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-500/30'
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Academic Sessions</h1>
          <p className="page-subtitle">{sessions.length} session{sessions.length !== 1 ? 's' : ''} · Manage academic year periods</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSessions} className="btn-secondary p-2.5"><RefreshCw size={16} /></button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> New Session
          </button>
        </div>
      </div>

      {/* Current Session Banner */}
      {sessionName && (
        <div className="glass-card p-4 flex items-center gap-3 border-l-4 border-l-emerald-500">
          <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-400">Currently Active Session</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-dark-50">{sessionName}</p>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <CalendarDays size={40} className="mx-auto text-slate-300 dark:text-dark-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-dark-400">No sessions yet. Create your first academic session.</p>
          </div>
        ) : sessions.map(s => (
          <div key={s._id} className={`glass-card p-4 flex items-center justify-between flex-wrap gap-3 ${
            selectedSession === s._id ? 'ring-2 ring-emerald-500/30' : ''
          }`}>
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                s.isCurrent ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-400 to-slate-500'
              }`}>
                <CalendarDays size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-dark-50 truncate">{s.name}</p>
                  {s.isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 font-semibold uppercase">Active</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-dark-400">
                  {s.startDate ? new Date(s.startDate).toLocaleDateString('en-IN') : '—'} → {s.endDate ? new Date(s.endDate).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge border text-[10px] ${statusColors[s.status] || statusColors.draft}`}>
                {s.status || 'draft'}
              </span>

              {/* Actions */}
              <div className="flex gap-1">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" title="Edit">
                  <Edit size={14} />
                </button>
                {!s.isCurrent && (
                  <button onClick={() => handleActivate(s._id, s.name)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Activate">
                    <Play size={14} />
                  </button>
                )}
                {s.isCurrent ? null : (
                  <button onClick={() => handleArchive(s._id, s.name)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title="Archive">
                    <Archive size={14} />
                  </button>
                )}
                <button onClick={() => openCopy(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Copy setup from another session">
                  <Copy size={14} />
                </button>
                {selectedSession !== s._id && (
                  <button onClick={() => switchSession(s._id, s.name)} className="text-[10px] px-2 py-1 rounded-lg bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors font-medium">
                    Switch
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Session">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Session Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder={`e.g., ${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}`} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary text-sm flex items-center gap-2">
              {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              {creating ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit: ${editSession?.name}`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Session Name</label>
            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Start Date</label>
              <input type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">End Date</label>
              <input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowEdit(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleEdit} className="btn-primary text-sm">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Copy Setup Modal */}
      <Modal isOpen={showCopy} onClose={() => setShowCopy(false)} title={`Copy Setup → ${copyTarget?.name}`}>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">This will copy classes, requirements, period structures, and teacher capabilities from the source session into <strong>{copyTarget?.name}</strong>. Existing data in the target will NOT be overwritten.</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Copy From Session</label>
            <select value={copySource} onChange={e => setCopySource(e.target.value)} className="select-field">
              <option value="">Select source session...</option>
              {sessions.filter(s => s._id !== copyTarget?._id).map(s => (
                <option key={s._id} value={s._id}>{s.name} {s.isCurrent ? '(Current)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCopy(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleCopySetup} disabled={copying || !copySource} className="btn-primary text-sm flex items-center gap-2">
              {copying ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
              {copying ? 'Copying...' : 'Copy Setup'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
