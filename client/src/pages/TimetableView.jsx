import { useState, useEffect } from 'react';
import { Lock, Unlock, ArrowLeftRight } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function TimetableView() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [selectedTT, setSelectedTT] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [viewMode, setViewMode] = useState('class');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [maxPeriod, setMaxPeriod] = useState(8);

  useEffect(() => {
    api.get('/classes').then(r => { setClasses(r.data || []); if (r.data?.length) setSelectedClass(r.data[0]._id); });
    api.get('/teachers').then(r => setTeachers(r.data || []));
    api.get('/timetable/list').then(r => { const tts = r.data || []; setTimetables(tts); if (tts.length) setSelectedTT(tts[0]._id); });
  }, []);

  useEffect(() => {
    if (!selectedTT) return;
    setLoading(true);
    const endpoint = viewMode === 'class' && selectedClass ? `/timetable/${selectedTT}/class/${selectedClass}` : viewMode === 'teacher' && selectedTeacher ? `/timetable/${selectedTT}/teacher/${selectedTeacher}` : null;
    if (!endpoint) { setLoading(false); return; }
    api.get(endpoint).then(r => {
      const b = r.data || [];
      setBlocks(b);
      const mp = b.reduce((max, bl) => Math.max(max, ...bl.periods), 0);
      setMaxPeriod(Math.max(mp, 8));
      setLoading(false);
    });
  }, [selectedTT, selectedClass, selectedTeacher, viewMode]);

  const getBlock = (day, period) => blocks.find(b => b.day === day && b.periods?.includes(period) && b.type !== 'reserved');
  const isBreak = (period) => { const bp = blocks.find(b => b.type === 'reserved' && b.periods?.includes(period) && !b.subject); return !!bp; };

  const handleLock = async (block) => {
    try {
      block.isLocked ? await api.put(`/timetable/block/${block._id}/unlock`) : await api.put(`/timetable/block/${block._id}/lock`);
      toast.success(block.isLocked ? 'Unlocked' : 'Locked');
      // Refresh
      const endpoint = viewMode === 'class' ? `/timetable/${selectedTT}/class/${selectedClass}` : `/timetable/${selectedTT}/teacher/${selectedTeacher}`;
      api.get(endpoint).then(r => setBlocks(r.data || []));
    } catch (err) { toast.error(err.message); }
  };

  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><h1 className="page-title">Timetable Editor</h1><p className="page-subtitle">View and edit lesson blocks</p></div>
        <div className="flex items-center gap-3 flex-wrap">
          {timetables.length > 0 && <select value={selectedTT} onChange={e => setSelectedTT(e.target.value)} className="select-field w-44 text-xs">{timetables.map(t => <option key={t._id} value={t._id}>{t.name} ({t.status})</option>)}</select>}
          <div className="flex bg-dark-800 rounded-xl p-1 border border-dark-700">
            <button onClick={() => setViewMode('class')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${viewMode === 'class' ? 'bg-primary-600 text-white' : 'text-dark-400'}`}>Class</button>
            <button onClick={() => setViewMode('teacher')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${viewMode === 'teacher' ? 'bg-primary-600 text-white' : 'text-dark-400'}`}>Teacher</button>
          </div>
          {viewMode === 'class' ? <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="select-field w-36 text-xs">{classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
           : <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="select-field w-44 text-xs"><option value="">Select</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select>}
        </div>
      </div>

      {!selectedTT ? <div className="glass-card p-12 text-center text-dark-400">No timetable generated yet. Go to Generator first.</div> : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr className="table-header"><th className="px-3 py-2.5 text-left w-20 text-xs">Period</th>{DAYS.map(d => <th key={d} className="px-3 py-2.5 text-center text-xs">{d.slice(0,3)}</th>)}</tr></thead>
            <tbody>
              {periods.map(p => {
                const brk = isBreak(p);
                return (
                  <tr key={p} className={`border-t border-dark-700/40 ${brk ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-3 py-1.5 text-xs font-medium text-dark-300">{brk ? '☕ Break' : `P${p}`}</td>
                    {DAYS.map(d => {
                      if (brk) return <td key={d} className="px-2 py-1.5 text-center text-[10px] text-amber-400/50">Break</td>;
                      const block = getBlock(d, p);
                      if (!block) return <td key={d} className="px-2 py-1.5"><div className="p-2 rounded-lg bg-dark-800/20 text-center text-dark-600 text-[10px] border border-dashed border-dark-700/40 min-h-[56px] flex items-center justify-center">—</div></td>;
                      return (
                        <td key={d} className="px-2 py-1.5">
                          <div className="p-2 rounded-xl text-[10px] relative cursor-pointer hover:scale-[1.02] transition-all min-h-[56px]"
                            style={{ backgroundColor: (block.subject?.color || '#6366f1') + '18', borderLeft: `3px solid ${block.subject?.color || '#6366f1'}` }}>
                            <p className="font-semibold text-white truncate text-xs">{block.subject?.name || 'Free'}</p>
                            <p className="text-dark-400 truncate">{block.teacher?.name || ''}</p>
                            <p className="text-dark-500 truncate">{block.room?.name || ''}</p>
                            <div className="absolute top-1 right-1 flex gap-0.5">
                              {block.isLocked && <span className="text-[8px]">🔒</span>}
                              {block.type === 'combined_class' && <span className="text-[8px]">🔗</span>}
                              {block.type === 'split_group' && <span className="text-[8px]">👥</span>}
                            </div>
                            <button onClick={() => handleLock(block)} className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-0.5">
                              {block.isLocked ? <Unlock size={10} className="text-amber-400" /> : <Lock size={10} className="text-dark-500" />}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-[10px] text-dark-500">
        <span className="flex items-center gap-1">🔒 Locked</span>
        <span className="flex items-center gap-1">🔗 Combined</span>
        <span className="flex items-center gap-1">👥 Split Group</span>
      </div>
    </div>
  );
}
