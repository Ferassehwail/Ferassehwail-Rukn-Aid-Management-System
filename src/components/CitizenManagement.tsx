import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Family, FamilyMember, ShelterCenter } from '../types';
import { getFamilies, getCenters, saveFamily, deleteFamily, addLog } from '../utils/db';

interface CitizenManagementProps {
  currentEmployee: { role: string; centerId: string; name: string };
}

export default function CitizenManagement({ currentEmployee }: CitizenManagementProps) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [centers, setCenters] = useState<ShelterCenter[]>([]);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modals / Form state
  const [showForm, setShowForm] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);

  // Form Fields
  const [headId, setHeadId] = useState('');
  const [fileNumber, setFileNumber] = useState('');
  const [headName, setHeadName] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [spouseId, setSpouseId] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [socialStatus, setSocialStatus] = useState('متزوج');
  const [category, setCategory] = useState('أسر فقيرة');
  const [centerId, setCenterId] = useState('');
  const [status, setStatus] = useState<'active' | 'suspended' | 'review'>('active');
  const [notes, setNotes] = useState('');
  const [canAddMembers, setCanAddMembers] = useState(true);

  // Members Management Form inside family
  const [membersList, setMembersList] = useState<FamilyMember[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [newMemberGender, setNewMemberGender] = useState<'male' | 'female'>('male');
  const [newMemberRelation, setNewMemberRelation] = useState('ابن');

  // Load Data
  const loadData = () => {
    let allFamilies = getFamilies();
    // If center manager, restrict to their center
    if (currentEmployee.role === 'center_manager' && currentEmployee.centerId) {
      allFamilies = allFamilies.filter(f => f.centerId === currentEmployee.centerId);
    }
    setFamilies(allFamilies);
    setCenters(getCenters());
  };

  // Export filtered families to Excel (.xlsx) using SheetJS
  const handleExportExcel = () => {
    const excelData = filteredFamilies.map(f => {
      const cObj = centers.find(c => c.id === f.centerId);
      return {
        "رقم الملف العائلي *": f.fileNumber,
        "هوية رب الأسرة (9 خانات) *": f.id,
        "اسم رب الأسرة رباعي *": f.headName,
        "اسم الزوجة الكامل رباعي": f.spouseName || '',
        "هوية الزوجة (9 خانات)": f.spouseId || '',
        "رقم جوال رب الأسرة": f.phone,
        "رقم جوال مرتبط بالواتساب": f.whatsapp || '',
        "الحالة الاجتماعية": f.socialStatus,
        "فئة العائلة / نوع الاستهداف": f.category,
        "مركز النزوح المعتمد": cObj ? cObj.name : '',
        "حالة المواطن والملف": f.status === 'active' ? 'نشط ومعتمد' : f.status === 'suspended' ? 'موقوف مؤقتا' : 'قيد المراجعة',
        "تفاصيل التقييم وملاحظات الحالة": f.notes || '',
        "عدد أفراد العائلة": f.membersCount,
        "عدد الأطفال": f.childrenCount,
        "عدد الذكور": f.malesCount,
        "عدد الإناث": f.femalesCount
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل العائلات المعتمد');
    XLSX.writeFile(wb, 'سجل_عائلات_منصة_الركن.xlsx');
    addLog(currentEmployee.name, `تصدير سجل العائلات المصفى (${filteredFamilies.length} سجل) بصيغة Excel`);
  };

  // Export filtered families to CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM
    csvContent += "رقم الملف العائلي,هوية رب الأسرة,اسم رب الأسرة رباعي,اسم الزوجة,هوية الزوجة,رقم الجوال,رقم الواتساب,الحالة الاجتماعية,فئة الاستهداف,مركز النزوح المعتمد,الحالة\n";
    filteredFamilies.forEach(f => {
      const cObj = centers.find(c => c.id === f.centerId);
      csvContent += `"${f.fileNumber}","${f.id}","${f.headName}","${f.spouseName || ''}","${f.spouseId || ''}","${f.phone}","${f.whatsapp || ''}","${f.socialStatus}","${f.category}","${cObj ? cObj.name : ''}","${f.status === 'active' ? 'نشط ومعتمد' : 'موقوف'}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "كشف_عائلات_منصة_الركن.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(currentEmployee.name, `تصدير سجل العائلات المصفى (${filteredFamilies.length} سجل) بصيغة CSV`);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, [currentEmployee]);

  // Open Form for Adding
  const handleOpenAdd = () => {
    setEditingFamily(null);
    setHeadId('');
    setFileNumber(`FL-${Date.now().toString().slice(-4)}`);
    setHeadName('');
    setSpouseName('');
    setSpouseId('');
    setPhone('');
    setWhatsapp('');
    setSocialStatus('متزوج');
    setCategory('أسر فقيرة');
    setCenterId(currentEmployee.centerId || (getCenters()[0]?.id || ''));
    setStatus('active');
    setNotes('');
    setCanAddMembers(true);
    setMembersList([]);
    setShowForm(true);
  };

  // Open Form for Editing
  const handleOpenEdit = (f: Family) => {
    setEditingFamily(f);
    setHeadId(f.id);
    setFileNumber(f.fileNumber);
    setHeadName(f.headName);
    setSpouseName(f.spouseName);
    setSpouseId(f.spouseId);
    setPhone(f.phone);
    setWhatsapp(f.whatsapp);
    setSocialStatus(f.socialStatus);
    setCategory(f.category);
    setCenterId(f.centerId);
    setStatus(f.status);
    setNotes(f.notes);
    setCanAddMembers(f.canAddMembers);
    setMembersList(f.membersList);
    setShowForm(true);
  };

  // Add kid / member to the list in form
  const handleAddMemberToForm = () => {
    const mName = newMemberName.trim();
    const mId = newMemberId.trim();
    const mAge = parseInt(newMemberAge);

    if (!mName || !mId || !newMemberAge) {
      alert('يرجى كتابة كافة بيانات فرد العائلة الجديد.');
      return;
    }

    if (!/^\d{9}$/.test(mId)) {
      alert('رقم هوية الفرد يجب أن يتكون من 9 أرقام.');
      return;
    }

    if (isNaN(mAge) || mAge < 0) {
      alert('العمر غير صالح.');
      return;
    }

    // Check duplicate ID inside current family members list
    if (membersList.some(m => m.id === mId) || headId === mId || spouseId === mId) {
      alert('رقم هوية الفرد مضاف مسبقاً في هذه العائلة.');
      return;
    }

    // Check duplicate ID across entire system
    const allFamilies = getFamilies();
    const duplicateFamily = allFamilies.find(f => 
      (editingFamily ? f.id !== editingFamily.id : true) && 
      (f.id === mId || f.spouseId === mId || f.membersList.some(m => m.id === mId))
    );

    if (duplicateFamily) {
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'رقم الهوية مكرر ومسجل مسبقاً!',
          text: `رقم هوية الفرد (${mName} - ${mId}) مسجل ضمن عائلة رب أسرتها هو: (${duplicateFamily.headName}) بمركز الإيواء.`,
          confirmButtonText: 'حسناً، فهمت',
          confirmButtonColor: '#ef4444'
        });
      } else {
        alert(`عذراً، رقم هوية هذا الفرد مسجل مسبقاً ضمن عائلة: ${duplicateFamily.headName}`);
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

    setMembersList([...membersList, newMember]);
    setNewMemberName('');
    setNewMemberId('');
    setNewMemberAge('');
  };

  const handleRemoveMemberFromForm = (idx: number) => {
    setMembersList(membersList.filter((_, i) => i !== idx));
  };

  // Submit main family form
  const handleSubmitFamily = (e: React.FormEvent) => {
    e.preventDefault();

    if (!headName.trim() || !headId.trim() || !fileNumber.trim()) {
      alert('يرجى تعبئة الحقول الأساسية المطلوبة.');
      return;
    }

    if (!/^\d{9}$/.test(headId.trim())) {
      alert('رقم هوية رب الأسرة يجب أن يتكون من 9 أرقام بالضبط.');
      return;
    }

    if (spouseId.trim() && !/^\d{9}$/.test(spouseId.trim())) {
      alert('رقم هوية الزوجة يجب أن يتكون من 9 أرقام بالضبط أو يترك فارغاً.');
      return;
    }

    // Calculate genders and children
    const childrenCount = membersList.filter(m => m.age < 18).length;
    const malesCount = (socialStatus !== 'أرملة' ? 1 : 0) + membersList.filter(m => m.gender === 'male').length;
    const femalesCount = (spouseName.trim() ? 1 : 0) + (socialStatus === 'أرملة' ? 1 : 0) + membersList.filter(m => m.gender === 'female').length;

    const familyData: Family = {
      id: headId.trim(),
      fileNumber: fileNumber.trim(),
      headName: headName.trim(),
      spouseName: spouseName.trim(),
      spouseId: spouseId.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      socialStatus,
      membersCount: 1 + (spouseName.trim() ? 1 : 0) + membersList.length,
      childrenCount,
      malesCount,
      femalesCount,
      category,
      centerId,
      status,
      notes: notes.trim(),
      canAddMembers,
      membersList,
      createdAt: editingFamily ? editingFamily.createdAt : new Date().toISOString()
    };

    const result = saveFamily(familyData, editingFamily?.id);
    if (result.success) {
      addLog(currentEmployee.name, `${editingFamily ? 'تعديل' : 'إضافة'} ملف العائلة لرب الأسرة: ${familyData.headName}`);
      setShowForm(false);
      setEditingFamily(null);
      
      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: 'تم الحفظ بنجاح',
          text: 'تم تقييد بيانات العائلة والمستفيدين بالملف الموحد.',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } else {
      // Duplicate alert with precise popup
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'البيانات مكررة في عائلة أخرى!',
          text: result.message,
          confirmButtonText: 'حسناً، مراجعة البيانات',
          confirmButtonColor: '#ef4444'
        });
      } else {
        alert(result.message);
      }
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.Swal) {
      window.Swal.fire({
        title: 'هل أنت متأكد من الحذف؟',
        text: `سيتم حذف ملف العائلة لرب الأسرة "${name}" بالكامل مع جميع بيانات أفراد الأسرة المسجلين التابعين له نهائياً من النظام، ولا يمكن التراجع عن هذه الخطوة!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف الملف بالكامل',
        cancelButtonText: 'تراجع وإلغاء'
      }).then((result) => {
        if (result.isConfirmed) {
          deleteFamily(id);
          addLog(currentEmployee.name, `حذف ملف العائلة لرب الأسرة: ${name}`);
          window.Swal.fire({
            title: 'تم الحذف بنجاح',
            text: `تم إزالة وحذف ملف عائلة رب الأسرة "${name}" بالكامل من كشوفات المنصة.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        }
      });
    } else {
      if (confirm(`هل أنت متأكد من حذف عائلة رب الأسرة (${name}) نهائياً من النظام بالكامل؟`)) {
        deleteFamily(id);
        addLog(currentEmployee.name, `حذف ملف العائلة لرب الأسرة: ${name}`);
        alert('تم حذف ملف العائلة بالكامل بنجاح.');
      }
    }
  };

  // Search filter implementation
  const filteredFamilies = families.filter(f => {
    const matchesSearch = 
      f.headName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.id.includes(searchTerm) ||
      (f.spouseName && f.spouseName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      f.fileNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.spouseId && f.spouseId.includes(searchTerm));

    const matchesCenter = selectedCenter ? f.centerId === selectedCenter : true;
    const matchesCategory = selectedCategory ? f.category === selectedCategory : true;

    return matchesSearch && matchesCenter && matchesCategory;
  });

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Title block */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-cairo">إدارة السجل المدني للعائلات والنازحين</h2>
          <p className="text-slate-500 text-xs mt-1">تعديل بيانات رب الأسرة، الزوجة، إضافة أطفال وتنزيل كشوفات المعاملة الكاملة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-100 cursor-pointer"
            title="تنزيل الكشف المصفى بصيغة Excel"
          >
            <i className="fa-solid fa-file-excel"></i>
            تصدير إكسل (Excel)
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="تنزيل الكشف المصفى بصيغة CSV"
          >
            <i className="fa-solid fa-file-csv text-blue-600"></i>
            تصدير CSV
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 shadow-md shadow-blue-100"
            id="add-family-btn"
          >
            <i className="fa-solid fa-user-plus"></i>
            إضافة عائلة جديدة
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="ابحث بالاسم الكامل لرب الأسرة، الزوجة، رقم الهوية أو رقم الملف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-11 py-2.5 bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl text-sm transition-all outline-none"
            id="families-search-input"
          />
          <div className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400">
            <i className="fa-solid fa-magnifying-glass text-sm"></i>
          </div>
        </div>

        <select
          value={selectedCenter}
          onChange={(e) => setSelectedCenter(e.target.value)}
          className="bg-slate-100 px-4 py-2.5 rounded-xl border border-transparent text-sm focus:bg-white outline-none"
        >
          <option value="">كل مراكز الإيواء</option>
          {centers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-100 px-4 py-2.5 rounded-xl border border-transparent text-sm focus:bg-white outline-none"
        >
          <option value="">كل فئات الاستهداف</option>
          <option value="أسر فقيرة">أسر فقيرة</option>
          <option value="أرامل">أرامل ومطلقات</option>
          <option value="أيتام">أيتام</option>
          <option value="ذوي إعاقة">ذوي إعاقة</option>
          <option value="كبار السن">كبار السن</option>
          <option value="مرضى">مرضى</option>
          <option value="نازحون">نازحون مهجرون</option>
          <option value="حالات إنسانية">حالات إنسانية خاصة</option>
        </select>
      </div>

      {/* Families List Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredFamilies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <th className="py-4 px-5">رقم الملف</th>
                  <th className="py-4 px-5">رب الأسرة</th>
                  <th className="py-4 px-5">الزوجة</th>
                  <th className="py-4 px-5">العدد الكلي للأسرة</th>
                  <th className="py-4 px-5">فئة الاستهداف</th>
                  <th className="py-4 px-5">مركز الإيواء الحالي</th>
                  <th className="py-4 px-5">الحالة</th>
                  <th className="py-4 px-5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredFamilies.map((f) => {
                  const centerObj = centers.find(c => c.id === f.centerId);
                  return (
                    <tr key={f.id} className="hover:bg-slate-50/40 transition-all">
                      <td className="py-3.5 px-5 font-bold text-blue-700 font-mono">{f.fileNumber}</td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-800 text-sm">{f.headName}</p>
                        <p className="text-slate-400 text-xs mt-0.5">الهوية: {f.id} | جوال: {f.phone}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        {f.spouseName ? (
                          <>
                            <p className="font-semibold text-slate-700">{f.spouseName}</p>
                            <p className="text-slate-400 text-xs mt-0.5">الهوية: {f.spouseId}</p>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">بدون / لا يوجد</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-extrabold text-slate-800">{f.membersCount} أشخاص</span>
                        <span className="text-slate-400 block text-xs">({f.childrenCount} أطفال | {f.malesCount} ذ | {f.femalesCount} إ)</span>
                      </td>
                      <td className="py-3.5 px-5 font-bold">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {f.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 font-semibold">{centerObj ? centerObj.name : 'مستقل'}</td>
                      <td className="py-3.5 px-5">
                        {f.status === 'active' ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            نشط
                          </span>
                        ) : f.status === 'review' ? (
                          <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            مراجعة
                          </span>
                        ) : (
                          <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            موقوف
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(f)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors cursor-pointer"
                            title="تعديل رب الأسرة والأفراد"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(f.id, f.headName)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition-colors cursor-pointer"
                            title="حذف العائلة"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <span className="text-4xl block"><i className="fa-solid fa-folder-open"></i></span>
            <p className="font-bold">لم يتم العثور على أي عوائل مطابقة لشروط البحث.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Sliding Overlay / Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-lg font-black font-cairo text-slate-800">
                {editingFamily ? `تعديل ملف عائلة: ${editingFamily.headName}` : 'إضافة ملف عائلي موحد جديد'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingFamily(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1.5 text-lg"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitFamily} className="p-6 md:p-8 space-y-8">
              
              {/* Part 1: Main details of head & spouse */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-blue-700 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <span><i className="fa-solid fa-id-card"></i></span>
                  <span>البيانات الشخصية لرب الأسرة والزوجة</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* File ID */}
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">رقم الملف العائلي *</label>
                    <input
                      type="text"
                      required
                      value={fileNumber}
                      onChange={(e) => setFileNumber(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-bold text-blue-700 outline-none"
                    />
                  </div>
                  {/* Head ID */}
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">هوية رب الأسرة (9 خانات) *</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={headId}
                      onChange={(e) => setHeadId(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    />
                  </div>
                  {/* Head Name */}
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">اسم رب الأسرة رباعي *</label>
                    <input
                      type="text"
                      required
                      value={headName}
                      onChange={(e) => setHeadName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    />
                  </div>

                  {/* Spouse Name */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">اسم الزوجة الكامل رباعي</label>
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(e) => setSpouseName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                    />
                  </div>
                  {/* Spouse ID */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">هوية الزوجة (9 خانات)</label>
                    <input
                      type="text"
                      maxLength={9}
                      value={spouseId}
                      onChange={(e) => setSpouseId(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    />
                  </div>
                  {/* Phone */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">رقم جوال رب الأسرة</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">رقم جوال مرتبط بالواتساب</label>
                    <input
                      type="text"
                      placeholder="970599xxxxxx"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                    />
                  </div>

                  {/* Social Status */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">الحالة الاجتماعية</label>
                    <select
                      value={socialStatus}
                      onChange={(e) => setSocialStatus(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none"
                    >
                      <option value="متزوج">متزوج</option>
                      <option value="أرملة">أرملة / مطلقة مع عيال</option>
                      <option value="أعزب">أعزب</option>
                      <option value="منفصل">منفصل</option>
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">فئة العائلة / نوع الاستهداف</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none font-bold"
                    >
                      <option value="أسر فقيرة">أسر فقيرة</option>
                      <option value="أرامل">أرامل ومطلقات</option>
                      <option value="أيتام">أيتام</option>
                      <option value="ذوي إعاقة">ذوي إعاقة</option>
                      <option value="كبار السن">كبار السن</option>
                      <option value="مرضى">مرضى</option>
                      <option value="نازحون">نازحون مهجرون</option>
                      <option value="حالات إنسانية">حالات إنسانية خاصة</option>
                    </select>
                  </div>

                  {/* Center Assignment */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">مركز النزوح المعتمد</label>
                    <select
                      value={centerId}
                      onChange={(e) => setCenterId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none font-bold text-blue-700"
                    >
                      {centers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* File Status */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">حالة المواطن والملف</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none font-bold"
                    >
                      <option value="active">نشط ومعتمد</option>
                      <option value="review">قيد المراجعة والتدقيق</option>
                      <option value="suspended">موقوف مؤقتاً</option>
                    </select>
                  </div>

                  {/* Can Citizen Add Members */}
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">إضافة ذاتية للمواطن</label>
                    <select
                      value={canAddMembers ? 'true' : 'false'}
                      onChange={(e) => setCanAddMembers(e.target.value === 'true')}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none font-bold"
                    >
                      <option value="true">يسمح للمواطن بالإضافة لأول مرة</option>
                      <option value="false">مغلق للتعديل التلقائي</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">تفاصيل التقييم وملاحظات الحالة</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب هنا أي تفاصيل إضافية للحالة الاجتماعية وملاحظات لجان الميدان..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none"
                  ></textarea>
                </div>
              </div>

              {/* Part 2: Dependents / Kids list */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <span><i className="fa-solid fa-users-line"></i></span>
                  <span>التابعين والأبناء المسجلين بالملف</span>
                </h4>

                {/* Inline form to add dependent */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">اسم الابن/التابع كامل رباعي</label>
                    <input
                      type="text"
                      placeholder="الاسم رباعي"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">رقم الهوية (9 خانات)</label>
                    <input
                      type="text"
                      maxLength={9}
                      placeholder="رقم هوية التابع"
                      value={newMemberId}
                      onChange={(e) => setNewMemberId(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">العمر (سنوات)</label>
                    <input
                      type="number"
                      placeholder="العمر"
                      value={newMemberAge}
                      onChange={(e) => setNewMemberAge(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-grow">
                      <label className="text-xs text-slate-500 font-semibold mb-1 block">الصلة والنوع</label>
                      <select
                        value={newMemberRelation}
                        onChange={(e) => setNewMemberRelation(e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                      >
                        <option value="ابن">ابن (ذكر)</option>
                        <option value="ابنة">ابنة (أنثى)</option>
                        <option value="والد">والد</option>
                        <option value="والدة">والدة</option>
                        <option value="أخ">أخ</option>
                        <option value="أخت">أخت</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMemberToForm}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors self-end cursor-pointer"
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </div>

                {/* Dependents Preview */}
                {membersList.length > 0 ? (
                  <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-slate-50/25">
                    {membersList.map((m, index) => (
                      <div key={index} className="px-5 py-3 flex justify-between items-center text-sm">
                        <div>
                          <span className="font-bold text-slate-800 ml-2">{m.name}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">الهوية: {m.id}</span>
                          <span className="text-xs text-slate-400 mr-2">العلاقة: {m.relation} | العمر: {m.age} سنة</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromForm(index)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          title="حذف الفرد"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic text-center py-4 bg-slate-50 rounded-2xl">لا يوجد تابعين مضافين بالملف حتى الآن. استخدم الحقل أعلاه لإدراج الأبناء.</p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white z-10 py-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingFamily(null); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-100 flex items-center gap-1.5 cursor-pointer"
                  id="save-family-submit"
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>حفظ وإغلاق المعاملة</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
