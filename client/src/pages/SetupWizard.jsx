import { useState, useEffect } from 'react';
import { CheckCircle, ChevronRight, School, Clock, Users, BookOpen, DoorOpen, FileText, Layers, Zap } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 'school', label: 'School Info', icon: School, desc: 'Name, code, working days' },
  { id: 'periods', label: 'Period Structure', icon: Clock, desc: 'Timings, breaks, lunch' },
  { id: 'classes', label: 'Classes & Sections', icon: Users, desc: 'Grades, sections, streams' },
  { id: 'subjects', label: 'Subjects', icon: BookOpen, desc: 'Core, elective, activities' },
  { id: 'teachers', label: 'Teachers', icon: Users, desc: 'Staff and capabilities' },
  { id: 'rooms', label: 'Rooms', icon: DoorOpen, desc: 'Classrooms, labs, grounds' },
  { id: 'requirements', label: 'Weekly Periods', icon: FileText, desc: 'Subject load per class' },
  { id: 'combinations', label: 'Combined Classes', icon: Layers, desc: 'Shared subject rules' },
  { id: 'generate', label: 'Generate', icon: Zap, desc: 'Auto-schedule everything' },
];

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [school, setSchool] = useState(null);
  const [periods, setPeriods] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    api.get('/setup/school').then(r => setSchool(r.data));
    api.get('/setup/period-structure').then(r => setPeriods(r.data));
    Promise.all([
      api.get('/classes').then(r => r.count || r.data?.length || 0),
      api.get('/subjects').then(r => r.count || r.data?.length || 0),
      api.get('/teachers').then(r => r.count || r.data?.length || 0),
      api.get('/rooms').then(r => r.count || r.data?.length || 0),
      api.get('/rules/requirements').then(r => r.count || r.data?.length || 0),
      api.get('/rules/combinations').then(r => r.count || r.data?.length || 0),
    ]).then(([classes, subjects, teachers, rooms, reqs, combos]) => {
      setCounts({ classes, subjects, teachers, rooms, reqs, combos });
    });
  }, []);

  const stepStatus = (i) => {
    if (i === 0) return school ? 'done' : 'pending';
    if (i === 1) return periods?.timeslots?.length > 0 ? 'done' : 'pending';
    if (i === 2) return counts.classes > 0 ? 'done' : 'pending';
    if (i === 3) return counts.subjects > 0 ? 'done' : 'pending';
    if (i === 4) return counts.teachers > 0 ? 'done' : 'pending';
    if (i === 5) return counts.rooms > 0 ? 'done' : 'pending';
    if (i === 6) return counts.reqs > 0 ? 'done' : 'pending';
    if (i === 7) return counts.combos > 0 ? 'done' : 'pending';
    return 'pending';
  };

  const handleSchoolSave = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData(e.target);
      const data = Object.fromEntries(form);
      data.settings = { ...school.settings, workingDays: form.getAll('workingDays') };
      await api.put('/setup/school', data);
      toast.success('School settings saved');
      api.get('/setup/school').then(r => setSchool(r.data));
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="page-title">Setup Wizard</h1><p className="page-subtitle">Complete each step to set up your timetable system</p></div>

      {/* Step Progress */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const status = stepStatus(i);
          const active = i === step;
          return (
            <button key={s.id} onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0
                ${active ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30' : status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-dark-800/50 text-dark-400 border border-dark-700/50 hover:bg-dark-800'}`}>
              {status === 'done' && !active ? <CheckCircle size={14} /> : <Icon size={14} />}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="glass-card p-6">
        {step === 0 && (
          <form onSubmit={handleSchoolSave} className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-1">School Information</h2>
            <p className="text-sm text-dark-400 mb-4">Configure your school's basic details and working days</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-dark-400 mb-1 block">School Name *</label><input name="name" defaultValue={school?.name} required className="input-field" /></div>
              <div><label className="text-xs text-dark-400 mb-1 block">School Code *</label><input name="code" defaultValue={school?.code} required className="input-field" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-dark-400 mb-1 block">Email</label><input name="email" defaultValue={school?.email} className="input-field" /></div>
              <div><label className="text-xs text-dark-400 mb-1 block">Phone</label><input name="phone" defaultValue={school?.phone} className="input-field" /></div>
            </div>
            <div>
              <label className="text-xs text-dark-400 mb-2 block">Working Days</label>
              <div className="flex flex-wrap gap-2">
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                  <label key={d} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700 cursor-pointer hover:border-primary-500/50 transition-colors">
                    <input type="checkbox" name="workingDays" value={d} defaultChecked={school?.settings?.workingDays?.includes(d)} className="w-3.5 h-3.5 rounded" />
                    <span className="text-sm text-dark-300">{d.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-xs text-dark-400 mb-1 block">Periods/Day</label><input name="defaultPeriodsPerDay" type="number" defaultValue={school?.settings?.defaultPeriodsPerDay || 8} className="input-field" /></div>
              <div><label className="text-xs text-dark-400 mb-1 block">Break After Period</label><input name="defaultBreakPeriod" type="number" defaultValue={school?.settings?.defaultBreakPeriod || 4} className="input-field" /></div>
              <div><label className="text-xs text-dark-400 mb-1 block">Max Continuous</label><input name="maxTeacherContinuousPeriods" type="number" defaultValue={school?.settings?.maxTeacherContinuousPeriods || 4} className="input-field" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="submit" className="btn-primary">Save School Settings</button>
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1">Next <ChevronRight size={14} /></button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-1">Period & Break Structure</h2>
            <p className="text-sm text-dark-400 mb-4">Define your school's daily period timings. Customize periods, breaks, and lunch.</p>
            {periods?.timeslots?.length > 0 ? (
              <div className="space-y-2">
                {periods.timeslots.map((slot, i) => (
                  <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border ${slot.type === 'break' || slot.type === 'lunch' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-dark-800/40 border-dark-700/50'}`}>
                    <span className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-xs font-bold text-dark-300">{slot.slotNumber}</span>
                    <div className="flex-1"><p className="text-sm font-medium text-white">{slot.label}</p><p className="text-[10px] text-dark-400">{slot.startTime} — {slot.endTime}</p></div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${slot.type === 'period' ? 'bg-primary-500/20 text-primary-400' : slot.type === 'break' ? 'bg-amber-500/20 text-amber-400' : slot.type === 'lunch' ? 'bg-orange-500/20 text-orange-400' : 'bg-dark-600 text-dark-300'}`}>{slot.type}</span>
                    <span className={`text-[10px] ${slot.isSchedulable ? 'text-emerald-400' : 'text-dark-500'}`}>{slot.isSchedulable ? 'Schedulable' : 'Fixed'}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-dark-400">Default period structure will be created automatically.</p>}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(0)} className="btn-secondary">← Back</button>
              <button onClick={() => setStep(2)} className="btn-primary flex items-center gap-1">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {step >= 2 && step <= 5 && (
          <div className="text-center py-8 space-y-4">
            {[
              { i: 2, name: 'Classes & Sections', count: counts.classes, link: '/classes' },
              { i: 3, name: 'Subjects', count: counts.subjects, link: '/subjects' },
              { i: 4, name: 'Teachers', count: counts.teachers, link: '/teachers' },
              { i: 5, name: 'Rooms', count: counts.rooms, link: '/rooms' },
            ].filter(x => x.i === step).map(x => (
              <div key={x.i}>
                <h2 className="text-lg font-bold text-white mb-2">{x.name}</h2>
                <p className="text-dark-400 mb-4">
                  {x.count > 0 ? `✅ ${x.count} ${x.name.toLowerCase()} configured.` : `No ${x.name.toLowerCase()} yet. Add them from the management page.`}
                </p>
                <div className="flex justify-center gap-3">
                  <a href={x.link} className="btn-primary">Manage {x.name}</a>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(step - 1)} className="btn-secondary">← Back</button>
              <button onClick={() => setStep(step + 1)} className="btn-primary flex items-center gap-1">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="text-center py-8 space-y-4">
            <h2 className="text-lg font-bold text-white mb-2">Weekly Subject Periods</h2>
            <p className="text-dark-400 mb-4">{counts.reqs > 0 ? `✅ ${counts.reqs} subject-class assignments configured.` : 'Define how many periods each subject needs per week for each class.'}</p>
            <a href="/requirements" className="btn-primary">Manage Weekly Loads</a>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(5)} className="btn-secondary">← Back</button>
              <button onClick={() => setStep(7)} className="btn-primary flex items-center gap-1">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="text-center py-8 space-y-4">
            <h2 className="text-lg font-bold text-white mb-2">Combined Classes</h2>
            <p className="text-dark-400 mb-4">{counts.combos > 0 ? `✅ ${counts.combos} combination rules configured.` : 'Optional: Set up shared subject rules for combined classes.'}</p>
            <a href="/combinations" className="btn-primary">Manage Combination Rules</a>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(6)} className="btn-secondary">← Back</button>
              <button onClick={() => setStep(8)} className="btn-primary flex items-center gap-1">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="text-center py-12 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
              <Zap size={36} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Ready to Generate!</h2>
            <p className="text-dark-400 max-w-md mx-auto">All setup steps are complete. Head to the Generator to create your timetable automatically.</p>
            <a href="/generator" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"><Zap size={20} /> Generate Timetable</a>
            <div className="flex justify-center pt-4">
              <button onClick={() => setStep(7)} className="btn-secondary">← Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
