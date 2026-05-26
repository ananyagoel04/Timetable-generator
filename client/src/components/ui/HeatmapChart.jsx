import { useMemo } from 'react';

const COLORS = [
  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
];

function getColor(value, max) {
  if (max === 0) return 'bg-slate-50 dark:bg-dark-800 text-slate-400 dark:text-dark-500';
  const ratio = value / max;
  if (ratio === 0) return 'bg-slate-50 dark:bg-dark-800 text-slate-400 dark:text-dark-500';
  if (ratio < 0.25) return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400';
  if (ratio < 0.5) return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400';
  if (ratio < 0.75) return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400';
  return 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400';
}

/**
 * Reusable CSS-grid heatmap component.
 * @param {Object} props
 * @param {Array} props.rows - [{ label, values: { col1: n, col2: n, ... } }]
 * @param {Array} props.columns - ['Mon', 'Tue', ...]
 * @param {string} props.title
 * @param {string} props.valueLabel - label for tooltip
 */
export default function HeatmapChart({ rows = [], columns = [], title = '', valueLabel = 'periods' }) {
  const maxValue = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      for (const col of columns) {
        const v = row.values?.[col] || 0;
        if (v > max) max = v;
      }
    }
    return max;
  }, [rows, columns]);

  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-6">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-4">{title}</h3>
        <p className="text-slate-400 dark:text-dark-500 text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-4 sm:p-6 overflow-x-auto">
      {title && <h3 className="text-sm font-semibold text-slate-600 dark:text-dark-300 mb-4">{title}</h3>}
      <div className="min-w-[500px]">
        {/* Header */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
          <div className="text-xs text-slate-400 dark:text-dark-500 font-medium px-2 py-1" />
          {columns.map(col => (
            <div key={col} className="text-xs text-center text-slate-500 dark:text-dark-400 font-medium py-1 truncate">
              {col}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div key={i} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
            <div className="text-xs text-slate-600 dark:text-dark-300 font-medium px-2 py-2 truncate flex items-center" title={row.label}>
              {row.label}
            </div>
            {columns.map(col => {
              const value = row.values?.[col] || 0;
              return (
                <div
                  key={col}
                  className={`rounded-md text-center text-xs font-semibold py-2 transition-all cursor-default
                    ${getColor(value, maxValue)}
                    hover:ring-2 hover:ring-primary-400/50`}
                  title={`${row.label} — ${col}: ${value} ${valueLabel}`}
                >
                  {value || '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 text-xs text-slate-400 dark:text-dark-500">
        <span>Low</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-950/40" />
          <div className="w-4 h-3 rounded-sm bg-blue-100 dark:bg-blue-950/40" />
          <div className="w-4 h-3 rounded-sm bg-amber-100 dark:bg-amber-950/40" />
          <div className="w-4 h-3 rounded-sm bg-red-100 dark:bg-red-950/40" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
