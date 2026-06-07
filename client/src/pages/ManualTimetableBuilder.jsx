import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext, closestCenter, DragOverlay, useSensor, useSensors,
  PointerSensor, TouchSensor
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  PenTool, Plus, Save, CheckCircle2, AlertTriangle, XCircle, ChevronDown,
  Loader2, Calendar, Clock, Users, BookOpen, DoorOpen, Lock, Unlock,
  ArrowLeft, Send, Trash2, Move, RefreshCw, Zap, Copy, FileText,
  GripVertical, Info, X, Edit3, Layers, Eye
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const BULK_DAYS_PRESETS = [
  { label: 'Mon–Fri', days: ['Monday','Tuesday','Wednesday','Thursday','Friday'] },
  { label: 'All', days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
  { label: 'MWF', days: ['Monday','Wednesday','Friday'] },
  { label: 'TTS', days: ['Tuesday','Thursday','Saturday'] },
];

// ═══════════════════════════════════════════════════════════════════
// DRAGGABLE LESSON CELL (dnd-kit)
// ═══════════════════════════════════════════════════════════════════
function ManualDraggableCell({ id, block, day, period, onDelete, onToggleLock, children }) {
  const isLocked = block?.isLocked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { block, day, period },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isLocked ? {} : { ...attributes, ...listeners })}
      className={`relative group p-1.5 rounded-lg border transition-all
        ${isDragging ? 'opacity-30 scale-95 ring-2 ring-primary-400' : 'hover:shadow-md'}
        ${isLocked ? 'opacity-80 ring-1 ring-amber-400/30' : 'cursor-grab active:cursor-grabbing'}`}
      style={{
        backgroundColor: `${block.subject?.color || '#6366F1'}15`,
        borderColor: `${block.subject?.color || '#6366F1'}40`
      }}
    >
      <div className="text-[10px] font-bold truncate" style={{ color: block.subject?.color || '#6366F1' }}>
        {block.subject?.code || block.subject?.name || 'N/A'}
      </div>
      <div className="text-[9px] text-slate-500 dark:text-dark-400 truncate">
        {block.teacher?.shortName || block.teacher?.name || '—'}
      </div>
      {block.room && <div className="text-[8px] text-slate-400 dark:text-dark-500 truncate">{block.room.roomNumber || block.room.name}</div>}

      {/* Hover actions */}
      <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
        <button onClick={(e) => { e.stopPropagation(); onToggleLock(block._id, block.isLocked); }}
          className="p-0.5 rounded bg-white dark:bg-dark-700 shadow-sm border border-slate-200 dark:border-dark-600">
          {block.isLocked ? <Lock size={9} className="text-amber-500" /> : <Unlock size={9} className="text-slate-400" />}
        </button>
        {!block.isLocked && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(block._id); }}
            className="p-0.5 rounded bg-white dark:bg-dark-700 shadow-sm border border-slate-200 dark:border-dark-600">
            <Trash2 size={9} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Drag handle indicator */}
      {!isLocked && (
        <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-60 transition-opacity">
          <GripVertical size={8} className="text-slate-400" />
        </div>
      )}

      {block.validationStatus === 'warning' && (
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white dark:border-dark-800" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DROPPABLE PERIOD CELL (dnd-kit)
// ═══════════════════════════════════════════════════════════════════
function ManualDroppableCell({ id, day, period, onAdd, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { day, period },
  });

  return (
    <td className="p-1 border-b border-slate-100 dark:border-dark-800" ref={setNodeRef}>
      {children || (
        <button onClick={() => onAdd(day, period)}
          className={`w-full py-3 px-1 rounded-lg border-2 border-dashed transition-all group
            ${isOver
              ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 scale-[1.03] shadow-md'
              : 'border-slate-200 dark:border-dark-700 text-slate-300 dark:text-dark-600 hover:border-primary-400 hover:text-primary-400 hover:bg-primary-500/5'}`}>
          {isOver ? (
            <span className="text-primary-500 font-medium text-xs animate-pulse mx-auto block">↓ Drop</span>
          ) : (
            <Plus size={14} className="mx-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      )}
    </td>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DRAG OVERLAY (floating preview)
// ═══════════════════════════════════════════════════════════════════
function ManualDragOverlay({ block }) {
  if (!block) return null;
  return (
    <div className="p-2 rounded-lg text-[10px] min-h-[40px] shadow-2xl border-l-4 opacity-90 pointer-events-none bg-white dark:bg-dark-800"
      style={{ borderLeftColor: block.subject?.color || '#6366f1', width: '120px' }}>
      <p className="font-bold text-slate-900 dark:text-dark-50 truncate">{block.subject?.code || block.subject?.name || 'N/A'}</p>
      <p className="text-slate-500 dark:text-dark-400 truncate">{block.teacher?.shortName || block.teacher?.name}</p>
    </div>
  );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ManualTimetableBuilder() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const { timetableId: urlTimetableId } = useParams(); // Edit mode if present

  // ── State ──
  const [step, setStep] = useState(urlTimetableId ? 'loading' : 'mode'); // 'mode' | 'loading' | 'building'
  const [timetable, setTimetable] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Reference data
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [periodStructure, setPeriodStructure] = useState(null);
  const [existingTimetables, setExistingTimetables] = useState([]);
  const [recentManual, setRecentManual] = useState([]);

  // Building state
  const [selectedClass, setSelectedClass] = useState('');
  const [viewMode, setViewMode] = useState('class'); // 'class' | 'teacher' | 'room'
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [addSlot, setAddSlot] = useState(null); // { day, period }
  const [validation, setValidation] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [teacherWorkload, setTeacherWorkload] = useState(null);
  const [draftStatus, setDraftStatus] = useState(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [fullValidation, setFullValidation] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Drag/drop state
  const [activeDragBlock, setActiveDragBlock] = useState(null);

  // Bulk assignment state
  const [showBulkDrawer, setShowBulkDrawer] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    classId: '', subjectId: '', teacherId: '', roomId: '',
    period: 1, duration: 1, type: 'normal',
    days: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
    overwriteExisting: false, skipConflicts: true
  });
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Template Gallery state
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const TEMPLATES = [
    {
      id: 'primary', name: 'Primary School', icon: '🎒', accent: 'from-green-500 to-emerald-600',
      desc: 'Grades 1-5 • 7 periods/day • Short breaks • Activity-heavy',
      periods: 7, days: 6, breakPattern: '3+Recess+4', focus: 'Activity & play-based'
    },
    {
      id: 'middle', name: 'Middle School', icon: '📚', accent: 'from-blue-500 to-indigo-600',
      desc: 'Grades 6-8 • 8 periods/day • Lab periods • Balanced academics',
      periods: 8, days: 6, breakPattern: '3+Short+2+Lunch+3', focus: 'Balanced academics'
    },
    {
      id: 'senior', name: 'Senior Secondary', icon: '🎓', accent: 'from-purple-500 to-pink-600',
      desc: 'Grades 9-12 • 8 periods/day • Stream-based • Double periods',
      periods: 8, days: 6, breakPattern: '3+Short+2+Lunch+3', focus: 'Stream specialization'
    },
    {
      id: 'cbse', name: 'CBSE Pattern', icon: '🏫', accent: 'from-orange-500 to-red-600',
      desc: 'CBSE standard • 8 periods • Saturday half-day • Assembly period',
      periods: 8, days: 6, breakPattern: 'Assembly+3+Short+2+Lunch+3', focus: 'CBSE compliance'
    },
    {
      id: 'icse', name: 'ICSE Pattern', icon: '📖', accent: 'from-teal-500 to-cyan-600',
      desc: 'ICSE standard • 9 periods • 5-day week • Extended lab',
      periods: 9, days: 5, breakPattern: '3+Short+3+Lunch+3', focus: 'Intensive academics'
    }
  ];

  // Add lesson form
  const [lessonForm, setLessonForm] = useState({
    classId: '', subjectId: '', teacherId: '', roomId: '',
    day: '', period: 1, duration: 1, type: 'normal', reason: ''
  });

  // dnd-kit sensors
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // ── Unsaved changes warning ──
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsaved) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  // ── Load reference data ──
  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => setClasses(r.data || [])).catch(() => {}),
      api.get('/subjects').then(r => setSubjects(r.data || [])).catch(() => {}),
      api.get('/teachers').then(r => setTeachers(r.data || [])).catch(() => {}),
      api.get('/rooms').then(r => setRooms(r.data || [])).catch(() => {}),
      api.get('/setup/period-structure').then(r => setPeriodStructure(r.data)).catch(() => {}),
      api.get('/timetable/list').then(r => setExistingTimetables(r.data || [])).catch(() => {}),
      api.get('/timetable/manual/list').then(r => setRecentManual(r.data || [])).catch(() => {})
    ]);
  }, []);

  // ── Edit mode: load existing timetable ──
  useEffect(() => {
    if (!urlTimetableId) return;
    const loadExisting = async () => {
      try {
        const res = await api.get(`/timetable/manual/${urlTimetableId}`);
        setTimetable(res.data?.timetable || { _id: urlTimetableId, name: 'Manual Timetable' });
        setBlocks(res.data?.blocks || []);
        setDraftStatus({
          completenessScore: res.data?.completenessScore,
          lastSaved: res.data?.timetable?.updatedAt
        });
        setStep('building');
      } catch (err) {
        toast.error('Failed to load timetable');
        setStep('mode');
      }
    };
    loadExisting();
  }, [urlTimetableId]);

  // ── Load suggestions when class changes ──
  const loadSuggestions = useCallback(async (classId, subjectId, teacherId, day, period) => {
    if (!timetable?._id) return;
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (subjectId) params.set('subjectId', subjectId);
      if (teacherId) params.set('teacherId', teacherId);
      if (day) params.set('day', day);
      if (period) params.set('period', period);

      const res = await api.get(`/timetable/manual/${timetable._id}/suggestions?${params}`);
      setSuggestions(res.data);
      if (res.data?.subjectProgress) setSubjectProgress(res.data.subjectProgress);
      if (res.data?.teacherWorkload) setTeacherWorkload(res.data.teacherWorkload);
    } catch { /* silent */ }
  }, [timetable]);

  // ── Load timetable blocks ──
  const loadBlocks = useCallback(async () => {
    if (!timetable?._id) return;
    try {
      const res = await api.get(`/timetable/manual/${timetable._id}`);
      setBlocks(res.data?.blocks || []);
      setDraftStatus({
        completenessScore: res.data?.completenessScore,
        lastSaved: res.data?.timetable?.updatedAt
      });
      if (selectedClass) {
        loadSuggestions(selectedClass);
      }
    } catch (err) { toast.error('Failed to load timetable'); }
  }, [timetable, selectedClass, loadSuggestions]);

  useEffect(() => { if (timetable) loadBlocks(); }, [timetable]);

  // ── Create timetable ──
  const createTimetable = async (mode, sourceTimetableId = null) => {
    setLoading(true);
    try {
      const body = { mode: mode === 'copy' ? 'copy' : 'blank', name: `Manual Timetable - ${new Date().toLocaleDateString()}` };
      if (sourceTimetableId) body.sourceTimetableId = sourceTimetableId;
      const res = await api.post('/timetable/manual/create', body);
      setTimetable(res.data);
      setStep('building');
      toast.success('Timetable created!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  // ── Validate lesson ──
  const validateLesson = async (lesson) => {
    if (!timetable?._id) return;
    try {
      const res = await api.post(`/timetable/manual/${timetable._id}/validate-lesson`, lesson);
      setValidation(res.data);
      return res.data;
    } catch { return null; }
  };

  // ── Add lesson ──
  const addLesson = async () => {
    if (!timetable?._id) return;
    setLoading(true);
    try {
      const res = await api.post(`/timetable/manual/${timetable._id}/lesson`, lessonForm);
      if (res.data?.success) {
        toast.success('Lesson added!');
        setShowAddDrawer(false);
        setValidation(null);
        setLessonForm({ classId: '', subjectId: '', teacherId: '', roomId: '', day: '', period: 1, duration: 1, type: 'normal', reason: '' });
        setHasUnsaved(true);
        loadBlocks();
      } else {
        toast.error('Validation failed — check conflicts');
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  // ── Delete lesson ──
  const deleteLesson = async (blockId) => {
    if (!timetable?._id) return;
    try {
      await api.delete(`/timetable/manual/${timetable._id}/lesson/${blockId}`);
      toast.success('Lesson removed');
      setHasUnsaved(true);
      loadBlocks();
    } catch (err) { toast.error(err.message); }
  };

  // ── Lock/Unlock ──
  const toggleLock = async (blockId, isLocked) => {
    if (!timetable?._id) return;
    try {
      const endpoint = isLocked ? 'unlock' : 'lock';
      await api.put(`/timetable/manual/${timetable._id}/lesson/${blockId}/${endpoint}`);
      loadBlocks();
    } catch (err) { toast.error(err.message); }
  };

  // ── Save Draft ──
  const saveDraft = async () => {
    if (!timetable?._id) return;
    setSavingDraft(true);
    try {
      const res = await api.put(`/timetable/manual/${timetable._id}/save-draft`);
      setDraftStatus({
        completenessScore: res.data?.completenessScore,
        lastSaved: res.data?.savedAt
      });
      toast.success('Draft saved!');
      setHasUnsaved(false);
    } catch (err) { toast.error(err.message); }
    finally { setSavingDraft(false); }
  };

  // ── Validate Full ──
  const runFullValidation = async () => {
    if (!timetable?._id) return;
    setShowValidationPanel(true);
    try {
      const res = await api.post(`/timetable/manual/${timetable._id}/validate-full`);
      setFullValidation(res.data);
      setDraftStatus(prev => ({ ...prev, completenessScore: res.data?.completenessScore }));
    } catch (err) { toast.error(err.message); }
  };

  // ── Publish ──
  const publishTimetable = async () => {
    if (!timetable?._id) return;
    setPublishing(true);
    try {
      await api.post(`/timetable/manual/${timetable._id}/publish`);
      toast.success('Timetable published!');
      navigate('/timetable');
    } catch (err) { toast.error(err.message); }
    finally { setPublishing(false); }
  };

  // ── Move lesson (drag/drop) ──
  const moveLesson = async (blockId, newDay, newPeriod) => {
    if (!timetable?._id) return;
    try {
      const res = await api.put(`/timetable/manual/${timetable._id}/lesson/${blockId}/move`, { newDay, newPeriod });
      if (res.data?.success) {
        toast.success('Lesson moved!');
        setHasUnsaved(true);
        loadBlocks();
      } else {
        toast.error(res.data?.validation?.messages?.[0]?.message || 'Move failed — conflict detected');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Move failed'); }
  };

  // ── DnD handlers ──
  const handleDragStart = useCallback((event) => {
    setActiveDragBlock(event.active.data.current?.block || null);
  }, []);

  const handleDragEnd = useCallback((event) => {
    setActiveDragBlock(null);
    const { active, over } = event;
    if (!over) return;
    const src = active.data.current;
    const tgt = over.data.current;
    if (!src || !tgt) return;
    if (src.day === tgt.day && src.period === tgt.period) return;
    if (src.block?._id) {
      moveLesson(src.block._id, tgt.day, tgt.period);
    }
  }, [timetable]);

  const handleDragCancel = useCallback(() => setActiveDragBlock(null), []);

  // ── Bulk assignment ──
  const runBulkPreview = () => {
    const preview = bulkForm.days.map(day => {
      const block = getBlockForCell(day, bulkForm.period);
      return {
        day,
        period: bulkForm.period,
        existing: block ? (block.subject?.name || 'Occupied') : null,
        action: block ? (bulkForm.overwriteExisting ? 'overwrite' : (bulkForm.skipConflicts ? 'skip' : 'conflict')) : 'create'
      };
    });
    setBulkPreview(preview);
    setBulkResult(null);
  };

  const submitBulkAssign = async () => {
    if (!timetable?._id) return;
    setBulkSubmitting(true);
    try {
      const res = await api.post(`/timetable/manual/${timetable._id}/bulk-assign`, bulkForm);
      setBulkResult(res.data?.data || res.data);
      toast.success(`Bulk assign: ${res.data?.data?.summary?.created || 0} created`);
      setHasUnsaved(true);
      loadBlocks();
    } catch (err) { toast.error(err.response?.data?.message || 'Bulk assign failed'); }
    finally { setBulkSubmitting(false); }
  };

  // ── Open add drawer with pre-filled slot ──
  const openAddDrawer = (day, period) => {
    setAddSlot({ day, period });
    setLessonForm(prev => ({ ...prev, day, period, classId: selectedClass }));
    setShowAddDrawer(true);
    setValidation(null);
    if (selectedClass) loadSuggestions(selectedClass, '', '', day, period);
  };

  // ── When form fields change, re-validate ──
  useEffect(() => {
    if (!showAddDrawer || !lessonForm.classId || !lessonForm.subjectId || !lessonForm.day) return;
    const timer = setTimeout(() => {
      validateLesson(lessonForm);
      loadSuggestions(lessonForm.classId, lessonForm.subjectId, lessonForm.teacherId, lessonForm.day, lessonForm.period);
    }, 300);
    return () => clearTimeout(timer);
  }, [lessonForm.classId, lessonForm.subjectId, lessonForm.teacherId, lessonForm.roomId, lessonForm.day, lessonForm.period]);

  // ── Get periods for day ──
  const getPeriodsForDay = (day) => {
    if (!periodStructure) return [];
    if (day === 'Saturday' && periodStructure.saturdayConfig?.enabled) {
      return periodStructure.saturdayConfig.timeslots || [];
    }
    return periodStructure.defaultDayTemplate || periodStructure.timeslots || [];
  };

  // ── Get blocks for a cell ──
  const getBlockForCell = (day, periodNum) => {
    const classId = selectedClass;
    return blocks.find(b =>
      b.day === day &&
      b.periods?.includes(periodNum) &&
      (viewMode === 'class' ? b.classes?.some(c => (c._id || c) === classId) : true)
    );
  };

  // ── Filtered blocks for current view ──
  const filteredBlocks = blocks.filter(b => {
    if (viewMode === 'class' && selectedClass) {
      return b.classes?.some(c => (c._id || c) === selectedClass);
    }
    return true;
  });

  // ═══ RENDER: Loading (edit mode) ═══
  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 animate-fade-in">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-dark-300 font-medium">Loading timetable…</p>
          <p className="text-sm text-slate-400 dark:text-dark-500 mt-1">Fetching blocks and reference data</p>
        </div>
      </div>
    );
  }

  // ═══ RENDER: Mode Selection ═══
  if (step === 'mode') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <PenTool size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-50">Create Timetable Manually</h1>
              <p className="text-sm text-slate-500 dark:text-dark-400">Build a timetable from scratch with smart validation</p>
            </div>
          </div>
        </div>

        {/* Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => createTimetable('blank')} disabled={loading}
            className="glass-card-hover p-6 text-left group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <Plus size={24} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-dark-50 text-lg mb-1">Blank Timetable</h3>
            <p className="text-sm text-slate-500 dark:text-dark-400">Start from an empty grid and place lessons one by one</p>
          </button>

          <button onClick={() => {
            const published = existingTimetables.find(t => t.status === 'published');
            if (published) createTimetable('copy', published._id);
            else toast.error('No published timetable to copy');
          }} disabled={loading}
            className="glass-card-hover p-6 text-left group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <Copy size={24} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-dark-50 text-lg mb-1">Copy Existing</h3>
            <p className="text-sm text-slate-500 dark:text-dark-400">Clone a published timetable and modify it</p>
          </button>

          <button onClick={() => createTimetable('blank')} disabled={loading}
            className="glass-card-hover p-6 text-left group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <Calendar size={24} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-dark-50 text-lg mb-1">Previous Session</h3>
            <p className="text-sm text-slate-500 dark:text-dark-400">Start from last session's timetable as a template</p>
          </button>

          <button onClick={() => setShowTemplateGallery(true)} disabled={loading}
            className="glass-card-hover p-6 text-left group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <FileText size={24} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-dark-50 text-lg mb-1">From Template</h3>
            <p className="text-sm text-slate-500 dark:text-dark-400">Choose from Primary, Middle, Senior, CBSE, or ICSE templates</p>
          </button>
        </div>

        {/* Template Gallery Modal */}
        {showTemplateGallery && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateGallery(false)}>
            <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-dark-50">Template Gallery</h2>
                  <p className="text-sm text-slate-500 dark:text-dark-400 mt-1">Pre-designed period structures for common school types</p>
                </div>
                <button onClick={() => setShowTemplateGallery(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TEMPLATES.map(tmpl => (
                  <button key={tmpl.id} onClick={() => { setShowTemplateGallery(false); createTimetable('blank'); }}
                    className="text-left p-5 rounded-xl border-2 border-slate-200 dark:border-dark-700 hover:border-primary-400 dark:hover:border-primary-500 transition-all hover:shadow-lg group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tmpl.accent} flex items-center justify-center text-lg shadow-md group-hover:scale-110 transition-transform`}>
                        {tmpl.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-dark-100">{tmpl.name}</h3>
                        <p className="text-[10px] text-slate-400 dark:text-dark-500">{tmpl.focus}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-dark-400 mb-3">{tmpl.desc}</p>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium">{tmpl.periods} periods/day</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-dark-400 font-medium">{tmpl.days} days/week</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary-500" />
            <span className="ml-2 text-slate-500">Creating timetable…</span>
          </div>
        )}

        {/* Recent Manual Timetables */}
        {recentManual.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock size={14} /> Recent Manual Timetables
            </h2>
            <div className="space-y-2">
              {recentManual.map(t => (
                <button key={t._id} onClick={() => navigate(`/manual-timetable/${t._id}/edit`)}
                  className="w-full glass-card-hover p-4 text-left flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-sm">
                      <Edit3 size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-dark-100 text-sm">{t.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-dark-500">
                        {t.creationMode === 'copied' ? 'Copied' : 'Manual'}
                        {' · '}{new Date(t.updatedAt).toLocaleDateString()}
                        {t.manualCompletenessScore != null && ` · ${t.manualCompletenessScore}% complete`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      t.status === 'published' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : t.status === 'draft' ? 'bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-dark-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>{t.status}</span>
                    <ArrowLeft size={14} className="text-slate-300 dark:text-dark-600 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => navigate('/timetable')} className="flex items-center gap-2 text-sm text-slate-500 dark:text-dark-400 hover:text-slate-700 dark:hover:text-dark-200 transition-colors">
          <ArrowLeft size={16} /> Back to Timetables
        </button>
      </div>
    );
  }

  // ═══ RENDER: Building Mode ═══
  const workingDays = periodStructure?.workingDays || DAYS;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Header Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/timetable')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-500 dark:text-dark-400 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-dark-50 flex items-center gap-2">
              <PenTool size={18} className="text-primary-500" />
              {timetable?.name || 'Manual Timetable'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-dark-400">
              {draftStatus?.completenessScore != null ? `${draftStatus.completenessScore}% complete` : 'Draft'}
              {draftStatus?.lastSaved && ` · Last saved ${new Date(draftStatus.lastSaved).toLocaleTimeString()}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={saveDraft} disabled={savingDraft}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-dark-800 border border-slate-300/50 dark:border-dark-700/50 text-slate-700 dark:text-dark-200 text-sm hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors">
            {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Draft
          </button>
          <button onClick={runFullValidation}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm hover:bg-amber-500/20 transition-colors">
            <CheckCircle2 size={14} /> Validate
          </button>
          <button onClick={publishTimetable} disabled={publishing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-purple-600 text-white text-sm shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all">
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Publish
          </button>
        </div>
      </div>

      {/* ── Controls Row ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Class Selector */}
        <div className="relative flex-1 max-w-xs">
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); if (e.target.value && timetable) loadSuggestions(e.target.value); }}
            className="w-full appearance-none px-3 py-2.5 pr-10 rounded-xl bg-white dark:bg-dark-800 border border-slate-300/50 dark:border-dark-700/50 text-sm text-slate-800 dark:text-dark-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all">
            <option value="">Select Class...</option>
            {classes.map(c => (
              <option key={c._id} value={c._id}>{c.grade}-{c.section}{c.stream && c.stream !== 'none' ? ` (${c.stream})` : ''}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-white dark:bg-dark-800 rounded-xl border border-slate-300/50 dark:border-dark-700/50 p-0.5">
          {[{ key: 'class', icon: BookOpen, label: 'Class' }, { key: 'teacher', icon: Users, label: 'Teacher' }, { key: 'room', icon: DoorOpen, label: 'Room' }].map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === v.key ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-dark-400 hover:text-slate-700 dark:hover:text-dark-200'}`}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>

        {/* Quick Add + Bulk Assign Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowAddDrawer(true); setLessonForm(prev => ({ ...prev, classId: selectedClass })); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all">
            <Plus size={16} /> Add Lesson
          </button>
          <button onClick={() => { setBulkForm(prev => ({ ...prev, classId: selectedClass })); setShowBulkDrawer(true); setBulkPreview(null); setBulkResult(null); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-all">
            <Layers size={14} /> Bulk Assign
          </button>
        </div>
      </div>

      {/* ── Main Content: Grid + Side Panel ── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Timetable Grid */}
        <div className="flex-1 overflow-x-auto">
          {!selectedClass ? (
            <div className="glass-card p-12 text-center">
              <BookOpen size={40} className="text-slate-300 dark:text-dark-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-600 dark:text-dark-300 mb-1">Select a Class</h3>
              <p className="text-sm text-slate-400 dark:text-dark-500">Choose a class from the dropdown above to view and edit the timetable grid</p>
            </div>
          ) : (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
            <div className="glass-card overflow-hidden">
              <table className="w-full text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-dark-800">
                    <th className="p-2 text-left font-semibold text-slate-500 dark:text-dark-400 border-b border-slate-200 dark:border-dark-700 w-16">Period</th>
                    {workingDays.map(day => (
                      <th key={day} className="p-2 text-center font-semibold text-slate-500 dark:text-dark-400 border-b border-slate-200 dark:border-dark-700">{day.slice(0, 3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getPeriodsForDay(workingDays[0]).map(slot => (
                    <tr key={slot.slotNumber} className={`${slot.type === 'break' || slot.type === 'lunch' ? 'bg-slate-100/50 dark:bg-dark-800/50' : ''}`}>
                      <td className="p-2 border-b border-slate-100 dark:border-dark-800">
                        <div className="text-[10px] font-bold text-slate-600 dark:text-dark-300">{slot.label}</div>
                        <div className="text-[9px] text-slate-400 dark:text-dark-500">{slot.startTime}–{slot.endTime}</div>
                      </td>
                      {workingDays.map(day => {
                        const daySlots = getPeriodsForDay(day);
                        const daySlot = daySlots.find(s => s.slotNumber === slot.slotNumber);
                        const isBreak = daySlot?.type === 'break' || daySlot?.type === 'lunch';

                        if (isBreak || !daySlot?.isSchedulable) {
                          return (
                            <td key={day} className="p-1 border-b border-slate-100 dark:border-dark-800 text-center">
                              <div className="py-2 px-1 rounded-lg bg-slate-200/50 dark:bg-dark-700/50 text-[9px] text-slate-400 dark:text-dark-500 font-medium">
                                {daySlot?.label || '—'}
                              </div>
                            </td>
                          );
                        }

                        const block = getBlockForCell(day, slot.slotNumber);
                        const cellId = `manual-${day}-${slot.slotNumber}`;

                        if (block) {
                          return (
                            <ManualDroppableCell key={day} id={cellId} day={day} period={slot.slotNumber} onAdd={openAddDrawer}>
                              <ManualDraggableCell
                                id={`drag-${block._id}-${day}-${slot.slotNumber}`}
                                block={block}
                                day={day}
                                period={slot.slotNumber}
                                onDelete={deleteLesson}
                                onToggleLock={toggleLock}
                              />
                            </ManualDroppableCell>
                          );
                        }

                        // Empty cell — droppable + clickable to add
                        return (
                          <ManualDroppableCell key={day} id={cellId} day={day} period={slot.slotNumber} onAdd={openAddDrawer} />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Drag overlay — floating preview */}
            <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
              {activeDragBlock && <ManualDragOverlay block={activeDragBlock} />}
            </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* ── Side Panel: Subject Progress + Teacher Workload ── */}
        <div className="w-full lg:w-72 space-y-4 shrink-0">
          {/* Completeness */}
          {draftStatus?.completenessScore != null && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap size={12} /> Completeness
              </h3>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${draftStatus.completenessScore >= 80 ? 'bg-emerald-500' : draftStatus.completenessScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${draftStatus.completenessScore}%` }} />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-dark-200">{draftStatus.completenessScore}%</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-dark-500">
                {filteredBlocks.length} lessons placed
              </p>
            </div>
          )}

          {/* Subject Load Progress */}
          {subjectProgress.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen size={12} /> Subject Load
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                {subjectProgress.map(sp => (
                  <div key={sp.subjectId} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sp.color || '#6366F1' }} />
                    <span className="text-[11px] text-slate-600 dark:text-dark-300 truncate flex-1">{sp.subjectCode || sp.subjectName}</span>
                    <span className={`text-[11px] font-mono font-bold ${sp.complete ? 'text-emerald-500' : sp.remaining <= 1 ? 'text-amber-500' : 'text-slate-500 dark:text-dark-400'}`}>
                      {sp.assigned}/{sp.required}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher Workload */}
          {teacherWorkload && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users size={12} /> Teacher Workload
              </h3>
              <p className="text-sm font-medium text-slate-700 dark:text-dark-200 mb-2">{teacherWorkload.name}</p>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${teacherWorkload.overloaded ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (teacherWorkload.weeklyTotal / teacherWorkload.maxPerWeek) * 100)}%` }} />
                </div>
                <span className="text-[10px] font-mono text-slate-500 dark:text-dark-400">{teacherWorkload.weeklyTotal}/{teacherWorkload.maxPerWeek}</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center">
                    <div className="text-[8px] text-slate-400 dark:text-dark-500">{d.slice(0, 2)}</div>
                    <div className={`text-[10px] font-bold ${(teacherWorkload.dailyLoads?.[d] || 0) > teacherWorkload.maxPerDay ? 'text-red-500' : 'text-slate-600 dark:text-dark-300'}`}>
                      {teacherWorkload.dailyLoads?.[d] || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Lesson Drawer ── */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:justify-end" onClick={() => setShowAddDrawer(false)}>
          <div className="w-full sm:w-[440px] max-h-[90vh] bg-white dark:bg-dark-900 sm:rounded-l-2xl rounded-t-2xl sm:rounded-tr-none overflow-y-auto shadow-2xl animate-slide-in-right"
            onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-dark-700 px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-dark-50 flex items-center gap-2">
                <Plus size={18} className="text-primary-500" /> Add Lesson
              </h2>
              <button onClick={() => setShowAddDrawer(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Class */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Class</label>
                <select value={lessonForm.classId} onChange={e => setLessonForm(f => ({ ...f, classId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select class...</option>
                  {classes.map(c => <option key={c._id} value={c._id}>{c.grade}-{c.section}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Subject</label>
                <select value={lessonForm.subjectId} onChange={e => setLessonForm(f => ({ ...f, subjectId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select subject...</option>
                  {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {/* Teacher */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">
                  Teacher
                  {suggestions?.teachers?.length > 0 && <span className="text-primary-400 ml-1">({suggestions.teachers.filter(t => t.available).length} available)</span>}
                </label>
                <select value={lessonForm.teacherId} onChange={e => setLessonForm(f => ({ ...f, teacherId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select teacher...</option>
                  {(suggestions?.teachers || teachers).map(t => {
                    const id = t.teacherId || t._id;
                    const name = t.name;
                    const avail = t.available !== undefined ? t.available : true;
                    return <option key={id} value={id} disabled={!avail}>{name} {!avail ? '(busy)' : ''}</option>;
                  })}
                </select>
              </div>

              {/* Room */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Room</label>
                <select value={lessonForm.roomId} onChange={e => setLessonForm(f => ({ ...f, roomId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select room...</option>
                  {(suggestions?.rooms || rooms).map(r => {
                    const id = r.roomId || r._id;
                    const avail = r.available !== undefined ? r.available : true;
                    return <option key={id} value={id} disabled={!avail}>{r.name} ({r.roomNumber || r.type}) {!avail ? '(in use)' : ''}</option>;
                  })}
                </select>
              </div>

              {/* Day + Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Day</label>
                  <select value={lessonForm.day} onChange={e => setLessonForm(f => ({ ...f, day: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    <option value="">Day...</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Period</label>
                  <select value={lessonForm.period} onChange={e => setLessonForm(f => ({ ...f, period: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    {(getPeriodsForDay(lessonForm.day || 'Monday')).filter(s => s.isSchedulable).map(s => (
                      <option key={s.slotNumber} value={s.slotNumber}>{s.label} ({s.startTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Duration</label>
                  <select value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    <option value={1}>1 Period</option>
                    <option value={2}>2 Periods (Double)</option>
                    <option value={3}>3 Periods (Lab)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Type</label>
                  <select value={lessonForm.type} onChange={e => setLessonForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    <option value="normal">Normal</option>
                    <option value="double_period">Double Period</option>
                    <option value="lab">Lab</option>
                    <option value="activity">Activity</option>
                    <option value="combined_class">Combined Class</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Notes (optional)</label>
                <input type="text" value={lessonForm.reason} onChange={e => setLessonForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Reason or notes..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm" />
              </div>

              {/* ── Validation Status ── */}
              {validation && (
                <div className={`p-3 rounded-xl border ${
                  validation.status === 'allowed' ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800' :
                  validation.status === 'warning' ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800' :
                  'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {validation.status === 'allowed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                    {validation.status === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
                    {validation.status === 'blocked' && <XCircle size={16} className="text-red-500" />}
                    <span className={`text-sm font-semibold capitalize ${
                      validation.status === 'allowed' ? 'text-emerald-700 dark:text-emerald-300' :
                      validation.status === 'warning' ? 'text-amber-700 dark:text-amber-300' :
                      'text-red-700 dark:text-red-300'
                    }`}>
                      {validation.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {validation.messages?.map((m, i) => (
                      <p key={i} className="text-xs text-slate-600 dark:text-dark-300 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">
                          {m.type === 'blocked' ? '🚫' : m.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        {m.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Button */}
              <button onClick={addLesson} disabled={loading || validation?.status === 'blocked'}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                  validation?.status === 'blocked'
                    ? 'bg-slate-200 dark:bg-dark-700 text-slate-400 dark:text-dark-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40'
                }`}>
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Add Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Validation Panel ── */}
      {showValidationPanel && fullValidation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowValidationPanel(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-dark-50 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-primary-500" /> Validation Results
              </h2>
              <button onClick={() => setShowValidationPanel(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-slate-50 dark:bg-dark-800 rounded-xl">
                  <p className="text-lg font-bold text-slate-700 dark:text-dark-200">{fullValidation.summary?.totalBlocks || 0}</p>
                  <p className="text-[10px] text-slate-400">Total Blocks</p>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/15 rounded-xl">
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fullValidation.summary?.warningCount || 0}</p>
                  <p className="text-[10px] text-amber-500">Warnings</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/15 rounded-xl">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{fullValidation.summary?.blockedCount || 0}</p>
                  <p className="text-[10px] text-red-500">Conflicts</p>
                </div>
              </div>

              {/* Issues */}
              {fullValidation.issues?.length > 0 ? (
                <div className="space-y-2">
                  {fullValidation.issues.map((issue, i) => (
                    <div key={i} className={`p-3 rounded-lg border text-xs ${issue.status === 'blocked' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'}`}>
                      <p className="font-medium text-slate-700 dark:text-dark-200">{issue.day} P{issue.periods?.join(',')}</p>
                      {issue.messages?.map((m, j) => (
                        <p key={j} className="text-slate-500 dark:text-dark-400 mt-0.5">{m.message}</p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">No issues found!</p>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center">Completeness: {fullValidation.completenessScore}%</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Assignment Drawer ── */}
      {showBulkDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end" onClick={() => setShowBulkDrawer(false)}>
          <div className="w-full max-w-md bg-white dark:bg-dark-900 shadow-2xl overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-slate-900 dark:text-dark-50 flex items-center gap-2">
                <Layers size={18} className="text-blue-500" /> Bulk Assign Lessons
              </h2>
              <button onClick={() => setShowBulkDrawer(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Class */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Class</label>
                <select value={bulkForm.classId} onChange={e => setBulkForm(f => ({ ...f, classId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select class...</option>
                  {classes.map(c => <option key={c._id} value={c._id}>{c.grade}-{c.section}{c.stream && c.stream !== 'none' ? ` (${c.stream})` : ''}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Subject</label>
                <select value={bulkForm.subjectId} onChange={e => setBulkForm(f => ({ ...f, subjectId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                  <option value="">Select subject...</option>
                  {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {/* Teacher + Room */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Teacher</label>
                  <select value={bulkForm.teacherId} onChange={e => setBulkForm(f => ({ ...f, teacherId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    <option value="">Select...</option>
                    {teachers.map(t => <option key={t._id} value={t._id}>{t.shortName || t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Room</label>
                  <select value={bulkForm.roomId} onChange={e => setBulkForm(f => ({ ...f, roomId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    <option value="">Select...</option>
                    {rooms.map(r => <option key={r._id} value={r._id}>{r.name} ({r.type})</option>)}
                  </select>
                </div>
              </div>

              {/* Period + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Period</label>
                  <select value={bulkForm.period} onChange={e => setBulkForm(f => ({ ...f, period: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    {(getPeriodsForDay('Monday')).filter(s => s.isSchedulable).map(s => (
                      <option key={s.slotNumber} value={s.slotNumber}>{s.label} ({s.startTime})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-1 block">Duration</label>
                  <select value={bulkForm.duration} onChange={e => setBulkForm(f => ({ ...f, duration: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-sm">
                    <option value={1}>1 Period</option>
                    <option value={2}>2 Periods</option>
                    <option value={3}>3 Periods</option>
                  </select>
                </div>
              </div>

              {/* Days — checkboxes with presets */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-dark-300 mb-2 block">Days</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {BULK_DAYS_PRESETS.map(preset => (
                    <button key={preset.label} onClick={() => setBulkForm(f => ({ ...f, days: [...preset.days] }))}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                        JSON.stringify(bulkForm.days.sort()) === JSON.stringify([...preset.days].sort())
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-slate-500 hover:border-blue-300'
                      }`}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <label key={day} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-dark-300 cursor-pointer">
                      <input type="checkbox" checked={bulkForm.days.includes(day)}
                        onChange={e => {
                          setBulkForm(f => ({
                            ...f,
                            days: e.target.checked ? [...f.days, day] : f.days.filter(d => d !== day)
                          }));
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      {day.slice(0, 3)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-dark-300 cursor-pointer">
                  <input type="checkbox" checked={bulkForm.overwriteExisting}
                    onChange={e => setBulkForm(f => ({ ...f, overwriteExisting: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                  Overwrite existing lessons
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-dark-300 cursor-pointer">
                  <input type="checkbox" checked={bulkForm.skipConflicts}
                    onChange={e => setBulkForm(f => ({ ...f, skipConflicts: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Skip conflicting slots
                </label>
              </div>

              {/* Preview Table */}
              {bulkPreview && !bulkResult && (
                <div className="border border-slate-200 dark:border-dark-700 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-dark-800 text-xs font-semibold text-slate-600 dark:text-dark-300 flex items-center gap-1.5">
                    <Eye size={12} /> Preview
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-dark-800">
                    {bulkPreview.map((item, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                        <span className="text-slate-700 dark:text-dark-200 font-medium">{item.day.slice(0, 3)} P{item.period}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.action === 'create' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                          item.action === 'overwrite' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                          item.action === 'skip' ? 'bg-slate-500/15 text-slate-500' :
                          'bg-red-500/15 text-red-500'
                        }`}>
                          {item.action === 'create' ? '✓ Create' :
                           item.action === 'overwrite' ? `⚠ Overwrite (${item.existing})` :
                           item.action === 'skip' ? `— Skip (${item.existing})` :
                           `✕ Conflict (${item.existing})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Result Summary */}
              {bulkResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2.5 bg-emerald-50 dark:bg-emerald-900/15 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{bulkResult.summary?.created || 0}</p>
                      <p className="text-[10px] text-emerald-500">Created</p>
                    </div>
                    <div className="text-center p-2.5 bg-slate-50 dark:bg-dark-800 rounded-xl border border-slate-200/50 dark:border-dark-700">
                      <p className="text-lg font-bold text-slate-600 dark:text-dark-300">{bulkResult.summary?.skipped || 0}</p>
                      <p className="text-[10px] text-slate-400">Skipped</p>
                    </div>
                    <div className="text-center p-2.5 bg-red-50 dark:bg-red-900/15 rounded-xl border border-red-200/50 dark:border-red-800/30">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">{bulkResult.summary?.conflicts || 0}</p>
                      <p className="text-[10px] text-red-500">Conflicts</p>
                    </div>
                  </div>
                  {(bulkResult.summary?.overwritten || 0) > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center">⚠ {bulkResult.summary.overwritten} overwritten</p>
                  )}
                  {bulkResult.conflicts?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-red-400 uppercase font-semibold">Conflicts</p>
                      {bulkResult.conflicts.map((c, i) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400">{c.day} P{c.period}: {c.reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="p-4 border-t border-slate-200 dark:border-dark-700 shrink-0 bg-white dark:bg-dark-900 flex gap-2">
              {!bulkPreview && !bulkResult ? (
                <button onClick={runBulkPreview}
                  disabled={!bulkForm.classId || !bulkForm.subjectId || !bulkForm.teacherId || bulkForm.days.length === 0}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                  <Eye size={14} /> Preview ({bulkForm.days.length} days)
                </button>
              ) : bulkPreview && !bulkResult ? (
                <>
                  <button onClick={() => setBulkPreview(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300">
                    ← Back
                  </button>
                  <button onClick={submitBulkAssign} disabled={bulkSubmitting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-1.5">
                    {bulkSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Assign {bulkPreview.filter(p => p.action === 'create' || p.action === 'overwrite').length} Lessons
                  </button>
                </>
              ) : (
                <button onClick={() => { setShowBulkDrawer(false); setBulkPreview(null); setBulkResult(null); }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all">
                  ✓ Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
