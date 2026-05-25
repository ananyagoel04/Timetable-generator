/**
 * Consistent loading spinner for the whole app.
 * 
 * Usage:
 *   <LoadingSpinner />
 *   <LoadingSpinner size="lg" message="Generating timetable..." />
 */
export default function LoadingSpinner({ message = 'Loading...', size = 'md', className = '' }) {
  const sizeClass = { sm: 'w-6 h-6 border-2', md: 'w-10 h-10 border-3', lg: 'w-14 h-14 border-4' }[size] || 'w-10 h-10 border-3';

  return (
    <div className={`flex flex-col items-center justify-center py-16 animate-fade-in ${className}`}>
      <div className={`${sizeClass} border-primary-500 border-t-transparent rounded-full animate-spin mb-3`} />
      {message && <p className="text-sm text-slate-500 dark:text-dark-400">{message}</p>}
    </div>
  );
}
