import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import Modal from './Modal';

/**
 * ConfirmDialog — replaces all window.confirm() calls
 * Usage:
 *   <ConfirmDialog
 *     open={showDelete}
 *     onClose={() => setShowDelete(false)}
 *     onConfirm={() => handleDelete()}
 *     title="Delete Teacher?"
 *     message="This action cannot be undone."
 *     variant="danger"
 *   />
 */
export default function ConfirmDialog({
  open, onClose, onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default', // 'default' | 'danger' | 'warning'
  loading = false,
  icon: CustomIcon
}) {
  const handleConfirm = useCallback(() => {
    onConfirm?.();
  }, [onConfirm]);

  // Keyboard: Enter to confirm, Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Enter' && !loading) { e.preventDefault(); handleConfirm(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, loading, handleConfirm]);

  const iconMap = {
    danger: <Trash2 size={24} className="text-red-400" />,
    warning: <AlertTriangle size={24} className="text-amber-400" />,
    default: null,
  };

  const btnClass = {
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20',
    default: 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/20'
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="">
      <div className="text-center py-2">
        {/* Icon */}
        <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${variant === 'danger' ? 'bg-red-500/10' : variant === 'warning' ? 'bg-amber-500/10' : 'bg-primary-500/10'}`}>
          {CustomIcon ? <CustomIcon size={24} /> : iconMap[variant] || <AlertTriangle size={24} className="text-primary-400" />}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-dark-50 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-dark-400 mb-6 max-w-sm mx-auto">{message}</p>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-dark-800 border border-slate-300 dark:border-dark-700 text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${btnClass[variant]} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Processing...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
