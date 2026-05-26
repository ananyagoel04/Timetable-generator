import { Inbox, Plus } from 'lucide-react';

/**
 * EmptyState — consistent empty state component
 * Usage:
 *   <EmptyState
 *     icon={Users}
 *     title="No teachers yet"
 *     description="Add your first teacher to get started."
 *     actionLabel="Add Teacher"
 *     onAction={() => setShowForm(true)}
 *   />
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = 'Get started by creating your first item.',
  actionLabel,
  onAction,
  actionHref,
  compact = false,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'} ${className}`}>
      <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-dark-700 dark:to-dark-800 flex items-center justify-center mb-4 shadow-inner`}>
        <Icon size={compact ? 20 : 28} className="text-slate-400 dark:text-dark-500" />
      </div>
      <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-slate-700 dark:text-dark-200 mb-1`}>
        {title}
      </h3>
      <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-400 dark:text-dark-500 max-w-sm mb-5`}>
        {description}
      </p>
      {actionLabel && (onAction || actionHref) && (
        actionHref ? (
          <a href={actionHref} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={14} />
            {actionLabel}
          </a>
        ) : (
          <button onClick={onAction} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={14} />
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
