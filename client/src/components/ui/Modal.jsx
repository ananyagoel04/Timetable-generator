import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }[size] || 'max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className={`relative w-full ${sizeClass} glass-card p-6 animate-scale-in max-h-[85vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-dark-50">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
