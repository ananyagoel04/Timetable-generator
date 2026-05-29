import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar, ChevronRight, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function SchoolSessionSelector() {
  const { user, switchSchool, isPlatformUser } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    if (!user?.schools?.length) {
      if (import.meta.env.DEV) console.debug('[SchoolSelector] no schools, redirecting to /');
      navigate('/');
      return;
    }
    // Load sessions for each school
    const loadSessions = async () => {
      const sessionMap = {};
      for (const membership of user.schools) {
        const schoolId = membership.school?._id || membership.school;
        try {
          const res = await api.get(`/setup/sessions?schoolId=${schoolId}`);
          sessionMap[schoolId] = res.data || [];
        } catch { sessionMap[schoolId] = []; }
      }
      setSessions(sessionMap);
      setLoading(false);
    };
    loadSessions();
  }, [user, navigate]);

  const handleSelect = async (schoolId, sessionId) => {
    setSwitching(schoolId);
    try {
      await switchSchool(schoolId, sessionId);
      navigate('/');
    } catch (err) {
      console.error(err);
      setSwitching(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0a2a 0%, #1a1145 30%, #0d1f3c 60%, #0a0a1a 100%)' }}>
        <Loader size={32} className="text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f0a2a 0%, #1a1145 30%, #0d1f3c 60%, #0a0a1a 100%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -top-20 -left-20 animate-pulse" />
        <div className="absolute w-80 h-80 bg-blue-500/8 rounded-full blur-3xl bottom-10 right-10" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-500/20">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Select School</h1>
          <p className="text-slate-400">Choose which school and session to work with</p>
        </div>

        <div className="space-y-4">
          {user.schools.map((membership, idx) => {
            const schoolId = membership.school?._id || membership.school;
            const schoolName = membership.school?.name || `School ${idx + 1}`;
            const schoolSessions = sessions[schoolId] || [];
            const currentSession = schoolSessions.find(s => s.isCurrent) || schoolSessions[0];
            const isSwitching = switching === schoolId;

            return (
              <button key={schoolId} onClick={() => handleSelect(schoolId, currentSession?._id)} disabled={isSwitching}
                className="glass-card w-full p-5 flex items-center gap-4 text-left group hover:border-primary-500/30 transition-all duration-200 cursor-pointer">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 border border-primary-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Building2 size={24} className="text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{schoolName}</h3>
                  <p className="text-sm text-slate-400 capitalize">{membership.role?.replace(/_/g, ' ')}</p>
                  {currentSession && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <Calendar size={12} />
                      <span>{currentSession.name} ({currentSession.status})</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {isSwitching ? (
                    <Loader size={20} className="text-primary-400 animate-spin" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-500 group-hover:text-primary-400 transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
