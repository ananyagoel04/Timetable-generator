import { useState, useEffect } from 'react';
import {
  Users, UserMinus, RefreshCw, Calendar, AlertTriangle, CheckCircle,
  Clock, Shield, Activity, ArrowRight, TrendingUp
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Absences from './Absences';
import Substitutions from './Substitutions';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity, accent: 'from-primary-500 to-indigo-600' },
  { id: 'absences', label: 'Absences', icon: UserMinus, accent: 'from-red-500 to-pink-600' },
  { id: 'substitutions', label: 'Substitutions', icon: RefreshCw, accent: 'from-blue-500 to-cyan-600' },
];

export default function StaffAvailability() {
  const { selectedSchool, selectedSession } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [selectedSchool, selectedSession]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [absRes, subRes, teacherRes] = await Promise.all([
        api.get('/absences').catch(() => ({ data: { data: [] } })),
        api.get('/substitutions').catch(() => ({ data: [] })),
        api.get('/teachers').catch(() => ({ data: [] })),
      ]);
      const absences = absRes.data?.data || [];
      const subs = subRes.data || [];
      const teachers = teacherRes.data?.data || teacherRes.data || [];
      const activeTeachers = teachers.filter(t => t.status === 'active');

      const today = new Date().toISOString().split('T')[0];
      const todayAbs = absences.filter(a => {
        const d = new Date(a.date).toISOString().split('T')[0];
        return d === today && a.status !== 'cancelled';
      });
      const unresolved = absences.filter(a => a.status === 'active').length;
      const pendingSubs = subs.filter(s => s.status === 'pending').length;
      const approvedSubs = subs.filter(s => s.status === 'approved').length;

      setStats({
        totalTeachers: activeTeachers.length,
        absentToday: todayAbs.length,
        presentToday: activeTeachers.length - todayAbs.length,
        unresolved,
        totalAbsences: absences.length,
        pendingSubs,
        approvedSubs,
        totalSubs: subs.length,
        availabilityRate: activeTeachers.length > 0
          ? Math.round(((activeTeachers.length - todayAbs.length) / activeTeachers.length) * 100)
          : 100,
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield size={24} className="text-primary-400" />
            Staff Availability Center
          </h1>
          <p className="page-subtitle">Unified absence tracking, substitutions & staff overview</p>
        </div>
        <button onClick={loadStats} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
                <CheckCircle size={16} className="text-white" />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-dark-500 uppercase tracking-wider font-medium">Present Today</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.presentToday}</span>
              <span className="text-xs text-slate-400">/ {stats.totalTeachers}</span>
            </div>
            <div className="mt-2 h-1 bg-slate-100 dark:bg-dark-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.availabilityRate}%` }} />
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-sm">
                <UserMinus size={16} className="text-white" />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-dark-500 uppercase tracking-wider font-medium">Absent Today</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.absentToday}</span>
            </div>
            {stats.unresolved > 0 && (
              <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                <AlertTriangle size={10} /> {stats.unresolved} unresolved
              </p>
            )}
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                <Clock size={16} className="text-white" />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-dark-500 uppercase tracking-wider font-medium">Pending Subs</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingSubs}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{stats.approvedSubs} approved</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-dark-500 uppercase tracking-wider font-medium">Availability</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold ${stats.availabilityRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : stats.availabilityRate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.availabilityRate}%
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{stats.totalAbsences} total absences this session</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white dark:bg-dark-800 rounded-xl p-1 border border-slate-200 dark:border-dark-700">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-1
              ${activeTab === tab.id
                ? 'bg-gradient-to-r ' + tab.accent + ' text-white shadow-lg'
                : 'text-slate-500 dark:text-dark-400 hover:bg-slate-50 dark:hover:bg-dark-700'}`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Quick Actions */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-dark-200 mb-4 flex items-center gap-2">
              <Activity size={14} className="text-primary-400" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button onClick={() => setActiveTab('absences')}
                className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-dark-700 hover:border-red-400 dark:hover:border-red-500 transition-all hover:shadow-md group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserMinus size={18} className="text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-dark-100 text-sm">Record Absence</p>
                      <p className="text-[10px] text-slate-400">Mark a teacher as absent & auto-find replacements</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 dark:text-dark-600 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
              <button onClick={() => setActiveTab('substitutions')}
                className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-dark-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-md group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <RefreshCw size={18} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-dark-100 text-sm">Manage Substitutions</p>
                      <p className="text-[10px] text-slate-400">Review & approve pending substitution requests</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 dark:text-dark-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            </div>
          </div>

          {/* Today's Summary */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-dark-200 mb-4 flex items-center gap-2">
              <Calendar size={14} className="text-primary-400" />
              Today's Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30">
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Teachers Present</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats?.presentToday || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30">
                <span className="text-sm text-red-700 dark:text-red-400 font-medium">Teachers Absent</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">{stats?.absentToday || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">Unresolved Periods</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats?.unresolved || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30">
                <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">Pending Substitutions</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats?.pendingSubs || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'absences' && <Absences />}
      {activeTab === 'substitutions' && <Substitutions />}
    </div>
  );
}
