import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Clock, Coffee, Utensils, Flag, Plus, Trash2,
  ChevronUp, ChevronDown, Save, RotateCcw, Copy, Check, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Slot type config ──────────────────────────────────────────
const slotTypeConfig = {
  period:   { icon: Clock,   color: 'text-primary-400',  bg: 'bg-primary-500/20' },
  break:    { icon: Coffee,  color: 'text-amber-400',    bg: 'bg-amber-500/20' },
  lunch:    { icon: Utensils, color: 'text-emerald-400',  bg: 'bg-emerald-500/20' },
  assembly: { icon: Flag,    color: 'text-purple-400',   bg: 'bg-purple-500/20' },
  activity: { icon: Clock,   color: 'text-cyan-400',     bg: 'bg-cyan-500/20' },
};

// ─── Sortable Slot Item ────────────────────────────────────────
function SortableSlotItem({ slot, index, onUpdate, onRemove, isOverride }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot._sortId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const cfg = slotTypeConfig[slot.type] || slotTypeConfig.period;
  const Icon = cfg.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-xl transition-all duration-150
        ${isDragging ? 'shadow-xl ring-2 ring-primary-500/40' : ''}
        ${isOverride ? 'bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/20' : 'bg-white/40 dark:bg-dark-800/40'}
        border border-slate-300/30 dark:border-dark-700/30 group`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 rounded-lg text-slate-400 dark:text-dark-600 hover:text-slate-700 dark:hover:text-dark-300 hover:bg-slate-100 dark:hover:bg-dark-700 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Type icon */}
      <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${cfg.bg} shrink-0`}>
        <Icon size={12} className={cfg.color} />
      </span>

      {/* Label */}
      <input
        value={slot.label}
        onChange={e => onUpdate(index, 'label', e.target.value)}
        className="input-field text-xs py-1.5 flex-1 min-w-[80px] !shadow-none !border-slate-200/60 dark:!border-dark-700/60"
        placeholder="Label"
      />

      {/* Type select */}
      <select
        value={slot.type}
        onChange={e => onUpdate(index, 'type', e.target.value)}
        className="select-field text-xs py-1.5 w-24 !shadow-none"
      >
        {Object.keys(slotTypeConfig).map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* Times */}
      <input
        value={slot.startTime}
        onChange={e => onUpdate(index, 'startTime', e.target.value)}
        type="time"
        className="input-field text-xs py-1.5 w-[90px] !shadow-none"
      />
      <input
        value={slot.endTime}
        onChange={e => onUpdate(index, 'endTime', e.target.value)}
        type="time"
        className="input-field text-xs py-1.5 w-[90px] !shadow-none"
      />

      {/* Schedulable */}
      <label className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-dark-400 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={slot.isSchedulable}
          onChange={e => onUpdate(index, 'isSchedulable', e.target.checked)}
          className="rounded border-slate-300 dark:border-dark-600 text-primary-600 w-3.5 h-3.5"
        />
        Teach
      </label>

      {/* Mobile reorder */}
      <div className="flex flex-col gap-0.5 md:hidden shrink-0">
        <button
          onClick={() => onUpdate(index, '_moveUp', true)}
          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:text-dark-600 dark:hover:text-dark-300"
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={() => onUpdate(index, '_moveDown', true)}
          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:text-dark-600 dark:hover:text-dark-300"
        >
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(index)}
        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 dark:text-dark-500 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/**
 * PeriodOverride — Drag-and-drop period arrangement with any-day overrides.
 *
 * Props:
 *  - defaultTemplate: Array of timeslot objects (the default day template)
 *  - dayOverrides: Map<dayName, Array<timeslot>> (day-specific overrides)
 *  - workingDays: Array of day names
 *  - onSlotsChange(dayName|null, newSlots): callback when slots change (null = default template)
 *  - onSave(): callback to trigger save
 *  - saving: boolean
 *  - dirty: boolean
 */
export default function PeriodOverride({
  defaultTemplate = [],
  dayOverrides = {},
  workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  onSlotsChange,
  onSave,
  saving = false,
  dirty = false,
}) {
  const [activeDay, setActiveDay] = useState(null); // null = default template
  const [slots, setSlots] = useState([]);

  // Generate stable sort IDs
  const addSortIds = useCallback((arr) =>
    arr.map((s, i) => ({ ...s, _sortId: s._sortId || `slot-${i}-${Date.now()}` })),
  []);

  // Load slots when day changes
  useEffect(() => {
    if (activeDay === null) {
      setSlots(addSortIds([...defaultTemplate]));
    } else {
      const overrideSlots = dayOverrides[activeDay];
      setSlots(addSortIds(overrideSlots ? [...overrideSlots] : [...defaultTemplate]));
    }
  }, [activeDay, defaultTemplate, dayOverrides, addSortIds]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIdx = slots.findIndex(s => s._sortId === active.id);
      const newIdx = slots.findIndex(s => s._sortId === over.id);
      const reordered = arrayMove(slots, oldIdx, newIdx).map((s, i) => ({
        ...s,
        slotNumber: i + 1,
      }));
      setSlots(reordered);
      onSlotsChange?.(activeDay, reordered);
    }
  };

  const updateSlot = (index, field, value) => {
    // Handle mobile move up/down
    if (field === '_moveUp' && index > 0) {
      const reordered = arrayMove(slots, index, index - 1).map((s, i) => ({ ...s, slotNumber: i + 1 }));
      setSlots(reordered);
      onSlotsChange?.(activeDay, reordered);
      return;
    }
    if (field === '_moveDown' && index < slots.length - 1) {
      const reordered = arrayMove(slots, index, index + 1).map((s, i) => ({ ...s, slotNumber: i + 1 }));
      setSlots(reordered);
      onSlotsChange?.(activeDay, reordered);
      return;
    }

    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'type') updated[index].isSchedulable = value === 'period';
    setSlots(updated);
    onSlotsChange?.(activeDay, updated);
  };

  const removeSlot = (index) => {
    const updated = slots.filter((_, i) => i !== index).map((s, i) => ({ ...s, slotNumber: i + 1 }));
    setSlots(updated);
    onSlotsChange?.(activeDay, updated);
  };

  const addSlot = (type = 'period') => {
    const last = slots[slots.length - 1];
    const start = last ? last.endTime : '08:00';
    const dur = type === 'period' ? 40 : type === 'lunch' ? 40 : 20;
    const [h, m] = start.split(':').map(Number);
    const endMin = h * 60 + m + dur;
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    const periodCount = slots.filter(s => s.type === 'period').length;

    const newSlot = {
      label: type === 'period' ? `Period ${periodCount + 1}` : type === 'lunch' ? 'Lunch Break' : type === 'break' ? 'Short Break' : type.charAt(0).toUpperCase() + type.slice(1),
      slotNumber: slots.length + 1,
      startTime: start,
      endTime: end,
      type,
      isSchedulable: type === 'period',
      _sortId: `slot-new-${Date.now()}`,
    };
    const updated = [...slots, newSlot];
    setSlots(updated);
    onSlotsChange?.(activeDay, updated);
  };

  const copyDefaultToDay = () => {
    if (activeDay === null) return;
    const copied = addSortIds([...defaultTemplate]);
    setSlots(copied);
    onSlotsChange?.(activeDay, copied);
    toast.success(`Copied default template to ${activeDay}`);
  };

  const resetToDefault = () => {
    if (activeDay === null) return;
    // Remove override for this day
    onSlotsChange?.(activeDay, null); // null signals "remove override"
    setSlots(addSortIds([...defaultTemplate]));
    toast.success(`${activeDay} reset to default`);
  };

  const sortIds = useMemo(() => slots.map(s => s._sortId), [slots]);
  const isOverrideActive = activeDay !== null && dayOverrides[activeDay] != null;

  return (
    <div className="space-y-4">
      {/* Day Tabs */}
      <div className="flex gap-1 bg-white dark:bg-dark-800 rounded-xl p-1 border border-slate-200 dark:border-dark-700 overflow-x-auto">
        <button
          onClick={() => setActiveDay(null)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            activeDay === null
              ? 'bg-primary-600 text-white shadow-md'
              : 'text-slate-500 dark:text-dark-400 hover:bg-slate-50 dark:hover:bg-dark-700'
          }`}
        >
          <Calendar size={13} /> Default
        </button>
        {workingDays.map(day => {
          const hasOverride = dayOverrides[day] != null;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all relative ${
                activeDay === day
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-dark-400 hover:bg-slate-50 dark:hover:bg-dark-700'
              }`}
            >
              {day.slice(0, 3)}
              {hasOverride && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-dark-800" />
              )}
            </button>
          );
        })}
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(slotTypeConfig).map(([type, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button
                key={type}
                onClick={() => addSlot(type)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg ${cfg.bg} ${cfg.color} hover:opacity-80 transition-opacity flex items-center gap-1`}
              >
                <Plus size={10} /> {type}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          {activeDay !== null && (
            <>
              <button onClick={copyDefaultToDay} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                <Copy size={12} /> Copy Default
              </button>
              {isOverrideActive && (
                <button onClick={resetToDefault} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 hover:text-red-500">
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </>
          )}
          {onSave && (
            <button onClick={onSave} disabled={!dirty || saving} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
              {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-dark-500">
        <span className="flex items-center gap-1">
          <Clock size={10} /> {slots.filter(s => s.isSchedulable).length} teaching periods
        </span>
        <span>·</span>
        <span>{slots.filter(s => !s.isSchedulable).length} breaks</span>
        <span>·</span>
        <span>Editing: {activeDay || 'Default Template'}</span>
        {isOverrideActive && (
          <>
            <span>·</span>
            <span className="text-amber-400 font-semibold">Override active</span>
          </>
        )}
      </div>

      {/* Sortable slot list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {slots.map((slot, i) => (
              <SortableSlotItem
                key={slot._sortId}
                slot={slot}
                index={i}
                onUpdate={updateSlot}
                onRemove={removeSlot}
                isOverride={activeDay !== null && isOverrideActive}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {slots.length === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-dark-500 text-sm">
          <Plus size={20} className="mx-auto mb-2 opacity-50" />
          Add slots using the buttons above
        </div>
      )}
    </div>
  );
}
