import { useState, useEffect } from 'react';
import { Save, School, Clock, Calendar, Users, Shield, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, logout } = useAuth();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', address: '', phone: '', email: '',
    defaultPeriodsPerDay: 8, maxTeacherContinuousPeriods: 4,
    maxSameSubjectPerDay: 2, classTeacherFirstPeriodPreference: true,
    classTeacherFirstPeriodWeight: 20,
    activitiesPreferLaterPeriods: true, mathSciencePreferMorning: true,
    workingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    allowSaturdayActivities: true
  });

  useEffect(() => {
    api.get('/setup/school').then(r => {
      const s = r.data;
      setSchool(s);
      if (s) setForm({
        name: s.name || '', code: s.code || '', address: s.address || '',
        phone: s.phone || '', email: s.email || '',
        ...s.settings
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/setup/school', {
        name: form.name, code: form.code, address: form.address,
        phone: form.phone, email: form.email,
        settings: {
          defaultPeriodsPerDay: form.defaultPeriodsPerDay,
          maxTeacherContinuousPeriods: form.maxTeacherContinuousPeriods,
          maxSameSubjectPerDay: form.maxSameSubjectPerDay,
          classTeacherFirstPeriodPreference: form.classTeacherFirstPeriodPreference,
          classTeacherFirstPeriodWeight: form.classTeacherFirstPeriodWeight,
          activitiesPreferLaterPeriods: form.activitiesPreferLaterPeriods,
          mathSciencePreferMorning: form.mathSciencePreferMorning,
          workingDays: form.workingDays,
          allowSaturdayActivities: form.allowSaturdayActivities
        }
      });
      toast.success('Settings saved!');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      workingDays: f.workingDays.includes(day)
        ? f.workingDays.filter(d => d !== day)
        : [...f.workingDays, day]
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-primary-500" size={32} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-20 sm:pb-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">School configuration & scheduling preferences</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center hidden sm:flex">
          <Save size={16} />{saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* School Info */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-50 mb-4 flex items-center gap-2">
          <School size={16} className="text-primary-400" /> School Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">School Name</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input-field" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">School Code</label>
            <input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} className="input-field" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="input-field" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Address</label>
            <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className="input-field" />
          </div>
        </div>
      </div>

      {/* Working Days */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-50 mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-emerald-400" /> Working Days
        </h3>
        <div className="flex flex-wrap gap-2">
          {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
            <button key={day} onClick={() => toggleDay(day)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all border min-h-[44px] ${form.workingDays?.includes(day)
                ? 'bg-primary-500/20 border-primary-500/30 text-primary-400'
                : 'bg-white/40 dark:bg-dark-800/40 border-slate-300/50 dark:border-dark-700/50 text-slate-400 dark:text-dark-500'}`}>
              <span className="sm:hidden">{day.slice(0, 2)}</span>
              <span className="hidden sm:inline">{day.slice(0, 3)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scheduling Preferences */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-50 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-amber-400" /> Scheduling Limits
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Periods per day</label>
            <input value={form.defaultPeriodsPerDay} onChange={e => setForm(f => ({...f, defaultPeriodsPerDay: +e.target.value}))} type="number" min="4" max="12" className="input-field" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Max teacher continuous</label>
            <input value={form.maxTeacherContinuousPeriods} onChange={e => setForm(f => ({...f, maxTeacherContinuousPeriods: +e.target.value}))} type="number" min="1" max="8" className="input-field" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Max same subject/day</label>
            <input value={form.maxSameSubjectPerDay} onChange={e => setForm(f => ({...f, maxSameSubjectPerDay: +e.target.value}))} type="number" min="1" max="4" className="input-field" />
          </div>
        </div>
      </div>

      {/* Soft Preferences */}
      <div className="glass-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-50 mb-4 flex items-center gap-2">
          <Shield size={16} className="text-purple-400" /> Soft Preferences
        </h3>
        <div className="space-y-3">
          {[
            { key: 'classTeacherFirstPeriodPreference', label: 'Class teacher gets first period preference' },
            { key: 'activitiesPreferLaterPeriods', label: 'Activities/games prefer later periods' },
            { key: 'mathSciencePreferMorning', label: 'Math & Science prefer morning slots' },
            { key: 'allowSaturdayActivities', label: 'Allow Saturday activity periods' },
          ].map(pref => (
            <label key={pref.key} className="flex items-center justify-between p-3 sm:p-3 rounded-xl bg-white/40 dark:bg-dark-800/40 border border-slate-300/30 dark:border-dark-700/30 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-dark-800/60 transition-colors min-h-[48px]">
              <span className="text-sm text-slate-700 dark:text-dark-200 pr-3">{pref.label}</span>
              <div className="relative shrink-0">
                <input type="checkbox" checked={form[pref.key] || false} onChange={e => setForm(f => ({...f, [pref.key]: e.target.checked}))} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 dark:bg-dark-600 peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </div>
            </label>
          ))}

          {/* Class Teacher Weight Slider — visible when enabled */}
          {form.classTeacherFirstPeriodPreference && (
            <div className="p-3 rounded-xl bg-primary-500/5 border border-primary-500/20 ml-0 sm:ml-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-600 dark:text-dark-300 font-medium">First Period Preference Weight</label>
                <span className="text-xs font-bold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-full">
                  {form.classTeacherFirstPeriodWeight || 20}
                </span>
              </div>
              <input
                type="range" min="5" max="50" step="5"
                value={form.classTeacherFirstPeriodWeight || 20}
                onChange={e => setForm(f => ({...f, classTeacherFirstPeriodWeight: +e.target.value}))}
                className="w-full h-2 bg-slate-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-400">Light (5)</span>
                <span className="text-[9px] text-slate-400">Moderate (25)</span>
                <span className="text-[9px] text-slate-400">Strong (50)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-50 mb-4 flex items-center gap-2">
            <Users size={16} className="text-cyan-400" /> Current User
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-slate-400 dark:text-dark-500">Name</p><p className="text-slate-700 dark:text-dark-200">{user.name}</p></div>
            <div><p className="text-xs text-slate-400 dark:text-dark-500">Email</p><p className="text-slate-700 dark:text-dark-200 break-all">{user.email}</p></div>
            <div><p className="text-xs text-slate-400 dark:text-dark-500">Role</p><p className="text-slate-700 dark:text-dark-200">{user.role?.replace(/_/g, ' ')}</p></div>
            <div><p className="text-xs text-slate-400 dark:text-dark-500">Schools</p><p className="text-slate-700 dark:text-dark-200">{user.schools?.length || 0}</p></div>
          </div>
        </div>
      )}

      {/* Mobile sticky save */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-dark-900/80 backdrop-blur-lg border-t border-slate-200 dark:border-dark-700 sm:hidden z-50">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 w-full justify-center">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
