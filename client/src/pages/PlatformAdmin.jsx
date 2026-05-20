import { useState, useEffect } from 'react';
import { Shield, School, Users, AlertTriangle, Clock, Eye, Search, Activity } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function PlatformAdmin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('schools');
  const [schools, setSchools] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [impersonation, setImpersonation] = useState({ schoolId: '', reason: '', hours: 2 });
  const [activeImpersonation, setActiveImpersonation] = useState(null);
  const [loading, setLoading] = useState(true);

  const isPlatformUser = user?.role?.startsWith('platform_') || user?.role === 'deployment_manager';

  useEffect(() => {
    if (!isPlatformUser) return;
    setLoading(true);
    Promise.all([
      api.get('/setup/school').then(r => setSchools(r.data ? [r.data] : [])),
      api.get('/audit-logs?limit=50').then(r => setAuditLogs(r.data || []))
    ]).finally(() => setLoading(false));
  }, []);

  if (!isPlatformUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-card p-12 text-center max-w-md">
          <Shield size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-dark-400">This area is reserved for platform administrators and support staff.</p>
          <p className="text-xs text-dark-500 mt-2">Your role: {user?.role?.replace(/_/g, ' ')}</p>
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

  const endImpersonation = () => {
    setActiveImpersonation(null);
    toast.success('Support session ended');
  };

  const tabs = [
    { id: 'schools', label: 'Schools', icon: School },
    { id: 'support', label: 'Support Access', icon: Eye },
    { id: 'audit', label: 'Platform Audit', icon: Activity },
    { id: 'users', label: 'Platform Users', icon: Users }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Platform Administration</h1><p className="page-subtitle">Multi-school management & support tools</p></div>
        <span className="badge-purple">{user?.role?.replace(/_/g, ' ')}</span>
      </div>

      {activeImpersonation && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-400" />
            <div><p className="text-sm font-medium text-amber-300">Active Support Session</p>
              <p className="text-xs text-amber-400/70">Reason: {activeImpersonation.reason} · Expires: {new Date(activeImpersonation.expiresAt).toLocaleTimeString()}</p>
            </div>
          </div>
          <button onClick={endImpersonation} className="btn-danger text-xs">End Session</button>
        </div>
      )}

      <div className="glass-card p-1.5 flex gap-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                ${tab === t.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'text-dark-400 hover:text-white hover:bg-dark-800/60'}`}>
              <Icon size={16} /><span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? <div className="text-center py-16 text-dark-400">Loading...</div> : (
        <>
          {tab === 'schools' && (
            <div className="space-y-3">
              <p className="text-sm text-dark-400">{schools.length} school{schools.length !== 1 ? 's' : ''} on platform</p>
              {schools.map(s => (
                <div key={s._id} className="glass-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">{s.name?.charAt(0)}</div>
                    <div>
                      <p className="font-semibold text-white">{s.name}</p>
                      <p className="text-xs text-dark-400">{s.code} · {s.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={s.isActive ? 'badge-success' : 'badge-danger'}>{s.isActive ? 'Active' : 'Inactive'}</span>
                    <p className="text-[10px] text-dark-500">{new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'support' && (
            <div className="glass-card p-6 max-w-lg">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Eye size={16} className="text-amber-400" /> Start Support Session</h3>
              <div className="space-y-4">
                <div><label className="text-xs text-dark-400 mb-1 block">School</label>
                  <select value={impersonation.schoolId} onChange={e => setImpersonation(f => ({ ...f, schoolId: e.target.value }))} className="select-field">
                    <option value="">Select school</option>
                    {schools.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select></div>
                <div><label className="text-xs text-dark-400 mb-1 block">Reason for Access</label>
                  <input value={impersonation.reason} onChange={e => setImpersonation(f => ({ ...f, reason: e.target.value }))} className="input-field" placeholder="e.g., Troubleshooting timetable generation issue" /></div>
                <div><label className="text-xs text-dark-400 mb-1 block">Duration</label>
                  <select value={impersonation.hours} onChange={e => setImpersonation(f => ({ ...f, hours: +e.target.value }))} className="select-field">
                    <option value={1}>1 hour</option><option value={2}>2 hours</option><option value={4}>4 hours</option>
                  </select></div>
                <button onClick={startImpersonation} className="btn-primary w-full flex items-center justify-center gap-2"><Clock size={16} /> Start Support Session</button>
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-2">
              <p className="text-sm text-dark-400">Recent platform activity</p>
              {auditLogs.length === 0 ? <div className="glass-card p-12 text-center text-dark-500">No audit logs yet</div> :
                auditLogs.slice(0, 30).map((log, i) => (
                  <div key={log._id || i} className="glass-card p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center"><Activity size={14} className="text-dark-400" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{log.action}</p>
                      <p className="text-[10px] text-dark-500">{log.entity} · {log.performedBy || 'system'} · {new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-3">
              <p className="text-sm text-dark-400">Platform-level users</p>
              <div className="glass-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold">{user?.name?.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{user?.name}</p>
                    <p className="text-xs text-dark-400">{user?.email}</p>
                  </div>
                  <span className="badge-purple ml-auto">{user?.role?.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
