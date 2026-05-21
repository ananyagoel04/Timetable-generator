import { useState, useEffect } from 'react';
import { Lock, Unlock, ArrowLeftRight, Edit3, Save, X, AlertTriangle, GripVertical, Loader2, PenSquare, Users, BookOpen, DoorOpen, RefreshCw, Move, Trash2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function TimetableView() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [selectedTT, setSelectedTT] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [viewMode, setViewMode] = useState('class');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [maxPeriod, setMaxPeriod] = useState(8);

  // Editor state
  const [editMode, setEditMode] = useState(false);
  const [dragSource, setDragSource] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [pendingSwaps, setPendingSwaps] = useState([]);
  const [saving, setSaving] = useState(false);

  // Inline edit modal
  const [editBlock, setEditBlock] = useState(null);
  const [editData, setEditData] = useState({ subject: '', teacher: '', room: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => { const d = r.data?.data || r.data || []; setClasses(d); if (d.length) setSelectedClass(d[0]._id); }),
      api.get('/teachers').then(r => setTeachers(r.data?.data || r.data || [])),
      api.get('/subjects').then(r => setSubjects(r.data?.data || r.data || [])),
      api.get('/rooms').then(r => setRooms(r.data?.data || r.data || [])),
      api.get('/timetable/list').then(r => { const tts = r.data?.data || r.data || []; setTimetables(tts); if (tts.length) setSelectedTT(tts[0]._id); })
    ]);
  }, []);

  useEffect(() => {
    if (!selectedTT) return;
    loadBlocks();
  }, [selectedTT, selectedClass, selectedTeacher, viewMode]);

  const loadBlocks = async () => {
    setLoading(true);
    const endpoint = viewMode === 'class' && selectedClass
      ? `/timetable/${selectedTT}/class/${selectedClass}`
      : viewMode === 'teacher' && selectedTeacher
        ? `/timetable/${selectedTT}/teacher/${selectedTeacher}` : null;
    if (!endpoint) { setLoading(false); return; }
    try {
      const r = await api.get(endpoint);
      const b = r.data?.data || r.data || [];
      setBlocks(b);
      const mp = b.reduce((max, bl) => Math.max(max, ...(bl.periods || [])), 0);
      setMaxPeriod(Math.max(mp, 8));
    } catch (err) { /* silent */ }
    finally { setLoading(false); }
  };

  const getBlock = (day, period) => blocks.find(b => b.day === day && b.periods?.includes(period) && b.type !== 'reserved');
  const isBreak = (period) => !!blocks.find(b => b.type === 'reserved' && b.periods?.includes(period) && !b.subject);

  // Check if this block is part of a consecutive group
  const isConsecutiveGroup = (block) => block?.consecutiveGroupId;

  // Find consecutive peer on the same day
  const getConsecutivePeers = (block) => {
    if (!block?.consecutiveGroupId) return [];
    return blocks.filter(b => b.consecutiveGroupId === block.consecutiveGroupId && b._id !== block._id);
  };

  const handleLock = async (block) => {
    try {
      if (block.isLocked) await api.put(`/timetable/block/${block._id}/unlock`);
      else await api.put(`/timetable/block/${block._id}/lock`);
      toast.success(block.isLocked ? 'Unlocked' : 'Locked');
      loadBlocks();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  // Inline edit
  const openBlockEdit = (block) => {
    if (!editMode && !block) return;
    setEditBlock(block);
    setEditData({
      subject: block?.subject?._id || '',
      teacher: block?.teacher?._id || '',
      room: block?.room?._id || ''
    });
  };

  const saveBlockEdit = async () => {
    if (!editBlock) return;
    setEditSaving(true);
    try {
      if (editData.teacher && editData.teacher !== (editBlock.teacher?._id || '')) {
        await api.put(`/timetable/block/${editBlock._id}/reassign-teacher`, { newTeacherId: editData.teacher });
      }
      if (editData.room && editData.room !== (editBlock.room?._id || '')) {
        await api.put(`/timetable/block/${editBlock._id}/reassign-room`, { newRoomId: editData.room });
      }
      if (editData.subject && editData.subject !== (editBlock.subject?._id || '')) {
        await api.put(`/timetable/block/${editBlock._id}`, { subject: editData.subject });
      }
      toast.success('Block updated');
      setEditBlock(null);
      loadBlocks();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
    finally { setEditSaving(false); }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, block, day, period) => {
    if (!editMode || block?.isLocked) return;
    setDragSource({ block, day, period });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ blockId: block?._id, day, period }));
    // Add visual feedback
    if (e.target) e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setDragSource(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e, day, period) => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget({ day, period });
  };

  const handleDragLeave = () => { setDragOverTarget(null); };

  const handleDrop = async (e, targetDay, targetPeriod) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!editMode || !dragSource) return;

    const sourceBlock = dragSource.block;
    const targetBlock = getBlock(targetDay, targetPeriod);

    if (targetBlock?.isLocked) {
      toast.error('Target slot is locked');
      setDragSource(null);
      return;
    }

    if (sourceBlock?._id === targetBlock?._id) {
      setDragSource(null);
      return;
    }

    const swap = {
      sourceBlock: sourceBlock?._id,
      sourceDay: dragSource.day,
      sourcePeriod: dragSource.period,
      targetBlock: targetBlock?._id,
      targetDay,
      targetPeriod,
      sourceLabel: sourceBlock?.subject?.name || 'Empty',
      targetLabel: targetBlock?.subject?.name || 'Empty'
    };

    setPendingSwaps(prev => [...prev, swap]);
    toast(`Swap queued: ${swap.sourceLabel} ↔ ${swap.targetLabel}`, { icon: '🔄' });
    setDragSource(null);
  };

  const saveSwaps = async () => {
    if (pendingSwaps.length === 0) return;
    setSaving(true);
    try {
      for (const swap of pendingSwaps) {
        if (swap.sourceBlock && swap.targetBlock) {
          await api.post('/timetable/swap', {
            blockAId: swap.sourceBlock,
            blockBId: swap.targetBlock
          });
        } else if (swap.sourceBlock) {
          await api.put(`/timetable/block/${swap.sourceBlock}`, {
            day: swap.targetDay,
            period: swap.targetPeriod
          });
        }
      }
      toast.success(`Applied ${pendingSwaps.length} swap(s)`);
      setPendingSwaps([]);
      loadBlocks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Swap failed - conflict detected');
    } finally { setSaving(false); }
  };

  const cancelSwaps = () => { setPendingSwaps([]); toast('Swaps cancelled'); };

  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  const isDragTarget = (day, period) => dragOverTarget?.day === day && dragOverTarget?.period === period;

  // Count stats
  const totalBlocks = blocks.filter(b => b.type !== 'reserved').length;
  const lockedBlocks = blocks.filter(b => b.isLocked).length;
  const consecutiveGroups = [...new Set(blocks.filter(b => b.consecutiveGroupId).map(b => b.consecutiveGroupId))].length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Timetable Editor</h1>
          <p className="page-subtitle">View, edit, drag-drop swap, and manage lesson blocks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {timetables.length > 0 && (
            <select value={selectedTT} onChange={e => setSelectedTT(e.target.value)} className="select-field w-44 text-xs">
              {timetables.map(t => <option key={t._id} value={t._id}>{t.name} ({t.status})</option>)}
            </select>
          )}
          <div className="flex bg-white dark:bg-dark-800 rounded-xl p-1 border border-slate-300 dark:border-dark-700">
            <button onClick={() => setViewMode('class')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'class' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 dark:text-dark-400'}`}>Class</button>
            <button onClick={() => setViewMode('teacher')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'teacher' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 dark:text-dark-400'}`}>Teacher</button>
          </div>
          {viewMode === 'class'
            ? <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="select-field w-36 text-xs">{classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
            : <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="select-field w-44 text-xs"><option value="">Select</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select>
          }
          <button onClick={loadBlocks} className="btn-secondary p-2" title="Refresh"><RefreshCw size={14} /></button>
          <button onClick={() => { setEditMode(!editMode); setPendingSwaps([]); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${editMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'btn-secondary'}`}>
            {editMode ? <X size={14} /> : <Edit3 size={14} />}
            {editMode ? 'Exit Edit' : 'Edit Mode'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {blocks.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-dark-400">
          <span className="flex items-center gap-1"><BookOpen size={12} /> {totalBlocks} periods</span>
          <span className="flex items-center gap-1"><Lock size={12} /> {lockedBlocks} locked</span>
          {consecutiveGroups > 0 && <span className="flex items-center gap-1 text-purple-500">⚡ {consecutiveGroups} consecutive groups</span>}
        </div>
      )}

      {/* Edit mode toolbar */}
      {editMode && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 animate-slide-up">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <Move size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Edit Mode Active</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400/70">
              <strong>Drag</strong> cells to swap positions · <strong>Click</strong> any cell to edit subject, teacher, or room
              {pendingSwaps.length > 0 && <span className="text-amber-700 dark:text-amber-300 font-semibold"> · {pendingSwaps.length} swap(s) pending</span>}
            </p>
          </div>
          {pendingSwaps.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <button onClick={cancelSwaps} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
              <button onClick={saveSwaps} disabled={saving} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                Apply Swaps
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending swaps list */}
      {pendingSwaps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingSwaps.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/30 text-xs">
              <span className="font-medium text-primary-700 dark:text-primary-300">{s.sourceLabel}</span>
              <ArrowLeftRight size={10} className="text-primary-400" />
              <span className="font-medium text-primary-700 dark:text-primary-300">{s.targetLabel}</span>
              <button onClick={() => setPendingSwaps(prev => prev.filter((_, idx) => idx !== i))}
                className="ml-1 text-primary-400 hover:text-red-500"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Timetable Grid */}
      {!selectedTT ? (
        <div className="glass-card p-12 text-center text-slate-500 dark:text-dark-400">
          No timetable generated yet. Go to Generator first.
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center"><Loader2 className="animate-spin mx-auto text-primary-500" size={24} /></div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2.5 text-left w-20 text-xs sticky left-0 bg-slate-100 dark:bg-dark-800 z-10">Period</th>
                  {DAYS.map(d => <th key={d} className="px-3 py-2.5 text-center text-xs">{d.slice(0,3)}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map(p => {
                  const brk = isBreak(p);
                  return (
                    <tr key={p} className={`border-t border-slate-200/60 dark:border-dark-700/40 ${brk ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}`}>
                      <td className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-dark-300 sticky left-0 bg-white dark:bg-dark-900 z-10">
                        {brk ? '☕ Break' : `P${p}`}
                      </td>
                      {DAYS.map(d => {
                        if (brk) return <td key={d} className="px-2 py-1.5 text-center text-[10px] text-amber-400/60">Break</td>;
                        const block = getBlock(d, p);
                        const isTarget = isDragTarget(d, p);
                        const isConsec = block && isConsecutiveGroup(block);
                        const peers = block ? getConsecutivePeers(block) : [];
                        const isSource = dragSource?.block?._id === block?._id;

                        if (!block) return (
                          <td key={d} className="px-2 py-1.5"
                            onDragOver={e => handleDragOver(e, d, p)}
                            onDragLeave={handleDragLeave}
                            onDrop={e => handleDrop(e, d, p)}>
                            <div className={`p-2 rounded-lg text-center min-h-[60px] flex items-center justify-center transition-all duration-200
                              ${isTarget ? 'border-2 border-dashed border-primary-400 bg-primary-50 dark:bg-primary-900/20 scale-[1.03] shadow-md' : 'border border-dashed border-slate-200/80 dark:border-dark-700/40 bg-slate-50/30 dark:bg-dark-800/20'}
                              ${editMode ? 'cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/10' : ''}`}
                              onClick={() => editMode && openBlockEdit(null)}>
                              {isTarget ? (
                                <span className="text-primary-500 font-medium text-xs animate-pulse">↓ Drop here</span>
                              ) : editMode ? (
                                <span className="text-slate-300 dark:text-dark-600 text-[10px]">+ Add</span>
                              ) : (
                                <span className="text-slate-300 dark:text-dark-600 text-[10px]">—</span>
                              )}
                            </div>
                          </td>
                        );

                        return (
                          <td key={d} className="px-2 py-1.5">
                            <div
                              draggable={editMode && !block.isLocked}
                              onDragStart={e => handleDragStart(e, block, d, p)}
                              onDragEnd={handleDragEnd}
                              onDragOver={e => handleDragOver(e, d, p)}
                              onDragLeave={handleDragLeave}
                              onDrop={e => handleDrop(e, d, p)}
                              onClick={() => openBlockEdit(block)}
                              className={`p-2 rounded-xl text-[10px] relative min-h-[60px] transition-all duration-200 group
                                ${editMode && !block.isLocked ? 'cursor-grab active:cursor-grabbing hover:shadow-lg hover:scale-[1.03] hover:-translate-y-0.5' : 'cursor-pointer hover:shadow-sm'}
                                ${block.isLocked ? 'opacity-80 ring-1 ring-amber-400/30' : ''}
                                ${isTarget ? 'ring-2 ring-primary-400 shadow-lg scale-[1.03]' : ''}
                                ${isSource ? 'opacity-40 scale-95' : ''}
                                ${isConsec ? 'border-l-4' : 'border-l-[3px]'}`}
                              style={{
                                backgroundColor: (block.subject?.color || '#6366f1') + '15',
                                borderLeftColor: block.subject?.color || '#6366f1'
                              }}>

                              {/* Drag handle - visible in edit mode */}
                              {editMode && !block.isLocked && (
                                <div className="absolute top-1 left-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                  <GripVertical size={10} className="text-slate-400 dark:text-dark-500" />
                                </div>
                              )}

                              <p className="font-semibold text-slate-800 dark:text-dark-50 truncate text-xs pl-3">{block.subject?.name || 'Free'}</p>
                              <p className="text-slate-500 dark:text-dark-400 truncate pl-3">{block.teacher?.shortName || block.teacher?.name || ''}</p>
                              <p className="text-slate-400 dark:text-dark-500 truncate pl-3">{block.room?.name || ''}</p>
                              {block.studentGroup && <span className="text-[8px] text-purple-500 dark:text-purple-400 pl-3">👥 {block.studentGroup}</span>}

                              {/* Indicators */}
                              <div className="absolute top-1 right-1 flex gap-0.5 items-center">
                                {block.isLocked && <span className="text-[8px]" title="Locked">🔒</span>}
                                {block.type === 'combined_class' && <span className="text-[8px]" title="Combined class">🔗</span>}
                                {isConsec && (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-purple-500/10 text-[7px] text-purple-500 font-medium" title={`Consecutive group (${peers.length + 1} periods)`}>
                                    ⚡{peers.length + 1}
                                  </span>
                                )}
                                {editMode && !block.isLocked && <PenSquare size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </div>

                              <button onClick={(e) => { e.stopPropagation(); handleLock(block); }}
                                className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 transition-opacity">
                                {block.isLocked ? <Unlock size={10} className="text-amber-400" /> : <Lock size={10} className="text-slate-400" />}
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
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 dark:text-dark-400 px-1">
        <span className="flex items-center gap-1">🔒 Locked</span>
        <span className="flex items-center gap-1">🔗 Combined</span>
        <span className="flex items-center gap-1">👥 Split Group</span>
        <span className="flex items-center gap-1 text-purple-500">⚡ Consecutive</span>
        {editMode && (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-800/30 rounded-lg px-2 py-0.5 bg-amber-50 dark:bg-amber-900/10">
            <GripVertical size={10} /> Drag to swap · Click to edit
          </span>
        )}
      </div>

      {/* Inline Edit Modal */}
      {editBlock && (
        <Modal isOpen={!!editBlock} onClose={() => setEditBlock(null)} title={`Edit Period: ${editBlock.day} P${editBlock.periods?.[0]}`}>
          <div className="space-y-4">
            {/* Current info card */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-dark-700 text-xs" style={{
              background: editBlock.subject?.color ? `${editBlock.subject.color}08` : undefined,
              borderLeftWidth: '4px',
              borderLeftColor: editBlock.subject?.color || '#6366f1'
            }}>
              <p className="text-sm font-semibold text-slate-800 dark:text-dark-100 mb-1">{editBlock.subject?.name || 'Unassigned'}</p>
              <div className="flex flex-wrap gap-3 text-slate-500 dark:text-dark-400">
                <span>👤 {editBlock.teacher?.name || 'No teacher'}</span>
                <span>🏠 {editBlock.room?.name || 'No room'}</span>
                <span>📅 {editBlock.day}, Period {editBlock.periods?.[0]}</span>
              </div>
            </div>

            {/* Edit fields */}
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1.5 block font-medium flex items-center gap-1.5">
                <BookOpen size={13} className="text-primary-500" /> Subject
              </label>
              <select value={editData.subject} onChange={e => setEditData({...editData, subject: e.target.value})} className="select-field text-sm">
                <option value="">— Keep current —</option>
                {subjects.filter(s => s.isActive !== false).map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1.5 block font-medium flex items-center gap-1.5">
                <Users size={13} className="text-emerald-500" /> Teacher
              </label>
              <select value={editData.teacher} onChange={e => setEditData({...editData, teacher: e.target.value})} className="select-field text-sm">
                <option value="">— Keep current —</option>
                {teachers.filter(t => t.status === 'active').map(t => (
                  <option key={t._id} value={t._id}>{t.name}{t.shortName ? ` (${t.shortName})` : ''} — {t.department || ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1.5 block font-medium flex items-center gap-1.5">
                <DoorOpen size={13} className="text-amber-500" /> Room
              </label>
              <select value={editData.room} onChange={e => setEditData({...editData, room: e.target.value})} className="select-field text-sm">
                <option value="">— Keep current —</option>
                {rooms.filter(r => r.isActive !== false).map(r => (
                  <option key={r._id} value={r._id}>{r.name} ({r.type}, cap: {r.capacity || '?'})</option>
                ))}
              </select>
            </div>

            {/* Warnings */}
            {editBlock.isLocked && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                <Lock size={14} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">This block is locked. Unlock it before saving changes.</p>
              </div>
            )}
            {editBlock.consecutiveGroupId && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30">
                <AlertTriangle size={14} className="text-purple-500 shrink-0" />
                <p className="text-xs text-purple-700 dark:text-purple-400">Part of a consecutive group — changes may affect linked periods.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditBlock(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={saveBlockEdit} disabled={editSaving || editBlock.isLocked} className="btn-primary text-sm flex items-center gap-2">
                {editSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
