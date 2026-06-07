import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, School, BookOpen, DoorOpen, Calendar, AlertTriangle, UserMinus,
  Zap, Settings, Layers, FileText, RefreshCw, Clock, TrendingUp,
  CheckCircle2, XCircle, Activity, ChevronRight, ClipboardList, Gauge
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PermissionGate from '../components/ui/PermissionGate';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user, hasPermission, selectedSchool, selectedSession } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todaySubs, setTodaySubs] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [setupStatus, setSetupStatus] = useState(null);

  useEffect(() => {
    api.get('/timetable/stats').then(r => { setStats(r.data); setLoading(false); }).catch(() => setLoading(false));

    // Today's substitutions
    const today = new Date().toISOString().split('T')[0];
    api.get(`/substitutions/daily/${today}`).then(r => setTodaySubs(r.data)).catch(() => {});

    // Recent audit logs
    api.get('/audit-logs?limit=5').then(r => {
      const data = r.data?.data || r.data || [];
      setAuditLogs(Array.isArray(data) ? data.slice(0, 5) : []);
    }).catch(() => {});

    // Setup readiness
    api.get('/setup/status').then(r => setSetupStatus(r.data)).catch(() => {});
  }, [selectedSchool, selectedSession]);

  const approveSub = async (id) => {
    try {
      await api.post(`/substitutions/${id}/approve`);
      toast.success('Approved');
      const today = new Date().toISOString().split('T')[0];
      api.get(`/substitutions/daily/${today}`).then(r => setTodaySubs(r.data));
    } catch (err) { toast.error('Failed'); }
  };

  const s = stats || {};
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  const statCards = [
    { label: 'Teachers', value: s.teachers, icon: Users, color: 'from-blue-500 to-cyan-500', link: '/teachers', perm: 'manage_teachers' },
    { label: 'Classes', value: s.classes, icon: School, color: 'from-emerald-500 to-teal-500', link: '/classes', perm: 'edit_setup' },
    { label: 'Subjects', value: s.subjects, icon: BookOpen, color: 'from-purple-500 to-indigo-500', link: '/subjects', perm: 'edit_setup' },
    { label: 'Rooms', value: s.rooms, icon: DoorOpen, color: 'from-amber-500 to-orange-500', link: '/rooms', perm: 'edit_setup' },
    { label: 'Weekly Loads', value: s.requirements, icon: FileText, color: 'from-teal-500 to-blue-500', link: '/requirements', perm: 'manage_rules' },
    { label: 'Combined Rules', value: s.combinationRules, icon: Layers, color: 'from-pink-500 to-rose-500', link: '/combinations', perm: 'manage_rules' },
    { label: 'Scheduled', value: s.scheduledBlocks, icon: Calendar, color: 'from-sky-500 to-blue-600', link: '/timetable', perm: 'view_timetable' },
    { label: 'Conflicts', value: s.conflicts, icon: AlertTriangle, color: 'from-red-500 to-pink-600', link: '/conflicts', warn: s.conflicts > 0, perm: 'view_timetable' },
    { label: 'Absences', value: s.pendingAbsences, icon: UserMinus, color: 'from-orange-500 to-red-500', link: '/absences', warn: s.pendingAbsences > 0, perm: 'manage_absences' },
  ];

  const quickActions = [
    { label: 'Setup Wizard', desc: 'Configure school, periods, and data', icon: Settings, color: 'from-primary-500 to-purple-600', link: '/setup', perm: 'edit_setup' },
    { label: 'Generate Timetable', desc: 'Auto-generate conflict-free schedule', icon: Zap, color: 'from-emerald-500 to-teal-600', link: '/generator', perm: 'generate_timetable' },
    { label: 'View Timetable', desc: 'Browse class & teacher schedules', icon: Calendar, color: 'from-blue-500 to-cyan-600', link: '/timetable', perm: 'view_timetable' },
    { label: 'Manage Absences', desc: 'Handle teacher absences & subs', icon: RefreshCw, color: 'from-orange-500 to-red-600', link: '/absences', perm: 'manage_absences' },
  ];

  const visibleStats = statCards.filter(c => hasPermission(c.perm));
  const visibleActions = quickActions.filter(a => hasPermission(a.perm));

  // Status indicator
  const timetableStatus = s.latestTimetable === 'published'
    ? { text: 'Published', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' }
    : s.latestTimetable === 'draft'
    ? { text: 'Draft Ready', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/15' }
    : { text: 'Ready to Generate', icon: Zap, color: 'text-primary-400', bg: 'bg-primary-500/15' };

  const auditIcons = {
    login: '🔑', create: '➕', update: '✏️', delete: '🗑️', generate: '⚡', publish: '📤',
    manual_edit: '🔧', teacher_replacement: '🔄', absence_create: '📋', substitution_approve: '✅',
    conflict_resolve: '🛠️', lock: '🔒', unlock: '🔓'
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 via-purple-600 to-indigo-600 p-5 sm:p-7 shadow-2xl shadow-primary-500/20">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        <div className="absolute left-1/2 -top-20 w-60 h-60 bg-purple-400/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg shrink-0">
              <Calendar size={28} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{greeting}, {user?.name?.split(' ')[0] || 'Admin'}</h1>
              <p className="text-white/60 text-xs sm:text-sm">TimeCraft — Advanced Automated School Timetable System</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${timetableStatus.bg} rounded-lg text-xs font-medium`}>
              <timetableStatus.icon size={14} className={timetableStatus.color} />
              <span className={timetableStatus.color}>{timetableStatus.text}</span>
            </div>
            {s.conflicts > 0 && (
              <Link to="/conflicts" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 rounded-lg text-xs font-medium text-red-300 hover:bg-red-500/25 transition-colors">
                <AlertTriangle size={14} />
                {s.conflicts} conflict{s.conflicts !== 1 ? 's' : ''}
                <ChevronRight size={12} />
              </Link>
            )}
            {s.pendingAbsences > 0 && (
              <Link to="/absences" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-500/25 transition-colors">
                <UserMinus size={14} />
                {s.pendingAbsences} pending
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {visibleStats.map(card => {
          const Icon = card.icon;
          return (
            <Link to={card.link} key={card.label} className="glass-card-hover p-4 group min-h-[60px] touch-manipulation">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
                <div>
                  <p className={`text-xl font-bold ${card.warn ? 'text-amber-500 dark:text-amber-400' : 'text-slate-900 dark:text-dark-50'}`}>
                    {loading ? <span className="inline-block w-6 h-5 bg-slate-200 dark:bg-dark-700 rounded animate-pulse" /> : (card.value ?? 0)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-dark-400">{card.label}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      {visibleActions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-3 uppercase tracking-wider">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleActions.map(action => {
              const Icon = action.icon;
              return (
                <Link to={action.link} key={action.label} className="glass-card-hover p-4 sm:p-5 group flex items-start gap-3 sm:gap-4 touch-manipulation min-h-[72px]">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-dark-50 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{action.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">{action.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Operational Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Substitutions */}
        <PermissionGate permissions={['approve_substitutions']}>
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider flex items-center gap-2">
                <RefreshCw size={14} />Today's Substitutions
              </h3>
              <Link to="/substitutions" className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors">View All →</Link>
            </div>
            {!todaySubs || todaySubs.count === 0 ? (
              <p className="text-xs text-slate-400 dark:text-dark-500 py-4 text-center">No substitutions today</p>
            ) : (
              <div className="space-y-2">
                {todaySubs.data?.slice(0, 5).map(sub => (
                  <div key={sub._id} className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-dark-800/50 border border-slate-200/30 dark:border-dark-700/30">
                    <span className="text-xs font-mono text-slate-500 dark:text-dark-400 w-7 shrink-0">P{sub.period}</span>
                    <span className="text-xs text-red-400 truncate">{sub.originalTeacher?.name}</span>
                    <ChevronRight size={10} className="text-slate-300 dark:text-dark-600 shrink-0" />
                    <span className="text-xs text-emerald-400 truncate">{sub.substituteTeacher?.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-dark-500 ml-auto shrink-0">{sub.class?.name}</span>
                    {sub.status === 'pending' && (
                      <button onClick={() => approveSub(sub._id)} className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors shrink-0">Approve</button>
                    )}
                    {sub.status === 'confirmed' && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                  </div>
                ))}
                {todaySubs.count > 5 && <p className="text-[10px] text-slate-400 dark:text-dark-500 text-center">+{todaySubs.count - 5} more</p>}
              </div>
            )}
          </div>
        </PermissionGate>

        {/* Recent Audit Activity */}
        <PermissionGate permissions={['view_audit']}>
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList size={14} />Recent Activity
              </h3>
              <Link to="/audit-logs" className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors">View All →</Link>
            </div>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-dark-500 py-4 text-center">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log, i) => (
                  <div key={log._id || i} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/50 dark:bg-dark-800/50 border border-slate-200/30 dark:border-dark-700/30">
                    <span className="text-sm mt-0.5 shrink-0">{auditIcons[log.action] || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-dark-200 truncate">
                        <span className="font-medium">{log.action?.replace(/_/g, ' ')}</span>
                        {log.entityName && <span className="text-slate-400 dark:text-dark-500"> · {log.entityName}</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-dark-500">{log.userName || 'System'} · {new Date(log.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PermissionGate>
      </div>

      {/* Setup Readiness + System Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Setup Readiness */}
        {setupStatus && (
          <PermissionGate permissions={['edit_setup']}>
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider flex items-center gap-2">
                  <Settings size={14} />Setup Readiness
                </h3>
                <Link to="/setup" className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors">Open Wizard →</Link>
              </div>
              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 dark:text-dark-400">{setupStatus.completedSteps}/{setupStatus.totalSteps} steps</span>
                  <span className={`text-xs font-bold ${setupStatus.readinessScore >= 100 ? 'text-emerald-400' : setupStatus.readinessScore >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{setupStatus.readinessScore}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${setupStatus.readinessScore >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : setupStatus.readinessScore >= 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-pink-500'}`}
                    style={{ width: `${setupStatus.readinessScore}%` }} />
                </div>
              </div>
              {/* Step indicators */}
              <div className="grid grid-cols-2 gap-1.5">
                {setupStatus.steps?.map(step => (
                  <div key={step.key} className="flex items-center gap-1.5 text-[10px]">
                    {step.complete ? <CheckCircle2 size={10} className="text-emerald-400 shrink-0" /> : <XCircle size={10} className="text-slate-300 dark:text-dark-600 shrink-0" />}
                    <span className={step.complete ? 'text-slate-600 dark:text-dark-300' : 'text-slate-400 dark:text-dark-500'}>{step.label}</span>
                    {step.count !== undefined && <span className="text-slate-400 dark:text-dark-500">({step.count})</span>}
                  </div>
                ))}
              </div>
              {setupStatus.canGenerate && (
                <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                  <p className="text-xs text-emerald-400 font-medium">✓ Ready to generate timetable</p>
                </div>
              )}
            </div>
          </PermissionGate>
        )}

        {/* System Status */}
        {stats && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Activity size={14} />System Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{s.requirements || 0}</p>
                <p className="text-[10px] text-slate-500 dark:text-dark-400">Subject-Class Loads</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{s.combinationRules || 0}</p>
                <p className="text-[10px] text-slate-500 dark:text-dark-400">Combination Rules</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3">
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{s.scheduledBlocks || 0}</p>
                <p className="text-[10px] text-slate-500 dark:text-dark-400">Lesson Blocks</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-800/60 rounded-xl p-3">
                <p className={`text-lg font-bold ${s.conflicts > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{s.conflicts || 0}</p>
                <p className="text-[10px] text-slate-500 dark:text-dark-400">Active Conflicts</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

