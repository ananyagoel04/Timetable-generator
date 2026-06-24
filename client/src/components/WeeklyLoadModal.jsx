import { useState, useEffect, useCallback } from 'react';
import { X, Save, AlertTriangle, Info, Clock, Layers, Beaker, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MODES = [
  { value: 'strict', label: 'Strict', desc: 'Must be exactly this many periods', color: 'text-red-400' },
  { value: 'preferred', label: 'Preferred', desc: 'Try to match, allow deviation', color: 'text-amber-400' },
  { value: 'flexible', label: 'Flexible', desc: 'Range-based, most lenient', color: 'text-emerald-400' }
];

export default function WeeklyLoadModal({ isOpen, onClose, requirement, className, subjectName, onSaved }) {
  const [form, setForm] = useState({
    periodsPerWeek: 0,
    minPeriodsPerWeek: 0,
    maxPeriodsPerWeek: 0,
    mode: 'preferred',
    priority: 50,
    preferredDays: [],
    preferredPeriods: [],
    avoidPeriods: [],
    requiresLab: false,
    roomType: 'classroom',
    allowDoublePeriod: false,
    consecutivePreference: 'none',
    consecutiveCount: 2,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);

  // Load requirement data into form
  useEffect(() => {
    if (!requirement) return;
    setForm({
      periodsPerWeek: requirement.periodsPerWeek || 0,
      minPeriodsPerWeek: requirement.minPeriods || requirement.minPeriodsPerWeek || requirement.periodsPerWeek || 0,
      maxPeriodsPerWeek: requirement.maxPeriods || requirement.maxPeriodsPerWeek || requirement.periodsPerWeek || 0,
      mode: requirement.mode || 'preferred',
      priority: requirement.priority || 50,
      preferredDays: requirement.preferredDays || [],
      preferredPeriods: requirement.preferredPeriods || [],
      avoidPeriods: requirement.avoidedPeriods || requirement.avoidPeriods || [],
      requiresLab: requirement.subject?.requiresLab || false,
      roomType: requirement.subject?.requiresSpecialRoom || 'classroom',
      allowDoublePeriod: requirement.allowDoublePeriod || false,
      consecutivePreference: requirement.consecutivePreference || 'none',
      consecutiveCount: requirement.consecutiveCount || 2,
    });
    setDirty(false);
    setErrors({});
  }, [requirement]);

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  };

  // Validate
  useEffect(() => {
    const e = {};
    if (form.maxPeriodsPerWeek < form.minPeriodsPerWeek) e.maxPeriodsPerWeek = 'Max cannot be less than min';
    if (form.periodsPerWeek < form.minPeriodsPerWeek) e.periodsPerWeek = 'Below minimum';
    if (form.periodsPerWeek > form.maxPeriodsPerWeek && form.maxPeriodsPerWeek > 0) e.periodsPerWeek = 'Exceeds maximum';
    if (form.periodsPerWeek > 30) e.periodsPerWeek = 'Too many periods for a week';
    setErrors(e);
  }, [form.periodsPerWeek, form.minPeriodsPerWeek, form.maxPeriodsPerWeek]);

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) return toast.error('Fix validation errors first');
    if (!requirement?._id) return toast.error('No requirement selected');
    setSaving(true);
    try {
      await api.put(`/requirements/${requirement._id}`, {
        periodsPerWeek: form.periodsPerWeek,
        minPeriods: form.minPeriodsPerWeek,
        maxPeriods: form.maxPeriodsPerWeek,
        mode: form.mode,
        priority: form.priority,
        preferredDays: form.preferredDays,
        preferredPeriods: form.preferredPeriods,
        avoidedPeriods: form.avoidPeriods,
        allowDoublePeriod: form.allowDoublePeriod,
        consecutivePreference: form.consecutivePreference,
        consecutiveCount: form.consecutiveCount,
      });
      toast.success('Weekly load updated');
      setDirty(false);
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (dirty && !window.confirm('You have unsaved changes. Discard?')) return;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-dark-900 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-dark-700/50 w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 flex items-center gap-2">
              <Layers size={18} className="text-primary-500" /> Edit Weekly Load
            </h2>
            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">
              {className} · <span className="text-primary-400">{subjectName}</span>
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Periods per week */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Periods/Week</label>
              <input type="number" min={0} max={30} value={form.periodsPerWeek}
                onChange={e => update('periodsPerWeek', parseInt(e.target.value) || 0)}
                className={`input-field text-center font-bold text-lg ${errors.periodsPerWeek ? 'border-red-500 ring-red-500/20 ring-2' : ''}`} />
              {errors.periodsPerWeek && <p className="text-[9px] text-red-400 mt-0.5">{errors.periodsPerWeek}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Min</label>
              <input type="number" min={0} max={30} value={form.minPeriodsPerWeek}
                onChange={e => update('minPeriodsPerWeek', parseInt(e.target.value) || 0)}
                className="input-field text-center" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Max</label>
              <input type="number" min={0} max={30} value={form.maxPeriodsPerWeek}
                onChange={e => update('maxPeriodsPerWeek', parseInt(e.target.value) || 0)}
                className={`input-field text-center ${errors.maxPeriodsPerWeek ? 'border-red-500 ring-red-500/20 ring-2' : ''}`} />
              {errors.maxPeriodsPerWeek && <p className="text-[9px] text-red-400 mt-0.5">{errors.maxPeriodsPerWeek}</p>}
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Scheduling Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(m => (
                <button key={m.value} onClick={() => update('mode', m.value)}
                  className={`p-2.5 rounded-xl text-center border transition-all ${form.mode === m.value ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/30' : 'border-slate-200 dark:border-dark-700 hover:border-slate-300 dark:hover:border-dark-600'}`}>
                  <p className={`text-xs font-bold ${form.mode === m.value ? 'text-primary-500' : m.color}`}>{m.label}</p>
                  <p className="text-[9px] text-slate-400 dark:text-dark-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600 dark:text-dark-300">Priority</label>
              <span className="text-xs font-bold text-primary-500">{form.priority}</span>
            </div>
            <input type="range" min={0} max={100} value={form.priority}
              onChange={e => update('priority', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500" />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>Low</span><span>Normal</span><span>High</span>
            </div>
          </div>

          {/* Preferred Days */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Preferred Days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(d => {
                const sel = form.preferredDays.includes(d);
                return (
                  <button key={d} onClick={() => update('preferredDays', sel ? form.preferredDays.filter(x => x !== d) : [...form.preferredDays, d])}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${sel ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-dark-400 hover:bg-slate-200 dark:hover:bg-dark-700'}`}>
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-slate-400 dark:text-dark-500 mt-1 flex items-center gap-1"><Info size={9} /> Generator will try to place lessons on these days first</p>
          </div>

          {/* Double Period / Lab */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-800/50 border border-slate-200/50 dark:border-dark-700/50">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-dark-200">Double Period</p>
                <p className="text-[9px] text-slate-400 dark:text-dark-500">Allow 2-period blocks</p>
              </div>
              <button onClick={() => update('allowDoublePeriod', !form.allowDoublePeriod)}>
                {form.allowDoublePeriod ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} className="text-slate-400" />}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-800/50 border border-slate-200/50 dark:border-dark-700/50">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-dark-200">Requires Lab</p>
                <p className="text-[9px] text-slate-400 dark:text-dark-500">Needs lab/special room</p>
              </div>
              <button onClick={() => update('requiresLab', !form.requiresLab)}>
                {form.requiresLab ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} className="text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Consecutive Preference */}
          {form.allowDoublePeriod && (
            <div className="p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20">
              <label className="text-xs font-medium text-blue-400 mb-1.5 block">Consecutive Preference</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ v: 'none', l: 'None' }, { v: 'preferred', l: 'Preferred' }, { v: 'required', l: 'Required' }].map(opt => (
                  <button key={opt.v} onClick={() => update('consecutivePreference', opt.v)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${form.consecutivePreference === opt.v ? 'bg-blue-500 text-white' : 'bg-white/50 dark:bg-dark-800/50 text-slate-500 dark:text-dark-400'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
              {form.consecutivePreference !== 'none' && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[10px] text-blue-300">Block size:</label>
                  <select value={form.consecutiveCount} onChange={e => update('consecutiveCount', parseInt(e.target.value))}
                    className="text-[10px] bg-white dark:bg-dark-800 border border-blue-500/30 rounded-lg px-2 py-1">
                    <option value={2}>2 (Double)</option>
                    <option value={3}>3 (Triple Lab)</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-800/30 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {Object.keys(errors).length > 0 && (
              <span className="text-[10px] text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> {Object.keys(errors).length} error(s)</span>
            )}
            {dirty && Object.keys(errors).length === 0 && (
              <span className="text-[10px] text-amber-400">Unsaved changes</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || Object.keys(errors).length > 0}
              className="btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Save size={13} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
