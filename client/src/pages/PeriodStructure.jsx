import { useState, useEffect } from 'react';
import { Clock, Coffee, Utensils, Flag, Plus, Copy, Trash2, Check, Archive, GripVertical, Users, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
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
  const [slots, setSlots] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', templateType: 'default', description: '', workingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] });
  const [saturdayEnabled, setSaturdayEnabled] = useState(false);
  const [saturdaySlots, setSaturdaySlots] = useState([]);

  useEffect(() => {
    loadStructures();
    api.get('/classes').then(r => setClasses(r.data || []));
  }, []);

  const loadStructures = async () => {
    setLoading(true);
    const r = await api.get('/setup/period-structures');
    const list = r.data || [];
    setStructures(list);
    if (list.length > 0 && !selected) selectStructure(list[0]);
    setLoading(false);
  };

  const selectStructure = (s) => {
    setSelected(s);
    setSlots(s.timeslots || []);
    setAssignedClasses(s.assignedTo?.classes?.map(c => c._id || c) || []);
    setSaturdayEnabled(s.saturdayConfig?.enabled || false);
    setSaturdaySlots(s.saturdayConfig?.timeslots || []);
  };

  const addSlot = (type = 'period') => {
    const last = slots[slots.length - 1];
    const start = last ? last.endTime : '08:00';
    const dur = type === 'period' ? 40 : type === 'lunch' ? 40 : 20;
    const [h, m] = start.split(':').map(Number);
    const endMin = h * 60 + m + dur;
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    setSlots([...slots, { label: type === 'period' ? `Period ${slots.filter(s => s.type === 'period').length + 1}` : type === 'lunch' ? 'Lunch Break' : type === 'break' ? 'Short Break' : type.charAt(0).toUpperCase() + type.slice(1), slotNumber: slots.length + 1, startTime: start, endTime: end, type, isSchedulable: type === 'period' }]);
  };

  const updateSlot = (i, field, value) => {
    const updated = [...slots];
    updated[i] = { ...updated[i], [field]: value };
    if (field === 'type') updated[i].isSchedulable = value === 'period';
    setSlots(updated);
  };

  const removeSlot = (i) => {
    const updated = slots.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, slotNumber: idx + 1 }));
    setSlots(updated);
  };

  const saveStructure = async () => {
    if (!selected) return;
    try {
      await api.put(`/setup/period-structures/${selected._id}`, {
        timeslots: slots,
        saturdayConfig: { enabled: saturdayEnabled, timeslots: saturdaySlots }
      });
      toast.success('Structure saved');
      loadStructures();
    } catch (err) { toast.error(err.message); }
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

  const getDuration = (start, end) => {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  };

  const totalMinutes = slots.reduce((sum, s) => sum + getDuration(s.startTime, s.endTime), 0);
  const teachingPeriods = slots.filter(s => s.isSchedulable).length;

  if (loading) return <div className="text-center py-16 text-dark-400">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="page-title">Period & Break Structure</h1><p className="page-subtitle">{structures.length} structure{structures.length !== 1 ? 's' : ''} · {selected ? `Editing: ${selected.name}` : 'Select a structure'}</p></div>
        <div className="flex gap-2">
          <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Structure</button>
          {selected && <button onClick={saveStructure} className="btn-secondary flex items-center gap-2"><Check size={16} /> Save</button>}
        </div>
      </div>

      {/* Structure List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {structures.filter(s => s.status !== 'archived').map(s => (
          <div key={s._id} onClick={() => selectStructure(s)}
            className={`glass-card-hover p-4 cursor-pointer transition-all ${selected?._id === s._id ? 'ring-2 ring-primary-500/50 border-primary-500/30' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white truncate">{s.name}</p>
              <span className={templateBadge[s.templateType] || 'badge'}>{s.templateType}</span>
            </div>
            <p className="text-xs text-dark-500 mb-2">{s.timeslots?.length || 0} slots · {s.timeslots?.filter(t => t.isSchedulable).length || 0} teaching</p>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'draft' ? 'bg-amber-500/20 text-amber-400' : 'bg-dark-700 text-dark-500'}`}>{s.status}</span>
              <div className="flex gap-1">
                <button onClick={e => { e.stopPropagation(); cloneStructure(s._id); }} className="p-1 rounded hover:bg-dark-700 text-dark-500 hover:text-white" title="Clone"><Copy size={13} /></button>
                <button onClick={e => { e.stopPropagation(); archiveStructure(s._id); }} className="p-1 rounded hover:bg-red-500/20 text-dark-500 hover:text-red-400" title="Archive"><Archive size={13} /></button>
              </div>
            </div>
            {s.assignedTo?.classes?.length > 0 && (
              <p className="text-[10px] text-primary-400 mt-1"><Users size={10} className="inline mr-1" />{s.assignedTo.classes.length} class{s.assignedTo.classes.length > 1 ? 'es' : ''} assigned</p>
            )}
          </div>
        ))}
      </div>

      {selected && <>
        {/* Assignment */}
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Assigned Classes</p>
            <p className="text-xs text-dark-400">{assignedClasses.length} class{assignedClasses.length !== 1 ? 'es' : ''} using this structure</p>
          </div>
          <button onClick={() => setAssignModal(true)} className="btn-secondary text-sm"><Users size={14} className="inline mr-1" /> Manage</button>
        </div>

        {/* Visual Timeline */}
        <div className="glass-card p-4">
          <p className="text-xs font-semibold text-dark-400 mb-3">Daily Timeline — {totalMinutes} min total · {teachingPeriods} teaching periods</p>
          <div className="flex rounded-xl overflow-hidden h-10 bg-dark-800">
            {slots.map((slot, i) => {
              const dur = getDuration(slot.startTime, slot.endTime);
              const pct = (dur / totalMinutes) * 100;
              const cfg = slotTypeConfig[slot.type] || slotTypeConfig.period;
              return (
                <div key={i} className={`${cfg.bg} flex items-center justify-center border-r border-dark-700/30 text-[9px] font-medium ${cfg.color} overflow-hidden`}
                  style={{ width: `${pct}%` }} title={`${slot.label} (${slot.startTime}–${slot.endTime})`}>
                  {pct > 5 && slot.label.slice(0, 8)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Editable Slot List */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-dark-400">Slot Configuration</p>
            <div className="flex gap-2">
              {Object.entries(slotTypeConfig).map(([type, cfg]) => {
                const Icon = cfg.icon;
                return <button key={type} onClick={() => addSlot(type)} className={`text-[10px] px-2 py-1 rounded-lg ${cfg.bg} ${cfg.color} hover:opacity-80`}><Icon size={10} className="inline mr-1" />+ {type}</button>;
              })}
            </div>
          </div>
          {slots.map((slot, i) => {
            const cfg = slotTypeConfig[slot.type] || slotTypeConfig.period;
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-dark-800/40 border border-dark-700/30">
                <GripVertical size={14} className="text-dark-600 shrink-0 cursor-grab" />
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${cfg.bg} shrink-0`}><Icon size={12} className={cfg.color} /></span>
                <input value={slot.label} onChange={e => updateSlot(i, 'label', e.target.value)} className="input-field text-xs py-1.5 flex-1 min-w-[100px]" />
                <select value={slot.type} onChange={e => updateSlot(i, 'type', e.target.value)} className="select-field text-xs py-1.5 w-24">
                  {Object.keys(slotTypeConfig).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={slot.startTime} onChange={e => updateSlot(i, 'startTime', e.target.value)} type="time" className="input-field text-xs py-1.5 w-24" />
                <input value={slot.endTime} onChange={e => updateSlot(i, 'endTime', e.target.value)} type="time" className="input-field text-xs py-1.5 w-24" />
                <label className="flex items-center gap-1 text-[10px] text-dark-400 shrink-0">
                  <input type="checkbox" checked={slot.isSchedulable} onChange={e => updateSlot(i, 'isSchedulable', e.target.checked)} className="rounded" /> Teach
                </label>
                <button onClick={() => removeSlot(i)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-dark-500 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>

        {/* Saturday Config */}
        <div className="glass-card p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div><p className="text-sm font-medium text-white">Separate Saturday Schedule</p>
              <p className="text-xs text-dark-400">Define different timeslots for Saturday</p></div>
            <div className="relative">
              <input type="checkbox" checked={saturdayEnabled} onChange={e => setSaturdayEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-dark-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </div>
          </label>
          {saturdayEnabled && (
            <div className="mt-3 pt-3 border-t border-dark-700/30">
              <p className="text-xs text-dark-400 mb-2">{saturdaySlots.length} Saturday slots</p>
              <button onClick={() => setSaturdaySlots([...saturdaySlots, { label: `Sat P${saturdaySlots.length + 1}`, slotNumber: saturdaySlots.length + 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true }])}
                className="btn-secondary text-xs"><Plus size={12} className="inline mr-1" /> Add Saturday Slot</button>
            </div>
          )}
        </div>
      </>}

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create Period Structure">
        <form onSubmit={createStructure} className="space-y-4">
          <div><label className="text-xs text-dark-400 mb-1 block">Name</label>
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="e.g., Junior School Schedule" required /></div>
          <div><label className="text-xs text-dark-400 mb-1 block">Template Type</label>
            <select value={createForm.templateType} onChange={e => setCreateForm(f => ({ ...f, templateType: e.target.value }))} className="select-field">
              {Object.keys(templateBadge).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select></div>
          <div><label className="text-xs text-dark-400 mb-1 block">Description</label>
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
            <label key={c._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-dark-800/40 cursor-pointer">
              <input type="checkbox" checked={assignedClasses.includes(c._id)} onChange={() => toggleClassAssign(c._id)} className="rounded border-dark-600" />
              <span className="text-sm text-dark-200">{c.name}</span>
              <span className="text-[10px] text-dark-500 ml-auto">{c.stream !== 'none' ? c.stream : ''} · {c.studentCount} students</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setAssignModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={assignClasses} className="btn-primary">{assignedClasses.length} Classes Selected — Assign</button>
        </div>
      </Modal>
    </div>
  );
}
