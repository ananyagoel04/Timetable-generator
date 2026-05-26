import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Shown when a user tries to access a page they don't have permission for.
 */
export default function AccessDenied({ permission }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center py-24 animate-fade-in">
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <ShieldAlert size={32} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-dark-50 mb-2">Access Denied</h1>
        <p className="text-sm text-slate-500 dark:text-dark-400 mb-6">
          You don't have permission to view this page.
          {permission && <span className="block mt-1 text-xs text-slate-400">Required: <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-dark-800 rounded text-xs">{permission}</code></span>}
        </p>
        <button onClick={() => navigate('/')} className="btn-primary text-sm">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
