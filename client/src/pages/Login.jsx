import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, LogIn } from 'lucide-react';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary-500/30">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TimeCraft</h1>
          <p className="text-dark-400 text-sm mt-1">Advanced School Timetable ERP</p>
        </div>

        <div className="glass-card p-8">
          <div className="flex bg-dark-800 rounded-xl p-1 mb-6">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isLogin ? 'bg-primary-600 text-white shadow-lg' : 'text-dark-400 hover:text-white'}`}>Sign In</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isLogin ? 'bg-primary-600 text-white shadow-lg' : 'text-dark-400 hover:text-white'}`}>Register</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-xs text-dark-400 mb-1 block">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required={!isLogin} className="input-field" placeholder="Your name" />
              </div>
            )}
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="input-field" placeholder="admin@school.edu" />
            </div>
            <div>
              <label className="text-xs text-dark-400 mb-1 block">Password</label>
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} required className="input-field pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              <LogIn size={18} /> {submitting ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-dark-500 mt-4">
            Default: <code className="text-primary-400">admin@dps.edu</code> / <code className="text-primary-400">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
