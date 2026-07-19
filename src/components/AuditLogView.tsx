import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { getLogs, addLog } from '../utils/db';

export default function AuditLogView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');

  const loadData = () => {
    setLogs(getLogs());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, []);

  const filteredLogs = logs.filter(l => 
    l.username.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.ip.includes(search)
  );

  const handleClearLogs = () => {
    if (confirm('تنبيه أمني: هل أنت متأكد من مسح كافة سجلات تتبع التدقيق الحالية؟ لا يمكن استرجاعها.')) {
      localStorage.setItem('alrukn_logs', JSON.stringify([]));
      addLog('المدير العام', 'مسح وتصفير سجلات التدقيق والعمليات الأمنية بالنظام');
      loadData();
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-cairo">سجل عمليات وتدقيق النظام الأمني (Audit Trail)</h2>
          <p className="text-slate-500 text-xs mt-1">مراقبة تتبع العمليات، وإدخالات السجلات، والتسليم، وتحديد عناوين الـ IP والموقع الجغرافي للموظفين</p>
        </div>
        <button
          onClick={handleClearLogs}
          className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <i className="fa-solid fa-trash-can"></i>
          تصفير سجل العمليات
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <input
          type="text"
          placeholder="ابحث باسم الموظف، نوع الإجراء، أو عنوان الـ IP لمراجعة التغييرات الأثرية..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-4 pr-11 py-2.5 bg-slate-100 hover:bg-slate-200/50 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl text-xs transition-all outline-none"
        />
        <div className="absolute top-1/2 right-8 -translate-y-1/2 text-slate-400">
          <i className="fa-solid fa-magnifying-glass text-xs"></i>
        </div>
      </div>

      {/* Logs Sheet Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <th className="py-4 px-5">اسم المستخدم / الموظف</th>
                  <th className="py-4 px-5">الإجراء وتفاصيل التغيير</th>
                  <th className="py-4 px-5">تاريخ ووقت المعاملة</th>
                  <th className="py-4 px-5">عنوان الـ IP الحالي</th>
                  <th className="py-4 px-5">متصفح الموظف ونوع الجهاز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/30 transition-all">
                    <td className="py-3 px-5 font-bold text-slate-800">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono">
                        @{l.username}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-bold text-slate-800 text-xs">
                      {l.action}
                    </td>
                    <td className="py-3 px-5 text-slate-400">
                      <span className="font-semibold text-slate-600 ml-1.5">{l.date}</span>
                      <span className="font-mono text-[11px]">{l.time}</span>
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-500 font-medium">
                      {l.ip}
                    </td>
                    <td className="py-3 px-5 text-slate-400 font-mono text-[10px] max-w-xs truncate" title={l.device}>
                      {l.device || 'غير محدد'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <span className="text-4xl block"><i className="fa-solid fa-list-check"></i></span>
            <p className="font-bold">سجل التتبع الأمني فارغ ولا توجد أي عمليات مقيدة حالياً.</p>
          </div>
        )}
      </div>

    </div>
  );
}
