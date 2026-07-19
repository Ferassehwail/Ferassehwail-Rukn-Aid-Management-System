import React, { useState, useEffect } from 'react';
import { Employee, SystemNotification } from '../types';
import { getNotifications, markAllNotificationsRead, deleteNotification, addLog } from '../utils/db';

// Subcomponents imports
import StatsView from './StatsView';
import CitizenManagement from './CitizenManagement';
import ExcelImportView from './ExcelImportView';
import AidManagement from './AidManagement';
import CandidatesView from './CandidatesView';
import DeliveryQueueView from './DeliveryQueueView';
import WhatsAppCenter from './WhatsAppCenter';
import CentersView from './CentersView';
import EmployeeManagement from './EmployeeManagement';
import ReportsView from './ReportsView';
import AuditLogView from './AuditLogView';

interface AdminDashboardProps {
  employee: Employee;
  onLogout: () => void;
  onGoToCitizenPortal: () => void;
}

type TabType = 
  | 'stats' 
  | 'citizens' 
  | 'excel' 
  | 'projects' 
  | 'candidates' 
  | 'delivery' 
  | 'whatsapp' 
  | 'centers' 
  | 'employees' 
  | 'reports' 
  | 'audit';

export default function AdminDashboard({ employee, onLogout, onGoToCitizenPortal }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [activeToasts, setActiveToasts] = useState<{ id: string; title: string; message: string; timestamp: number }[]>([]);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  // Set active username in localstorage so other logs pick it up
  useEffect(() => {
    window.localStorage.setItem('alrukn_active_username', employee.username);
  }, [employee]);

  // Load and subscribe to notifications
  const loadNotifs = () => {
    setNotifications(getNotifications());
  };

  useEffect(() => {
    loadNotifs();
    window.addEventListener('alrukn_db_update', loadNotifs);
    return () => window.removeEventListener('alrukn_db_update', loadNotifs);
  }, []);

  // Listen to new notifications and trigger real-time auto-disappearing toasts
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      if (latest.id !== lastNotificationId) {
        setLastNotificationId(latest.id);
        
        // Only show toast if the notification was added recently (within past 15 seconds)
        const ageMs = Date.now() - new Date(latest.date).getTime();
        if (ageMs < 15000) {
          const newToast = {
            id: latest.id,
            title: latest.title,
            message: latest.message,
            timestamp: Date.now()
          };
          setActiveToasts(prev => [newToast, ...prev].slice(0, 5));

          // Automatically hide after 10 seconds
          setTimeout(() => {
            setActiveToasts(prev => prev.filter(t => t.id !== latest.id));
          }, 10000);
        }
      }
    }
  }, [notifications, lastNotificationId]);

  const handleManualDismissToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    setShowNotificationsDropdown(false);
  };

  const handleDeleteNotif = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent closing dropdown
    deleteNotification(id);
  };

  // Helper to restrict tabs depending on Employee Role (RBAC)
  const isAllowed = (tab: TabType): boolean => {
    const role = employee.role;

    if (role === 'admin') return true; // admin can see everything

    switch (tab) {
      case 'stats':
        return ['center_manager', 'auditor', 'monitor', 'delivery'].includes(role);
      case 'citizens':
        return ['center_manager', 'data_entry', 'auditor'].includes(role);
      case 'excel':
        return ['center_manager', 'data_entry'].includes(role);
      case 'projects':
        return ['auditor'].includes(role);
      case 'candidates':
        return ['center_manager', 'data_entry', 'auditor'].includes(role);
      case 'delivery':
        return ['center_manager', 'delivery', 'auditor'].includes(role);
      case 'whatsapp':
        return ['center_manager', 'data_entry'].includes(role);
      case 'centers':
        return ['auditor'].includes(role);
      case 'employees':
        return false; // only admin can manage employees
      case 'reports':
        return ['center_manager', 'auditor', 'monitor'].includes(role);
      case 'audit':
        return ['auditor'].includes(role);
      default:
        return false;
    }
  };

  // Automatically switch tab if default 'stats' is not allowed
  useEffect(() => {
    if (!isAllowed('stats')) {
      if (isAllowed('citizens')) setActiveTab('citizens');
      else if (isAllowed('delivery')) setActiveTab('delivery');
      else if (isAllowed('reports')) setActiveTab('reports');
    }
  }, [employee]);

  // Sidebar Tabs Config
  const tabsConfig: { id: TabType; title: string; icon: string }[] = [
    { id: 'stats', title: 'الإحصائيات العامة', icon: 'fa-solid fa-chart-line' },
    { id: 'citizens', title: 'السجل العائلي للعوائل', icon: 'fa-solid fa-address-book' },
    { id: 'excel', title: 'رفع كشوفات Excel', icon: 'fa-solid fa-file-excel' },
    { id: 'projects', title: 'المشاريع الإغاثية', icon: 'fa-solid fa-folder-tree' },
    { id: 'candidates', title: 'فرز وتأهيل المستفيدين', icon: 'fa-solid fa-user-check' },
    { id: 'delivery', title: 'جدول تسليم المساعدات', icon: 'fa-solid fa-truck-fast' },
    { id: 'whatsapp', title: 'مركز واتساب والرسائل', icon: 'fa-brands fa-whatsapp' },
    { id: 'centers', title: 'مراكز النزوح والإيواء', icon: 'fa-solid fa-house-laptop' },
    { id: 'employees', title: 'الموظفين والصلاحيات', icon: 'fa-solid fa-users-gear' },
    { id: 'reports', title: 'الكشوفات والتقارير', icon: 'fa-solid fa-print' },
    { id: 'audit', title: 'سجل العمليات الأمني', icon: 'fa-solid fa-shield-halved' }
  ];

  // Filter allowed tabs to draw
  const allowedTabs = tabsConfig.filter(t => isAllowed(t.id));

  const handleLogoutAction = () => {
    addLog(employee.name, `تسجيل خروج ناجح من لوحة الإدارة`);
    onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans print:bg-white print:p-0">
      
      {/* 1. Sidebar Panel - Hidden during printing */}
      <aside className="w-full md:w-72 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-l border-slate-800 z-20 print:hidden">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-slate-800 bg-slate-950/40 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-blue-500/15">
              <i className="fa-solid fa-hands-holding-child"></i>
            </div>
            <div>
              <h1 className="text-sm font-black font-cairo text-white leading-tight">منصة الركن الرقمية</h1>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">توزيع المساعدات الإنسانية</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            {allowedTabs.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setShowNotificationsDropdown(false); }}
                className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold font-cairo transition-all flex items-center gap-3 cursor-pointer ${activeTab === t.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <span className="text-sm w-5 text-center"><i className={t.icon}></i></span>
                <span>{t.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* User Info Block at bottom of sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center font-bold text-white text-xs border border-slate-700">
              {employee.name.slice(0, 1)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate leading-snug">{employee.name}</p>
              <span className="text-[10px] text-slate-500 block truncate">@{employee.username}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
            <button
              onClick={onGoToCitizenPortal}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg text-center transition-all cursor-pointer"
            >
              بوابة الاستعلام
            </button>
            <button
              onClick={handleLogoutAction}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1.5 rounded-lg text-center transition-all cursor-pointer"
            >
              خروج الموظف
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <main className="flex-grow flex flex-col min-w-0">
        
        {/* Top Header Navbar - Hidden during printing */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm/5 print:hidden">
          
          <div className="flex items-center gap-2">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-xl text-xs font-black font-cairo">
              {employee.role === 'admin' ? 'الإدارة العامة للمنصة' : 'صلاحية مقيدة ومبرهنة'}
            </span>
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
              | مرحباً بك، الموظف: <span className="font-bold text-slate-800 underline decoration-blue-500 underline-offset-4">{employee.name}</span>
            </span>
          </div>

          <div className="flex items-center gap-4 relative">
            
            {/* Real-time Notification Bell - Interactive Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 transition-colors relative cursor-pointer"
                title="تنبيهات النظام اليومية"
                id="notifications-bell-btn"
              >
                <i className="fa-solid fa-bell text-lg"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-extrabold text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Bell Dropdown */}
              {showNotificationsDropdown && (
                <div className="absolute left-0 mt-2.5 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-40 text-right animate-scale-up">
                  <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <span className="text-xs font-black text-slate-800">إشعارات عمليات النظام</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-blue-600 hover:text-blue-800 text-[10px] font-bold"
                      >
                        تعليم الكل كمقروء
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-3.5 hover:bg-slate-50 transition-colors text-xs space-y-1 cursor-pointer ${!n.read ? 'bg-blue-50/20' : ''}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800">{n.title}</span>
                            <button
                              onClick={(e) => handleDeleteNotif(n.id, e)}
                              className="text-slate-300 hover:text-red-500 text-[10px]"
                              title="حذف"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                          <p className="text-slate-500 text-[11px] leading-relaxed font-medium">{n.message}</p>
                          <span className="text-[9px] text-slate-400 block font-mono">
                            {new Date(n.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-400 space-y-1">
                        <span className="text-2xl block"><i className="fa-solid fa-bell-slash"></i></span>
                        <p className="text-[11px] font-bold">لا يوجد تنبيهات جديدة حالياً.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile widget in navbar */}
            <div className="flex items-center gap-2">
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800">{employee.name}</p>
                <span className="text-[10px] text-slate-400 font-semibold block">{employee.phone}</span>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-700 text-xs border border-slate-200">
                <i className="fa-solid fa-user-tie text-base text-slate-600"></i>
              </div>
            </div>

          </div>
        </header>

        {/* 3. Render Active View Component with customized margins */}
        <div className="flex-grow p-6 md:p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none">
          {activeTab === 'stats' && <StatsView />}
          {activeTab === 'citizens' && <CitizenManagement currentEmployee={employee} />}
          {activeTab === 'excel' && <ExcelImportView currentEmployee={employee} />}
          {activeTab === 'projects' && <AidProgramManagementWrapper />}
          {activeTab === 'candidates' && <CandidatesView currentEmployee={employee} />}
          {activeTab === 'delivery' && <DeliveryQueueView currentEmployee={employee} />}
          {activeTab === 'whatsapp' && <WhatsAppCenter currentEmployee={employee} />}
          {activeTab === 'centers' && <CentersView currentEmployee={employee} />}
          {activeTab === 'employees' && <EmployeeManagement currentEmployee={employee} />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'audit' && <AuditLogView />}
        </div>

      </main>

      {/* Real-time Floating Toast Notifications (Disappear after 10s or manual delete) */}
      {activeToasts.length > 0 && (
        <div className="fixed bottom-6 left-6 z-50 space-y-3 w-80 max-w-full pointer-events-none print:hidden" dir="rtl">
          {activeToasts.map(toast => (
            <div
              key={toast.id}
              className="bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-800/80 pointer-events-auto flex gap-3 items-start animate-slide-in backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-sm shrink-0">
                <i className="fa-solid fa-bell-ring animate-bounce"></i>
              </div>
              <div className="flex-grow space-y-0.5 text-right">
                <h4 className="text-xs font-black font-cairo text-blue-400">{toast.title}</h4>
                <p className="text-[11px] text-slate-200 font-medium leading-relaxed">{toast.message}</p>
                <span className="text-[9px] text-slate-500 block font-mono">يختفي تلقائياً خلال 10 ثوانٍ...</span>
              </div>
              <button
                onClick={() => handleManualDismissToast(toast.id)}
                className="text-slate-500 hover:text-white transition-colors p-1"
                title="إغلاق الإشعار"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// Simple internal Wrapper for AidManagement to keep imports safe
function AidProgramManagementWrapper() {
  const [activeEmp, setActiveEmp] = useState<any>(null);

  useEffect(() => {
    // Lookup current employee role to assign permissions inside AidManagement
    const employees = JSON.parse(localStorage.getItem('alrukn_employees') || '[]');
    const activeUsername = localStorage.getItem('alrukn_active_username') || 'admin';
    const matched = employees.find((e: any) => e.username === activeUsername) || employees[0];
    setActiveEmp(matched);
  }, []);

  if (!activeEmp) return null;
  return <AidManagement currentEmployee={activeEmp} />;
}
