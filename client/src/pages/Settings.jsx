import { useState, useEffect } from 'react';
import { Save, School, Clock, Calendar, Users, Shield } from 'lucide-react';
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

  if (loading) return <div className="text-center py-16 text-dark-400">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">School configuration & scheduling preferences</p></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} />{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      {/* School Info */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><School size={16} className="text-primary-400" /> School Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-xs text-dark-400 mb-1 block">School Name</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input-field" /></div>
          <div><label className="text-xs text-dark-400 mb-1 block">School Code</label><input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} className="input-field" /></div>
          <div><label className="text-xs text-dark-400 mb-1 block">Email</label><input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="input-field" /></div>
          <div><label className="text-xs text-dark-400 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="input-field" /></div>
          <div className="md:col-span-2"><label className="text-xs text-dark-400 mb-1 block">Address</label><input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className="input-field" /></div>
        </div>
      </div>

      {/* Working Days */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Calendar size={16} className="text-emerald-400" /> Working Days</h3>
        <div className="flex flex-wrap gap-2">
          {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
            <button key={day} onClick={() => toggleDay(day)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${form.workingDays?.includes(day)
                ? 'bg-primary-500/20 border-primary-500/30 text-primary-400'
                : 'bg-dark-800/40 border-dark-700/50 text-dark-500'}`}>
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Scheduling Preferences */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Clock size={16} className="text-amber-400" /> Scheduling Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="text-xs text-dark-400 mb-1 block">Periods per day</label><input value={form.defaultPeriodsPerDay} onChange={e => setForm(f => ({...f, defaultPeriodsPerDay: +e.target.value}))} type="number" min="4" max="12" className="input-field" /></div>
          <div><label className="text-xs text-dark-400 mb-1 block">Max teacher continuous</label><input value={form.maxTeacherContinuousPeriods} onChange={e => setForm(f => ({...f, maxTeacherContinuousPeriods: +e.target.value}))} type="number" min="1" max="8" className="input-field" /></div>
          <div><label className="text-xs text-dark-400 mb-1 block">Max same subject/day</label><input value={form.maxSameSubjectPerDay} onChange={e => setForm(f => ({...f, maxSameSubjectPerDay: +e.target.value}))} type="number" min="1" max="4" className="input-field" /></div>
        </div>
      </div>

      {/* Soft Preferences */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Shield size={16} className="text-purple-400" /> Soft Preferences</h3>
        <div className="space-y-3">
          {[
            { key: 'classTeacherFirstPeriodPreference', label: 'Class teacher gets first period preference' },
            { key: 'activitiesPreferLaterPeriods', label: 'Activities/games prefer later periods' },
            { key: 'mathSciencePreferMorning', label: 'Math & Science prefer morning slots' },
            { key: 'allowSaturdayActivities', label: 'Allow Saturday activity periods' },
          ].map(pref => (
            <label key={pref.key} className="flex items-center justify-between p-3 rounded-xl bg-dark-800/40 border border-dark-700/30 cursor-pointer hover:bg-dark-800/60 transition-colors">
              <span className="text-sm text-dark-200">{pref.label}</span>
              <div className="relative">
                <input type="checkbox" checked={form[pref.key] || false} onChange={e => setForm(f => ({...f, [pref.key]: e.target.checked}))} className="sr-only peer" />
                <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Users size={16} className="text-cyan-400" /> Current User</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-dark-500">Name</p><p className="text-dark-200">{user.name}</p></div>
            <div><p className="text-xs text-dark-500">Email</p><p className="text-dark-200">{user.email}</p></div>
            <div><p className="text-xs text-dark-500">Role</p><p className="text-dark-200">{user.role?.replace(/_/g, ' ')}</p></div>
            <div><p className="text-xs text-dark-500">Schools</p><p className="text-dark-200">{user.schools?.length || 0}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
