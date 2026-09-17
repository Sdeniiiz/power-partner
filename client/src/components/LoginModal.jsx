import React, { useState } from 'react';
import { LogIn, Shield, User, Key, AlertCircle, Sparkles } from 'lucide-react';
import { loginUser } from '../api';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Lütfen kullanıcı adı ve şifre girin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser({ username: username.trim(), password: password.trim() });
      if (res.success) {
        localStorage.setItem('powerpartner_auth_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Giriş başarısız! Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (uname, pass) => {
    setUsername(uname);
    setPassword(pass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center relative">
          <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm border border-white/20 mb-3 shadow-inner">
            <Shield className="w-9 h-9 text-blue-200" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">PowerPartner CRM</h2>
          <p className="text-xs text-blue-100/80 mt-1 font-medium">Lütfen devam etmek için giriş yapın</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              Kullanıcı Adı
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Örn: admin veya sezai"
              className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Giriş Yap
              </>
            )}
          </button>
        </form>

        {/* Quick Login / Demo Accounts */}
        <div className="p-4 bg-slate-900/40 border-t border-slate-700/60">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mb-2.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Hızlı Test Girişleri (Tek Tıkla Seç):</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-blue-500/30 text-blue-300 rounded-lg text-left transition-colors flex flex-col"
            >
              <span className="font-bold">admin (Yönetici)</span>
              <span className="text-[10px] text-slate-400">Şifre: admin123</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('sezai', '123')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-left transition-colors flex flex-col"
            >
              <span className="font-bold">sezai (Personel)</span>
              <span className="text-[10px] text-slate-400">Şifre: 123</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('yes', '123')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-left transition-colors flex flex-col"
            >
              <span className="font-bold">yes (Personel)</span>
              <span className="text-[10px] text-slate-400">Şifre: 123</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('burak', '123')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-left transition-colors flex flex-col"
            >
              <span className="font-bold">burak (Personel)</span>
              <span className="text-[10px] text-slate-400">Şifre: 123</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
