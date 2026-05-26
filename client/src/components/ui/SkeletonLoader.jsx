/**
 * SkeletonLoader — animated skeleton placeholders for loading states
 * Usage: <SkeletonCard /> <SkeletonTable rows={5} /> <SkeletonGrid cols={3} />
 */

function SkeletonPulse({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-dark-700 dark:via-dark-600 dark:to-dark-700 rounded-lg ${className}`} 
      style={{ backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s ease-in-out infinite' }} />
  );
}

export function SkeletonCard({ count = 1 }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonPulse className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="h-4 w-3/4" />
              <SkeletonPulse className="h-3 w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <SkeletonPulse className="h-3 w-full" />
            <SkeletonPulse className="h-3 w-5/6" />
            <SkeletonPulse className="h-3 w-2/3" />
          </div>
          <div className="flex gap-2">
            <SkeletonPulse className="h-8 w-20 rounded-lg" />
            <SkeletonPulse className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex gap-2 p-4 bg-slate-50 dark:bg-dark-800/50 border-b border-slate-200 dark:border-dark-700">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonPulse key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-2 p-4 border-b border-slate-100 dark:border-dark-800/50">
          {Array.from({ length: cols }).map((_, ci) => (
            <SkeletonPulse key={ci} className={`h-3 flex-1 ${ci === 0 ? 'w-1/4' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ cols = 7, rows = 8 }) {
  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `60px repeat(${cols}, 1fr)` }}>
        <SkeletonPulse className="h-8 rounded-lg" />
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonPulse key={i} className="h-8 rounded-lg" />
        ))}
      </div>
      {/* Grid cells */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="grid gap-2 mb-2" style={{ gridTemplateColumns: `60px repeat(${cols}, 1fr)` }}>
          <SkeletonPulse className="h-14 rounded-lg" />
          {Array.from({ length: cols }).map((_, ci) => (
            <SkeletonPulse key={ci} className="h-14 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <SkeletonPulse className="h-3 w-1/2" />
            <SkeletonPulse className="h-8 w-2/3" />
            <SkeletonPulse className="h-2 w-3/4" />
          </div>
        ))}
      </div>
      {/* Content area */}
      <div className="grid md:grid-cols-2 gap-4">
        <SkeletonCard count={1} />
        <SkeletonCard count={1} />
      </div>
    </div>
  );
}

export default { SkeletonCard, SkeletonTable, SkeletonGrid, SkeletonDashboard };
