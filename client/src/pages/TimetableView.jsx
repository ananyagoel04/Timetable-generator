import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext, closestCenter, DragOverlay, useSensor, useSensors,
  PointerSensor, KeyboardSensor, TouchSensor
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Lock, Unlock, ArrowLeftRight, Edit3, Save, X, AlertTriangle,
  GripVertical, Loader2, PenSquare, Users, BookOpen, DoorOpen,
  RefreshCw, Move, Download, Printer, Eye, EyeOff, Undo2, Redo2, History,
  Upload, RotateCcw, Camera, GitCompare, ChevronRight, Pencil, Check, Archive, Plus, Minus, ArrowRight,
  Trash2, KeyRound
} from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import PermissionGate from '../components/ui/PermissionGate';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

// ═══════════════════════════════════════════════════════════════════
// DRAGGABLE BLOCK CELL (dnd-kit)
// ═══════════════════════════════════════════════════════════════════
function DraggableBlock({ id, block, day, period, editMode, onEdit, onLock, isHighlighted, isMultiPeriod, spanSize }) {
  const isLocked = block?.isLocked;
  const isConsec = block?.consecutiveGroupId;
  const duration = block?.duration || block?.periods?.length || 1;
  const isAtomic = duration > 1 && (block?.periods?.length || 1) > 1;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: id,
    data: { block, day, period },
    disabled: !editMode || isLocked,
  });

  if (!block) return null;

  // Block type detection
  const isActivity = block.type === 'activity' || block.subject?.type === 'activity' || block.subject?.type === 'games' || block.subject?.type === 'library';
  const isClub = block.type === 'club' || block.subject?.type === 'club';
  const isCombined = block.type === 'combined_class';
  const isFlexBlock = isActivity || isClub;

  // Room capacity check — tight if < 10% surplus
  const roomCapacity = block.room?.capacity || 0;
  const studentCount = block.studentCount || block.classes?.reduce((s, c) => s + (c?.studentCount || 30), 0) || 30;
  const capacityTight = roomCapacity > 0 && studentCount > 0 && ((roomCapacity - studentCount) / roomCapacity) < 0.10;

  // Type badges
  const typeBadge = isAtomic ? (
    <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-purple-500/15 text-[7px] text-purple-400 font-bold" title={`${duration}-period block`}>
      ⚡ {duration}P
    </span>
  ) : isConsec ? (
    <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-purple-500/10 text-[7px] text-purple-500 font-medium" title="Consecutive">
      ⚡
    </span>
  ) : null;

  // Activity/Club badge
  const flexBadge = isActivity ? (
    <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-teal-500/15 text-[7px] text-teal-400 font-bold" title="Activity">
      🎯 Activity
    </span>
  ) : isClub ? (
    <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-pink-500/15 text-[7px] text-pink-400 font-bold" title="Club">
      🎪 Club
    </span>
  ) : null;

  // Combined class names
  const combinedNames = isCombined && block.classes?.length > 1
    ? block.classes.map(c => c?.name || c?.shortName || '').filter(Boolean).join(' + ')
    : null;

  return (
    <div
      ref={setDragRef}
      {...(editMode && !isLocked ? { ...attributes, ...listeners } : {})}
      onClick={() => onEdit(block)}
      className={`p-2 rounded-xl text-[10px] relative transition-all duration-200 group select-none
        ${editMode && !isLocked ? 'cursor-grab active:cursor-grabbing hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5' : 'cursor-pointer hover:shadow-sm'}
        ${isLocked ? 'opacity-80 ring-1 ring-amber-400/30' : ''}
        ${isDragging ? 'opacity-30 scale-95 ring-2 ring-primary-400' : ''}
        ${isHighlighted ? 'ring-2 ring-blue-400 shadow-lg' : ''}
        ${isAtomic || isConsec ? 'border-l-4' : 'border-l-[3px]'}
        ${isAtomic ? 'ring-1 ring-purple-400/20' : ''}
        ${isFlexBlock ? 'border-dashed' : ''}`}
      style={{
        backgroundColor: (block.subject?.color || '#6366f1') + (isAtomic ? '20' : isFlexBlock ? '12' : '15'),
        borderLeftColor: isActivity ? '#14b8a6' : isClub ? '#ec4899' : (block.subject?.color || '#6366f1'),
        ...(isMultiPeriod ? { height: '100%', minHeight: `${Math.max(48 * spanSize, 96)}px` } : { minHeight: '48px' })
      }}
    >
      {editMode && !isLocked && (
        <div className="absolute top-1 left-1 opacity-40 group-hover:opacity-100 transition-opacity">
          <GripVertical size={10} className="text-slate-400 dark:text-dark-500" />
        </div>
      )}

      <p className="font-semibold text-slate-800 dark:text-dark-50 truncate text-xs pl-3" title={block.subject?.name}>{block.subject?.code || block.subject?.name || 'Free'}</p>
      <p className="text-slate-500 dark:text-dark-400 truncate pl-3">{block.teacher?.shortName || block.teacher?.name || (isFlexBlock ? '—' : '')}</p>
      <p className="text-slate-400 dark:text-dark-500 truncate pl-3">{block.room?.name || ''}</p>
      {block.studentGroup && <span className="text-[8px] text-purple-500 dark:text-purple-400 pl-3">👥 {block.studentGroup}</span>}
      {isAtomic && <p className="text-[8px] text-purple-400 pl-3 mt-0.5">P{block.periods.join('-P')}</p>}
      {combinedNames && <p className="text-[8px] text-blue-400 pl-3 mt-0.5 truncate" title={combinedNames}>🔗 {combinedNames}</p>}

      <div className="absolute top-1 right-1 flex gap-0.5 items-center flex-wrap justify-end max-w-[60%]">
        {isLocked && <span className="text-[8px]" title="Locked">🔒</span>}
        {isCombined && !combinedNames && <span className="text-[8px]" title="Combined">🔗</span>}
        {flexBadge}
        {typeBadge}
        {capacityTight && <span className="inline-flex items-center px-1 py-px rounded bg-red-500/15 text-[7px] text-red-400 font-bold" title={`Room: ${roomCapacity} seats, Students: ${studentCount}`}>⚠ Full</span>}
        {editMode && !isLocked && <PenSquare size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>

      <button onClick={(e) => { e.stopPropagation(); onLock(block); }}
        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 transition-opacity">
        {isLocked ? <Unlock size={10} className="text-amber-400" /> : <Lock size={10} className="text-slate-400" />}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DROPPABLE CELL (dnd-kit)
// ═══════════════════════════════════════════════════════════════════
function DroppableCell({ id, day, period, editMode, onAddLesson, children, rowSpan = 1 }) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: { day, period },
  });

  return (
    <td
      className={`px-1 py-0.5 ${rowSpan > 1 ? 'align-top' : ''}`}
      ref={setNodeRef}
      rowSpan={rowSpan > 1 ? rowSpan : undefined}
      style={rowSpan > 1 ? { verticalAlign: 'top', height: `${rowSpan * 48}px` } : {}}
    >
      {children || (
        <div
          onClick={() => editMode && onAddLesson && onAddLesson(day, period)}
          className={`p-2 rounded-lg text-center flex items-center justify-center transition-all duration-200
          ${isOver
            ? 'border-2 border-dashed border-primary-400 bg-primary-50 dark:bg-primary-900/20 scale-[1.03] shadow-md'
            : 'border border-dashed border-slate-200/80 dark:border-dark-700/40 bg-slate-50/30 dark:bg-dark-800/20'}
          ${editMode ? 'cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/10' : ''}`}
          style={{ minHeight: rowSpan > 1 ? `${rowSpan * 48 - 8}px` : '48px' }}>
          {isOver ? (
            <span className="text-primary-500 font-medium text-xs animate-pulse">↓ Drop</span>
          ) : editMode ? (
            <span className="text-slate-300 dark:text-dark-600 text-[10px]">+ Add</span>
          ) : (
            <span className="text-slate-300 dark:text-dark-600 text-[10px]">—</span>
          )}
        </div>
      )}
    </td>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DRAG OVERLAY (floating preview while dragging)
// ═══════════════════════════════════════════════════════════════════
function DragOverlayBlock({ block }) {
  if (!block) return null;
  return (
    <div className="p-2.5 rounded-xl text-[10px] min-h-[56px] shadow-2xl border-l-4 opacity-90 pointer-events-none"
      style={{
        backgroundColor: (block.subject?.color || '#6366f1') + '25',
        borderLeftColor: block.subject?.color || '#6366f1',
        backdropFilter: 'blur(12px)',
        width: '140px',
      }}>
      <p className="font-bold text-slate-900 dark:text-dark-50 text-xs truncate" title={block.subject?.name}>{block.subject?.code || block.subject?.name || 'Free'}</p>
      <p className="text-slate-500 dark:text-dark-400 truncate">{block.teacher?.shortName || block.teacher?.name}</p>
      <p className="text-slate-400 dark:text-dark-500 truncate">{block.room?.name}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function TimetableView() {
  const { hasPermission, selectedSchool, selectedSession } = useAuth();
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
  const [periodInfo, setPeriodInfo] = useState({});

  // Editor state
  const [editMode, setEditMode] = useState(false);
  const [pendingSwaps, setPendingSwaps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeBlock, setActiveBlock] = useState(null); // Drag overlay
  const [highlightTeacher, setHighlightTeacher] = useState(null);
  const [showCompact, setShowCompact] = useState(false);

  // Inline edit modal
  const [editBlock, setEditBlock] = useState(null);
  const [editData, setEditData] = useState({ subject: '', teacher: '', room: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [moveConflicts, setMoveConflicts] = useState(null);

  // Undo/Redo state
  const [undoStatus, setUndoStatus] = useState({ undoCount: 0, redoCount: 0, lastUndoAction: null, lastRedoAction: null });

  // ═══════════════ PUBLISH / SNAPSHOT / COMPARE STATE ═══════════════
  const [ttMeta, setTtMeta] = useState(null); // { status, publishedAt, publishedBy, name }
  const [showSnapshotDrawer, setShowSnapshotDrawer] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareSnap, setCompareSnap] = useState(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [dragValidation, setDragValidation] = useState(null); // { valid, conflicts, warnings }

  // Add lesson to empty cell
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [addLessonSlot, setAddLessonSlot] = useState({ day: '', period: 1 });
  const [addLessonForm, setAddLessonForm] = useState({ subjectId: '', teacherId: '', roomId: '' });
  const [addLessonSaving, setAddLessonSaving] = useState(false);

  // Delete timetable
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchUndoStatus = useCallback(async () => {
    if (!selectedTT) return;
    try {
      const r = await api.get(`/timetable/${selectedTT}/undo-status`);
      setUndoStatus(r.data?.data || { undoCount: 0, redoCount: 0 });
    } catch { /* non-critical */ }
  }, [selectedTT]);

  const handleUndo = useCallback(async () => {
    if (!selectedTT || undoStatus.undoCount === 0) return;
    try {
      await api.post(`/timetable/${selectedTT}/undo`);
      toast.success('Undone');
      loadBlocks();
      fetchUndoStatus();
    } catch (err) { toast.error(err.response?.data?.data?.error || 'Undo failed'); }
  }, [selectedTT, undoStatus.undoCount]);

  const handleRedo = useCallback(async () => {
    if (!selectedTT || undoStatus.redoCount === 0) return;
    try {
      await api.post(`/timetable/${selectedTT}/redo`);
      toast.success('Redone');
      loadBlocks();
      fetchUndoStatus();
    } catch (err) { toast.error(err.response?.data?.data?.error || 'Redo failed'); }
  }, [selectedTT, undoStatus.redoCount]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e) => {
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Fetch undo status when timetable changes or blocks reload
  useEffect(() => { fetchUndoStatus(); }, [selectedTT, blocks.length]);

  // ═══════════════ PUBLISH / SNAPSHOT HANDLERS ═══════════════
  const fetchTtMeta = useCallback(async () => {
    if (!selectedTT) return;
    const tt = timetables.find(t => t._id === selectedTT);
    if (tt) setTtMeta(tt);
  }, [selectedTT, timetables]);

  useEffect(() => { fetchTtMeta(); }, [fetchTtMeta]);

  const fetchSnapshots = useCallback(async () => {
    if (!selectedTT) return;
    setSnapshotsLoading(true);
    try {
      const r = await api.get(`/timetable/${selectedTT}/snapshots`);
      setSnapshots(r.data?.data || r.data || []);
    } catch { setSnapshots([]); }
    setSnapshotsLoading(false);
  }, [selectedTT]);

  useEffect(() => { if (showSnapshotDrawer) fetchSnapshots(); }, [showSnapshotDrawer, selectedTT]);

  const handlePublish = async () => {
    setPublishLoading(true);
    try {
      await api.put(`/timetable/${selectedTT}/publish`);
      toast.success('Timetable published!');
      const r = await api.get('/timetable/list');
      setTimetables(r.data?.data || r.data || []);
    } catch (err) { toast.error(err.response?.data?.error || 'Publish failed'); }
    setPublishLoading(false); setConfirmPublish(false);
  };

  const handleUnpublish = async () => {
    setPublishLoading(true);
    try {
      await api.put(`/timetable/${selectedTT}/unpublish`);
      toast.success('Timetable reverted to draft');
      const r = await api.get('/timetable/list');
      setTimetables(r.data?.data || r.data || []);
    } catch (err) { toast.error(err.response?.data?.error || 'Unpublish failed'); }
    setPublishLoading(false); setConfirmUnpublish(false);
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    try {
      await api.put(`/timetable/${selectedTT}/rename`, { name: renameValue.trim() });
      toast.success('Timetable renamed');
      const r = await api.get('/timetable/list');
      setTimetables(r.data?.data || r.data || []);
      setRenaming(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Rename failed'); }
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const r = await api.post(`/timetable/${selectedTT}/snapshot`, { label: snapshotLabel || undefined });
      toast.success(`Snapshot v${r.data?.data?.version} created`);
      setSnapshotLabel('');
      fetchSnapshots();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create snapshot'); }
    setCreatingSnapshot(false);
  };

  const handleCompare = async (snapId) => {
    try {
      const r = await api.get(`/timetable/${selectedTT}/compare/${snapId}`);
      setCompareData(r.data?.data || r.data);
      setCompareSnap(snapshots.find(s => s._id === snapId));
      setShowCompareModal(true);
    } catch (err) { toast.error(err.response?.data?.error || 'Compare failed'); }
  };

  const handleRollback = async (snapId) => {
    setRollbackLoading(true);
    try {
      const r = await api.post(`/timetable/${selectedTT}/rollback/${snapId}`);
      toast.success(`Rolled back to v${r.data?.data?.version || ''} — ${r.data?.data?.blocksRestored || 0} blocks restored`);
      loadBlocks(); fetchSnapshots();
    } catch (err) { toast.error(err.response?.data?.error || 'Rollback failed'); }
    setRollbackLoading(false); setConfirmRollback(null);
  };

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => { const d = r.data?.data || r.data || []; setClasses(d); if (d.length) setSelectedClass(d[0]._id); }),
      api.get('/teachers').then(r => setTeachers(r.data?.data || r.data || [])),
      api.get('/subjects').then(r => setSubjects(r.data?.data || r.data || [])),
      api.get('/rooms').then(r => setRooms(r.data?.data || r.data || [])),
      api.get('/timetable/list').then(r => { const tts = r.data?.data || r.data || []; setTimetables(tts); if (tts.length) setSelectedTT(tts[0]._id); })
    ]);
  }, [selectedSchool, selectedSession]);

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
      // Capture periodInfo from API if available
      if (r.data?.periodInfo) setPeriodInfo(r.data.periodInfo);
      const mp = b.reduce((max, bl) => Math.max(max, ...(bl.periods || [])), 0);
      // If periodInfo is available, use the max slot number from it
      const piMax = r.data?.periodInfo ? Math.max(...Object.keys(r.data.periodInfo).map(Number), 0) : 0;
      setMaxPeriod(Math.max(mp, piMax, 8));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // Get all blocks at a day+period (may be multiple for split groups)
  // Show reserved blocks WITH a subject (assembly/prayer) — hide subjectless reserved blocks (pure breaks)
  const getBlock = useCallback((day, period) =>
    blocks.find(b => b.day === day && b.periods?.includes(period) && (b.type !== 'reserved' || b.subject)),
    [blocks]
  );

  const getBlocksAt = useCallback((day, period) =>
    blocks.filter(b => b.day === day && b.periods?.includes(period) && (b.type !== 'reserved' || b.subject)),
    [blocks]
  );

  const isBreak = useCallback((period) => {
    // Use periodInfo as source of truth if available
    const pi = periodInfo[period];
    if (pi) return pi.type === 'break' || pi.type === 'lunch' || pi.type === 'recess' || !pi.isSchedulable;
    // Fallback: check reserved blocks
    return !!blocks.find(b => b.type === 'reserved' && b.periods?.includes(period) && !b.subject);
  }, [blocks, periodInfo]);

  const getBreakName = useCallback((period) => {
    const pi = periodInfo[period];
    return pi?.name || 'Break';
  }, [periodInfo]);

  const getPeriodLabel = useCallback((period) => {
    const pi = periodInfo[period];
    return pi?.name || `P${period}`;
  }, [periodInfo]);

  // Build a set of periods that are "continuation" of a multi-period block
  // (i.e., not the first period of an atomic block) to skip rendering them
  const skipPeriods = useMemo(() => {
    const skips = {}; // { "day_period": blockId }
    for (const b of blocks) {
      if ((b.duration || 1) > 1 && b.periods?.length > 1) {
        const sorted = [...b.periods].sort((a, c) => a - c);
        // Skip all periods after the first one
        for (let i = 1; i < sorted.length; i++) {
          skips[`${b.day}_${sorted[i]}`] = b._id;
        }
      }
    }
    return skips;
  }, [blocks]);

  // Get the span (rowSpan) for a multi-period block at its first period
  const getBlockSpan = useCallback((day, period) => {
    const block = getBlock(day, period);
    if (!block) return 1;
    if ((block.duration || 1) > 1 && block.periods?.length > 1) {
      const sorted = [...block.periods].sort((a, c) => a - c);
      if (sorted[0] === period) return sorted.length;
    }
    return 1;
  }, [getBlock]);

  const periods = useMemo(() => Array.from({ length: maxPeriod }, (_, i) => i + 1), [maxPeriod]);

  // Break deduplication: collapse consecutive breaks with same name into one row
  const breakSpans = useMemo(() => {
    const spans = {}; // { periodNumber: spanSize } for first break in group
    const skipped = new Set(); // period numbers to skip rendering
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (skipped.has(p)) continue;
      if (!isBreak(p)) continue;
      const name = getBreakName(p);
      let span = 1;
      // Look ahead for consecutive breaks with the same name
      while (i + span < periods.length) {
        const next = periods[i + span];
        if (isBreak(next) && getBreakName(next) === name) {
          skipped.add(next);
          span++;
        } else break;
      }
      if (span > 1) spans[p] = span;
    }
    return { spans, skipped };
  }, [periods, isBreak, getBreakName]);

  // ═══ DND-KIT HANDLERS ═══
  const handleDragStart = useCallback((event) => {
    const { block } = event.active.data.current;
    setActiveBlock(block);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    setActiveBlock(null);
    const { active, over } = event;
    if (!over || !editMode) return;

    const sourceData = active.data.current;
    const targetData = over.data.current;

    if (!sourceData || !targetData) return;
    if (sourceData.day === targetData.day && sourceData.period === targetData.period) return;

    const sourceBlock = sourceData.block;
    const targetBlock = getBlock(targetData.day, targetData.period);

    if (targetBlock?.isLocked) {
      toast.error('Target slot is locked');
      return;
    }

    // Validate move before queuing
    if (sourceBlock?._id) {
      try {
        const res = await api.post(`/timetable/block/${sourceBlock._id}/validate-move`, {
          day: targetData.day, period: targetData.period
        });
        const validation = res.data?.data || res.data;
        if (validation?.conflicts?.length) {
          setMoveConflicts({
            source: sourceBlock,
            target: targetBlock,
            targetDay: targetData.day,
            targetPeriod: targetData.period,
            conflicts: validation.conflicts,
            warnings: validation.warnings || []
          });
          return;
        }
        if (validation?.warnings?.length) {
          toast(validation.warnings[0], { icon: '⚠️' });
        }
      } catch { /* proceed anyway */ }
    }

    const swap = {
      sourceBlock: sourceBlock?._id,
      sourceDay: sourceData.day,
      sourcePeriod: sourceData.period,
      targetBlock: targetBlock?._id,
      targetDay: targetData.day,
      targetPeriod: targetData.period,
      sourceLabel: sourceBlock?.subject?.name || 'Empty',
      targetLabel: targetBlock?.subject?.name || 'Empty'
    };

    setPendingSwaps(prev => [...prev, swap]);
    toast(`Swap queued: ${swap.sourceLabel} ↔ ${swap.targetLabel}`, { icon: '🔄' });
  }, [editMode, getBlock]);

  const handleDragCancel = useCallback(() => {
    setActiveBlock(null);
  }, []);

  const handleLock = async (block) => {
    try {
      if (block.isLocked) await api.put(`/timetable/block/${block._id}/unlock`);
      else await api.put(`/timetable/block/${block._id}/lock`);
      toast.success(block.isLocked ? 'Unlocked' : 'Locked');
      loadBlocks();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const openBlockEdit = (block) => {
    if (!block) return;
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

  const saveSwaps = async () => {
    if (pendingSwaps.length === 0) return;
    setSaving(true);
    let successCount = 0;
    try {
      for (const swap of pendingSwaps) {
        if (swap.sourceBlock && swap.targetBlock) {
          await api.post('/timetable/swap', { blockAId: swap.sourceBlock, blockBId: swap.targetBlock });
        } else if (swap.sourceBlock) {
          await api.put(`/timetable/block/${swap.sourceBlock}/move`, {
            day: swap.targetDay, period: swap.targetPeriod
          });
        }
        successCount++;
      }
      toast.success(`Applied ${successCount} swap(s)`);
      setPendingSwaps([]);
      loadBlocks();
    } catch (err) {
      toast.error(`${successCount} applied, then: ${err.response?.data?.error || 'Conflict detected'}`);
      loadBlocks();
    } finally { setSaving(false); }
  };

  const cancelSwaps = () => { setPendingSwaps([]); toast('Swaps cancelled'); };

  // ═══ ADD LESSON TO EMPTY CELL ═══
  const openAddLessonModal = (day, period) => {
    setAddLessonSlot({ day, period });
    setAddLessonForm({ subjectId: '', teacherId: '', roomId: '' });
    setShowAddLessonModal(true);
  };

  const addNewLesson = async () => {
    if (!selectedTT || !addLessonForm.subjectId) return;
    setAddLessonSaving(true);
    try {
      const classId = viewMode === 'class' ? selectedClass : undefined;
      const payload = {
        classId,
        subjectId: addLessonForm.subjectId,
        teacherId: addLessonForm.teacherId,
        roomId: addLessonForm.roomId,
        day: addLessonSlot.day,
        period: addLessonSlot.period,
        duration: 1,
        type: 'normal'
      };
      // Use manual lesson API if timetable supports it, otherwise use block update
      await api.post(`/timetable/manual/${selectedTT}/lesson`, payload);
      toast.success('Lesson added!');
      setShowAddLessonModal(false);
      loadBlocks();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to add lesson');
    } finally { setAddLessonSaving(false); }
  };

  // ═══ DELETE TIMETABLE ═══
  const handleDeleteTimetable = async () => {
    if (!selectedTT || !deletePassword) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const tt = timetables.find(t => t._id === selectedTT);
      const payload = { password: deletePassword };
      if (tt?.status === 'published') payload.confirmPublishedDelete = true;

      await api.delete(`/timetable/${selectedTT}`, { data: payload });
      toast.success('Timetable deleted successfully');
      setShowDeleteConfirm(false);
      setDeletePassword('');

      // Remove from list and select next
      const remaining = timetables.filter(t => t._id !== selectedTT);
      setTimetables(remaining);
      setSelectedTT(remaining.length > 0 ? remaining[0]._id : '');
      setBlocks([]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Delete failed';
      setDeleteError(msg);
      toast.error(msg);
    } finally { setDeleteLoading(false); }
  };

  // Count stats
  const totalBlocks = blocks.filter(b => b.type !== 'reserved').length;
  const lockedBlocks = blocks.filter(b => b.isLocked).length;
  const consecutiveGroups = [...new Set(blocks.filter(b => b.consecutiveGroupId).map(b => b.consecutiveGroupId))].length;
  const multiPeriodBlocks = blocks.filter(b => (b.duration || 1) > 1 && b.periods?.length > 1).length;
  const splitGroupBlocks = blocks.filter(b => b.type === 'split_group').length;

  // Visible working days
  const visibleDays = useMemo(() => {
    const daysWithBlocks = new Set(blocks.map(b => b.day));
    return DAYS.filter(d => daysWithBlocks.has(d) || d !== 'Saturday');
  }, [blocks]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {renaming ? (
              <div className="flex items-center gap-1.5">
                <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus className="input-field text-sm py-1 w-48" placeholder="Timetable name" />
                <button onClick={handleRename} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Check size={14} /></button>
                <button onClick={() => setRenaming(false)} className="p-1.5 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30"><X size={14} /></button>
              </div>
            ) : (
              <>
                <h1 className="page-title">{ttMeta?.name || 'Timetable Editor'}</h1>
                <PermissionGate permissions={['edit_timetable']}>
                  <button onClick={() => { setRenaming(true); setRenameValue(ttMeta?.name || ''); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-400 dark:text-dark-500" title="Rename"><Pencil size={12} /></button>
                </PermissionGate>
              </>
            )}
          </div>
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
          <button onClick={() => window.print()} className="btn-secondary p-2" title="Print"><Printer size={14} /></button>
          <button onClick={async () => {
            try {
              toast.loading('Generating PDF...', { id: 'tt-pdf' });
              const params = viewMode === 'class' && selectedClass
                ? `?timetableId=${selectedTT}&classId=${selectedClass}`
                : viewMode === 'teacher' && selectedTeacher
                ? `?timetableId=${selectedTT}&teacherId=${selectedTeacher}`
                : `?timetableId=${selectedTT}`;
              const endpoint = viewMode === 'teacher' ? '/export/timetable/teacher-pdf' : '/export/timetable/pdf';
              const res = await api.get(`${endpoint}${params}`, { responseType: 'blob' });
              const blob = new Blob([res.data || res], { type: 'application/pdf' });
              const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
              link.download = `timetable_${viewMode}_${Date.now()}.pdf`; link.click();
              URL.revokeObjectURL(link.href);
              toast.success('PDF downloaded!', { id: 'tt-pdf' });
            } catch (err) { toast.error('PDF export failed', { id: 'tt-pdf' }); }
          }} className="btn-secondary p-2" title="Export PDF"><Download size={14} /></button>
          <button onClick={() => setShowCompact(!showCompact)} className="btn-secondary p-2" title={showCompact ? 'Expand' : 'Compact'}>
            {showCompact ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button onClick={() => setShowSnapshotDrawer(!showSnapshotDrawer)} className={`btn-secondary p-2 ${showSnapshotDrawer ? 'ring-2 ring-primary-500/40' : ''}`} title="Version History"><History size={14} /></button>
          <PermissionGate permissions={['edit_timetable']}>
            <button onClick={() => { setEditMode(!editMode); setPendingSwaps([]); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${editMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'btn-secondary'}`}>
              {editMode ? <X size={14} /> : <Edit3 size={14} />}
              {editMode ? 'Exit Edit' : 'Edit Mode'}
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ═══════════════ PUBLISH / STATUS BAR ═══════════════ */}
      {selectedTT && ttMeta && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-dark-800/60 border border-slate-200/50 dark:border-dark-700/50 flex-wrap">
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
            ttMeta.status === 'published' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            ttMeta.status === 'archived' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' :
            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>{ttMeta.status || 'draft'}</span>
          {ttMeta.publishedAt && <span className="text-[10px] text-slate-400 dark:text-dark-500">Published {new Date(ttMeta.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} by {ttMeta.publishedBy || 'admin'}</span>}
          <div className="flex-1" />
          <PermissionGate permissions={['edit_timetable']}>
            <button onClick={handleCreateSnapshot} disabled={creatingSnapshot} className="btn-secondary text-[10px] px-2.5 py-1.5 flex items-center gap-1">
              <Camera size={11} />{creatingSnapshot ? 'Saving...' : 'Snapshot'}
            </button>
          </PermissionGate>
          <PermissionGate permissions={['publish_timetable']}>
            {ttMeta.status === 'published' ? (
              <button onClick={() => setConfirmUnpublish(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 transition-colors flex items-center gap-1">
                <Archive size={11} />Unpublish
              </button>
            ) : (
              <button onClick={() => setConfirmPublish(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center gap-1">
                <Upload size={11} />Publish
              </button>
            )}
          </PermissionGate>
          <PermissionGate permissions={['edit_timetable']}>
            <button onClick={() => { setShowDeleteConfirm(true); setDeletePassword(''); setDeleteError(''); }}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1 border border-red-500/20">
              <Trash2 size={11} />Delete
            </button>
          </PermissionGate>
        </div>
      )}

      {/* Stats Bar */}
      {blocks.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-dark-400 flex-wrap">
          <span className="flex items-center gap-1"><BookOpen size={12} /> {totalBlocks} periods</span>
          <span className="flex items-center gap-1"><Lock size={12} /> {lockedBlocks} locked</span>
          {multiPeriodBlocks > 0 && <span className="flex items-center gap-1 text-purple-500">⚡ {multiPeriodBlocks} multi-period</span>}
          {consecutiveGroups > 0 && <span className="flex items-center gap-1 text-purple-400">🔗 {consecutiveGroups} linked</span>}
          {splitGroupBlocks > 0 && <span className="flex items-center gap-1 text-teal-500">👥 {splitGroupBlocks} split-group</span>}
          {highlightTeacher && (
            <button onClick={() => setHighlightTeacher(null)} className="flex items-center gap-1 text-blue-500 hover:text-blue-400">
              <X size={12} /> Clear highlight
            </button>
          )}
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
              <strong>Drag</strong> cells to swap positions · <strong>Click</strong> any cell to edit · <strong>Ctrl+Z</strong> to undo
              {pendingSwaps.length > 0 && <span className="text-amber-700 dark:text-amber-300 font-semibold"> · {pendingSwaps.length} swap(s) pending</span>}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {/* Undo/Redo buttons */}
            <button onClick={handleUndo} disabled={undoStatus.undoCount === 0}
              className={`p-2 rounded-lg text-xs font-medium transition-all border ${undoStatus.undoCount > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30' : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-300 dark:text-dark-600 cursor-not-allowed'}`}
              title={`Undo${undoStatus.lastUndoAction ? ` (${undoStatus.lastUndoAction})` : ''} — Ctrl+Z`}>
              <Undo2 size={14} />
            </button>
            <button onClick={handleRedo} disabled={undoStatus.redoCount === 0}
              className={`p-2 rounded-lg text-xs font-medium transition-all border ${undoStatus.redoCount > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30' : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-300 dark:text-dark-600 cursor-not-allowed'}`}
              title={`Redo${undoStatus.lastRedoAction ? ` (${undoStatus.lastRedoAction})` : ''} — Ctrl+Shift+Z`}>
              <Redo2 size={14} />
            </button>
            {undoStatus.undoCount > 0 && (
              <span className="flex items-center text-[10px] text-blue-500 dark:text-blue-400">{undoStatus.undoCount} undo{undoStatus.undoCount > 1 ? 's' : ''}</span>
            )}
          </div>
          {pendingSwaps.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <button onClick={cancelSwaps} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
              <button onClick={saveSwaps} disabled={saving} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending swaps */}
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

      {/* ═══════════════ TIMETABLE GRID WITH DND-KIT ═══════════════ */}
      {!selectedTT ? (
        <div className="glass-card p-12 text-center text-slate-500 dark:text-dark-400">
          No timetable generated yet. Go to Generator first.
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="animate-spin mx-auto text-primary-500" size={24} />
          <p className="text-sm text-slate-400 mt-2">Loading timetable...</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="table-header">
                    <th className="px-2 py-2.5 text-left w-16 text-xs sticky left-0 bg-slate-100 dark:bg-dark-800 z-10">Period</th>
                    {visibleDays.map(d => (
                      <th key={d} className="px-2 py-2.5 text-center text-xs">{DAY_SHORT[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                {periods.map(p => {
                    const brk = isBreak(p);
                    // Skip deduplicated break rows
                    if (brk && breakSpans.skipped.has(p)) return null;
                    const breakRowSpan = brk && breakSpans.spans[p] ? breakSpans.spans[p] : 1;
                    return (
                      <tr key={p} className={`border-t border-slate-200/60 dark:border-dark-700/40 ${brk ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}`}>
                        <td className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-dark-300 sticky left-0 bg-white dark:bg-dark-900 z-10 whitespace-nowrap"
                          {...(brk && breakRowSpan > 1 ? {} : {})}>
                          {brk ? `☕ ${getBreakName(p)}` : getPeriodLabel(p)}
                        </td>
                        {visibleDays.map(d => {
                          if (brk) return <td key={d} className="px-1.5 py-1 text-center text-[10px] text-amber-400/60">{getBreakName(p)}</td>;

                          // Skip if this period is a continuation of a multi-period block
                          if (skipPeriods[`${d}_${p}`]) return null;

                          const allBlocksHere = getBlocksAt(d, p);
                          const block = allBlocksHere[0];
                          const isSplitGroup = allBlocksHere.length > 1 && allBlocksHere.every(b => b.type === 'split_group');
                          const span = getBlockSpan(d, p);
                          const cellId = `${d}-${p}`;
                          const isHighlighted = highlightTeacher && block?.teacher?._id === highlightTeacher;

                          return (
                            <DroppableCell key={d} id={cellId} day={d} period={p} editMode={editMode} onAddLesson={openAddLessonModal} rowSpan={span}>
                              {isSplitGroup ? (
                                /* Split group: stacked mini-cards */
                                <div className="space-y-1">
                                  {allBlocksHere.map((sg, idx) => (
                                    <div key={sg._id || idx}
                                      onClick={() => openBlockEdit(sg)}
                                      className="p-1.5 rounded-lg text-[9px] cursor-pointer hover:shadow-sm transition-all border-l-[3px]"
                                      style={{
                                        backgroundColor: (sg.subject?.color || '#6366f1') + '12',
                                        borderLeftColor: sg.subject?.color || '#6366f1'
                                      }}>
                                      <p className="font-semibold text-slate-800 dark:text-dark-50 truncate">{sg.subject?.name}</p>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 dark:text-dark-500 truncate">{sg.teacher?.shortName || sg.teacher?.name}</span>
                                        <span className="text-purple-400 text-[8px]">👥 {sg.studentGroup}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : block ? (
                                <DraggableBlock
                                  id={`block-${block._id}-${d}-${p}`}
                                  block={block}
                                  day={d}
                                  period={p}
                                  editMode={editMode}
                                  onEdit={openBlockEdit}
                                  onLock={handleLock}
                                  isHighlighted={isHighlighted}
                                  isMultiPeriod={span > 1}
                                  spanSize={span}
                                />
                              ) : null}
                            </DroppableCell>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drag overlay — floating block preview */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeBlock && <DragOverlayBlock block={activeBlock} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 dark:text-dark-400 px-1">
        <span className="flex items-center gap-1">🔒 Locked</span>
        <span className="flex items-center gap-1">🔗 Combined</span>
        <span className="flex items-center gap-1">👥 Split Group (stacked)</span>
        <span className="flex items-center gap-1 text-purple-500">⚡ Multi-period (merged)</span>
        {editMode && (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-800/30 rounded-lg px-2 py-0.5 bg-amber-50 dark:bg-amber-900/10">
            <GripVertical size={10} /> Drag to swap · Click to edit
          </span>
        )}
      </div>

      {/* ═══════════════ CONFLICT PREVIEW MODAL ═══════════════ */}
      {moveConflicts && (
        <Modal isOpen={!!moveConflicts} onClose={() => setMoveConflicts(null)} title="Move Conflict Detected" size="sm">
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">Cannot move "{moveConflicts.source?.subject?.name}"</p>
                  <ul className="mt-1 space-y-0.5">
                    {moveConflicts.conflicts.map((c, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400">• {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {moveConflicts.warnings?.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Warnings:</p>
                {moveConflicts.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {w}</p>
                ))}
              </div>
            )}
            <button onClick={() => setMoveConflicts(null)} className="btn-secondary w-full text-sm">Dismiss</button>
          </div>
        </Modal>
      )}

      {/* ═══════════════ INLINE EDIT MODAL ═══════════════ */}
      {editBlock && (
        <Modal isOpen={!!editBlock} onClose={() => setEditBlock(null)} title={`Edit Period: ${editBlock.day} P${editBlock.periods?.[0]}`}>
          <div className="space-y-4">
            {/* Current info card */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-dark-700 text-xs" style={{
              background: editBlock.subject?.color ? `${editBlock.subject.color}08` : undefined,
              borderLeftWidth: '4px', borderLeftColor: editBlock.subject?.color || '#6366f1'
            }}>
              <p className="text-sm font-semibold text-slate-800 dark:text-dark-100 mb-1">{editBlock.subject?.name || 'Unassigned'}</p>
              <div className="flex flex-wrap gap-3 text-slate-500 dark:text-dark-400">
                <span>👤 {editBlock.teacher?.name || 'No teacher'}</span>
                <span>🏠 {editBlock.room?.name || 'No room'}</span>
                <span>📅 {editBlock.day}, P{editBlock.periods?.[0]}</span>
              </div>
            </div>

            {/* Edit fields */}
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1.5 block font-medium flex items-center gap-1.5">
                <BookOpen size={13} className="text-primary-500" /> Subject
              </label>
              <select value={editData.subject} onChange={e => setEditData({ ...editData, subject: e.target.value })} className="select-field text-sm">
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
              <select value={editData.teacher} onChange={e => setEditData({ ...editData, teacher: e.target.value })} className="select-field text-sm">
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
              <select value={editData.room} onChange={e => setEditData({ ...editData, room: e.target.value })} className="select-field text-sm">
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

            {/* Edit history link */}
            <button
              onClick={async () => {
                try {
                  const res = await api.get(`/timetable/block/${editBlock._id}/edit-history`);
                  const history = res.data?.data || [];
                  if (history.length === 0) toast('No edit history', { icon: '📋' });
                  else toast(`${history.length} edits recorded`, { icon: '📋' });
                } catch { /* silent */ }
              }}
              className="text-xs text-slate-400 hover:text-primary-500 flex items-center gap-1 transition-colors"
            >
              <History size={12} /> View edit history
            </button>

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

      {/* ═══════════════ SNAPSHOT HISTORY DRAWER ═══════════════ */}
      {showSnapshotDrawer && (
        <div className="fixed inset-y-0 right-0 w-80 max-w-full bg-white dark:bg-dark-900 border-l border-slate-200 dark:border-dark-700 shadow-2xl z-50 flex flex-col animate-slide-up" style={{animationDuration:'200ms'}}>
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-dark-700">
            <h3 className="font-semibold text-slate-900 dark:text-dark-50 text-sm flex items-center gap-2"><History size={16} className="text-primary-500" />Version History</h3>
            <button onClick={() => setShowSnapshotDrawer(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-400"><X size={16} /></button>
          </div>
          {/* Create snapshot */}
          <PermissionGate permissions={['edit_timetable']}>
            <div className="p-3 border-b border-slate-200 dark:border-dark-700 flex gap-2">
              <input value={snapshotLabel} onChange={e => setSnapshotLabel(e.target.value)} placeholder="Snapshot label (optional)" className="input-field text-xs flex-1" />
              <button onClick={handleCreateSnapshot} disabled={creatingSnapshot} className="btn-primary text-xs px-3 py-1.5 shrink-0">{creatingSnapshot ? '...' : <Camera size={13} />}</button>
            </div>
          </PermissionGate>
          {/* Snapshot list */}
          <div className="flex-1 overflow-y-auto">
            {snapshotsLoading ? (
              <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" size={20} /></div>
            ) : snapshots.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-dark-500 text-xs">No snapshots yet. Create one to track versions.</div>
            ) : snapshots.map(s => (
              <div key={s._id} className="p-3 border-b border-slate-100 dark:border-dark-800 hover:bg-slate-50 dark:hover:bg-dark-800/50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-900 dark:text-dark-50">v{s.version}</span>
                  {s.isPublished && <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Published</span>}
                </div>
                <p className="text-[10px] text-slate-600 dark:text-dark-300 mb-1 truncate">{s.label || s.description || `Snapshot v${s.version}`}</p>
                <p className="text-[9px] text-slate-400 dark:text-dark-500 mb-2">{new Date(s.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })} · {s.createdBy || 'admin'}</p>
                {s.stats && <div className="flex gap-2 text-[9px] text-slate-400 dark:text-dark-500 mb-2"><span>{s.stats.totalBlocks || 0} blocks</span>{s.stats.qualityScore != null && <span>Score: {Math.round(s.stats.qualityScore)}%</span>}</div>}
                <div className="flex gap-1.5">
                  <button onClick={() => handleCompare(s._id)} className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1"><GitCompare size={10} />Compare</button>
                  <PermissionGate permissions={['edit_timetable']}>
                    <button onClick={() => setConfirmRollback(s)} className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1"><RotateCcw size={10} />Rollback</button>
                  </PermissionGate>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ COMPARE MODAL ═══════════════ */}
      {showCompareModal && compareData && (
        <Modal isOpen={showCompareModal} onClose={() => { setShowCompareModal(false); setCompareData(null); }} title={`Compare with v${compareSnap?.version || '?'}`} size="lg">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-2.5 text-center border border-emerald-200/30 dark:border-emerald-800/30">
                <Plus size={14} className="mx-auto text-emerald-400 mb-1" />
                <p className="text-lg font-bold text-emerald-400">{compareData.added?.length || 0}</p>
                <p className="text-[9px] text-slate-500 dark:text-dark-400">Added</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2.5 text-center border border-red-200/30 dark:border-red-800/30">
                <Minus size={14} className="mx-auto text-red-400 mb-1" />
                <p className="text-lg font-bold text-red-400">{compareData.removed?.length || 0}</p>
                <p className="text-[9px] text-slate-500 dark:text-dark-400">Removed</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-2.5 text-center border border-blue-200/30 dark:border-blue-800/30">
                <ArrowRight size={14} className="mx-auto text-blue-400 mb-1" />
                <p className="text-lg font-bold text-blue-400">{compareData.moved?.length || 0}</p>
                <p className="text-[9px] text-slate-500 dark:text-dark-400">Moved</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2.5 text-center border border-amber-200/30 dark:border-amber-800/30">
                <Edit3 size={14} className="mx-auto text-amber-400 mb-1" />
                <p className="text-lg font-bold text-amber-400">{compareData.changed?.length || 0}</p>
                <p className="text-[9px] text-slate-500 dark:text-dark-400">Changed</p>
              </div>
            </div>

            {/* Individual block diffs */}
            {compareData.added?.length > 0 && (
              <div>
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2 font-semibold">Added Blocks</p>
                <div className="space-y-1">{compareData.added.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <Plus size={10} className="text-emerald-400 shrink-0" />
                    <span className="text-slate-700 dark:text-dark-200">{b.day} P{b.period}</span>
                    <span className="text-slate-500 dark:text-dark-400">·</span>
                    <span className="text-slate-600 dark:text-dark-300">{b.subject || '?'}</span>
                    <span className="text-slate-400 dark:text-dark-500 text-[10px]">({b.teacher || '?'})</span>
                  </div>
                ))}</div>
              </div>
            )}
            {compareData.removed?.length > 0 && (
              <div>
                <p className="text-[10px] text-red-400 uppercase tracking-wider mb-2 font-semibold">Removed Blocks</p>
                <div className="space-y-1">{compareData.removed.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                    <Minus size={10} className="text-red-400 shrink-0" />
                    <span className="text-slate-700 dark:text-dark-200">{b.day} P{b.period}</span>
                    <span className="text-slate-500 dark:text-dark-400">·</span>
                    <span className="text-slate-600 dark:text-dark-300">{b.subject || '?'}</span>
                    <span className="text-slate-400 dark:text-dark-500 text-[10px]">({b.teacher || '?'})</span>
                  </div>
                ))}</div>
              </div>
            )}
            {compareData.moved?.length > 0 && (
              <div>
                <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-2 font-semibold">Moved Blocks</p>
                <div className="space-y-1">{compareData.moved.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <ArrowRight size={10} className="text-blue-400 shrink-0" />
                    <span className="text-slate-500 dark:text-dark-400 line-through">{b.from?.day} P{b.from?.period}</span>
                    <ChevronRight size={10} className="text-blue-400" />
                    <span className="text-slate-700 dark:text-dark-200">{b.to?.day || b.day} P{b.to?.period || b.period}</span>
                    <span className="text-slate-600 dark:text-dark-300">{b.subject || '?'}</span>
                  </div>
                ))}</div>
              </div>
            )}
            {compareData.changed?.length > 0 && (
              <div>
                <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2 font-semibold">Changed Blocks</p>
                <div className="space-y-1">{compareData.changed.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <Edit3 size={10} className="text-amber-400 shrink-0" />
                    <span className="text-slate-700 dark:text-dark-200">{b.day} P{b.period}</span>
                    <span className="text-slate-500 dark:text-dark-400">·</span>
                    <span className="text-slate-600 dark:text-dark-300">{b.subject || '?'}</span>
                    {b.oldTeacher && b.newTeacher && b.oldTeacher !== b.newTeacher && (
                      <span className="text-[10px]"><span className="text-red-400 line-through">{b.oldTeacher}</span> → <span className="text-emerald-400">{b.newTeacher}</span></span>
                    )}
                    {b.oldRoom && b.newRoom && b.oldRoom !== b.newRoom && (
                      <span className="text-[10px]"><span className="text-red-400 line-through">{b.oldRoom}</span> → <span className="text-emerald-400">{b.newRoom}</span></span>
                    )}
                  </div>
                ))}</div>
              </div>
            )}
            {(!compareData.added?.length && !compareData.removed?.length && !compareData.moved?.length && !compareData.changed?.length) && (
              <div className="text-center py-8 text-slate-400 dark:text-dark-500">No differences found — timetable matches this snapshot.</div>
            )}
          </div>
        </Modal>
      )}

      {/* ═══════════════ CONFIRM DIALOGS ═══════════════ */}
      <ConfirmDialog open={confirmPublish} onClose={() => setConfirmPublish(false)} onConfirm={handlePublish} loading={publishLoading}
        title="Publish Timetable?" message="This will make the timetable active for the entire school. All previously published timetables will be archived."
        confirmText="Publish" variant="default" />
      <ConfirmDialog open={confirmUnpublish} onClose={() => setConfirmUnpublish(false)} onConfirm={handleUnpublish} loading={publishLoading}
        title="Unpublish Timetable?" message="This will revert the timetable to draft status. It will no longer be active."
        confirmText="Unpublish" variant="warning" />
      <ConfirmDialog open={!!confirmRollback} onClose={() => setConfirmRollback(null)} onConfirm={() => confirmRollback && handleRollback(confirmRollback._id)} loading={rollbackLoading}
        title={`Rollback to v${confirmRollback?.version || '?'}?`}
        message={`This will restore the timetable to snapshot v${confirmRollback?.version}. A backup of the current state will be created automatically. This cannot be easily undone.`}
        confirmText="Rollback" variant="warning" />

      {/* ═══════════════ ADD LESSON MODAL ═══════════════ */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowAddLessonModal(false)}>
          <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-dark-50 flex items-center gap-2">
                <Plus size={16} className="text-emerald-500" /> Add Lesson
              </h3>
              <button onClick={() => setShowAddLessonModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500 dark:text-dark-400">
                {addLessonSlot.day} — Period {addLessonSlot.period}
              </p>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Subject *</label>
                <select value={addLessonForm.subjectId} onChange={e => setAddLessonForm(f => ({ ...f, subjectId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select subject...</option>
                  {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Teacher</label>
                <select value={addLessonForm.teacherId} onChange={e => setAddLessonForm(f => ({ ...f, teacherId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select teacher...</option>
                  {teachers.map(t => <option key={t._id} value={t._id}>{t.shortName || t.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Room</label>
                <select value={addLessonForm.roomId} onChange={e => setAddLessonForm(f => ({ ...f, roomId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select room...</option>
                  {rooms.map(r => <option key={r._id} value={r._id}>{r.name} ({r.roomNumber || r.type})</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-dark-700 flex gap-2">
              <button onClick={() => setShowAddLessonModal(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300">
                Cancel
              </button>
              <button onClick={addNewLesson} disabled={!addLessonForm.subjectId || addLessonSaving}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                {addLessonSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DELETE TIMETABLE DIALOG ═══════════════ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 dark:border-dark-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <Trash2 size={20} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-red-600 dark:text-red-400 text-lg">Delete Timetable</h3>
                  <p className="text-xs text-slate-500 dark:text-dark-400">This action cannot be undone.</p>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400 space-y-1">
                <p className="font-semibold">The following data will be permanently deleted:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>All lesson blocks ({blocks.length})</li>
                  <li>All snapshots and conflict logs</li>
                  <li>The timetable configuration</li>
                </ul>
                {ttMeta?.status === 'published' && (
                  <p className="mt-2 font-bold text-red-700 dark:text-red-300">⚠ This timetable is currently PUBLISHED.</p>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-dark-200 mb-1.5 flex items-center gap-1.5">
                  <KeyRound size={12} /> Enter your password to confirm
                </label>
                <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm focus:ring-2 focus:ring-red-500/30 focus:border-red-500" />
              </div>

              {deleteError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {deleteError}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-dark-700 flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteTimetable} disabled={!deletePassword || deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5">
                {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
