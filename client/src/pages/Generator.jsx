import { useState, useEffect } from 'react';
import { Zap, CheckCircle, AlertTriangle, Loader2, FileText, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Generator() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [timetables, setTimetables] = useState([]);

  useEffect(() => { api.get('/timetable/list').then(r => setTimetables(r.data || [])); }, []);

  const handleGenerate = async () => {
    setGenerating(true); setResult(null);
    try {
      const res = await api.post('/timetable/generate');
      setResult(res.data);
      toast.success(`Generated ${res.data.totalBlocks} lesson blocks!`);
      api.get('/timetable/list').then(r => setTimetables(r.data || []));
    } catch (err) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const handlePublish = async (id) => {
    try { await api.put(`/timetable/${id}/publish`); toast.success('Published!'); api.get('/timetable/list').then(r => setTimetables(r.data || [])); }
    catch (err) { toast.error(err.message); }
  };

  const statusColors = { generating: 'text-amber-400', draft: 'text-blue-400', review: 'text-amber-400', published: 'text-emerald-400', archived: 'text-slate-400 dark:text-dark-500', failed: 'text-red-400' };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="text-center"><h1 className="page-title">Timetable Generator</h1><p className="page-subtitle mt-1">Auto-generate a conflict-free timetable using the scheduling engine</p></div>

      <div className="glass-card p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30"><Zap size={36} className="text-slate-900 dark:text-dark-50" /></div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-dark-50 mb-2">Lesson-Block Scheduling Engine</h2>
        <p className="text-slate-500 dark:text-dark-400 text-sm mb-6 max-w-md mx-auto">Analyzes all classes, teachers, subjects, rooms, combination rules, and constraints to create an optimal schedule.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-left">
          {[{ l: 'No teacher clashes', d: 'Hard constraint' }, { l: 'No room clashes', d: 'Hard constraint' }, { l: 'Combined classes', d: 'Shared subject blocks' }, { l: 'Load balancing', d: 'Soft optimization' }].map((c, i) => (
            <div key={i} className="bg-white/60 dark:bg-dark-800/60 rounded-xl p-3 border border-slate-300/50 dark:border-dark-700/50"><p className="text-xs font-semibold text-emerald-400">{c.l}</p><p className="text-[10px] text-slate-500 dark:text-dark-400 mt-0.5">{c.d}</p></div>
          ))}
        </div>
        <button onClick={handleGenerate} disabled={generating} className={`btn-primary px-8 py-3 text-lg inline-flex items-center gap-3 ${generating ? 'opacity-70 cursor-not-allowed' : ''}`}>
          {generating ? <><Loader2 size={22} className="animate-spin" /> Generating...</> : <><Zap size={22} /> Generate Timetable</>}
        </button>
      </div>

      {result && (
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4"><CheckCircle size={24} className="text-emerald-400" /><h3 className="text-lg font-semibold text-slate-900 dark:text-dark-50">Generation Complete</h3></div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{result.totalBlocks}</p><p className="text-xs text-slate-500 dark:text-dark-400">Blocks</p></div>
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-slate-900 dark:text-dark-50">{result.status}</p><p className="text-xs text-slate-500 dark:text-dark-400">Status</p></div>
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className={`text-2xl font-bold ${result.unplaced > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{result.unplaced}</p><p className="text-xs text-slate-500 dark:text-dark-400">Unplaced</p></div>
            <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center"><p className={`text-2xl font-bold ${result.conflicts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{result.conflicts}</p><p className="text-xs text-slate-500 dark:text-dark-400">Conflicts</p></div>
          </div>
          <div className="flex justify-center gap-3">
            <Link to="/timetable" className="btn-primary flex items-center gap-2"><Eye size={16} /> View Timetable</Link>
            {result.conflicts > 0 && <Link to="/conflicts" className="btn-secondary flex items-center gap-2"><AlertTriangle size={16} /> View Conflicts</Link>}
          </div>
        </div>
      )}

      {timetables.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-300/50 dark:border-dark-700/50"><h3 className="font-semibold text-slate-900 dark:text-dark-50 text-sm">Generated Timetables</h3></div>
          <div className="divide-y divide-dark-700/30">
            {timetables.map(t => (
              <div key={t._id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-100/30 dark:hover:bg-dark-800/30">
                <div>
                  <p className="text-sm text-slate-900 dark:text-dark-50 font-medium">{t.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-dark-500">{new Date(t.createdAt).toLocaleString()} · {t.stats?.totalBlocks || 0} blocks · {t.stats?.generationTimeMs || 0}ms</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${statusColors[t.status]}`}>{t.status}</span>
                  {t.status === 'draft' && <button onClick={() => handlePublish(t._id)} className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Publish</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
