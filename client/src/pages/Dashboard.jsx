import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, School, BookOpen, DoorOpen, Calendar, AlertTriangle, UserMinus, Zap, Settings, Layers, FileText, RefreshCw } from 'lucide-react';
import api from '../api/axios';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timetable/stats').then(r => { setStats(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const s = stats || {};

  const statCards = [
    { label: 'Teachers', value: s.teachers, icon: Users, color: 'from-blue-500 to-cyan-500', link: '/teachers' },
    { label: 'Classes', value: s.classes, icon: School, color: 'from-emerald-500 to-teal-500', link: '/classes' },
    { label: 'Subjects', value: s.subjects, icon: BookOpen, color: 'from-purple-500 to-indigo-500', link: '/subjects' },
    { label: 'Rooms', value: s.rooms, icon: DoorOpen, color: 'from-amber-500 to-orange-500', link: '/rooms' },
    { label: 'Weekly Loads', value: s.requirements, icon: FileText, color: 'from-teal-500 to-blue-500', link: '/requirements' },
    { label: 'Combined Rules', value: s.combinationRules, icon: Layers, color: 'from-pink-500 to-rose-500', link: '/combinations' },
    { label: 'Scheduled', value: s.scheduledBlocks, icon: Calendar, color: 'from-sky-500 to-blue-600', link: '/timetable' },
    { label: 'Conflicts', value: s.conflicts, icon: AlertTriangle, color: 'from-red-500 to-pink-600', link: '/conflicts', warn: s.conflicts > 0 },
    { label: 'Absences', value: s.pendingAbsences, icon: UserMinus, color: 'from-orange-500 to-red-500', link: '/absences', warn: s.pendingAbsences > 0 },
  ];

  const quickActions = [
    { label: 'Setup Wizard', desc: 'Configure school, periods, and data', icon: Settings, color: 'from-primary-500 to-purple-600', link: '/setup' },
    { label: 'Generate Timetable', desc: 'Auto-generate conflict-free schedule', icon: Zap, color: 'from-emerald-500 to-teal-600', link: '/generator' },
    { label: 'Resolve Conflicts', desc: 'Fix scheduling issues', icon: AlertTriangle, color: 'from-red-500 to-orange-600', link: '/conflicts' },
    { label: 'Manage Substitutions', desc: 'Handle teacher absences', icon: RefreshCw, color: 'from-blue-500 to-cyan-600', link: '/substitutions' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 via-purple-600 to-indigo-600 p-5 sm:p-6 shadow-2xl shadow-primary-500/20">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute right-10 bottom-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg shrink-0">
            <Calendar size={24} className="text-white sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Welcome to TimeCraft</h1>
            <p className="text-white/70 text-xs sm:text-sm truncate">Advanced Automated School Timetable System — {s.latestTimetable === 'published' ? '✅ Published' : s.latestTimetable === 'draft' ? '📋 Draft Ready' : '⚡ Ready to Generate'}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <Link to={card.link} key={card.label} className="glass-card-hover p-4 group min-h-[60px] touch-manipulation">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                  <Icon size={18} className="text-white" />
                </div>
                <div>
                  <p className={`text-xl font-bold ${card.warn ? 'text-amber-400' : 'text-slate-900 dark:text-dark-50'}`}>
                    {loading ? '—' : (card.value ?? 0)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-dark-400">{card.label}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-3 uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <Link to={action.link} key={action.label} className="glass-card-hover p-4 sm:p-5 group flex items-start gap-3 sm:gap-4 touch-manipulation min-h-[72px]">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0`}>
                  <Icon size={22} className="text-slate-900 dark:text-dark-50" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-dark-50 group-hover:text-primary-400 transition-colors">{action.label}</h3>
                  <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">{action.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Status Summary */}
      {stats && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-3 uppercase tracking-wider">System Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
            <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3">
              <p className="text-lg font-bold text-emerald-400">{s.requirements || 0}</p>
              <p className="text-[10px] text-slate-500 dark:text-dark-400">Subject-Class Assignments</p>
            </div>
            <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3">
              <p className="text-lg font-bold text-blue-400">{s.combinationRules || 0}</p>
              <p className="text-[10px] text-slate-500 dark:text-dark-400">Combination Rules</p>
            </div>
            <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3">
              <p className="text-lg font-bold text-purple-400">{s.scheduledBlocks || 0}</p>
              <p className="text-[10px] text-slate-500 dark:text-dark-400">Lesson Blocks</p>
            </div>
            <div className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3">
              <p className={`text-lg font-bold ${s.conflicts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{s.conflicts || 0}</p>
              <p className="text-[10px] text-slate-500 dark:text-dark-400">Active Conflicts</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
