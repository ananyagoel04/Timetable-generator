import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, AuthNavigateSync, useAuth } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import PermissionGate from './components/ui/PermissionGate';
import AccessDenied from './components/ui/AccessDenied';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SetupWizard from './pages/SetupWizard';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Rooms from './pages/Rooms';
import SubjectRequirements from './pages/SubjectRequirements';
import CombinationRules from './pages/CombinationRules';
import TimetableView from './pages/TimetableView';
import Generator from './pages/Generator';
import ConflictCenter from './pages/ConflictCenter';
import Absences from './pages/Absences';
import Substitutions from './pages/Substitutions';
import StaffAvailability from './pages/StaffAvailability';
import AuditLogs from './pages/AuditLogs';
import TeacherReplacements from './pages/TeacherReplacements';
import PeriodStructure from './pages/PeriodStructure';
import CustomRules from './pages/CustomRules';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import PlatformAdmin from './pages/PlatformAdmin';
import UserManagement from './pages/UserManagement';
import CanTeachManager from './pages/CanTeachManager';
import ForgotPassword from './pages/ForgotPassword';
import SchoolSessionSelector from './pages/SchoolSessionSelector';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import RoleManagement from './pages/RoleManagement';
import SessionManagement from './pages/SessionManagement';
import { lazy, Suspense } from 'react';

// Lazy-load the Manual Timetable Builder (heavy page)
const ManualTimetableBuilder = lazy(() => import('./pages/ManualTimetableBuilder'));

/**
 * ProtectedRoute — Guards against unauthenticated access.
 * Shows loader during auth hydration. Never redirects while loading.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading, authReady, selectedSchool, isPlatformUser } = useAuth();

  // Still loading — show spinner
  if (authLoading || !authReady) {
    if (import.meta.env.DEV) console.debug('[RouteGuard] waiting:authLoading');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-dark-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!isAuthenticated) {
    if (import.meta.env.DEV) console.debug('[RouteGuard] denied:notAuthenticated');
    return <Navigate to="/login" replace />;
  }

  // Platform users: allowed into Layout WITHOUT a selected school.
  // They'll see school-scoped items disabled in the sidebar until they pick a school.
  if (isPlatformUser()) {
    if (import.meta.env.DEV) console.debug('[RouteGuard] allowed:platformUser', { selectedSchool });
    return children;
  }

  // School users: must have a school selected
  if (!selectedSchool) {
    if (import.meta.env.DEV) console.debug('[RouteGuard] redirect:noSchool');
    return <Navigate to="/select-school" replace />;
  }

  if (import.meta.env.DEV) console.debug('[RouteGuard] allowed');
  return children;
}

/** Wraps a page with a permission gate — shows AccessDenied if user lacks permission */
function Gated({ permissions, platformOnly, children }) {
  return (
    <PermissionGate permissions={permissions || []} platformOnly={platformOnly} fallback={<AccessDenied permission={permissions?.join(', ') || 'platform access'} />}>
      {children}
    </PermissionGate>
  );
}

/** Lazy loading fallback */
function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, authLoading, authReady } = useAuth();

  // Global loading while auth hydrates
  if (authLoading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/select-school" element={isAuthenticated ? <SchoolSessionSelector /> : <Navigate to="/login" replace />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Dashboard — accessible to all authenticated users */}
        <Route path="/" element={<Dashboard />} />

        {/* Timetable Viewing — accessible to all (view_timetable) */}
        <Route path="/timetable" element={<Gated permissions={['view_timetable']}><TimetableView /></Gated>} />
        <Route path="/reports" element={<Gated permissions={['view_timetable']}><Reports /></Gated>} />

        {/* Setup & Configuration — admin/manager only */}
        <Route path="/setup" element={<Gated permissions={['edit_setup']}><SetupWizard /></Gated>} />
        <Route path="/periods" element={<Gated permissions={['edit_setup']}><PeriodStructure /></Gated>} />
        <Route path="/settings" element={<Gated permissions={['manage_school']}><Settings /></Gated>} />

        {/* Master Data — staff and above */}
        <Route path="/teachers" element={<Gated permissions={['manage_teachers']}><Teachers /></Gated>} />
        <Route path="/classes" element={<Gated permissions={['edit_setup']}><Classes /></Gated>} />
        <Route path="/subjects" element={<Gated permissions={['edit_setup']}><Subjects /></Gated>} />
        <Route path="/rooms" element={<Gated permissions={['edit_setup']}><Rooms /></Gated>} />

        {/* Scheduling Configuration — manager and above */}
        <Route path="/requirements" element={<Gated permissions={['manage_rules']}><SubjectRequirements /></Gated>} />
        <Route path="/can-teach" element={<Gated permissions={['manage_teachers']}><CanTeachManager /></Gated>} />
        <Route path="/combinations" element={<Gated permissions={['manage_rules']}><CombinationRules /></Gated>} />
        <Route path="/rules" element={<Gated permissions={['manage_rules']}><CustomRules /></Gated>} />
        <Route path="/generator" element={<Gated permissions={['generate_timetable']}><Generator /></Gated>} />
        <Route path="/conflicts" element={<Gated permissions={['edit_timetable']}><ConflictCenter /></Gated>} />

        {/* Manual Timetable Builder */}
        <Route path="/manual-timetable" element={
          <Gated permissions={['generate_timetable']}>
            <Suspense fallback={<LazyFallback />}>
              <ManualTimetableBuilder />
            </Suspense>
          </Gated>
        } />
        <Route path="/manual-timetable/:timetableId/edit" element={
          <Gated permissions={['edit_timetable']}>
            <Suspense fallback={<LazyFallback />}>
              <ManualTimetableBuilder />
            </Suspense>
          </Gated>
        } />

        {/* Operations — manager and above */}
        <Route path="/staff-availability" element={<Gated permissions={['manage_absences']}><StaffAvailability /></Gated>} />
        <Route path="/absences" element={<Gated permissions={['manage_absences']}><Absences /></Gated>} />
        <Route path="/substitutions" element={<Gated permissions={['approve_substitutions']}><Substitutions /></Gated>} />
        <Route path="/replacements" element={<Gated permissions={['manage_replacements']}><TeacherReplacements /></Gated>} />

        {/* System — admin only */}
        <Route path="/users" element={<Gated permissions={['manage_users']}><UserManagement /></Gated>} />
        <Route path="/sessions" element={<Gated permissions={['edit_setup']}><SessionManagement /></Gated>} />
        <Route path="/audit-logs" element={<Gated permissions={['view_audit']}><AuditLogs /></Gated>} />

        {/* Platform — platform users only */}
        <Route path="/platform" element={<Gated platformOnly><PlatformAdmin /></Gated>} />

        {/* Analytics & Roles */}
        <Route path="/analytics" element={<Gated permissions={['view_timetable']}><AnalyticsDashboard /></Gated>} />
        <Route path="/roles" element={<Gated permissions={['manage_users']}><RoleManagement /></Gated>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuthNavigateSync />
          <SidebarProvider>
            <Toaster position="top-right" toastOptions={{
              className: '!bg-white dark:bg-dark-800 !text-slate-900 dark:text-dark-50 !border !border-slate-300/50 dark:border-dark-700/50',
              style: { backdropFilter: 'blur(16px)' }
            }} />
            <AppRoutes />
          </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
