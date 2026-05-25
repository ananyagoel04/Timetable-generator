import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Confirm dialog — replaces window.confirm with styled modal.
 * 
 * Usage:
 *   <ConfirmDialog
 *     isOpen={showConfirm}
 *     onClose={() => setShowConfirm(false)}
 *     onConfirm={handleDelete}
 *     title="Delete Teacher"
 *     message="Are you sure? This cannot be undone."
 *     confirmText="Delete"
 *     variant="danger"
 *   />
 */
export default function ConfirmDialog({
  isOpen, onClose, onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // danger | warning | primary
  loading = false
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const btnClass = {
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20',
    warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20',
    primary: 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20',
  }[variant] || 'bg-red-600 hover:bg-red-500 text-white';

  const iconColor = {
    danger: 'text-red-400',
    warning: 'text-amber-400',
    primary: 'text-primary-400',
  }[variant] || 'text-red-400';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-sm glass-card p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className={iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-dark-50 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-dark-400">{message}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm" disabled={loading}>{cancelText}</button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${btnClass}`} disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
