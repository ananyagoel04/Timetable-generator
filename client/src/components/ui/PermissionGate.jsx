import { useAuth } from '../../context/AuthContext';

/**
 * Permission-based UI gating component.
 * Renders children only if the user has ALL required permissions.
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
 */
export default function PermissionGate({ permissions = [], platformOnly = false, fallback = null, children }) {
  const { hasPermission, isPlatformUser } = useAuth();

  if (platformOnly && !isPlatformUser()) {
    return fallback;
  }

  if (permissions.length > 0) {
    const hasAll = permissions.every(p => hasPermission(p));
    if (!hasAll) return fallback;
  }

  return children;
}
