import React, { useState, useEffect } from 'react';
import { AidProgram, ShelterCenter, Employee } from '../types';
import { 
  getAidPrograms, 
  getCenters, 
  saveAidProgram, 
  deleteAidProgram, 
  addLog, 
  getEmployees 
} from '../utils/db';
import { 
  signInWithGoogleForCalendar, 
  createOrUpdateCalendarEvent, 
  deleteCalendarEvent, 
  GoogleUser 
} from '../utils/googleCalendar';

interface AidManagementProps {
  currentEmployee: { name: string; role: string; centerId: string };
}

export default function AidManagement({ currentEmployee }: AidManagementProps) {
  const [programs, setPrograms] = useState<AidProgram[]>([]);
  const [centers, setCenters] = useState<ShelterCenter[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Google Calendar integration states
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [syncToCalendar, setSyncToCalendar] = useState(true);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AidProgram | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('طرد غذائي');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState('150');
  const [unitCount, setUnitCount] = useState('100');
  const [targetCategories, setTargetCategories] = useState<string[]>([]);
  const [targetCenters, setTargetCenters] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'completed'>('active');

  const categories = [
    'أسر فقيرة',
    'أرامل',
    'أيتام',
    'ذوي إعاقة',
    'كبار السن',
    'مرضى',
    'نازحون',
    'حالات إنسانية'
  ];

  const loadData = () => {
    setPrograms(getAidPrograms());
    setCenters(getCenters());
    setEmployees(getEmployees());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, []);

  // Restore Google connection from session storage on mount
  useEffect(() => {
    const cached = sessionStorage.getItem('alrukn_google_user');
    if (cached) {
      try {
        setGoogleUser(JSON.parse(cached));
      } catch (e) {
        console.error('Error loading Google User cache:', e);
      }
    }
  }, []);

  // Connect Google account handler
  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    try {
      const user = await signInWithGoogleForCalendar();
      setGoogleUser(user);
      sessionStorage.setItem('alrukn_google_user', JSON.stringify(user));
      addLog(currentEmployee.name, `ربط حساب تقويم Google بنجاح: ${user.email}`);

      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: 'اكتمل الربط بنجاح',
          text: `تم ربط تقويم جوجل بحساب: ${user.email} بنجاح. يمكنك الآن جدولة ومزامنة المواعيد مع الموظفين.`,
          confirmButtonColor: '#2563eb'
        });
      }
    } catch (err: any) {
      console.error(err);
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'فشل ربط الحساب',
          text: err.message || 'تعذر استرجاع صلاحية الوصول من جوجل. يرجى تجربة المحاولة مرة أخرى.',
          confirmButtonColor: '#dc2626'
        });
      }
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  // Disconnect Google account handler
  const handleUnlinkGoogle = () => {
    setGoogleUser(null);
    sessionStorage.removeItem('alrukn_google_user');
    addLog(currentEmployee.name, 'إلغاء ربط حساب تقويم Google');
    if (window.Swal) {
      window.Swal.fire({
        icon: 'info',
        title: 'تم إلغاء الربط',
        text: 'تم فصل حساب Google Calendar اللحظي عن النظام.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const handleOpenAdd = () => {
    setEditingProgram(null);
    setName('');
    setType('طرد غذائي');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setValue('150');
    setUnitCount('100');
    setTargetCategories(['أسر فقيرة']);
    setTargetCenters(centers.map(c => c.id));
    setNotes('');
    setStatus('active');
    setShowForm(true);
  };

  const handleOpenEdit = (p: AidProgram) => {
    setEditingProgram(p);
    setName(p.name);
    setType(p.type);
    setStartDate(p.startDate);
    setEndDate(p.endDate);
    setValue(String(p.value));
    setUnitCount(String(p.unitCount));
    setTargetCategories(p.targetCategories);
    setTargetCenters(p.targetCenters);
    setNotes(p.notes);
    setStatus(p.status);
    setShowForm(true);
  };

  const handleToggleCategory = (cat: string) => {
    if (targetCategories.includes(cat)) {
      setTargetCategories(targetCategories.filter(c => c !== cat));
    } else {
      setTargetCategories([...targetCategories, cat]);
    }
  };

  const handleToggleCenter = (centerId: string) => {
    if (targetCenters.includes(centerId)) {
      setTargetCenters(targetCenters.filter(id => id !== centerId));
    } else {
      setTargetCenters([...targetCenters, centerId]);
    }
  };

  // Handle program creation / updates + Calendar Sync
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || targetCategories.length === 0 || targetCenters.length === 0) {
      alert('يرجى كتابة اسم المشروع واختيار فئة استهداف واحدة ومركز إيواء واحد على الأقل.');
      return;
    }

    const programData: AidProgram = {
      id: editingProgram ? editingProgram.id : `aid-${Date.now()}`,
      name: name.trim(),
      type,
      startDate,
      endDate,
      value: parseFloat(value) || 0,
      unitCount: parseInt(unitCount) || 0,
      targetCategories,
      targetCenters,
      notes: notes.trim(),
      status,
      createdAt: editingProgram ? editingProgram.createdAt : new Date().toISOString(),
      calendarEventId: editingProgram?.calendarEventId
    };

    // 1. Initial local save
    saveAidProgram(programData);
    addLog(currentEmployee.name, `${editingProgram ? 'تعديل' : 'إنشاء'} برنامج المساعدة الإغاثية: ${programData.name}`);

    // 2. Perform programmatic Google Calendar Sync if requested and authenticated
    let syncSucceeded = false;
    if (googleUser && syncToCalendar) {
      if (window.Swal) {
        window.Swal.fire({
          title: 'جاري مزامنة المواعيد...',
          text: 'يتم الآن جدولة وإرسال التنبيهات البريدية للموظفين المعنيين بمراكز الإيواء عبر Google Calendar...',
          allowOutsideClick: false,
          didOpen: () => {
            window.Swal.showLoading();
          }
        });
      }

      try {
        const eventId = await createOrUpdateCalendarEvent(programData, centers, employees, googleUser.accessToken);
        programData.calendarEventId = eventId;
        // Save again with the returned Calendar Event ID to allow programmatical updates next time!
        saveAidProgram(programData);
        syncSucceeded = true;
        addLog(currentEmployee.name, `تمت جدولة ومزامنة المواعيد مع تقويم جوجل: ${programData.name}`);
      } catch (err: any) {
        console.error('Calendar Sync Error:', err);
        syncSucceeded = false;
      }
    }

    setShowForm(false);
    setEditingProgram(null);
    loadData();

    // Show beautiful confirmation dialog
    if (window.Swal) {
      window.Swal.close();
      if (googleUser && syncToCalendar) {
        if (syncSucceeded) {
          window.Swal.fire({
            icon: 'success',
            title: 'تم الحفظ والمزامنة بنجاح',
            text: 'تمت جدولة المواعيد وتلقي الموظفين بريد المزامنة التلقائي بجدول التوزيع بنجاح.',
            timer: 3000,
            showConfirmButton: false
          });
        } else {
          window.Swal.fire({
            icon: 'warning',
            title: 'تم الحفظ محلياً فقط',
            text: 'تم تسجيل المشروع الإغاثي محلياً بنجاح، ولكن تعذر الاتصال بتقاويم جوجل. يرجى تجربة مزامنتها يدوياً لاحقاً.',
            confirmButtonColor: '#f59e0b'
          });
        }
      } else {
        window.Swal.fire({
          icon: 'success',
          title: 'تم حفظ المشروع الإغاثي',
          text: 'تم جدولة المشروع واستهداف فئات المستفيدين بنجاح.',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } else {
      alert('تم حفظ وتجهيز المشروع بنجاح.');
    }
  };

  // Manual Programmatic sync button handler on the card
  const handleManualSync = async (p: AidProgram) => {
    if (!googleUser) {
      if (window.Swal) {
        window.Swal.fire({
          icon: 'info',
          title: 'ربط الحساب أولاً',
          text: 'يرجى تسجيل الدخول وربط حساب Google الخاص بك عبر الشريط العلوي للمنصة للبدء في جدولة المواعيد.',
          confirmButtonColor: '#2563eb'
        });
      } else {
        alert('يرجى ربط تقويم جوجل أولاً من الشريط العلوي.');
      }
      return;
    }

    if (window.Swal) {
      window.Swal.fire({
        title: 'جاري تحديث المواعيد برمجياً...',
        text: 'يتم إرسال ومزامنة التعديلات اللحظية للموظفين...',
        allowOutsideClick: false,
        didOpen: () => {
          window.Swal.showLoading();
        }
      });
    }

    try {
      const eventId = await createOrUpdateCalendarEvent(p, centers, employees, googleUser.accessToken);
      const updated = { ...p, calendarEventId: eventId };
      saveAidProgram(updated);
      loadData();

      if (window.Swal) {
        window.Swal.close();
        window.Swal.fire({
          icon: 'success',
          title: 'تمت المزامنة بنجاح',
          text: 'تم تحديث مواعيد التوزيع وتنبيه الموظفين برمجياً على تقاويم هواتفهم بنجاح.',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (err: any) {
      console.error(err);
      if (window.Swal) {
        window.Swal.close();
        window.Swal.fire({
          icon: 'error',
          title: 'فشلت مزامنة Google Calendar',
          text: err.message || 'تعذر الاتصال بخوادم Google API. يرجى إعادة ربط الحساب وتجربة المحاولة.',
          confirmButtonColor: '#dc2626'
        });
      }
    }
  };

  // Handles program deletion + Calendar event deletion (programmatic cleanup)
  const handleDelete = async (id: string, pName: string, calendarEventId?: string) => {
    if (confirm(`هل أنت متأكد من حذف مشروع (${pName}) نهائياً من النظام؟`)) {
      if (googleUser && calendarEventId) {
        try {
          await deleteCalendarEvent(calendarEventId, googleUser.accessToken);
        } catch (e) {
          console.error('Failed to clean up Google Calendar event on deletion:', e);
        }
      }
      deleteAidProgram(id);
      addLog(currentEmployee.name, `حذف مشروع المساعدات: ${pName}`);
      loadData();
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in font-sans">
      
      {/* Google Calendar Status Banner / Bar */}
      <div className={`p-4 rounded-3xl border transition-all ${googleUser ? 'bg-emerald-50/70 border-emerald-100 text-emerald-900' : 'bg-slate-50 border-slate-100 text-slate-700'} flex flex-col md:flex-row justify-between items-center gap-4`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${googleUser ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'} flex items-center justify-center shadow-md`}>
            <i className="fa-solid fa-calendar-check text-base"></i>
          </div>
          <div>
            {googleUser ? (
              <p className="text-xs font-bold leading-relaxed">
                <span>تم ربط التقويم بنجاح: </span>
                <span className="font-mono text-blue-700 bg-white/60 px-2 py-0.5 rounded border border-blue-100/50">{googleUser.email}</span>
                <span className="text-slate-500 mr-2">| سيقوم النظام بجدولة مواعيد التوزيع وإرسال تنبيهات تلقائية لبريد الموظفين بالمركز تلقائياً.</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong className="text-slate-800 block">تكامل التنبيهات المجدولة ومزامنة الموظفين مع Google Calendar:</strong>
                اربط حساب جوجل وجدول مواعيد التوزيع لتنبيه الموظفين تلقائياً على بريدهم وهواتفهم بدقة.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {googleUser ? (
            <button
              onClick={handleUnlinkGoogle}
              className="bg-white hover:bg-red-50 border border-slate-200 text-red-600 text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-link-slash"></i>
              <span>فصل حساب Google</span>
            </button>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={isLinkingGoogle}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black py-2.5 px-5 rounded-xl shadow-lg shadow-blue-500/10 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isLinkingGoogle ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>جاري ربط حسابك...</span>
                </>
              ) : (
                <>
                  <i className="fa-brands fa-google"></i>
                  <span>ربط ومزامنة Google Calendar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-cairo">إدارة حزم ومشاريع المساعدات الإنسانية</h2>
          <p className="text-slate-500 text-xs mt-1">إنشاء طرود جديدة وتصنيف معايير الاستحقاق للفئات والبدء الفوري بالتوزيع وجدولة التقويم للموظفين</p>
        </div>
        {(currentEmployee.role === 'admin' || currentEmployee.role === 'auditor') && (
          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-600/10 active:scale-95 cursor-pointer"
          >
            <i className="fa-solid fa-folder-plus"></i>
            إنشاء مشروع إغاثي جديد
          </button>
        )}
      </div>

      {/* Grid of Programs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {programs.map((p) => (
          <div key={p.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-600"></div>
            
            {/* Card Header */}
            <div className="p-6 pb-4 border-b border-slate-50 flex justify-between items-start">
              <div>
                <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-md block w-fit mb-2">
                  {p.type}
                </span>
                <h3 className="font-extrabold text-slate-800 text-base leading-snug">{p.name}</h3>
                <p className="text-slate-400 text-xs mt-1.5"><i className="fa-solid fa-calendar-days ml-1"></i> فترة الصلاحية: {p.startDate} إلى {p.endDate}</p>
              </div>
              
              <div className="flex flex-col items-end gap-1.5">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {p.status === 'active' ? 'نشط وقيد التوزيع' : 'مكتمل ومغلق'}
                </span>
                {p.calendarEventId && (
                  <span className="bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1" title="مربوط ومجدول مع تقويم جوجل">
                    <i className="fa-brands fa-google text-[10px]"></i>
                    مجدول بجوجل
                  </span>
                )}
              </div>
            </div>

            {/* Target info */}
            <div className="p-6 py-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1 font-bold">الفئات المستهدفة:</span>
                <div className="flex flex-wrap gap-1">
                  {p.targetCategories.map((cat, idx) => (
                    <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">{cat}</span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-bold">مراكز الإيواء المشمولة بالتلقي:</span>
                <div className="flex flex-wrap gap-1">
                  {p.targetCenters.map((cid, idx) => {
                    const centerObj = centers.find(c => c.id === cid);
                    return (
                      <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                        {centerObj ? centerObj.name : 'مركز عام'}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100/60 text-center">
                <div>
                  <span className="text-slate-400 block text-[10px]">القيمة التقديرية</span>
                  <span className="text-slate-800 font-black text-sm">{p.value} شيكل</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">عدد الطرود المجهزة</span>
                  <span className="text-slate-800 font-black text-sm">{p.unitCount} طرد / كرتونة</span>
                </div>
              </div>

              {p.notes && (
                <p className="text-slate-500 bg-slate-100/40 p-2.5 rounded-lg border border-dashed border-slate-200/50 italic whitespace-pre-wrap">{p.notes}</p>
              )}
            </div>

            {/* Actions Footer */}
            <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex justify-between items-center">
              
              {/* Left Action: Google Sync */}
              <div>
                <button
                  onClick={() => handleManualSync(p)}
                  className={`text-[11px] font-bold py-1.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${p.calendarEventId ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}
                  title="مزامنة وتحديث المواعيد وتنبيه الموظفين برمجياً مع Google Calendar"
                >
                  <i className="fa-solid fa-rotate"></i>
                  <span>{p.calendarEventId ? 'تحديث تقويم جوجل برمجياً' : 'مزامنة تقويم جوجل الآن'}</span>
                </button>
              </div>

              {/* Right Actions: CRUD */}
              {(currentEmployee.role === 'admin' || currentEmployee.role === 'auditor') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-edit ml-1"></i>
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name, p.calendarEventId)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-trash ml-1"></i>
                    حذف
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-scale-up">
            
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-lg font-black font-cairo text-slate-800">
                {editingProgram ? 'تعديل مشروع المساعدة' : 'تجهيز مشروع إغاثي جديد'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingProgram(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1.5 text-lg"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-500 font-bold mb-1 block">اسم المشروع الإغاثي *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: مشروع سلة اللحوم الطازجة"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 font-bold mb-1 block">نوع المساعدة</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none font-bold text-blue-700"
                  >
                    <option value="طرد غذائي">طرد غذائي متكامل</option>
                    <option value="طرد خضار ولحوم">طرد خضار ولحوم طازجة</option>
                    <option value="قسيمة كسوة">قسيمة كسوة ملابس</option>
                    <option value="مساعدة مالية نقدية">مساعدة مالية نقدية (كاش)</option>
                    <option value="طرد صحي">طرد مستلزمات نظافة</option>
                    <option value="وجبات جاهزة">وجبات طعام جاهزة مجهزة</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 font-bold mb-1 block">تاريخ بداية التوزيع</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 font-bold mb-1 block">تاريخ نهاية التوزيع</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 font-bold mb-1 block">قيمة المساعدة (بالشيكل / دولار)</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 font-bold mb-1 block">إجمالي عدد الطرود المجهزة</label>
                  <input
                    type="number"
                    value={unitCount}
                    onChange={(e) => setUnitCount(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              {/* Targets select */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-500 font-bold block">الفئات المستهدفة للاستحقاق التلقائي *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {categories.map((cat) => {
                    const isChecked = targetCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleCategory(cat)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center ${isChecked ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Centers select */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-500 font-bold block">مراكز الإيواء المشمولة بالتسليم *</label>
                <div className="space-y-1">
                  {centers.map((c) => {
                    const isChecked = targetCenters.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleCenter(c.id)}
                        className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold border transition-all text-right flex justify-between items-center ${isChecked ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        <span>{c.name} ({c.location})</span>
                        {isChecked && <i className="fa-solid fa-circle-check text-emerald-600"></i>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-bold mb-1 block">ملاحظات وشروط المشروع</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات أو قائمة التوريدات المشمولة للشركاء..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                ></textarea>
              </div>

              {editingProgram && (
                <div>
                  <label className="text-[11px] text-slate-500 font-bold mb-1 block">حالة التوزيع</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none font-bold"
                  >
                    <option value="active">نشط وقيد التوزيع</option>
                    <option value="completed">مكتمل ومغلق</option>
                  </select>
                </div>
              )}

              {/* Automatic google calendar sync option */}
              {googleUser && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <strong className="text-blue-800 font-bold block">مزامنة تلقائية للمواعيد</strong>
                    <span className="text-[10px] text-slate-500">سيقوم النظام بربط التواريخ مع Google Calendar للموظفين تلقائياً فور الحفظ.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={syncToCalendar}
                    onChange={(e) => setSyncToCalendar(e.target.checked)}
                    className="w-4 h-4 text-blue-600 focus:ring-0 rounded border-slate-300"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingProgram(null); }}
                  className="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl text-xs transition-all shadow-md shadow-blue-100 cursor-pointer"
                >
                  حفظ وتجهيز المشروع
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
