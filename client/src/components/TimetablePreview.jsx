import { useMemo } from 'react';
import { Clock, Coffee, Utensils, Flag, Eye } from 'lucide-react';
import { dedupeBreaks, getDuration, computeStats } from '../utils/breakUtils';

const slotTypeConfig = {
  period:   { icon: Clock,    color: 'text-primary-400',  bg: 'bg-primary-500/20',  ring: 'ring-primary-500/30' },
  break:    { icon: Coffee,   color: 'text-amber-400',    bg: 'bg-amber-500/20',    ring: 'ring-amber-500/30' },
  lunch:    { icon: Utensils,  color: 'text-emerald-400',  bg: 'bg-emerald-500/20',  ring: 'ring-emerald-500/30' },
  assembly: { icon: Flag,     color: 'text-purple-400',   bg: 'bg-purple-500/20',   ring: 'ring-purple-500/30' },
  activity: { icon: Clock,    color: 'text-cyan-400',     bg: 'bg-cyan-500/20',     ring: 'ring-cyan-500/30' },
};

/**
 * TimetablePreview — Real-time visual preview of a day's period structure.
 * Accepts timeslots and renders a vertical timeline with break deduplication.
 *
 * @param {{ slots: Array, dayLabel?: string, compact?: boolean }} props
 */
export default function TimetablePreview({ slots = [], dayLabel = 'Preview', compact = false }) {
  const dedupedSlots = useMemo(() => dedupeBreaks(slots), [slots]);
  const stats = useMemo(() => computeStats(dedupedSlots), [dedupedSlots]);

  let teachingIdx = 0;

  if (dedupedSlots.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Eye size={24} className="mx-auto text-slate-300 dark:text-dark-600 mb-2" />
        <p className="text-xs text-slate-400 dark:text-dark-500">No timeslots to preview</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-700/50 bg-slate-50/50 dark:bg-dark-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-primary-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-dark-200">{dayLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-dark-500">
            <span>{stats.teachingPeriods} periods</span>
            <span>{stats.breakCount} breaks</span>
            <span>{stats.totalMinutes} min</span>
          </div>
        </div>
      </div>

      {/* Visual timeline bar */}
      <div className="px-4 py-2">
        <div className="flex rounded-xl overflow-hidden h-8 bg-white dark:bg-dark-800 ring-1 ring-slate-200 dark:ring-dark-700">
          {dedupedSlots.map((slot, i) => {
            const dur = getDuration(slot.startTime, slot.endTime);
            const pct = (dur / stats.totalMinutes) * 100;
            const cfg = slotTypeConfig[slot.type] || slotTypeConfig.period;
            return (
              <div
                key={i}
                className={`${cfg.bg} flex items-center justify-center border-r border-slate-300/20 dark:border-dark-700/20 text-[9px] font-medium ${cfg.color} overflow-hidden transition-all duration-300 hover:opacity-90`}
                style={{ width: `${pct}%` }}
                title={`${slot.label} (${slot.startTime}–${slot.endTime}) ${dur}min`}
              >
                {pct > 6 && slot.label?.slice(0, 8)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Slot list */}
      <div className={`px-3 pb-3 space-y-1 ${compact ? 'max-h-[240px] overflow-y-auto scrollbar-thin' : ''}`}>
        {dedupedSlots.map((slot, i) => {
          if (slot.isSchedulable) teachingIdx++;
          const cfg = slotTypeConfig[slot.type] || slotTypeConfig.period;
          const Icon = cfg.icon;
          const dur = getDuration(slot.startTime, slot.endTime);

          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200
                ${slot.isSchedulable
                  ? 'bg-white/60 dark:bg-dark-800/40 hover:bg-white dark:hover:bg-dark-800/60'
                  : 'bg-slate-50/60 dark:bg-dark-900/30'
                }
                ${slot._overridden ? `ring-1 ${cfg.ring}` : ''}
                ${slot._merged ? 'border-l-2 border-amber-400' : ''}
              `}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${cfg.bg} shrink-0`}>
                <Icon size={12} className={cfg.color} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-800 dark:text-dark-100 truncate">
                    {slot.label || (slot.isSchedulable ? `Period ${teachingIdx}` : slot.type)}
                  </span>
                  {slot._overridden && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary-500/10 text-primary-400 font-semibold">
                      OVERRIDE
                    </span>
                  )}
                  {slot._merged && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold">
                      MERGED
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-dark-500">
                  {slot.startTime} – {slot.endTime} · {dur}min
                </span>
              </div>

              {slot.isSchedulable && (
                <span className="text-[10px] font-bold text-primary-500 bg-primary-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                  P{teachingIdx}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
