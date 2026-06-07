import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, ChevronRight, ChevronLeft, School, Clock, Users, BookOpen, DoorOpen, FileText,
  Layers, Zap, Database, Loader2, Shield, AlertTriangle, Settings, CalendarDays,
  Link2, BarChart2, ClipboardCheck, ArrowRight, Sparkles, RotateCcw } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { id: 'school', label: 'School Info', icon: School, desc: 'Name, code, working days, branding', required: true },
  { id: 'session', label: 'Academic Session', icon: CalendarDays, desc: 'Year, terms, start/end dates', required: true },
  { id: 'periods', label: 'Period Structure', icon: Clock, desc: 'Timings, breaks, lunch slots', required: true },
  { id: 'classes', label: 'Classes & Sections', icon: Users, desc: 'Grades, sections, student streams', required: true },
  { id: 'subjects', label: 'Subjects', icon: BookOpen, desc: 'Core, elective, lab, activity types', required: true },
  { id: 'teachers', label: 'Teachers', icon: Users, desc: 'Staff, constraints, availability', required: true },
  { id: 'rooms', label: 'Rooms & Facilities', icon: DoorOpen, desc: 'Classrooms, labs, capacity', required: true },
  { id: 'canTeach', label: 'Teacher Capabilities', icon: Link2, desc: 'Who can teach what subject', required: true },
  { id: 'requirements', label: 'Weekly Periods', icon: FileText, desc: 'Subject hours per class per week', required: true },
  { id: 'combinations', label: 'Combined Classes', icon: Layers, desc: 'Shared subject configuration', required: false },
  { id: 'constraints', label: 'Scheduling Rules', icon: Settings, desc: 'Max continuous, no-go slots', required: false },
  { id: 'roles', label: 'Users & Roles', icon: Shield, desc: 'Admin, coordinator, teacher access', required: false },
  { id: 'audit', label: 'Readiness Audit', icon: ClipboardCheck, desc: 'Final validation before generation', required: true },
  { id: 'generate', label: 'Generate', icon: Zap, desc: 'Auto-schedule everything', required: true },
];

function SessionManager({ school }) {
  const [sessions, setSessions] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (school) loadSessions(); }, [school]);
  const loadSessions = () => api.get('/setup/sessions').then(r => setSessions(r.data?.data || r.data || [])).catch(() => {});

  const activate = async (id) => {
    setBusy(true);
    try { await api.put(`/setup/sessions/${id}/activate`); toast.success('Session activated'); loadSessions(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    setBusy(false);
  };
  const archive = async (id) => {
    setBusy(true);
    try { await api.put(`/setup/sessions/${id}/archive`); toast.success('Session archived'); loadSessions(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    setBusy(false);
  };
  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('/setup/sessions', { name: newName || 'New Session', status: 'active' });
      const newId = r.data?.data?._id || r.data?._id;
      if (copyFrom && newId) {
        await api.post(`/setup/sessions/${newId}/copy-setup`, { sourceSessionId: copyFrom });
        toast.success('Session created & setup copied');
      } else { toast.success('Session created'); }
      setShowCreate(false); setNewName(''); setCopyFrom(''); loadSessions();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    setBusy(false);
  };

  if (!school) return (
    <div className="flex items-center gap-4 p-5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
      <AlertTriangle size={24} className="text-amber-500 shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-300">Complete School Info first to create your academic session.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-1">Academic Sessions</h2>
          <p className="text-sm text-slate-500 dark:text-dark-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-secondary flex items-center gap-1.5 text-sm">
          <Plus size={14} /> New Session
        </button>
      </div>
      {showCreate && (
        <form onSubmit={create} className="p-4 rounded-xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-200/50 dark:border-primary-800/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Session Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} className="input-field" placeholder="e.g., 2026-27" required /></div>
            <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Copy Setup From</label>
              <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className="select-field">
                <option value="">Start fresh</option>
                {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary text-sm">{busy ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      )}
      <div className="space-y-2">
        {sessions.map(s => (
          <div key={s._id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${s.isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30' : 'bg-white/40 dark:bg-dark-800/40 border-slate-200/50 dark:border-dark-700/50'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.isCurrent ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-dark-700'}`}>
              <CalendarDays size={18} className={s.isCurrent ? 'text-emerald-500' : 'text-slate-400 dark:text-dark-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-dark-50 truncate">{s.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.isCurrent ? 'bg-emerald-500/20 text-emerald-500' : s.status === 'archived' ? 'bg-slate-200 dark:bg-dark-700 text-slate-400 dark:text-dark-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  {s.isCurrent ? '● Active' : s.status || 'draft'}
                </span>
                {s.startDate && <span className="text-[10px] text-slate-400 dark:text-dark-500">{new Date(s.startDate).toLocaleDateString()} — {s.endDate ? new Date(s.endDate).toLocaleDateString() : '...'}</span>}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {!s.isCurrent && <button onClick={() => activate(s._id)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-all font-medium">Activate</button>}
              {s.isCurrent && <button onClick={() => archive(s._id)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-slate-200/60 dark:bg-dark-700 text-slate-500 dark:text-dark-400 hover:bg-slate-300/60 dark:hover:bg-dark-600 transition-all font-medium">Archive</button>}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center py-8"><CalendarDays size={36} className="mx-auto text-slate-300 dark:text-dark-600 mb-2" />
            <p className="text-sm text-slate-500 dark:text-dark-400">No sessions found. Create your first session above.</p></div>
        )}
      </div>
    </div>
  );
}

export default function SetupWizard() {
  const { user } = useAuth();
  const isPlatformUser = user?.role === 'platform_admin' || user?.role === 'developer';
  const [step, setStep] = useState(0);
  const [school, setSchool] = useState(null);
  const [periods, setPeriods] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolRes, periodsRes, ...countResults] = await Promise.all([
        api.get('/setup/school').catch(() => ({ data: null })),
        api.get('/setup/period-structure').catch(() => ({ data: null })),
        api.get('/classes').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
        api.get('/subjects').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
        api.get('/teachers').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
        api.get('/rooms').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
        api.get('/can-teach').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
        api.get('/requirements').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
        api.get('/rules/combinations').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
        api.get('/users').then(r => (r.data?.data || r.data || []).length).catch(() => 0),
      ]);
      setSchool(schoolRes.data);
      setPeriods(periodsRes.data);
      setCounts({
        classes: countResults[0], subjects: countResults[1], teachers: countResults[2],
        rooms: countResults[3], canTeach: countResults[4], reqs: countResults[5],
        combos: countResults[6], users: countResults[7]
      });
    } catch (e) { /* non-critical */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stepStatus = (i) => {
    const s = STEPS[i];
    if (s.id === 'school') return school?.name ? 'done' : 'pending';
    if (s.id === 'session') return school ? 'done' : 'pending';
    if (s.id === 'periods') return periods?.timeslots?.length > 0 ? 'done' : 'pending';
    if (s.id === 'classes') return counts.classes > 0 ? 'done' : 'pending';
    if (s.id === 'subjects') return counts.subjects > 0 ? 'done' : 'pending';
    if (s.id === 'teachers') return counts.teachers > 0 ? 'done' : 'pending';
    if (s.id === 'rooms') return counts.rooms > 0 ? 'done' : 'pending';
    if (s.id === 'canTeach') return counts.canTeach > 0 ? 'done' : 'pending';
    if (s.id === 'requirements') return counts.reqs > 0 ? 'done' : 'pending';
    if (s.id === 'combinations') return counts.combos > 0 ? 'done' : 'skip';
    if (s.id === 'constraints') return 'done';
    if (s.id === 'roles') return counts.users > 0 ? 'done' : 'skip';
    if (s.id === 'audit') return audit?.ready ? 'done' : 'pending';
    if (s.id === 'generate') return 'pending';
    return 'pending';
  };

  const completedRequired = STEPS.filter((s, i) => s.required && stepStatus(i) === 'done').length;
  const totalRequired = STEPS.filter(s => s.required).length;
  const progress = Math.round((completedRequired / totalRequired) * 100);

  const handleSchoolSave = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData(e.target);
      const data = Object.fromEntries(form);
      data.settings = { ...school?.settings, workingDays: form.getAll('workingDays') };
      await api.put('/setup/school', data);
      toast.success('School settings saved');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  };

  const [seeding, setSeeding] = useState(false);
  const handleSeedData = async () => {
    if (!window.confirm('This will generate demo seed data. Existing data may be overwritten. Continue?')) return;
    setSeeding(true);
    try {
      const r = await api.post('/setup/seed');
      const s = r.data?.summary;
      toast.success(`Seeded: ${s?.classes} classes, ${s?.subjects} subjects, ${s?.teachers} teachers, ${s?.rooms} rooms`);
      window.location.reload();
    } catch (err) { toast.error('Seed failed: ' + (err.response?.data?.error || err.message)); }
    finally { setSeeding(false); }
  };

  const runAudit = async () => {
    setAuditLoading(true);
    try {
      const r = await api.get('/setup/readiness-audit');
      setAudit(r.data?.data || r.data);
    } catch (err) { toast.error('Audit failed: ' + (err.response?.data?.error || err.message)); }
    setAuditLoading(false);
  };

  const goNext = () => step < STEPS.length - 1 && setStep(step + 1);
  const goBack = () => step > 0 && setStep(step - 1);

  // Find next incomplete required step for smart navigation
  const nextIncomplete = STEPS.findIndex((s, i) => s.required && stepStatus(i) === 'pending');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-primary-500/20 animate-pulse">
          <Settings size={24} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <p className="text-sm text-slate-500 dark:text-dark-400">Loading setup data...</p>
      </div>
    );
  }

  // Render step-specific link page with improved design
  const renderEntityStep = (name, count, link, desc, tips) => (
    <div className="py-6 space-y-5 animate-fade-in">
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-2">{name}</h2>
        <p className="text-slate-500 dark:text-dark-400 mb-4 max-w-lg mx-auto text-sm leading-relaxed">{desc}</p>
      </div>
      {count > 0 ? (
        <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 max-w-md mx-auto">
          <CheckCircle size={22} className="text-emerald-500 shrink-0" />
          <div>
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold text-sm">{count} {name.toLowerCase()} configured</span>
            <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/50 mt-0.5">You can add more or edit existing entries</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 max-w-md mx-auto">
          <AlertTriangle size={22} className="text-amber-500 shrink-0" />
          <div>
            <span className="text-amber-700 dark:text-amber-300 font-semibold text-sm">No {name.toLowerCase()} configured yet</span>
            <p className="text-[11px] text-amber-600/70 dark:text-amber-400/50 mt-0.5">This is required before timetable generation</p>
          </div>
        </div>
      )}
      {tips && (
        <div className="max-w-md mx-auto px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-200/50 dark:border-primary-800/30">
          <p className="text-xs text-primary-600 dark:text-primary-400 flex items-start gap-2">
            <Sparkles size={13} className="shrink-0 mt-0.5" />
            <span>{tips}</span>
          </p>
        </div>
      )}
      <div className="flex justify-center">
        <a href={link} className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm">
          {count > 0 ? 'Edit' : 'Add'} {name} <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with progress */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Settings size={20} className="text-white" />
            </div>
            Setup Wizard
          </h1>
          <p className="page-subtitle mt-1">Complete each step to configure your timetable system</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Progress indicator */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-dark-800/60 border border-slate-200/50 dark:border-dark-700/50 backdrop-blur-sm">
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" className="text-slate-200 dark:text-dark-700" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="url(#progressGrad)" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${progress}, 100`} className="transition-all duration-700" />
                <defs><linearGradient id="progressGrad"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary-500">{progress}%</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-dark-200">{completedRequired}/{totalRequired} required</p>
              <p className="text-[10px] text-slate-400 dark:text-dark-500">steps complete</p>
            </div>
          </div>
          {/* Seed button — platform/developer only */}
          {isPlatformUser && (
            <button onClick={handleSeedData} disabled={seeding}
              className="btn-secondary flex items-center gap-2 text-sm py-2.5 px-4">
              {seeding ? <Loader2 className="animate-spin" size={15} /> : <Database size={15} />}
              {seeding ? 'Seeding...' : 'Seed Demo Data'}
            </button>
          )}
        </div>
      </div>

      {/* Step Progress - Vertical sidebar + Content layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar Steps */}
        <div className="glass-card p-3 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:sticky lg:top-24 scrollbar-thin">
          <div className="space-y-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const status = stepStatus(i);
              const active = i === step;
              return (
                <button key={s.id} onClick={() => setStep(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group
                    ${active ? 'bg-gradient-to-r from-primary-500/15 to-indigo-500/10 border border-primary-500/30 shadow-sm shadow-primary-500/10' :
                      status === 'done' ? 'hover:bg-emerald-500/5 border border-transparent' :
                      status === 'skip' ? 'hover:bg-slate-100 dark:hover:bg-dark-800/30 border border-transparent opacity-60' :
                      'hover:bg-slate-100 dark:hover:bg-dark-800/30 border border-transparent'}`}>
                  {/* Step number / check */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-all
                    ${active ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' :
                      status === 'done' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                      'bg-slate-100 dark:bg-dark-700 text-slate-400 dark:text-dark-500'}`}>
                    {status === 'done' && !active ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate
                      ${active ? 'text-primary-600 dark:text-primary-400' :
                        status === 'done' ? 'text-slate-700 dark:text-dark-200' :
                        'text-slate-500 dark:text-dark-400'}`}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-dark-500 truncate hidden sm:block">{s.desc}</p>
                  </div>
                  {/* Status badge */}
                  <div className="shrink-0">
                    {!s.required && <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-700 text-slate-400 dark:text-dark-500">OPT</span>}
                    {s.required && status === 'pending' && !active && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse block" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick jump to next incomplete */}
          {nextIncomplete >= 0 && nextIncomplete !== step && (
            <button onClick={() => setStep(nextIncomplete)}
              className="w-full mt-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2 hover:from-amber-500/20 hover:to-orange-500/20 transition-all">
              <AlertTriangle size={13} />
              Jump to next incomplete: {STEPS[nextIncomplete].label}
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="glass-card p-6 animate-fade-in min-h-[400px]" key={step}>
          {/* Step 0: School Info */}
          {step === 0 && (
            <form onSubmit={handleSchoolSave} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-1">School Information</h2>
                <p className="text-sm text-slate-500 dark:text-dark-400">Configure your school's basic details and working days</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">School Name <span className="text-red-400">*</span></label>
                  <input name="name" defaultValue={school?.name} required placeholder="e.g. Delhi Public School" className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">School Code <span className="text-red-400">*</span></label>
                  <input name="code" defaultValue={school?.code} required placeholder="e.g. DPS-RKP" className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Email</label>
                  <input name="email" type="email" defaultValue={school?.email} placeholder="school@example.edu" className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Phone</label>
                  <input name="phone" defaultValue={school?.phone} placeholder="+91 98765 43210" className="input-field" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-2 block">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                    <label key={d} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 cursor-pointer hover:border-primary-500/50 transition-all has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20 has-[:checked]:shadow-sm">
                      <input type="checkbox" name="workingDays" value={d} defaultChecked={school?.settings?.workingDays?.includes(d)} className="w-4 h-4 rounded accent-primary-500" />
                      <span className="text-sm text-slate-700 dark:text-dark-200 font-medium">{d.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Periods / Day</label>
                  <input name="defaultPeriodsPerDay" type="number" min="4" max="12" defaultValue={school?.settings?.defaultPeriodsPerDay || 8} className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Break After Period</label>
                  <input name="defaultBreakPeriod" type="number" min="1" max="10" defaultValue={school?.settings?.defaultBreakPeriod || 4} className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1.5 block">Max Continuous</label>
                  <input name="maxTeacherContinuousPeriods" type="number" min="2" max="6" defaultValue={school?.settings?.maxTeacherContinuousPeriods || 4} className="input-field" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-dark-700/50">
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <CheckCircle size={14} /> Save School Settings
                </button>
                <button type="button" onClick={goNext} className="btn-secondary flex items-center gap-1">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </form>
          )}

          {/* Step 1: Academic Session */}
          {step === 1 && (
            <SessionManager school={school} />
          )}

          {/* Step 2: Period Structure */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-1">Period & Break Structure</h2>
                  <p className="text-sm text-slate-500 dark:text-dark-400">Define your school's daily period timings</p>
                </div>
                <a href="/period-structure" className="btn-secondary text-sm flex items-center gap-1.5">
                  Edit Structure <ArrowRight size={13} />
                </a>
              </div>
              {periods?.timeslots?.length > 0 ? (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
                  {periods.timeslots.map((slot, i) => (
                    <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border transition-all hover:shadow-sm ${
                      slot.type === 'break' || slot.type === 'lunch'
                        ? 'bg-amber-500/5 border-amber-500/15 dark:border-amber-800/30'
                        : 'bg-white/40 dark:bg-dark-800/40 border-slate-200/50 dark:border-dark-700/50'}`}>
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                        slot.type === 'period' ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400' :
                        'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                        {slot.slotNumber}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-dark-50">{slot.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-dark-400">{slot.startTime} — {slot.endTime}</p>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                        slot.type === 'period' ? 'bg-primary-500/15 text-primary-500' :
                        slot.type === 'break' ? 'bg-amber-500/15 text-amber-500' :
                        'bg-orange-500/15 text-orange-500'}`}>
                        {slot.type}
                      </span>
                      <span className={`text-[10px] font-medium ${slot.isSchedulable ? 'text-emerald-500' : 'text-slate-400 dark:text-dark-500'}`}>
                        {slot.isSchedulable ? '● Schedulable' : '○ Fixed'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock size={36} className="text-slate-300 dark:text-dark-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-dark-400 text-sm">Configure your period structure in the Periods page to define daily timings.</p>
                </div>
              )}
            </div>
          )}

          {/* Steps 3-6: Entity management */}
          {step === 3 && renderEntityStep('Classes & Sections', counts.classes, '/classes',
            'Add all grades and sections. Each class needs a unique name like "10-A" or "Grade 5 Section B".',
            'Tip: For 11th-12th, create separate classes per stream (Science, Commerce, Humanities).'
          )}
          {step === 4 && renderEntityStep('Subjects', counts.subjects, '/subjects',
            'Add all subjects including core, elective, lab, and activity subjects. Set subject types and colors.',
            'Include labs (Science Lab, Computer Lab), activities (PE, Art, Music), and Library.'
          )}
          {step === 5 && renderEntityStep('Teachers', counts.teachers, '/teachers',
            'Add all teaching staff with their departments, availability constraints, and max periods per day/week.',
            'Set max periods/day and max periods/week to control teacher workload fairly.'
          )}
          {step === 6 && renderEntityStep('Rooms & Facilities', counts.rooms, '/rooms',
            'Add classrooms, computer labs, science labs, and other facilities with their capacities.',
            'Include specialty rooms: Physics Lab, Computer Lab, Art Room, Music Room, Library, Sports Ground.'
          )}

          {/* Step 7: Teacher Capabilities */}
          {step === 7 && renderEntityStep('Teacher Capabilities', counts.canTeach, '/can-teach',
            'Map which teachers can teach which subjects. This is critical for accurate timetable generation.',
            'Each teacher needs at least one subject capability. Set priority to prefer primary teachers.'
          )}

          {/* Step 8: Weekly Requirements */}
          {step === 8 && renderEntityStep('Weekly Period Requirements', counts.reqs, '/requirements',
            'Define how many periods each subject needs per week for each class. This drives the generation engine.',
            'A typical class needs 36-48 total periods/week. Include labs, library, and activity periods.'
          )}

          {/* Step 9: Combined Classes (Optional) */}
          {step === 9 && (
            <div className="py-6 space-y-5">
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-2">
                  Combined Classes <span className="text-xs font-normal text-slate-400 dark:text-dark-500 ml-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-700">Optional</span>
                </h2>
                <p className="text-slate-500 dark:text-dark-400 mb-4 max-w-md mx-auto text-sm">
                  Set up shared subject rules where multiple sections attend the same class together (e.g., combined PE, assembly).
                </p>
              </div>
              {counts.combos > 0 ? (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircle size={18} className="text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">{counts.combos} combination rules</span>
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-dark-500 text-center">No combinations needed? You can skip this step.</p>
              )}
              <div className="flex justify-center">
                <a href="/combinations" className="btn-secondary inline-flex items-center gap-2">Manage Combinations <ArrowRight size={14} /></a>
              </div>
            </div>
          )}

          {/* Step 10: Scheduling Constraints */}
          {step === 10 && (
            <div className="py-6 space-y-5 text-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-2">
                Scheduling Rules <span className="text-xs font-normal text-slate-400 dark:text-dark-500 ml-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-700">Optional</span>
              </h2>
              <p className="text-slate-500 dark:text-dark-400 mb-4 max-w-md mx-auto text-sm">Fine-tune the scheduling engine with advanced constraints like max consecutive periods, preferred time slots, and no-go zones.</p>
              <div className="flex items-center justify-center gap-2 mb-4"><CheckCircle size={18} className="text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">Default rules active</span></div>
              <a href="/rules" className="btn-secondary inline-flex items-center gap-2">Customize Rules <ArrowRight size={14} /></a>
            </div>
          )}

          {/* Step 11: Users & Roles */}
          {step === 11 && (
            <div className="py-6 space-y-5 text-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-2">
                Users & Roles <span className="text-xs font-normal text-slate-400 dark:text-dark-500 ml-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-700">Optional</span>
              </h2>
              <p className="text-slate-500 dark:text-dark-400 mb-4 max-w-md mx-auto text-sm">Set up additional admin, coordinator, and teacher-view accounts for your school staff.</p>
              {counts.users > 0 ? (
                <div className="flex items-center justify-center gap-2 mb-4"><CheckCircle size={18} className="text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">{counts.users} users configured</span></div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-dark-500">You can add more users later from the Users page.</p>
              )}
              <a href="/users" className="btn-secondary inline-flex items-center gap-2">Manage Users <ArrowRight size={14} /></a>
            </div>
          )}

          {/* Step 12: Readiness Audit */}
          {step === 12 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-1">Readiness Audit</h2>
                  <p className="text-sm text-slate-500 dark:text-dark-400">Comprehensive validation of all setup data</p>
                </div>
                <button onClick={runAudit} disabled={auditLoading}
                  className="btn-primary flex items-center gap-2">
                  {auditLoading ? <Loader2 className="animate-spin" size={14} /> : audit ? <RotateCcw size={14} /> : <ClipboardCheck size={14} />}
                  {auditLoading ? 'Analyzing...' : audit ? 'Re-run Audit' : 'Run Audit'}
                </button>
              </div>

              {audit ? (
                <div className="space-y-4">
                  {/* Overall Status */}
                  <div className={`p-5 rounded-xl border ${audit.ready
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-emerald-200 dark:border-emerald-800/30'
                    : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10 border-red-200 dark:border-red-800/30'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        audit.ready ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                        {audit.ready ? <CheckCircle size={24} className="text-emerald-500" /> : <AlertTriangle size={24} className="text-red-500" />}
                      </div>
                      <div>
                        <p className={`text-base font-bold ${audit.ready ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                          {audit.ready ? 'System Ready for Generation' : 'Issues Found — Fix Before Generating'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">{audit.checks?.length || 0} checks performed</p>
                      </div>
                    </div>
                  </div>

                  {/* Check Results */}
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto scrollbar-thin pr-1">
                    {(audit.checks || []).map((check, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        check.pass
                          ? 'bg-white/40 dark:bg-dark-800/40 border-slate-200/50 dark:border-dark-700/50'
                          : 'bg-red-50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/30'}`}>
                        {check.pass ? <CheckCircle size={14} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-dark-100">{check.label}</p>
                          {check.detail && <p className="text-[10px] text-slate-500 dark:text-dark-400 mt-0.5">{check.detail}</p>}
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full shrink-0 font-semibold ${
                          check.pass ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                          {check.pass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Warnings */}
                  {audit.warnings?.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 space-y-2">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <AlertTriangle size={13} /> Warnings ({audit.warnings.length})
                      </p>
                      {audit.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-400/70 pl-5">• {w}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-dark-700 flex items-center justify-center mx-auto mb-4">
                    <ClipboardCheck size={32} className="text-slate-300 dark:text-dark-600" />
                  </div>
                  <p className="text-slate-500 dark:text-dark-400 text-sm">Click "Run Audit" to validate your setup</p>
                  <p className="text-[11px] text-slate-400 dark:text-dark-500 mt-1">This checks for missing data, conflicts, and readiness issues</p>
                </div>
              )}
            </div>
          )}

          {/* Step 13: Generate */}
          {step === 13 && (
            <div className="text-center py-12 space-y-5">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-2">
                <Zap size={36} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-dark-50">Ready to Generate!</h2>
              <p className="text-slate-500 dark:text-dark-400 max-w-md mx-auto text-sm leading-relaxed">
                {progress === 100
                  ? 'All required setup steps are complete. Head to the Generator to create your timetable automatically.'
                  : `${progress}% complete. Finish the remaining required steps for best results.`
                }
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-dark-500">
                <BarChart2 size={12} />
                {completedRequired}/{totalRequired} required steps complete
              </div>
              <a href="/generator" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:shadow-primary-500/30 transition-all">
                <Zap size={18} /> Generate Timetable
              </a>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-5 mt-5 border-t border-slate-200 dark:border-dark-700/50">
            <button onClick={goBack} disabled={step === 0}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                step === 0 ? 'text-slate-300 dark:text-dark-600 cursor-not-allowed' : 'btn-secondary'}`}>
              <ChevronLeft size={14} /> Back
            </button>
            <span className="text-xs text-slate-400 dark:text-dark-500 font-medium">
              Step {step + 1} of {STEPS.length}
            </span>
            <button onClick={goNext} disabled={step === STEPS.length - 1}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                step === STEPS.length - 1 ? 'text-slate-300 dark:text-dark-600 cursor-not-allowed' : 'btn-primary'}`}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
