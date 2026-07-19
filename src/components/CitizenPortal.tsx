import React, { useState, useEffect } from 'react';
import { Family, FamilyMember, ShelterCenter, DeliveryRecord, AidProgram } from '../types';
import { getFamilies, getCenters, getDeliveries, getAidPrograms, saveFamily, addLog } from '../utils/db';

interface CitizenPortalProps {
  onAdminLoginClick: () => void;
}

export default function CitizenPortal({ onAdminLoginClick }: CitizenPortalProps) {
  const [nationalId, setNationalId] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);
  const [family, setFamily] = useState<Family | null>(null);
  const [center, setCenter] = useState<ShelterCenter | null>(null);
  const [aidHistory, setAidHistory] = useState<(DeliveryRecord & { aidName: string; aidType: string })[]>([]);
  
  // Citizen add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [newMemberGender, setNewMemberGender] = useState<'male' | 'female'>('male');
  const [newMemberRelation, setNewMemberRelation] = useState('ابن');
  const [tempMembers, setTempMembers] = useState<FamilyMember[]>([]);
  const [formError, setFormError] = useState('');

  // Handle Search
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError('');
    setSearched(false);
    setFamily(null);
    setCenter(null);
    setAidHistory([]);
    setShowAddForm(false);
    setTempMembers([]);

    const cleanId = nationalId.trim();
    if (!cleanId) {
      setSearchError('الرجاء إدخال رقم الهوية للبحث.');
      return;
    }

    if (!/^\d+$/.test(cleanId)) {
      setSearchError('رقم الهوية يجب أن يحتوي على أرقام فقط.');
      return;
    }

    if (cleanId.length !== 9) {
      setSearchError('رقم الهوية يجب أن يتكون من 9 خانات بالضبط.');
      return;
    }

    // Search families
    const allFamilies = getFamilies();
    
    // Check if the searched ID belongs to a head of family, a spouse, or any family member
    const foundFamily = allFamilies.find(f => 
      f.id === cleanId || 
      f.spouseId === cleanId || 
      f.membersList.some(m => m.id === cleanId)
    );

    if (!foundFamily) {
      setSearchError('عذراً، لم يتم العثور على أي بيانات مسجلة برقم الهوية هذا. يرجى مراجعة إدارة المعبر أو مركز الإيواء للتسجيل.');
      return;
    }

    // If ID is found but is a member/spouse rather than head, inform them they are registered with the family
    let idNotice = '';
    if (foundFamily.id !== cleanId) {
      if (foundFamily.spouseId === cleanId) {
        idNotice = `رقم الهوية المدخل مسجل للزوجة (${foundFamily.spouseName}) مضافاً إلى عائلة رب الأسرة: ${foundFamily.headName}`;
      } else {
        const memberObj = foundFamily.membersList.find(m => m.id === cleanId);
        idNotice = `رقم الهوية المدخل مسجل للابن/التابع (${memberObj?.name}) مضافاً إلى عائلة رب الأسرة: ${foundFamily.headName}`;
      }
    }

    setFamily(foundFamily);
    setSearched(true);

    // Get shelter center details
    const allCenters = getCenters();
    const foundCenter = allCenters.find(c => c.id === foundFamily.centerId);
    if (foundCenter) {
      setCenter(foundCenter);
    }

    // Get Delivery History
    const allDeliveries = getDeliveries();
    const allAids = getAidPrograms();
    const history = allDeliveries
      .filter(d => d.familyId === foundFamily.id)
      .map(d => {
        const program = allAids.find(p => p.id === d.aidProgramId);
        return {
          ...d,
          aidName: program ? program.name : 'مساعدة إنسانية عاجلة',
          aidType: program ? program.type : 'طرد طوارئ'
        };
      });
    setAidHistory(history);

    if (idNotice && window.Swal) {
      window.Swal.fire({
        icon: 'info',
        title: 'تنبيه مضاف عائلياً',
        text: idNotice,
        confirmButtonText: 'حسناً، عرض ملف العائلة',
        confirmButtonColor: '#1d4ed8'
      });
    }

    addLog('مواطن', `بحث بصفحة المواطن عن رقم هوية: ${cleanId}`);
  };

  // Restrict ID input to numbers and max 9 length
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 9) {
      setNationalId(val);
    }
  };

  // Add family member (Client-Side update for first time)
  const handleAddTempMember = () => {
    setFormError('');
    const mName = newMemberName.trim();
    const mId = newMemberId.trim();
    const mAge = parseInt(newMemberAge);

    if (!mName || !mId || !newMemberAge) {
      setFormError('الرجاء تعبئة جميع حقول الفرد.');
      return;
    }

    if (!/^\d{9}$/.test(mId)) {
      setFormError('رقم هوية الفرد يجب أن يتكون من 9 أرقام.');
      return;
    }

    if (isNaN(mAge) || mAge < 0 || mAge > 120) {
      setFormError('عمر الفرد غير صحيح.');
      return;
    }

    // Check if duplicate in temp list
    if (tempMembers.some(m => m.id === mId) || family?.id === mId || family?.spouseId === mId || family?.membersList.some(m => m.id === mId)) {
      setFormError('رقم الهوية هذا مضاف مسبقاً في هذه العائلة.');
      return;
    }

    // Validate unique ID against other families in database
    const allFamilies = getFamilies();
    const duplicateFamily = allFamilies.find(f => 
      f.id === mId || f.spouseId === mId || f.membersList.some(m => m.id === mId)
    );

    if (duplicateFamily) {
      setFormError(`خطأ: رقم الهوية مسجل مسبقاً في عائلة أخرى لرب الأسرة: ${duplicateFamily.headName}`);
      
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'الاسم مكرر بالنظام!',
          text: `رقم الهوية ${mId} مسجل كعضو أو رب أسرة ضمن عائلة أخرى بمركز الإيواء باسم العائلة: (${duplicateFamily.headName})`,
          confirmButtonText: 'مفهوم',
          confirmButtonColor: '#ef4444'
        });
      }
      return;
    }

    const newMember: FamilyMember = {
      id: mId,
      name: mName,
      age: mAge,
      relation: newMemberRelation,
      gender: newMemberGender
    };

    setTempMembers([...tempMembers, newMember]);
    setNewMemberName('');
    setNewMemberId('');
    setNewMemberAge('');
  };

  const handleRemoveTempMember = (index: number) => {
    setTempMembers(tempMembers.filter((_, i) => i !== index));
  };

  // Submit locked family additions
  const handleSubmitMembers = () => {
    if (!family) return;

    const updatedMembersList = [...family.membersList, ...tempMembers];
    
    // Recalculate genders and children (age < 18)
    const childrenCount = updatedMembersList.filter(m => m.age < 18).length;
    const malesCount = (family.membersList.some(m => m.gender === 'male') ? 1 : 0) + 
                       (family.gender === 'male' || family.socialStatus !== 'أرملة' ? 1 : 0) + 
                       updatedMembersList.filter(m => m.gender === 'male').length;
                       
    const femalesCount = (family.spouseName ? 1 : 0) + 
                         (family.socialStatus === 'أرملة' ? 1 : 0) + 
                         updatedMembersList.filter(m => m.gender === 'female').length;

    const updatedFamily: Family = {
      ...family,
      membersList: updatedMembersList,
      membersCount: 1 + (family.spouseName ? 1 : 0) + updatedMembersList.length,
      childrenCount,
      canAddMembers: false, // Lock after first save
      notes: `${family.notes}\n[تم إضافة ${tempMembers.length} أفراد بواسطة المواطن بـ ${new Date().toLocaleDateString('ar-EG')}]`
    };

    const res = saveFamily(updatedFamily);
    if (res.success) {
      setFamily(updatedFamily);
      setTempMembers([]);
      setShowAddForm(false);
      addLog('مواطن', `إضافة أفراد للعائلة ذاتياً لرب الأسرة: ${family.headName}`);
      
      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: 'تم حفظ الأفراد بنجاح',
          text: 'تم إدراج الأفراد وقفل التعديل التلقائي. لا يمكن تعديل البيانات مستقبلاً إلا بمراجعة إدارة المركز.',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#10b981'
        });
      }
    } else {
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'فشل الحفظ',
          text: res.message,
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#ef4444'
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50">
      {/* Top Header Section */}
      <header className="bg-gradient-to-r from-blue-800 to-blue-600 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="max-w-7xl mx-auto px-4 py-8 relative z-10 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-4 text-center md:text-right mb-6 md:mb-0">
            <div className="bg-white text-blue-800 p-3.5 rounded-2xl shadow-xl flex items-center justify-center border border-blue-100">
              <i className="fa-solid fa-hand-holding-heart text-3xl"></i>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-cairo">منصة الركن</h1>
              <p className="text-blue-100 text-sm md:text-base font-light mt-1">لإدارة وتسليم المساعدات الإنسانية وتتبع كشوفات التوزيع</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onAdminLoginClick} 
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-sm"
              id="admin-portal-btn"
            >
              <i className="fa-solid fa-user-shield"></i>
              بوابة الإدارة والموظفين
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-12">
        
        {/* Welcome and Search Block */}
        <section className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-600"></div>
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">استعلام المواطنين عن المساعدات والنزوح</h2>
            <p className="text-slate-500 text-sm mt-2">الرجاء إدخال رقم هوية رب الأسرة أو الزوجة أو أحد أفراد العائلة للتحقق من البيانات وحالة الاستلام ومواقع الإيواء</p>
          </div>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <input
                  type="text"
                  maxLength={9}
                  value={nationalId}
                  onChange={handleIdChange}
                  placeholder="أدخل رقم الهوية (9 خانات)"
                  className="w-full pl-4 pr-12 py-4 bg-slate-100 focus:bg-white border-2 border-transparent focus:border-blue-500 rounded-2xl text-lg font-bold text-slate-800 tracking-widest text-center transition-all outline-none"
                  id="citizen-id-search-input"
                />
                <div className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 text-xl">
                  <i className="fa-solid fa-id-card"></i>
                </div>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2"
                id="citizen-search-btn"
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                <span>ابحـث الآن</span>
              </button>
            </div>
            {searchError && (
              <div className="mt-4 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-base"></i>
                <span>{searchError}</span>
              </div>
            )}
          </form>
        </section>

        {/* Results Card */}
        {searched && family && (
          <div className="space-y-6">
            
            {/* Family Profile Section */}
            <section className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative">
              
              {/* Card Ribbon / Header Status */}
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-xl"><i className="fa-solid fa-users"></i></span>
                  <h3 className="text-lg font-bold text-slate-800">بطاقة العائلة الرقمية الموحدة</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">حالة الملف:</span>
                  {family.status === 'active' ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      نشط ومعتمد
                    </span>
                  ) : family.status === 'review' ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      قيد المراجعة والتدقيق
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      موقوف مؤقتاً
                    </span>
                  )}
                </div>
              </div>

              {/* Data Grid */}
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1 */}
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-400 text-xs">اسم رب الأسرة رباعي</label>
                    <p className="text-slate-800 font-bold text-lg">{family.headName}</p>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs">رقم هوية رب الأسرة</label>
                    <p className="text-slate-600 font-bold tracking-wider">{family.id}</p>
                  </div>
                  {family.spouseName && (
                    <>
                      <div>
                        <label className="text-slate-400 text-xs">اسم الزوجة الكامل رباعي</label>
                        <p className="text-slate-800 font-bold">{family.spouseName}</p>
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs">رقم هوية الزوجة</label>
                        <p className="text-slate-600 font-bold tracking-wider">{family.spouseId}</p>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-400 text-xs block truncate">أفراد الأسرة</label>
                      <p className="text-slate-800 font-extrabold text-lg">{family.membersCount} أشخاص</p>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs block truncate">عدد الأطفال</label>
                      <p className="text-slate-800 font-extrabold text-lg">{family.childrenCount} أطفال</p>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs block truncate">ذكور / إناث</label>
                      <p className="text-slate-800 font-semibold text-sm">
                        {family.malesCount} ذ / {family.femalesCount} إ
                      </p>
                    </div>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4 border-t md:border-t-0 md:border-r border-slate-100 pt-4 md:pt-0 md:pr-6">
                  <div>
                    <label className="text-slate-400 text-xs">رقم الملف العائلي</label>
                    <p className="text-blue-700 font-bold tracking-wider">{family.fileNumber}</p>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs">الفئة وتصنيف الاستحقاق</label>
                    <p className="text-slate-800 font-bold">
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm">
                        {family.category}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs">مركز النزوح / الإيواء الحالي</label>
                    <p className="text-slate-800 font-bold">{center ? center.name : 'لم يتم تحديد مركز إيواء'}</p>
                    {center && <p className="text-slate-400 text-xs mt-1"><i className="fa-solid fa-location-dot"></i> {center.location}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 text-xs">تاريخ التسجيل</label>
                      <p className="text-slate-600 font-semibold text-sm">
                        {new Date(family.createdAt).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs">رقم الجوال</label>
                      <p className="text-slate-600 font-semibold text-sm">{family.phone}</p>
                    </div>
                  </div>
                </div>

                {family.notes && (
                  <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <label className="text-slate-400 text-xs block mb-1">ملاحظات الحالة وتفاصيل التقييم</label>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{family.notes}</p>
                  </div>
                )}
              </div>

              {/* Members List Toggle */}
              {family.membersList.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-6">
                  <h4 className="text-sm font-bold text-slate-700 mb-3"><i className="fa-solid fa-id-card-clip ml-1 text-slate-400"></i> قائمة التابعين والأفراد المضافين بالملف:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {family.membersList.map((m, index) => (
                      <div key={index} className="bg-white border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{m.name}</p>
                          <p className="text-xs text-slate-400 mt-1">الهوية: {m.id} | الصلة: {m.relation}</p>
                        </div>
                        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {m.gender === 'male' ? 'ذكر' : 'أنثى'} ({m.age} سنة)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citizen Add Member Button Block */}
              {family.canAddMembers && (
                <div className="border-t border-slate-100 bg-blue-50/40 p-6 flex flex-col items-center justify-between gap-4 md:flex-row">
                  <div>
                    <h4 className="font-bold text-blue-800 text-sm">هل تود إضافة أفراد جدد لملفك العائلي؟</h4>
                    <p className="text-xs text-blue-600 mt-1">يسمح لك النظام بإدراج الزوجة والأبناء لأول مرة بنفسك لتفادي طوابير الانتظار.</p>
                  </div>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm"
                  >
                    <i className={`fa-solid ${showAddForm ? 'fa-minus' : 'fa-plus'}`}></i>
                    {showAddForm ? 'إلغاء الإضافة الذاتية' : 'إضافة أفراد الآن'}
                  </button>
                </div>
              )}

              {/* Citizen Add Member Interactive Form */}
              {showAddForm && family.canAddMembers && (
                <div className="border-t border-slate-100 p-6 bg-slate-100/50 space-y-6">
                  <div className="bg-white border border-blue-100 rounded-2xl p-5 space-y-4 shadow-sm">
                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
                      <i className="fa-solid fa-user-plus ml-1 text-blue-600"></i> تعبئة بيانات الفرد الجديد للأسرة
                    </h4>

                    {formError && (
                      <div className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <span>{formError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">الاسم رباعي للفرد الجديد</label>
                        <input
                          type="text"
                          placeholder="الاسم رباعي"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">رقم الهوية (9 خانات)</label>
                        <input
                          type="text"
                          maxLength={9}
                          placeholder="رقم الهوية"
                          value={newMemberId}
                          onChange={(e) => setNewMemberId(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">العمر (سنوات)</label>
                        <input
                          type="number"
                          placeholder="العمر"
                          value={newMemberAge}
                          onChange={(e) => setNewMemberAge(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">صلة القرابة</label>
                        <select
                          value={newMemberRelation}
                          onChange={(e) => setNewMemberRelation(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                        >
                          <option value="ابن">ابن</option>
                          <option value="ابنة">ابنة</option>
                          <option value="زوجة">زوجة ثانية</option>
                          <option value="والد">والد</option>
                          <option value="والدة">والدة</option>
                          <option value="أخ">أخ</option>
                          <option value="أخت">أخت</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-4">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="gender"
                            checked={newMemberGender === 'male'}
                            onChange={() => setNewMemberGender('male')}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          ذكر
                        </label>
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="gender"
                            checked={newMemberGender === 'female'}
                            onChange={() => setNewMemberGender('female')}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          أنثى
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddTempMember}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <i className="fa-solid fa-plus"></i>
                        أدرج بقائمة الإضافة
                      </button>
                    </div>
                  </div>

                  {/* Temp Members List Preview */}
                  {tempMembers.length > 0 && (
                    <div className="bg-white border border-dashed border-blue-200 rounded-2xl p-5 space-y-4">
                      <h5 className="text-sm font-bold text-blue-800"><i className="fa-solid fa-list-check ml-1"></i> الأعضاء الجدد المطلوب إضافتهم للملف:</h5>
                      <div className="divide-y divide-slate-100">
                        {tempMembers.map((m, index) => (
                          <div key={index} className="py-3 flex justify-between items-center">
                            <div>
                              <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                              <span className="text-xs text-slate-400 mr-2">({m.relation} | هوية {m.id} | العمر: {m.age} سنة)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTempMember(index)}
                              className="text-red-500 hover:text-red-700 p-1 text-sm"
                              title="حذف"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTempMembers([])}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                        >
                          إلغاء الكل
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitMembers}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-100 flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-floppy-disk"></i>
                          حفظ وإقفال الملف نهائياً
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Received Aid Section */}
            <section className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-500 text-xl"><i className="fa-solid fa-box-open"></i></span>
                  <h3 className="text-lg font-bold text-slate-800">سجل المساعدات الإنسانية المستلمة (للقراءة فقط)</h3>
                </div>
                <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md font-medium">سجل رسمي غير قابل للتعديل</span>
              </div>

              {aidHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100/50 text-slate-500 border-b border-slate-100">
                        <th className="py-4 px-6 font-bold">اسم المساعدة</th>
                        <th className="py-4 px-6 font-bold">النوع</th>
                        <th className="py-4 px-6 font-bold">اسم المستلم الفعلي</th>
                        <th className="py-4 px-6 font-bold">رقم الهوية للمستلم</th>
                        <th className="py-4 px-6 font-bold">تاريخ الاستلام</th>
                        <th className="py-4 px-6 font-bold">الموقع / المركز</th>
                        <th className="py-4 px-6 font-bold">حالة التسليم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {aidHistory.map((h, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                          <td className="py-4 px-6 font-bold text-slate-800">{h.aidName}</td>
                          <td className="py-4 px-6">
                            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-semibold">
                              {h.aidType}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-medium">{h.receivedBy}</td>
                          <td className="py-4 px-6 font-mono text-xs">{h.recipientId}</td>
                          <td className="py-4 px-6 text-slate-500">
                            {new Date(h.deliveredAt).toLocaleString('ar-EG')}
                          </td>
                          <td className="py-4 px-6 text-slate-500">{getCenters().find(c => c.id === h.centerId)?.name || 'المركز الرئيسي'}</td>
                          <td className="py-4 px-6">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                              <i className="fa-solid fa-circle-check text-emerald-500"></i>
                              تم الاستلام
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <span className="text-4xl block"><i className="fa-solid fa-clipboard-list"></i></span>
                  <p className="font-medium text-slate-500">لا يوجد مساعدات مستلمة مقيدة بهذا الملف حتى الآن.</p>
                  <p className="text-xs text-slate-400">ستظهر البيانات هنا تلقائياً بعد استلام أي مساعدة معتمدة من لجان التوزيع.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Footer Section */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-3">
          <p className="text-sm font-light">جميع الحقوق محفوظة © 2026</p>
          <p className="text-slate-200 font-bold text-base font-cairo">منصة الركن لإدارة توزيع المساعدات المركزية</p>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-800/60 max-w-md mx-auto leading-relaxed">
            تصميم وتنفيذ <span className="text-slate-300 font-semibold">م. فراس محمد سحويل</span>. منصة ذكية مخصصة لخدمة المنظمات واللجان الإغاثية في حالات الطوارئ والنزوح الإنساني.
          </p>
        </div>
      </footer>
    </div>
  );
}
