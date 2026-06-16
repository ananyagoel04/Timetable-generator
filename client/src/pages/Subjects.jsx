import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, Clock } from "lucide-react";
import api from "../api/axios";
import Modal from "../components/ui/Modal";
import toast from "react-hot-toast";
import { useAuth } from '../context/AuthContext';

export default function Subjects() {
  const { selectedSchool, selectedSession } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [periodSlots, setPeriodSlots] = useState([]);

  const defaultForm = {
    name: "",
    code: "",
    type: "theory",
    category: "core",
    defaultPeriodsPerWeek: 4,
    color: "#6366f1",
    requiresLab: false,
    timePreferenceType: "none",
    preferredPeriods: [],
    timePreferenceStrength: "preferred",
  };
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    fetchSubjects();
    fetchPeriodSlots();
  }, [selectedSchool, selectedSession]);

  const fetchSubjects = () =>
    api.get("/subjects").then((r) => {
      setSubjects(r.data || []);
      setLoading(false);
    });

  // Fetch period structure slots for custom period selection
  const fetchPeriodSlots = () => {
    api.get("/setup/periods").then((r) => {
      const structures = r.data?.data || r.data || [];
      const active = structures.find(s => s.status === 'active') || structures[0];
      if (active?.defaultDayTemplate) {
        setPeriodSlots(active.defaultDayTemplate.filter(s => s.isSchedulable));
      }
    }).catch(() => {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      // Auto-migrate to legacy fields for backward compat
      if (form.timePreferenceType === 'before_lunch') {
        payload.timePreference = 'morning';
      } else if (form.timePreferenceType === 'after_lunch') {
        payload.timePreference = 'afternoon';
      } else if (form.timePreferenceType === 'none') {
        payload.timePreference = 'none';
        payload.preferredPeriods = [];
      }

      editing
        ? await api.put(`/subjects/${editing._id}`, payload)
        : await api.post("/subjects", payload);
      toast.success(editing ? "Updated" : "Added");
      setModalOpen(false);
      fetchSubjects();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (s) => {
    setEditing(s);
    // Resolve time preference type from P15H or legacy fields
    let prefType = s.timePreferenceType || 'none';
    if (prefType === 'none') {
      if (s.timePreference === 'morning' || s.preferMorning) prefType = 'before_lunch';
      else if (s.timePreference === 'afternoon' || s.preferAfternoon) prefType = 'after_lunch';
    }
    setForm({
      name: s.name,
      code: s.code,
      type: s.type,
      category: s.category,
      defaultPeriodsPerWeek: s.defaultPeriodsPerWeek,
      color: s.color,
      requiresLab: s.requiresLab,
      timePreferenceType: prefType,
      preferredPeriods: s.preferredPeriods || [],
      timePreferenceStrength: s.timePreferenceStrength || 'preferred',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete?")) return;
    await api.delete(`/subjects/${id}`);
    fetchSubjects();
  };

  const togglePeriod = (slotNum) => {
    setForm(f => ({
      ...f,
      preferredPeriods: f.preferredPeriods.includes(slotNum)
        ? f.preferredPeriods.filter(p => p !== slotNum)
        : [...f.preferredPeriods, slotNum].sort((a, b) => a - b)
    }));
  };

  const filtered = subjects.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const typeIcons = {
    theory: "📖", practical: "🔬", lab: "💻", activity: "🎨",
    library: "📚", games: "⚽", moral_science: "🕊️", club: "🎭", other: "📋",
  };

  const prefTypeLabels = {
    none: null,
    before_lunch: { emoji: '🌅', label: 'Before Lunch', bg: 'bg-amber-500/20', color: 'text-amber-400' },
    after_lunch: { emoji: '🌇', label: 'After Lunch', bg: 'bg-blue-500/20', color: 'text-blue-400' },
    custom_periods: { emoji: '🎯', label: 'Custom', bg: 'bg-purple-500/20', color: 'text-purple-400' },
    morning: { emoji: '☀️', label: 'AM', bg: 'bg-amber-500/20', color: 'text-amber-400' },
    afternoon: { emoji: '🌙', label: 'PM', bg: 'bg-blue-500/20', color: 'text-blue-400' },
  };

  const getSubjectPrefBadge = (s) => {
    const type = s.timePreferenceType || (s.timePreference !== 'none' ? s.timePreference : null) || (s.preferMorning ? 'morning' : s.preferAfternoon ? 'afternoon' : null);
    if (!type || type === 'none') return null;
    const info = prefTypeLabels[type];
    if (!info) return null;
    const strengthLabel = s.timePreferenceStrength === 'required' ? ' (req)' : s.timePreferenceStrength === 'strong' ? ' (strong)' : '';
    return (
      <span className={`badge ${info.bg} ${info.color} text-[9px]`}>
        {info.emoji} {info.label}{strengthLabel}
        {type === 'custom_periods' && s.preferredPeriods?.length > 0 && ` P${s.preferredPeriods.join(',')}`}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subjects</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm(defaultForm);
            setModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Add Subject
        </button>
      </div>
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-9" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          <p className="text-slate-500 dark:text-dark-400 col-span-full text-center py-12">Loading...</p>
        ) : (
          filtered.map((s) => (
            <div key={s._id} className="glass-card-hover p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: s.color }}>
                    <span className="text-base leading-none">{typeIcons[s.type] || "📖"}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(s)} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(s._id)} className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 dark:text-dark-400 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-dark-50 text-sm">{s.name}</h3>
              <p className="text-[10px] text-slate-400 dark:text-dark-500">{s.code} · {s.defaultPeriodsPerWeek}/wk</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="badge bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-dark-300 border border-slate-400 dark:border-dark-600 text-[9px]">{s.category}</span>
                {s.requiresLab && <span className="badge bg-purple-500/20 text-purple-400 text-[9px]">Lab</span>}
                {getSubjectPrefBadge(s)}
              </div>
            </div>
          ))
        )}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Subject" : "Add Subject"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="input-field" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Code *</label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} required className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="select-field">
                <option value="theory">Theory</option>
                <option value="practical">Practical</option>
                <option value="lab">Lab</option>
                <option value="activity">Activity</option>
                <option value="library">Library</option>
                <option value="games">Games</option>
                <option value="club">Club</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="select-field">
                <option value="core">Core</option>
                <option value="elective">Elective</option>
                <option value="co_curricular">Co-Curricular</option>
                <option value="extra_curricular">Extra-Curricular</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Periods/Week</label>
              <input value={form.defaultPeriodsPerWeek} onChange={(e) => setForm((f) => ({ ...f, defaultPeriodsPerWeek: +e.target.value }))} type="number" className="input-field" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Color</label>
              <input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} type="color" className="w-10 h-10 rounded-lg border border-slate-300 dark:border-dark-700 cursor-pointer" />
            </div>
            <label className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={form.requiresLab} onChange={(e) => setForm((f) => ({ ...f, requiresLab: e.target.checked }))} className="w-4 h-4 rounded" />
              <span className="text-sm text-slate-600 dark:text-dark-300">Requires Lab</span>
            </label>
          </div>

          {/* ── P15H Time Preference ── */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-dark-800/50 border border-slate-200/50 dark:border-dark-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-primary-400" />
              <label className="text-xs font-semibold text-slate-700 dark:text-dark-200 uppercase tracking-wider">Time Preference</label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'none', label: 'No Preference', emoji: '—', desc: 'Any period' },
                { value: 'before_lunch', label: 'Before Lunch', emoji: '🌅', desc: 'Schedule before lunch break' },
                { value: 'after_lunch', label: 'After Lunch', emoji: '🌇', desc: 'Schedule after lunch break' },
                { value: 'custom_periods', label: 'Custom Periods', emoji: '🎯', desc: 'Select specific periods' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, timePreferenceType: opt.value, ...(opt.value !== 'custom_periods' ? { preferredPeriods: [] } : {}) }))}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    form.timePreferenceType === opt.value
                      ? 'border-primary-500 bg-primary-500/10 shadow-sm'
                      : 'border-slate-200 dark:border-dark-700 hover:border-slate-300 dark:hover:border-dark-600'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{opt.emoji}</span>
                    <span className={`text-xs font-semibold ${form.timePreferenceType === opt.value ? 'text-primary-500' : 'text-slate-700 dark:text-dark-200'}`}>{opt.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Custom Period Selection — Period Checkboxes */}
            {form.timePreferenceType === 'custom_periods' && (
              <div className="mt-2 animate-slide-up">
                <p className="text-[10px] text-slate-500 dark:text-dark-400 mb-2 font-medium">Select preferred periods:</p>
                <div className="flex flex-wrap gap-1.5">
                  {periodSlots.length > 0 ? periodSlots.map(slot => (
                    <button key={slot.slotNumber} type="button"
                      onClick={() => togglePeriod(slot.slotNumber)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        form.preferredPeriods.includes(slot.slotNumber)
                          ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                          : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-dark-300 border-slate-300 dark:border-dark-600 hover:border-primary-400'
                      }`}>
                      {slot.label || `P${slot.slotNumber}`}
                      <span className="text-[9px] opacity-60 ml-1">{slot.startTime}</span>
                    </button>
                  )) : (
                    <p className="text-[10px] text-slate-400">No period structure found. Configure periods first.</p>
                  )}
                </div>
                {form.preferredPeriods.length > 0 && (
                  <p className="text-[10px] text-emerald-400 mt-1.5">
                    ✓ Selected: {form.preferredPeriods.map(p => {
                      const slot = periodSlots.find(s => s.slotNumber === p);
                      return slot?.label || `P${p}`;
                    }).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Strength selector — shown for all non-none preferences */}
            {form.timePreferenceType !== 'none' && (
              <div className="mt-2">
                <label className="text-[10px] text-slate-500 dark:text-dark-400 mb-1 block font-medium">Enforcement Strength</label>
                <div className="flex gap-2">
                  {[
                    { value: 'preferred', label: 'Soft', desc: 'Generator prefers these slots', color: 'emerald' },
                    { value: 'strong', label: 'Strong', desc: 'Generator strongly prefers', color: 'amber' },
                    { value: 'required', label: 'Required', desc: 'Hard constraint — must use these slots', color: 'red' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, timePreferenceStrength: opt.value }))}
                      className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                        form.timePreferenceStrength === opt.value
                          ? `border-${opt.color}-500 bg-${opt.color}-500/10`
                          : 'border-slate-200 dark:border-dark-700'
                      }`}>
                      <p className={`text-[10px] font-bold ${form.timePreferenceStrength === opt.value ? `text-${opt.color}-500` : 'text-slate-500 dark:text-dark-400'}`}>{opt.label}</p>
                      <p className="text-[9px] text-slate-400 dark:text-dark-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editing ? "Update" : "Create"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
