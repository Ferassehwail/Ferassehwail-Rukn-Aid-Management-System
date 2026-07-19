import React, { useState, useEffect } from 'react';
import { AidProgram, Family, Beneficiary, ShelterCenter } from '../types';
import { getAidPrograms, getFamilies, getBeneficiaries, saveBeneficiary, deleteBeneficiary, getCenters, addLog } from '../utils/db';

interface CandidatesViewProps {
  currentEmployee: { name: string; role: string; centerId: string };
}

export default function CandidatesView({ currentEmployee }: CandidatesViewProps) {
  const [programs, setPrograms] = useState<AidProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [families, setFamilies] = useState<Family[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [centers, setCenters] = useState<ShelterCenter[]>([]);

  // Filtering states
  const [centerFilter, setCenterFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    const allPrograms = getAidPrograms().filter(p => p.status === 'active');
    setPrograms(allPrograms);
    if (allPrograms.length > 0 && !selectedProgramId) {
      setSelectedProgramId(allPrograms[0].id);
    }
    
    let allFamilies = getFamilies().filter(f => f.status === 'active');
    // If center manager, restrict family pool
    if (currentEmployee.role === 'center_manager' && currentEmployee.centerId) {
      allFamilies = allFamilies.filter(f => f.centerId === currentEmployee.centerId);
    }
    setFamilies(allFamilies);
    setBeneficiaries(getBeneficiaries());
    setCenters(getCenters());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, [selectedProgramId, currentEmployee]);

  const selectedProgram = programs.find(p => p.id === selectedProgramId);

  // 1. Filter families that match the current selected program's targeting criteria
  const eligibleFamilies = families.filter(f => {
    if (!selectedProgram) return false;
    
    // Must match one of the program's target categories
    const matchesCategory = selectedProgram.targetCategories.includes(f.category);
    // Must match one of the program's target centers
    const matchesCenter = selectedProgram.targetCenters.includes(f.centerId);

    return matchesCategory && matchesCenter;
  });

  // Apply visual search/filter on top of eligible families
  const visibleFamilies = eligibleFamilies.filter(f => {
    const matchesSearch = 
      f.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.id.includes(searchQuery) ||
      f.fileNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCenterFilter = centerFilter ? f.centerId === centerFilter : true;
    const matchesCategoryFilter = categoryFilter ? f.category === categoryFilter : true;

    return matchesSearch && matchesCenterFilter && matchesCategoryFilter;
  });

  // Toggle selection for a family (Add to delivery queue or remove)
  const handleToggleNomination = (family: Family, isChecked: boolean) => {
    if (!selectedProgram) return;

    const beneficiaryId = `${family.id}-${selectedProgram.id}`;
    
    if (isChecked) {
      // Determine state based on role: data entry nominates, admin/auditor approves directly
      const status: Beneficiary['status'] = 
        (currentEmployee.role === 'admin' || currentEmployee.role === 'auditor' || currentEmployee.role === 'center_manager') 
          ? 'approved' 
          : 'nominated';

      const b: Beneficiary = {
        id: beneficiaryId,
        familyId: family.id,
        aidProgramId: selectedProgram.id,
        status,
        nominationReason: `فرز آلي لمطابقة فئة الاستحقاق (${family.category}) بـ ${centers.find(c => c.id === family.centerId)?.name || ''}`,
        assignedCenterId: family.centerId,
        barcode: `BC${family.id}${selectedProgram.id.slice(-2)}`,
        qrCode: `QR${family.id}${selectedProgram.id.slice(-2)}`
      };
      saveBeneficiary(b);
      addLog(currentEmployee.name, `ترشيح عائلة رب الأسرة (${family.headName}) للاستلام بمشروع: ${selectedProgram.name}`);
    } else {
      deleteBeneficiary(beneficiaryId);
      addLog(currentEmployee.name, `استبعاد عائلة رب الأسرة (${family.headName}) من مشروع: ${selectedProgram.name}`);
    }
  };

  // Bulk Nominate / Approve all visible eligible families
  const handleBulkAction = (approveAll: boolean) => {
    if (!selectedProgram) return;

    if (approveAll) {
      const status: Beneficiary['status'] = 
        (currentEmployee.role === 'admin' || currentEmployee.role === 'auditor' || currentEmployee.role === 'center_manager') 
          ? 'approved' 
          : 'nominated';

      visibleFamilies.forEach(f => {
        const beneficiaryId = `${f.id}-${selectedProgram.id}`;
        // Only add if not already added
        const exists = beneficiaries.find(b => b.id === beneficiaryId);
        if (!exists || exists.status === 'nominated') {
          const b: Beneficiary = {
            id: beneficiaryId,
            familyId: f.id,
            aidProgramId: selectedProgram.id,
            status,
            nominationReason: 'فرز كتل جماعي مستوفي المعايير',
            assignedCenterId: f.centerId,
            barcode: `BC${f.id}${selectedProgram.id.slice(-2)}`,
            qrCode: `QR${f.id}${selectedProgram.id.slice(-2)}`
          };
          saveBeneficiary(b);
        }
      });

      addLog(currentEmployee.name, `فرز جماعي وتثبيت استحقاق لـ ${visibleFamilies.length} عائلات لمشروع: ${selectedProgram.name}`);
      
      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: 'تم الفرز الجماعي بنجاح',
          text: `تم استهداف وتثبيت عدد (${visibleFamilies.length}) عائلة مستحقة للانتقال لقائمة التسليم الفوري.`,
          timer: 2000,
          showConfirmButton: false
        });
      }
    } else {
      // Remove all visible
      visibleFamilies.forEach(f => {
        const beneficiaryId = `${f.id}-${selectedProgram.id}`;
        const b = beneficiaries.find(x => x.id === beneficiaryId);
        if (b && b.status !== 'delivered') {
          deleteBeneficiary(beneficiaryId);
        }
      });
      addLog(currentEmployee.name, `إلغاء فرز واستبعاد كتل جماعي لمشروع: ${selectedProgram.name}`);
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-cairo">نظام فرز وتأهيل مرشحي المساعدات</h2>
          <p className="text-slate-500 text-xs mt-1">تحديد العائلات المستحقة وتنزيلهم في كشف التسليم النشط بناءً على مطابقة تصنيفات الحالة الاجتماعية</p>
        </div>

        {/* Dropdown to choose project */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">المشروع الإغاثي النشط:</span>
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-blue-700 focus:ring-0 outline-none shadow-sm"
          >
            {programs.length > 0 ? (
              programs.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))
            ) : (
              <option value="">لا يوجد مشاريع توزيع نشطة</option>
            )}
          </select>
        </div>
      </div>

      {selectedProgram ? (
        <>
          {/* Target rules banner */}
          <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-2xl flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-blue-800">
            <div>
              <span className="font-bold text-slate-500 ml-1">فئات الاستهداف المعتمدة للمشروع:</span>
              <span className="font-extrabold">{selectedProgram.targetCategories.join(' ، ')}</span>
            </div>
            <div className="hidden sm:block text-slate-300">|</div>
            <div>
              <span className="font-bold text-slate-500 ml-1">المراكز المستفيدة:</span>
              <span className="font-extrabold">
                {selectedProgram.targetCenters.map(cid => centers.find(c => c.id === cid)?.name).filter(Boolean).join(' ، ')}
              </span>
            </div>
          </div>

          {/* Table Filters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="البحث بالاسم الكامل، رقم هوية رب الأسرة، أو رقم الملف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-11 py-2.5 bg-slate-100 hover:bg-slate-200/50 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl text-xs transition-all outline-none"
              />
              <div className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </div>
            </div>

            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="bg-slate-100 px-4 py-2.5 rounded-xl border border-transparent text-xs focus:bg-white outline-none"
            >
              <option value="">كل مراكز المشروع</option>
              {selectedProgram.targetCenters.map(cid => {
                const cObj = centers.find(c => c.id === cid);
                return cObj ? <option key={cid} value={cid}>{cObj.name}</option> : null;
              })}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-100 px-4 py-2.5 rounded-xl border border-transparent text-xs focus:bg-white outline-none"
            >
              <option value="">كل الفئات المشمولة</option>
              {selectedProgram.targetCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction(true)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="fa-solid fa-check-double"></i>
                ترشيح كل المطابقين
              </button>
              <button
                onClick={() => handleBulkAction(false)}
                className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="fa-solid fa-trash-can"></i>
                إلغاء فرز الكل
              </button>
            </div>
          </div>

          {/* Candidate Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {visibleFamilies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                      <th className="py-4 px-5 text-center w-16">حالة الفرز (صح/خطأ)</th>
                      <th className="py-4 px-5">رب الأسرة المعني</th>
                      <th className="py-4 px-5">رقم الملف والمركز</th>
                      <th className="py-4 px-5">الحالة الاجتماعية والتصنيف</th>
                      <th className="py-4 px-5">عدد أفراد الأسرة</th>
                      <th className="py-4 px-5">حالة الترشيح الحالية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {visibleFamilies.map(f => {
                      const beneficiaryId = `${f.id}-${selectedProgram.id}`;
                      const bRecord = beneficiaries.find(b => b.id === beneficiaryId);
                      const isNominated = bRecord !== undefined && bRecord.status !== 'rejected' && bRecord.status !== 'cancelled';
                      const isDelivered = bRecord?.status === 'delivered';

                      return (
                        <tr key={f.id} className={`hover:bg-slate-50/40 transition-all ${isNominated ? 'bg-blue-50/10' : ''}`}>
                          <td className="py-3.5 px-5 text-center">
                            <input
                              type="checkbox"
                              disabled={isDelivered}
                              checked={isNominated}
                              onChange={(e) => handleToggleNomination(f, e.target.checked)}
                              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer disabled:opacity-40"
                            />
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-bold text-slate-800 text-sm">{f.headName}</p>
                            <p className="text-slate-400 text-xs mt-0.5">الهوية: {f.id} | جوال: {f.phone}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-bold font-mono text-blue-600">{f.fileNumber}</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {centers.find(c => c.id === f.centerId)?.name || 'غير معروف'}
                            </p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-bold text-slate-700">{f.socialStatus}</p>
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold mt-1 inline-block">
                              {f.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-bold text-slate-800">
                            {f.membersCount} أفراد
                          </td>
                          <td className="py-3.5 px-5">
                            {isDelivered ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                                <i className="fa-solid fa-circle-check"></i>
                                تم تسليمه طرده
                              </span>
                            ) : isNominated ? (
                              <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                                <i className="fa-solid fa-truck-ramp-box"></i>
                                {bRecord?.status === 'approved' ? 'مدرج بكشف التسليم' : 'مرشح قيد الموافقة'}
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-400 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                                <i className="fa-solid fa-user-clock"></i>
                                غير مفرز بعد
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <span className="text-4xl block"><i className="fa-solid fa-person-circle-exclamation"></i></span>
                <p className="font-bold">لا يوجد أي عائلات مستحقة مطابقة للشروط المسجلة أو فلاتر البحث الحالية.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center text-slate-400 space-y-2">
          <span className="text-4xl block"><i className="fa-solid fa-folder-open"></i></span>
          <p className="font-bold text-slate-600">الرجاء اختيار أو جدولة مشروع توزيع مساعدات نشط أولاً.</p>
        </div>
      )}

    </div>
  );
}
