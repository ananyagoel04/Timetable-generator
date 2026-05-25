import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
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

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-dark-400 text-sm">Loading...</p>
      </div>
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/select-school" element={isAuthenticated ? <SchoolSessionSelector /> : <Navigate to="/login" replace />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/periods" element={<PeriodStructure />} />
        <Route path="/requirements" element={<SubjectRequirements />} />
        <Route path="/can-teach" element={<CanTeachManager />} />
        <Route path="/combinations" element={<CombinationRules />} />
        <Route path="/timetable" element={<TimetableView />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/conflicts" element={<ConflictCenter />} />
        <Route path="/absences" element={<Absences />} />
        <Route path="/substitutions" element={<Substitutions />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/rules" element={<CustomRules />} />
        <Route path="/replacements" element={<TeacherReplacements />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/platform" element={<PlatformAdmin />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PlaceholderPage({ title, desc }) {
  return (
    <div className="flex items-center justify-center py-24 animate-fade-in">
      <div className="text-center">
        <h1 className="page-title">{title}</h1>
        <p className="text-slate-500 dark:text-dark-400 mt-2">{desc}</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
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
