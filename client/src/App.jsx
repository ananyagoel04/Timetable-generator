import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
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

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-400 text-sm">Loading...</p>
      </div>
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/requirements" element={<SubjectRequirements />} />
        <Route path="/combinations" element={<CombinationRules />} />
        <Route path="/timetable" element={<TimetableView />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/conflicts" element={<ConflictCenter />} />
        <Route path="/absences" element={<Absences />} />
        <Route path="/substitutions" element={<Substitutions />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/rules" element={<PlaceholderPage title="Rules & Preferences" desc="Custom rule engine — Coming soon" />} />
        <Route path="/replacements" element={<TeacherReplacements />} />
        <Route path="/reports" element={<PlaceholderPage title="Reports" desc="PDF & Excel export — Coming soon" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" desc="System configuration — Coming soon" />} />
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
        <p className="text-dark-400 mt-2">{desc}</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
        }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
