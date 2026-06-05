import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Coffee, Utensils, Flag, Plus, Copy, Trash2, Check, Archive, Users, ChevronDown, Eye, EyeOff, Layers } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import PeriodOverride from '../components/PeriodOverride';
import TimetablePreview from '../components/TimetablePreview';
import { dedupeBreaks, DAY_NAMES } from '../utils/breakUtils';
import toast from 'react-hot-toast';

const slotTypeConfig = {
  period: { icon: Clock, color: 'text-primary-400', bg: 'bg-primary-500/20' },
  break: { icon: Coffee, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  lunch: { icon: Utensils, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  assembly: { icon: Flag, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  activity: { icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
};

const templateBadge = {
  default: 'badge-info', junior: 'badge-success', senior: 'badge-purple',
  half_day: 'badge-warning', exam: 'badge-danger', saturday: 'badge-info',
  event: 'badge-purple', remedial: 'badge-warning', custom: 'badge'
};

export default function PeriodStructure() {
  const [structures, setStructures] = useState([]);
  const [selected, setSelected] = useState(null);
  const [classes, setClasses] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [createForm, setCreateForm] = useState({
    name: '',
    templateType: 'default',
    description: '',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  });

  // Editable state
  const [defaultTemplate, setDefaultTemplate] = useState([]);
  const [dayOverrides, setDayOverrides] = useState({});
  const [workingDays, setWorkingDays] = useState([]);
  const [previewDay, setPreviewDay] = useState(null); // null = default

  useEffect(() => {
    loadStructures();
    api.get('/classes').then(r => setClasses(r.data || []));
  }, []);

  const loadStructures = async () => {
    setLoading(true);
    try {
      const r = await api.get('/setup/period-structures');
      const list = r.data || [];
      setStructures(list);
      if (list.length > 0 && !selected) selectStructure(list[0]);
    } catch (err) {
      toast.error('Failed to load structures');
    }
    setLoading(false);
  };

  const selectStructure = (s) => {
    setSelected(s);
    setDefaultTemplate(s.defaultDayTemplate || s.timeslots || []);
    setAssignedClasses(s.assignedTo?.classes?.map(c => c._id || c) || []);
    setWorkingDays(s.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    setDirty(false);

    // Parse dayOverrides from Map
    const overrides = {};
    if (s.dayOverrides) {
      // Handle both Map-like object and plain object
      const entries = s.dayOverrides instanceof Map
        ? [...s.dayOverrides.entries()]
        : Object.entries(s.dayOverrides);
      entries.forEach(([day, slots]) => {
        if (slots && slots.length > 0) overrides[day] = slots;
      });
    }
    setDayOverrides(overrides);
    setPreviewDay(null);
  };

  const handleSlotsChange = useCallback((dayName, newSlots) => {
    if (dayName === null) {
      // Updating default template
      setDefaultTemplate(newSlots || []);
    } else if (newSlots === null) {
      // Remove override for this day
      setDayOverrides(prev => {
        const next = { ...prev };
        delete next[dayName];
        return next;
      });
    } else {
      // Set override for this day
      setDayOverrides(prev => ({ ...prev, [dayName]: newSlots }));
    }
    setDirty(true);
    // Update preview to show the day being edited
    setPreviewDay(dayName);
  }, []);

  const saveStructure = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/setup/period-structures/${selected._id}`, {
        defaultDayTemplate: defaultTemplate,
        timeslots: defaultTemplate, // backward compat
        dayOverrides: dayOverrides,
        workingDays: workingDays,
      });
      toast.success('Structure saved');
      setDirty(false);
      loadStructures();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  const createStructure = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/setup/period-structures', createForm);
      toast.success('Structure created');
      setCreateModal(false);
      loadStructures();
      selectStructure(r.data);
    } catch (err) { toast.error(err.message); }
  };

  const cloneStructure = async (id) => {
    try {
      await api.post(`/setup/period-structures/${id}/clone`);
      toast.success('Structure cloned');
      loadStructures();
    } catch (err) { toast.error(err.message); }
  };

  const archiveStructure = async (id) => {
    try {
      await api.delete(`/setup/period-structures/${id}`);
      toast.success('Structure archived');
      if (selected?._id === id) setSelected(null);
      loadStructures();
    } catch (err) { toast.error(err.message); }
  };

  const assignClasses = async () => {
    if (!selected) return;
    try {
      await api.put(`/setup/period-structures/${selected._id}/assign`, { classes: assignedClasses });
      toast.success('Classes assigned');
      setAssignModal(false);
      loadStructures();
    } catch (err) { toast.error(err.message); }
  };

  const toggleClassAssign = (cid) => {
    setAssignedClasses(prev => prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]);
  };

  const toggleWorkingDay = (day) => {
    setWorkingDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      setDirty(true);
      return next;
    });
  };

  // Preview slots (with break deduplication)
  const previewSlots = useMemo(() => {
    if (previewDay && dayOverrides[previewDay]) {
      return dedupeBreaks(dayOverrides[previewDay]);
    }
    return dedupeBreaks(defaultTemplate);
  }, [previewDay, dayOverrides, defaultTemplate]);

  if (loading) return <div className="text-center py-16 text-slate-500 dark:text-dark-400">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Period & Break Structure</h1>
          <p className="page-subtitle">
            {structures.length} structure{structures.length !== 1 ? 's' : ''} · {selected ? `Editing: ${selected.name}` : 'Select a structure'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Structure
          </button>
        </div>
      </div>

      {/* Structure List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {structures.filter(s => s.status !== 'archived').map(s => (
          <div key={s._id} onClick={() => selectStructure(s)}
            className={`glass-card-hover p-4 cursor-pointer transition-all ${selected?._id === s._id ? 'ring-2 ring-primary-500/50 border-primary-500/30' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-dark-50 truncate">{s.name}</p>
              <span className={templateBadge[s.templateType] || 'badge'}>{s.templateType}</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-dark-500 mb-2">
              {(s.defaultDayTemplate || s.timeslots)?.length || 0} slots ·{' '}
              {(s.defaultDayTemplate || s.timeslots)?.filter(t => t.isSchedulable).length || 0} teaching
              {s.dayOverrides && Object.keys(s.dayOverrides).length > 0 && (
                <span className="ml-1 text-amber-400">
                  · {Object.keys(s.dayOverrides).length} override{Object.keys(s.dayOverrides).length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'draft' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-200 dark:bg-dark-700 text-slate-400 dark:text-dark-500'}`}>{s.status}</span>
              <div className="flex gap-1">
                <button onClick={e => { e.stopPropagation(); cloneStructure(s._id); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-400 dark:text-dark-500 hover:text-slate-900 dark:hover:text-dark-50" title="Clone"><Copy size={13} /></button>
                <button onClick={e => { e.stopPropagation(); archiveStructure(s._id); }} className="p-1 rounded hover:bg-red-500/20 text-slate-400 dark:text-dark-500 hover:text-red-400" title="Archive"><Archive size={13} /></button>
              </div>
            </div>
            {s.assignedTo?.classes?.length > 0 && (
              <p className="text-[10px] text-primary-400 mt-1"><Users size={10} className="inline mr-1" />{s.assignedTo.classes.length} class{s.assignedTo.classes.length > 1 ? 'es' : ''} assigned</p>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <>
          {/* Working Days Selector */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-dark-50">Working Days</p>
                <p className="text-xs text-slate-500 dark:text-dark-400">Select which days this structure applies to</p>
              </div>
              <button onClick={() => setAssignModal(true)} className="btn-secondary text-sm">
                <Users size={14} className="inline mr-1" /> Assign Classes
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.slice(1).concat(DAY_NAMES.slice(0, 1)).map(day => (
                <button
                  key={day}
                  onClick={() => toggleWorkingDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    workingDays.includes(day)
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-500 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Main editor + preview layout */}
          <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
            {/* Left: Period Override Editor */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={16} className="text-primary-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-dark-50">Slot Configuration</p>
              </div>
              <PeriodOverride
                defaultTemplate={defaultTemplate}
                dayOverrides={dayOverrides}
                workingDays={workingDays}
                onSlotsChange={handleSlotsChange}
                onSave={saveStructure}
                saving={saving}
                dirty={dirty}
              />
            </div>

            {/* Right: Live Preview */}
            {showPreview && (
              <div className="space-y-4">
                {/* Preview day selector */}
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setPreviewDay(null)}
                    className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
                      previewDay === null ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-800 text-slate-400'
                    }`}
                  >
                    Default
                  </button>
                  {workingDays.map(day => (
                    <button
                      key={day}
                      onClick={() => setPreviewDay(day)}
                      className={`text-[10px] px-2 py-1 rounded-lg transition-all relative ${
                        previewDay === day ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-dark-800 text-slate-400'
                      }`}
                    >
                      {day.slice(0, 3)}
                      {dayOverrides[day] && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  ))}
                </div>

                <TimetablePreview
                  slots={previewSlots}
                  dayLabel={previewDay || 'Default Template'}
                  compact
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create Period Structure">
        <form onSubmit={createStructure} className="space-y-4">
          <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Name</label>
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="e.g., Junior School Schedule" required /></div>
          <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Template Type</label>
            <select value={createForm.templateType} onChange={e => setCreateForm(f => ({ ...f, templateType: e.target.value }))} className="select-field">
              {Object.keys(templateBadge).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select></div>
          <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Description</label>
            <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className="input-field" rows={2} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title="Assign Classes" size="lg">
        <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
          {classes.map(c => (
            <label key={c._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100/40 dark:hover:bg-dark-800/40 cursor-pointer">
              <input type="checkbox" checked={assignedClasses.includes(c._id)} onChange={() => toggleClassAssign(c._id)} className="rounded border-slate-400 dark:border-dark-600" />
              <span className="text-sm text-slate-700 dark:text-dark-200">{c.name}</span>
              <span className="text-[10px] text-slate-400 dark:text-dark-500 ml-auto">{c.stream !== 'none' ? c.stream : ''} · {c.studentCount} students</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setAssignModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={assignClasses} className="btn-primary">{assignedClasses.length} Classes Selected — Assign</button>
        </div>
      </Modal>

      {/* Floating save */}
      {dirty && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <button onClick={saveStructure} disabled={saving} className="btn-primary shadow-2xl shadow-primary-500/30 flex items-center gap-2 px-5 py-2.5 text-sm">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
            {saving ? 'Saving...' : 'Save Structure'}
          </button>
        </div>
      )}
    </div>
  );
}
