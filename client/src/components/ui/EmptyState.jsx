import { Inbox } from 'lucide-react';

/**
 * Empty state placeholder for lists and tables.
 * 
 * Usage:
 *   <EmptyState icon={Users} title="No Teachers" message="Add your first teacher to get started." />
 */
export default function EmptyState({ icon: Icon = Inbox, title = 'No Data', message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-300 dark:text-dark-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-dark-200 mb-1">{title}</h3>
      {message && <p className="text-sm text-slate-400 dark:text-dark-500 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
