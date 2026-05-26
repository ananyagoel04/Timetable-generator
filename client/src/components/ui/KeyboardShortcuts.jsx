import { useEffect, useState, useCallback } from 'react';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], description: 'Undo last edit', scope: 'Timetable Editor' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo last edit', scope: 'Timetable Editor' },
  { keys: ['Esc'], description: 'Close modal / exit edit mode', scope: 'Global' },
  { keys: ['?'], description: 'Show keyboard shortcuts', scope: 'Global' },
  { keys: ['Ctrl', 'S'], description: 'Save current form', scope: 'Forms' },
  { keys: ['Ctrl', 'P'], description: 'Print current view', scope: 'Reports' },
];

/**
 * Global keyboard shortcuts handler + help overlay
 * Mount once in App.jsx: <KeyboardShortcuts />
 */
export default function KeyboardShortcuts({ onUndo, onRedo }) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    // ? — show help (only when not in input)
    if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    // Esc — close help
    if (e.key === 'Escape') {
      setShowHelp(false);
      return;
    }

    // Ctrl+Z — undo
    if (modKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      onUndo?.();
      return;
    }

    // Ctrl+Shift+Z — redo
    if (modKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      onRedo?.();
      return;
    }

    // Ctrl+P — print
    if (modKey && e.key === 'p') {
      // Allow default browser print
      return;
    }
  }, [onUndo, onRedo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
      <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-dark-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-primary-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-dark-50">Keyboard Shortcuts</h3>
          </div>
          <button onClick={() => setShowHelp(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-1">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-800/50">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-dark-400 font-mono">
                  {s.scope}
                </span>
                <span className="text-sm text-slate-700 dark:text-dark-200">{s.description}</span>
              </div>
              <div className="flex gap-1">
                {s.keys.map((k, ki) => (
                  <kbd key={ki} className="px-2 py-0.5 text-xs font-mono rounded border border-slate-300 dark:border-dark-600 bg-slate-50 dark:bg-dark-800 text-slate-600 dark:text-dark-300 shadow-sm">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-400 dark:text-dark-500 mt-4 text-center">
          Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-slate-300 dark:border-dark-600 bg-slate-50 dark:bg-dark-800">?</kbd> anytime to toggle this overlay
        </p>
      </div>
    </div>
  );
}
