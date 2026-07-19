import React, { useState } from 'react';
import { Employee } from '../types';
import { getEmployees, addLog, saveEmployee } from '../utils/db';

interface AdminLoginProps {
  onLoginSuccess: (employee: Employee) => void;
  onBackToCitizenPortal: () => void;
}

export default function AdminLogin({ onLoginSuccess, onBackToCitizenPortal }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('يرجى كتابة اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);

    // Simulate database lookup latency
    setTimeout(() => {
      let allEmployees = getEmployees();
      let matched = allEmployees.find(
        emp => emp.username.toLowerCase() === cleanUsername.toLowerCase() && emp.password === cleanPassword
      );

      // Fail-safe: if the user typed 'admin' and '123' but it was deleted/modified from localStorage, let's restore it!
      if (!matched && cleanUsername.toLowerCase() === 'admin' && cleanPassword === '123') {
        const defaultAdmin = {
          id: 'emp-1',
          name: 'م. فراس محمد سحويل',
          username: 'admin',
          password: '123',
          phone: '0599555666',
          centerId: '',
          role: 'admin' as const,
          createdAt: new Date().toISOString(),
          status: 'active' as const
        };
        // Save back to db via saveEmployee which triggers Firestore sync
        saveEmployee(defaultAdmin);
        matched = defaultAdmin;
      }

      if (matched) {
        if (matched.status === 'suspended') {
          setError('خطأ: تم إيقاف أو تجميد هذا الحساب مؤقتاً بقرار إداري. يرجى مراجعة م. فراس محمد سحويل.');
          addLog(matched.username, `محاولة دخول فاشلة - الحساب موقوف إدارياً`);
          setLoading(false);
          return;
        }
        // Record login in audit log
        addLog(matched.username, `تسجيل دخول ناجح بصلاحية: ${matched.role}`);
        onLoginSuccess(matched);
      } else {
        setError('خطأ: اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.');
        addLog('مجهول', `محاولة دخول فاشلة باسم المستخدم: ${cleanUsername}`);
      }
      setLoading(false);
    }, 600);
  };

  const handleForgotPassword = () => {
    if (window.Swal) {
      window.Swal.fire({
        icon: 'info',
        title: 'استعادة كلمة المرور',
        text: 'لاستعادة كلمة المرور الخاصة بك أو إعادة تعيينها، يرجى التواصل مع مدير النظام (م. فراس محمد سحويل) أو مسؤول الدعم الفني بالجمعية لإجراء التغيير وتحديث صلاحيتك.',
        confirmButtonText: 'حسناً، فهمت',
        confirmButtonColor: '#1d4ed8'
      });
    } else {
      alert('لاستعادة كلمة المرور الخاصة بك أو إعادة تعيينها، يرجى التواصل مع المدير العام للمنصة (م. فراس محمد سحويل).');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white relative overflow-hidden">
      
      {/* Decorative ambient background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8 z-10 relative overflow-hidden">
        
        {/* Top visual accents */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600"></div>

        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-gradient-to-tr from-blue-600 to-blue-400 text-white p-4 rounded-2xl shadow-xl shadow-blue-500/20 mb-4 items-center justify-center">
            <i className="fa-solid fa-lock-open text-2xl"></i>
          </div>
          <h2 className="text-xl font-black font-cairo">منصة الركن الرقمية</h2>
          <p className="text-slate-400 text-xs mt-1.5">بوابة تسجيل الدخول الآمن للموظفين وإدارة المراكز</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/15 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-xs leading-relaxed flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-base text-red-400"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">اسم المستخدم</label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-4 pr-11 py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl text-sm transition-all text-white outline-none"
                id="admin-username-input"
              />
              <div className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-500 text-base">
                <i className="fa-solid fa-user"></i>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">كلمة المرور</label>
            <div className="relative">
              <input
                type="password"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-11 py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl text-sm transition-all text-white outline-none"
                id="admin-password-input"
              />
              <div className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-500 text-base">
                <i className="fa-solid fa-key"></i>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-400 hover:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 outline-none"
              />
              تذكرني بالجهاز
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              نسيت كلمة المرور؟
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 active:scale-95 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 mt-2 cursor-pointer"
            id="admin-login-submit"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        {/* Back Button */}
        <div className="mt-6 border-t border-slate-800 pt-5 flex flex-col gap-3 text-center">
          <button
            onClick={onBackToCitizenPortal}
            className="text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-arrow-right"></i>
            العودة لبوابة الاستعلام للمواطنين
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm('تنبيه: سيتم مسح جميع بيانات المدخلات التجريبية وإعادة تهيئة السجلات والقوالب إلى حالتها الافتراضية الأولى. هل تريد المتابعة؟')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="text-[10px] text-red-400/70 hover:text-red-400 font-medium transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer mt-1"
          >
            <i className="fa-solid fa-rotate"></i>
            مسح البيانات وإعادة ضبط المصنع
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-slate-500 text-[11px] font-light max-w-sm leading-relaxed z-10">
        جميع الحقوق محفوظة © 2026 لمصمم ومنفذ النظام م. فراس محمد سحويل.
      </div>
    </div>
  );
}
