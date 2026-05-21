import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, LogIn, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('admin@dps.edu');
  const [password, setPassword] = useState('admin123');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Theme management for login page
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back!');
      } else {
        await register(name, email, password);
        toast.success('Account created!');
      }
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally { setSubmitting(false); }
  };

  const themeOptions = [
    { value: 'system', icon: Monitor, label: 'System' },
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 dark:from-dark-950 dark:via-dark-900 dark:to-dark-950 px-4 transition-colors duration-500">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 dark:bg-primary-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 dark:bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
      </div>

      {/* Theme toggle - top right */}
      <div className="absolute top-4 right-4 z-50">
        <div className="flex bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-xl p-1 border border-slate-200 dark:border-dark-700 shadow-lg">
          {themeOptions.map(opt => {
            const Icon = opt.icon;
            return (
              <button key={opt.value} onClick={() => setTheme(opt.value)}
                title={opt.label}
                className={`p-2 rounded-lg transition-all ${theme === opt.value
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-700'}`}>
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary-500/30 hover:scale-105 transition-transform">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-dark-300 bg-clip-text text-transparent">TimeCraft</h1>
          <p className="text-slate-500 dark:text-dark-400 text-sm mt-1">Advanced School Timetable ERP</p>
        </div>

        <div className="glass-card p-8 shadow-2xl shadow-slate-900/5 dark:shadow-black/20">
          <div className="flex bg-slate-100 dark:bg-dark-800 rounded-xl p-1 mb-6">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${isLogin ? 'bg-white dark:bg-dark-700 text-slate-900 dark:text-dark-50 shadow-md' : 'text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50'}`}>Sign In</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${!isLogin ? 'bg-white dark:bg-dark-700 text-slate-900 dark:text-dark-50 shadow-md' : 'text-slate-500 dark:text-dark-400 hover:text-slate-900 dark:hover:text-dark-50'}`}>Register</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required={!isLogin} className="input-field" placeholder="Your name" />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="input-field" placeholder="admin@school.edu" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-dark-400 mb-1 block font-medium">Password</label>
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} required className="input-field pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-500 hover:text-slate-600 dark:hover:text-dark-300 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
              <LogIn size={18} /> {submitting ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 dark:text-dark-500 mt-4">
            Default: <code className="text-primary-400">admin@dps.edu</code> / <code className="text-primary-400">admin123</code>
          </p>
        </div>

        <p className="text-center text-[10px] text-slate-400 dark:text-dark-600 mt-6">
          TimeCraft v2.0 · Built for modern schools
        </p>
      </div>
    </div>
  );
}
