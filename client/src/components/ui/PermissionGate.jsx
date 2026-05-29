import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Permission-based UI gating component.
 * Renders children only if the user has ALL required permissions.
 * Shows a loading spinner while auth/permissions are still hydrating
 * to prevent false Access Denied flashes on reload.
 * 
 * Usage:
 *   <PermissionGate permissions={['manage_teachers']}>
 *     <button>Add Teacher</button>
 *   </PermissionGate>
 * 
 *   <PermissionGate permissions={['edit_timetable']} fallback={<p>Read only</p>}>
 *     <TimetableEditor />
 *   </PermissionGate>
 * 
 *   <PermissionGate platformOnly>
 *     <PlatformDiagnostics />
 *   </PermissionGate>
 * 
 *   <PermissionGate permissions={['edit_setup']} requireSchoolContext>
 *     <SetupWizard />
 *   </PermissionGate>
 */
export default function PermissionGate({ permissions = [], platformOnly = false, requireSchoolContext = false, fallback = null, children }) {
  const { hasPermission, isPlatformUser, authLoading, authReady, permissionsReady, schoolContextReady } = useAuth();

  // While auth is still hydrating, show a loading state instead of the fallback
  // This prevents the Access Denied flash on page reload / route switch
  if (authLoading || !authReady || !permissionsReady) {
    if (import.meta.env.DEV) console.debug('[PermissionGate] waiting:auth', { authLoading, authReady, permissionsReady });
    return (
      <div className="flex items-center justify-center py-16 animate-fade-in">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-primary-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400 dark:text-dark-500">Loading permissions…</p>
        </div>
      </div>
    );
  }

  // If route requires school context, wait for that too
  if (requireSchoolContext && !schoolContextReady) {
    if (import.meta.env.DEV) console.debug('[PermissionGate] waiting:schoolContext');
    return (
      <div className="flex items-center justify-center py-16 animate-fade-in">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-primary-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400 dark:text-dark-500">Loading school context…</p>
        </div>
      </div>
    );
  }

  // ── Now auth is fully resolved — check actual permissions ──

  if (platformOnly && !isPlatformUser()) {
    if (import.meta.env.DEV) console.debug('[PermissionGate] denied:platformOnly');
    return fallback;
  }

  if (permissions.length > 0) {
    const hasAll = permissions.every(p => hasPermission(p));
    if (!hasAll) {
      if (import.meta.env.DEV) console.debug('[PermissionGate] denied:missing', permissions);
      return fallback;
    }
  }

  if (import.meta.env.DEV) console.debug('[PermissionGate] allowed');
  return children;
}
