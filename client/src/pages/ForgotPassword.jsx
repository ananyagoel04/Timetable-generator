import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';

export default function ForgotPassword() {
  const [step, setStep] = useState('request'); // 'request' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devToken, setDevToken] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data?.resetToken) setDevToken(res.data.resetToken);
      setStep('reset');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, resetToken, newPassword });
      setStep('done');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f0a2a 0%, #1a1145 30%, #0d1f3c 60%, #0a0a1a 100%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -top-20 -left-20 animate-pulse" />
        <div className="absolute w-80 h-80 bg-blue-500/8 rounded-full blur-3xl bottom-10 right-10" />
      </div>

      <div className="glass-card w-full max-w-md p-8 relative z-10">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Login
        </Link>

        {step === 'request' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Mail size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Forgot Password</h1>
                <p className="text-sm text-slate-400">Enter your email to get a reset token</p>
              </div>
            </div>
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="your@email.com" />
              </div>
              {error && <div className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle size={14} />{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-primary-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-primary-500/20 transition-all disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Reset Token'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <KeyRound size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Reset Password</h1>
                <p className="text-sm text-slate-400">Enter the token and your new password</p>
              </div>
            </div>
            {devToken && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-400 font-medium mb-1">Dev Mode — Reset Token:</p>
                <code className="text-xs text-emerald-300 break-all select-all">{devToken}</code>
              </div>
            )}
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Reset Token</label>
                <input type="text" value={resetToken} onChange={e => setResetToken(e.target.value)} required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="Paste your reset token" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 pr-10"
                    placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <div className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle size={14} />{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-50">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Check size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Password Reset!</h2>
            <p className="text-slate-400 mb-6">Your password has been updated successfully.</p>
            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
              <ArrowLeft size={16} /> Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
