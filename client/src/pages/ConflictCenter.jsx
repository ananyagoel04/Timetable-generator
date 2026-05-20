import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, Users, DoorOpen, Clock, AlertTriangle, BookOpen, XCircle } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ConflictCenter() {
  const [conflicts, setConflicts] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [selectedTT, setSelectedTT] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timetable/list').then(r => { const tts = r.data || []; setTimetables(tts); if (tts.length) setSelectedTT(tts[0]._id); });
  }, []);

  useEffect(() => { if (selectedTT) fetchConflicts(); }, [selectedTT]);

  const fetchConflicts = () => {
    setLoading(true);
    api.get(`/timetable/${selectedTT}/conflicts`).then(r => { setConflicts(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  };

  const typeConfig = {
    teacher_clash: { icon: Users, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Teacher Double-Booked' },
    room_clash: { icon: DoorOpen, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Room Double-Booked' },
    class_clash: { icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Class Clash' },
    teacher_overload: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Teacher Overload' },
    missing_teacher: { icon: XCircle, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Missing Teacher' },
    subject_shortage: { icon: AlertTriangle, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', label: 'Subject Shortage' },
    unassigned_lesson: { icon: AlertTriangle, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', label: 'Unassigned Lesson' },
  };

  const severityColors = { critical: 'badge-danger', high: 'bg-red-500/20 text-red-400', medium: 'badge-warning', low: 'badge-info', warning: 'bg-amber-500/20 text-amber-400' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Conflict Center</h1><p className="page-subtitle">{conflicts.length} issues detected</p></div>
        <div className="flex items-center gap-3">
          {timetables.length > 0 && <select value={selectedTT} onChange={e => setSelectedTT(e.target.value)} className="select-field w-44 text-xs">{timetables.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select>}
          <button onClick={fetchConflicts} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /> Re-scan</button>
        </div>
      </div>

      {loading ? <div className="text-center py-16 text-dark-400">Scanning...</div> :
       !selectedTT ? <div className="glass-card p-12 text-center text-dark-400">No timetable generated yet.</div> :
       conflicts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Conflicts Found</h2>
          <p className="text-dark-400">Your timetable is conflict-free!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((c, i) => {
            const cfg = typeConfig[c.type] || typeConfig.teacher_clash;
            const Icon = cfg.icon;
            return (
              <div key={c._id || i} className={`glass-card p-5 border ${cfg.bg} animate-slide-up`} style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}><Icon size={20} className={cfg.color} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white text-sm">{c.title || cfg.label}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${severityColors[c.severity] || 'badge-info'}`}>{c.severity}</span>
                    </div>
                    <p className="text-sm text-dark-300">{c.message}</p>
                    {c.day && <p className="text-xs text-dark-500 mt-1">{c.day} · Period {c.period}</p>}
                    {c.suggestedFix && <p className="text-xs text-emerald-400/70 mt-1.5">💡 {c.suggestedFix}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
