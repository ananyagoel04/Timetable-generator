import { useState, useEffect } from 'react';
import { Shield, School, Users, AlertTriangle, Clock, Eye, Activity, BarChart3, Database, Cpu, HardDrive, RefreshCw, Plus, Search } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function PlatformAdmin() {
  const { user, isPlatformUser } = useAuth();
  const [tab, setTab] = useState('overview');
  const [schools, setSchools] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [platformUsers, setPlatformUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [impersonation, setImpersonation] = useState({ schoolId: '', reason: '', hours: 2 });
  const [activeImpersonation, setActiveImpersonation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isPlatformUser()) return;
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schoolsRes, statsRes] = await Promise.all([
        api.get('/platform/schools').catch(() => ({ data: { data: [] } })),
        api.get('/platform/stats').catch(() => ({ data: { data: null } })),
      ]);
      setSchools(schoolsRes.data?.data || []);
      setPlatformStats(statsRes.data?.data || null);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/platform/audit-logs?limit=50');
      setAuditLogs(res.data?.data || []);
    } catch (e) { /* silent */ }
  };

  const fetchPlatformUsers = async () => {
    try {
      const res = await api.get('/platform/users');
      setPlatformUsers(res.data?.data || []);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    if (tab === 'audit') fetchAuditLogs();
    if (tab === 'users') fetchPlatformUsers();
  }, [tab]);

  if (!isPlatformUser()) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-card p-12 text-center max-w-md">
          <Shield size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-dark-50 mb-2">Access Restricted</h2>
          <p className="text-slate-500 dark:text-dark-400">This area is reserved for platform administrators and support staff.</p>
          <p className="text-xs text-slate-400 dark:text-dark-500 mt-2">Your role: {user?.role?.replace(/_/g, ' ')}</p>
        </div>
      </div>
    );
  }

  const startImpersonation = () => {
    if (!impersonation.reason.trim()) return toast.error('Provide an access reason');
    const expiry = new Date(Date.now() + impersonation.hours * 60 * 60 * 1000);
    setActiveImpersonation({ ...impersonation, startedAt: new Date(), expiresAt: expiry });
    toast.success(`Support session started — expires in ${impersonation.hours}h`);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'schools', label: 'Schools', icon: School },
    { id: 'support', label: 'Support Access', icon: Eye },
    { id: 'audit', label: 'Platform Audit', icon: Activity },
    { id: 'users', label: 'Platform Users', icon: Users }
  ];

  const filteredSchools = schools.filter(s =>
    !searchQuery || s.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Platform Administration</h1>
          <p className="page-subtitle">Multi-school management & cross-tenant diagnostics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-purple">{user?.role?.replace(/_/g, ' ')}</span>
          <button onClick={fetchData} className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-2">
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>

      {activeImpersonation && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">Active Support Session</p>
              <p className="text-xs text-amber-400/70">Reason: {activeImpersonation.reason} · Expires: {new Date(activeImpersonation.expiresAt).toLocaleTimeString()}</p>
            </div>
          </div>
          <button onClick={() => { setActiveImpersonation(null); toast.success('Session ended'); }} className="btn-danger text-xs">End Session</button>
        </div>
      )}

      {/* Tab bar */}
      <div className="glass-card p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                ${tab === t.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50 hover:bg-slate-100/60 dark:hover:bg-dark-800/60'}`}>
              <Icon size={16} /><span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 mx-auto mb-3 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-dark-400 text-sm">Loading platform data...</p>
        </div>
      ) : (
        <>
          {/* ═══ OVERVIEW ═══ */}
          {tab === 'overview' && platformStats && (
            <div className="space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Schools', value: platformStats.schools, icon: School, color: 'from-blue-500 to-cyan-500' },
                  { label: 'Users', value: platformStats.users, icon: Users, color: 'from-emerald-500 to-teal-500' },
                  { label: 'Timetables', value: platformStats.timetables, icon: BarChart3, color: 'from-purple-500 to-indigo-500' },
                  { label: 'Audit (24h)', value: platformStats.auditLogsLast24h, icon: Activity, color: 'from-amber-500 to-orange-500' },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="glass-card p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                          <Icon size={18} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-slate-900 dark:text-dark-50">{s.value ?? '—'}</p>
                          <p className="text-[11px] text-slate-500 dark:text-dark-400">{s.label}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* System info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-3 flex items-center gap-2"><Database size={16} /> Database</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Collections</span><span className="font-mono text-slate-900 dark:text-dark-50">{platformStats.database?.collections}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Data Size</span><span className="font-mono text-slate-900 dark:text-dark-50">{platformStats.database?.dataSize}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Storage</span><span className="font-mono text-slate-900 dark:text-dark-50">{platformStats.database?.storageSize}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Indexes</span><span className="font-mono text-slate-900 dark:text-dark-50">{platformStats.database?.indexes}</span></div>
                  </div>
                </div>
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-3 flex items-center gap-2"><Cpu size={16} /> Server</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Uptime</span><span className="font-mono text-slate-900 dark:text-dark-50">{Math.round(platformStats.serverUptime / 60)}m</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Heap Used</span><span className="font-mono text-slate-900 dark:text-dark-50">{platformStats.memoryUsage?.heapUsed}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">RSS</span><span className="font-mono text-slate-900 dark:text-dark-50">{platformStats.memoryUsage?.rss}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SCHOOLS ═══ */}
          {tab === 'schools' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input-field !pl-10" placeholder="Search schools..." />
                </div>
                <button className="btn-primary flex items-center gap-1.5 text-sm"><Plus size={16} />Add School</button>
              </div>
              <p className="text-sm text-slate-500 dark:text-dark-400">{filteredSchools.length} school{filteredSchools.length !== 1 ? 's' : ''} on platform</p>
              {filteredSchools.map(s => (
                <div key={s._id} className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">{s.name?.charAt(0)}</div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-dark-50">{s.name}</p>
                      <p className="text-xs text-slate-500 dark:text-dark-400">{s.code} · {s.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-right text-[10px] text-slate-400 dark:text-dark-500 hidden sm:block">
                      <p>{s.sessionCount || 0} sessions · {s.timetableCount || 0} timetables · {s.userCount || 0} users</p>
                    </div>
                    <span className={s.status === 'active' ? 'badge-success' : 'badge-danger'}>{s.status || 'active'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ SUPPORT ACCESS ═══ */}
          {tab === 'support' && (
            <div className="glass-card p-6 max-w-lg">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-50 mb-4 flex items-center gap-2"><Eye size={16} className="text-amber-400" /> Start Support Session</h3>
              <div className="space-y-4">
                <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">School</label>
                  <select value={impersonation.schoolId} onChange={e => setImpersonation(f => ({ ...f, schoolId: e.target.value }))} className="select-field">
                    <option value="">Select school</option>
                    {schools.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select></div>
                <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Reason for Access</label>
                  <input value={impersonation.reason} onChange={e => setImpersonation(f => ({ ...f, reason: e.target.value }))} className="input-field" placeholder="e.g., Troubleshooting timetable generation issue" /></div>
                <div><label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block">Duration</label>
                  <select value={impersonation.hours} onChange={e => setImpersonation(f => ({ ...f, hours: +e.target.value }))} className="select-field">
                    <option value={1}>1 hour</option><option value={2}>2 hours</option><option value={4}>4 hours</option>
                  </select></div>
                <button onClick={startImpersonation} className="btn-primary w-full flex items-center justify-center gap-2"><Clock size={16} /> Start Support Session</button>
              </div>
            </div>
          )}

          {/* ═══ AUDIT ═══ */}
          {tab === 'audit' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-dark-400">Recent platform activity (latest 50)</p>
                <button onClick={fetchAuditLogs} className="text-xs text-primary-500 hover:text-primary-400 font-medium">Refresh</button>
              </div>
              {auditLogs.length === 0 ? (
                <div className="glass-card p-12 text-center text-slate-400 dark:text-dark-500">
                  <Activity size={32} className="mx-auto mb-3 opacity-40" />
                  <p>No audit logs yet</p>
                </div>
              ) : auditLogs.map((log, i) => (
                <div key={log._id || i} className="glass-card p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-dark-800 flex items-center justify-center shrink-0">
                    <Activity size={14} className="text-slate-500 dark:text-dark-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-900 dark:text-dark-50 font-medium truncate">{log.action}</p>
                    <p className="text-[10px] text-slate-400 dark:text-dark-500 truncate">
                      {log.entityType} · {log.user?.name || log.performedBy || 'system'} · {log.school?.name || '—'} · {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ USERS ═══ */}
          {tab === 'users' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 dark:text-dark-400">{platformUsers.length} platform-level user{platformUsers.length !== 1 ? 's' : ''}</p>
              {platformUsers.length === 0 ? (
                <div className="glass-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold">{user?.name?.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-dark-50">{user?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-dark-400">{user?.email}</p>
                  </div>
                  <span className="badge-purple ml-auto">{user?.role?.replace(/_/g, ' ')}</span>
                </div>
              ) : platformUsers.map(u => (
                <div key={u._id} className="glass-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold">{u.name?.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-dark-50 truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 dark:text-dark-400 truncate">{u.email}</p>
                  </div>
                  <span className="badge-purple">{u.role?.replace(/_/g, ' ')}</span>
                  <span className={u.isActive ? 'badge-success' : 'badge-danger'}>{u.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
