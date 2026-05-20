import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Clock, Coffee, Utensils, Flag } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const typeConfig = {
  period: { icon: Clock, color: 'bg-primary-500/20 border-primary-500/30 text-primary-400', label: 'Period' },
  break: { icon: Coffee, color: 'bg-amber-500/20 border-amber-500/30 text-amber-400', label: 'Break' },
  lunch: { icon: Utensils, color: 'bg-orange-500/20 border-orange-500/30 text-orange-400', label: 'Lunch' },
  assembly: { icon: Flag, color: 'bg-purple-500/20 border-purple-500/30 text-purple-400', label: 'Assembly' },
};

export default function PeriodStructure() {
  const [structure, setStructure] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/setup/period-structure').then(r => {
      setStructure(r.data);
      setSlots(r.data?.timeslots || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const addSlot = (type = 'period') => {
    const last = slots[slots.length - 1];
    const lastEnd = last?.endTime || '08:00';
    const newStart = lastEnd;
    const [h, m] = newStart.split(':').map(Number);
    const dur = type === 'period' ? 40 : type === 'lunch' ? 40 : 20;
    const endMin = h * 60 + m + dur;
    const newEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    const num = slots.length + 1;
    setSlots([...slots, {
      slotNumber: num,
      label: type === 'period' ? `Period ${slots.filter(s => s.type === 'period').length + 1}` : type.charAt(0).toUpperCase() + type.slice(1),
      startTime: newStart, endTime: newEnd, type, isSchedulable: type === 'period'
    }]);
  };

  const updateSlot = (index, field, value) => {
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-set isSchedulable
    if (field === 'type') updated[index].isSchedulable = value === 'period';
    setSlots(updated);
  };

  const removeSlot = (index) => {
    const updated = slots.filter((_, i) => i !== index).map((s, i) => ({ ...s, slotNumber: i + 1 }));
    setSlots(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/setup/period-structure', { timeslots: slots });
      toast.success('Period structure saved!');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // Calculate visual timeline
  const totalMinutes = slots.reduce((sum, s) => {
    const [sh, sm] = (s.startTime || '08:00').split(':').map(Number);
    const [eh, em] = (s.endTime || '08:40').split(':').map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);

  if (loading) return <div className="text-center py-16 text-dark-400">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Period & Break Structure</h1><p className="page-subtitle">{slots.length} slots · {slots.filter(s => s.type === 'period').length} teaching periods</p></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Structure'}</button>
      </div>

      {/* Visual Timeline Preview */}
      <div className="glass-card p-4">
        <p className="text-xs text-dark-400 mb-3 font-medium">Day Timeline Preview</p>
        <div className="flex gap-0.5 h-12 rounded-xl overflow-hidden">
          {slots.map((s, i) => {
            const [sh, sm] = (s.startTime || '08:00').split(':').map(Number);
            const [eh, em] = (s.endTime || '08:40').split(':').map(Number);
            const dur = (eh * 60 + em) - (sh * 60 + sm);
            const pct = totalMinutes > 0 ? (dur / totalMinutes) * 100 : 10;
            const cfg = typeConfig[s.type] || typeConfig.period;
            return (
              <div key={i} style={{ width: `${pct}%` }}
                className={`flex flex-col items-center justify-center rounded-lg border ${cfg.color} text-[9px] font-medium min-w-[30px] transition-all`}
                title={`${s.label}: ${s.startTime}–${s.endTime}`}>
                <span className="truncate px-1">{s.label}</span>
                <span className="opacity-60">{s.startTime}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editable Slot List */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-700/50 bg-dark-800/40 flex items-center">
          <p className="font-semibold text-white text-sm flex-1">Configure Timeslots</p>
          <div className="flex gap-2">
            <button onClick={() => addSlot('period')} className="text-xs px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors flex items-center gap-1"><Plus size={12} /> Period</button>
            <button onClick={() => addSlot('break')} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1"><Plus size={12} /> Break</button>
            <button onClick={() => addSlot('lunch')} className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors flex items-center gap-1"><Plus size={12} /> Lunch</button>
          </div>
        </div>
        <div className="divide-y divide-dark-700/30">
          {slots.map((slot, i) => {
            const cfg = typeConfig[slot.type] || typeConfig.period;
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-dark-800/30 transition-colors group">
                <GripVertical size={14} className="text-dark-600 cursor-grab shrink-0" />
                <span className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-xs font-bold text-dark-300 shrink-0">{slot.slotNumber}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${cfg.color} shrink-0`}><Icon size={14} /></div>
                <input value={slot.label} onChange={e => updateSlot(i, 'label', e.target.value)} className="input-field py-1.5 text-sm w-32" />
                <select value={slot.type} onChange={e => updateSlot(i, 'type', e.target.value)} className="select-field py-1.5 text-sm w-28">
                  <option value="period">Period</option><option value="break">Break</option><option value="lunch">Lunch</option><option value="assembly">Assembly</option>
                </select>
                <input value={slot.startTime} onChange={e => updateSlot(i, 'startTime', e.target.value)} type="time" className="input-field py-1.5 text-sm w-28" />
                <span className="text-dark-500 text-xs">to</span>
                <input value={slot.endTime} onChange={e => updateSlot(i, 'endTime', e.target.value)} type="time" className="input-field py-1.5 text-sm w-28" />
                <label className="flex items-center gap-1.5 shrink-0">
                  <input type="checkbox" checked={slot.isSchedulable} onChange={e => updateSlot(i, 'isSchedulable', e.target.checked)} className="w-3.5 h-3.5 rounded" />
                  <span className="text-[10px] text-dark-400">Teach</span>
                </label>
                <button onClick={() => removeSlot(i)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-dark-500">💡 Add any number of periods, breaks, lunch, and assembly slots. The timetable engine will use this structure for all classes.</p>
    </div>
  );
}
