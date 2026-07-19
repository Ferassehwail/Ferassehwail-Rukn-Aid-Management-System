import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Family, ShelterCenter, AidProgram, DeliveryRecord } from '../types';
import { getFamilies, getCenters, getAidPrograms, getDeliveries, addLog } from '../utils/db';

export default function ReportsView() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [centers, setCenters] = useState<ShelterCenter[]>([]);
  const [programs, setPrograms] = useState<AidProgram[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);

  // Filter states
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');

  const loadData = () => {
    setFamilies(getFamilies());
    setCenters(getCenters());
    setPrograms(getAidPrograms());
    setDeliveries(getDeliveries());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, []);

  // Filtered families based on choices
  const filteredFamilies = families.filter(f => {
    const matchesCenter = selectedCenter ? f.centerId === selectedCenter : true;
    const matchesCategory = selectedCategory ? f.category === selectedCategory : true;
    return matchesCenter && matchesCategory;
  });

  // Filtered deliveries based on program or center
  const filteredDeliveries = deliveries.filter(d => {
    const matchesProgram = selectedProgram ? d.aidProgramId === selectedProgram : true;
    const matchesCenter = selectedCenter ? d.centerId === selectedCenter : true;
    return matchesProgram && matchesCenter;
  });

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export to formatted Excel file (.xlsx) using SheetJS
  const handleExportExcel = (type: 'families' | 'deliveries') => {
    const empName = window.localStorage.getItem('alrukn_active_username') || 'موظف الإدارة';
    let excelData: any[] = [];
    
    if (type === 'families') {
      excelData = filteredFamilies.map(f => {
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
          "تفاصيل التقييم وملاحظات الحالة": f.notes || ''
        };
      });
      addLog(empName, `تصدير كشف العائلات المستهدفة (${filteredFamilies.length} سجل) بصيغة Excel المعتمدة`);
    } else {
      excelData = filteredDeliveries.map(d => {
        const pObj = programs.find(p => p.id === d.aidProgramId);
        const cObj = centers.find(c => c.id === d.centerId);
        return {
          "رقم حركة الصرف": d.id,
          "المستلم المعتمد": d.receivedBy,
          "رقم الهوية للمستلم": d.recipientId,
          "المشروع الإغاثي": pObj ? pObj.name : '',
          "تاريخ ووقت التوزيع": new Date(d.deliveredAt).toLocaleString('ar-EG'),
          "الموظف المسئول": d.employeeName,
          "مركز التوزيع المعتمد": cObj ? cObj.name : '',
          "طريقة التحقق وبصمة الأمن": d.verificationMethod === 'signature' ? 'بصمة توقيع إلكتروني' : 'تحقق رمز أمان OTP'
        };
      });
      addLog(empName, `تصدير سجل إثباتات توزيع المساعدات (${filteredDeliveries.length} حركات) بصيغة Excel المعتمدة`);
    }

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'families' ? 'العائلات المستهدفة' : 'حركات التوزيع');
    XLSX.writeFile(wb, type === 'families' ? 'كشف_العائلات_المعتمد_منصة_الركن.xlsx' : 'سجل_إثباتات_توزيع_المساعدات_الركن.xlsx');
  };

  // CSV Exporter helper
  const handleExportCSV = (type: 'families' | 'deliveries') => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM for Arabic encoding
    const empName = window.localStorage.getItem('alrukn_active_username') || 'موظف الإدارة';

    if (type === 'families') {
      csvContent += "رقم الملف العائلي,هوية رب الأسرة (9 خانات),اسم رب الأسرة رباعي,اسم الزوجة الكامل رباعي,هوية الزوجة (9 خانات),رقم جوال رب الأسرة,رقم جوال مرتبط بالواتساب,الحالة الاجتماعية,فئة العائلة / نوع الاستهداف,مركز النزوح المعتمد,حالة المواطن والملف,ملاحظات التقييم\n";
      filteredFamilies.forEach(f => {
        const cObj = centers.find(c => c.id === f.centerId);
        csvContent += `"${f.fileNumber}","${f.id}","${f.headName}","${f.spouseName || ''}","${f.spouseId || ''}","${f.phone}","${f.whatsapp || ''}","${f.socialStatus}","${f.category}","${cObj ? cObj.name : ''}","${f.status === 'active' ? 'نشط ومعتمد' : 'موقوف'}","${f.notes || ''}"\n`;
      });
      addLog(empName, `تصدير كشف العائلات المستهدفة (${filteredFamilies.length} سجل) بصيغة CSV`);
    } else {
      csvContent += "رقم حركة الصرف,المستلم المعتمد,رقم الهوية للمستلم,المشروع الإغاثي,تاريخ ووقت التوزيع,الموظف المسئول,مركز التوزيع,طريقة التحقق\n";
      filteredDeliveries.forEach(d => {
        const pObj = programs.find(p => p.id === d.aidProgramId);
        const cObj = centers.find(c => c.id === d.centerId);
        csvContent += `"${d.id}","${d.receivedBy}","${d.recipientId}","${pObj ? pObj.name : ''}","${d.deliveredAt}","${d.employeeName}","${cObj ? cObj.name : ''}","${d.verificationMethod}"\n`;
      });
      addLog(empName, `تصدير سجل إثباتات توزيع المساعدات (${filteredDeliveries.length} حركات) بصيغة CSV`);
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", type === 'families' ? "كشف_العائلات_المسجلة_منصة_الركن.csv" : "كشف_إثباتات_توزيع_المساعدات_الركن.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in print:p-0 print:bg-white print:text-black">
      
      {/* Title block - Hidden during printing */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold font-cairo">مركز كشوفات وتصدير تقارير المساعدات</h2>
          <p className="text-slate-500 text-xs mt-1">توليد جداول الطباعة الرسمية للشركاء ومراجعي الحسابات مع التصدير الفوري لجداول بيانات إكسل / CSV</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Families exports */}
          <div className="flex items-center bg-blue-50/50 p-1.5 rounded-xl border border-blue-100 gap-1 text-[11px] font-bold text-blue-800">
            <span className="px-1 font-cairo">العائلات:</span>
            <button
              onClick={() => handleExportExcel('families')}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
              title="تصدير بصيغة Excel XLSX معتمدة"
            >
              <i className="fa-solid fa-file-excel text-white"></i>
              Excel
            </button>
            <button
              onClick={() => handleExportCSV('families')}
              className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <i className="fa-solid fa-file-csv text-blue-600"></i>
              CSV
            </button>
          </div>

          {/* Deliveries exports */}
          <div className="flex items-center bg-emerald-50/50 p-1.5 rounded-xl border border-emerald-100 gap-1 text-[11px] font-bold text-emerald-800">
            <span className="px-1 font-cairo">حركات الصرف:</span>
            <button
              onClick={() => handleExportExcel('deliveries')}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
              title="تصدير بصيغة Excel XLSX معتمدة"
            >
              <i className="fa-solid fa-file-excel text-white"></i>
              Excel
            </button>
            <button
              onClick={() => handleExportCSV('deliveries')}
              className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <i className="fa-solid fa-file-csv text-emerald-600"></i>
              CSV
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-100"
            title="حفظ التقرير والرسومات والمستند كتقرير PDF رسمي"
          >
            <i className="fa-solid fa-file-pdf"></i>
            تصدير وطباعة كتقرير PDF
          </button>
        </div>
      </div>

      {/* Filters block - Hidden during printing */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        
        <div className="space-y-1.5">
          <label className="text-xs text-slate-500 font-bold block">مركز الإيواء أو القطاع المعني:</label>
          <select
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            className="w-full bg-slate-100 px-3.5 py-2 rounded-xl text-xs outline-none"
          >
            <option value="">كل مراكز النزوح</option>
            {centers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-500 font-bold block">نوع وفئة الاستهداف الاجتماعي:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-slate-100 px-3.5 py-2 rounded-xl text-xs outline-none"
          >
            <option value="">كل تصنيفات العائلات</option>
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

        <div className="space-y-1.5">
          <label className="text-xs text-slate-500 font-bold block">مساعدات مشروع إغاثي محدد:</label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full bg-slate-100 px-3.5 py-2 rounded-xl text-xs outline-none"
          >
            <option value="">كل المشاريع الإغاثية المستمرة</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Smart Analytics Dashboard Section - Hidden during printing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        
        {/* Card 1: Distribution by Shelter Center */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-house-chimney"></i>
            </div>
            <div>
              <h3 className="text-xs font-black font-cairo text-slate-800">توزيع المساعدات حسب مراكز النزوح</h3>
              <p className="text-[10px] text-slate-400">إجمالي الحركات المصنفة لكل موقع إيواء</p>
            </div>
          </div>
          
          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
            {centers.map(c => {
              const count = deliveries.filter(d => d.centerId === c.id).length;
              const total = deliveries.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={c.id} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-700 truncate max-w-[160px]">{c.name}</span>
                    <span className="text-slate-900">{count} طرد ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {centers.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-8 italic">لا يوجد مراكز إيواء مسجلة حالياً.</p>
            )}
          </div>
        </div>

        {/* Card 2: Distribution by Relief Project */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-folder-open"></i>
            </div>
            <div>
              <h3 className="text-xs font-black font-cairo text-slate-800">حجم الصرف حسب المشاريع الإغاثية</h3>
              <p className="text-[10px] text-slate-400">عدد المستفيدين المستلمين لكل برنامج فعال</p>
            </div>
          </div>

          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
            {programs.map(p => {
              const count = deliveries.filter(d => d.aidProgramId === p.id).length;
              const total = deliveries.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-700 truncate max-w-[160px]">{p.name}</span>
                    <span className="text-emerald-700">{count} طرد ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {programs.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-8 italic">لا يوجد مشاريع إغاثية مسجلة حالياً.</p>
            )}
          </div>
        </div>

        {/* Card 3: Distribution by Aid Type */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-hand-holding-hand"></i>
            </div>
            <div>
              <h3 className="text-xs font-black font-cairo text-slate-800">تصنيف المساعدات المنفذة</h3>
              <p className="text-[10px] text-slate-400">توزيع الطرود حسب فئات ونوع الدعم</p>
            </div>
          </div>

          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
            {Array.from(new Set(programs.map(p => p.type))).map(type => {
              const matchingPIds = programs.filter(p => p.type === type).map(p => p.id);
              const count = deliveries.filter(d => matchingPIds.includes(d.aidProgramId)).length;
              const total = deliveries.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-700">{type}</span>
                    <span className="text-purple-700">{count} حركة ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {programs.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-8 italic">لا توجد تصنيفات مساعدات متاحة.</p>
            )}
          </div>
        </div>

      </div>

      {/* Printable Sheet View */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8 space-y-8 print:border-none print:shadow-none print:p-0">
        
        {/* Official Letterhead Header - Visible only when printing or layout */}
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-5 text-right font-cairo">
          <div className="space-y-1">
            <h1 className="text-lg font-black text-slate-900">جمعية الركن الخيرية للإغاثة الإنسانية</h1>
            <p className="text-xs text-slate-500">منصة الركن الرقمية الموحدة لتوزيع المساعدات والإعانات الطارئة</p>
            <p className="text-xs text-slate-400">تاريخ إصدار الكشف: {new Date().toLocaleDateString('ar-EG')} م</p>
          </div>
          <div className="text-left text-xs text-slate-500 leading-relaxed font-mono">
            <p>REF: ALRUKN-REP-2026</p>
            <p>STATUS: OFFICIALLY SEALED</p>
            <p>AUTHOR: {window.localStorage.getItem('alrukn_active_username') || 'ADMIN'}</p>
          </div>
        </div>

        {/* Mini report stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100/60 print:bg-white print:border print:border-slate-300">
          <div>
            <span className="text-slate-400 text-[10px] block font-bold print:text-slate-700">العائلات المستعرضة</span>
            <span className="text-slate-800 text-base font-black block mt-0.5 print:text-black">{filteredFamilies.length} عائلة مقيدة</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block font-bold print:text-slate-700">الأشخاص المشمولين</span>
            <span className="text-slate-800 text-base font-black block mt-0.5 print:text-black">
              {filteredFamilies.reduce((sum, f) => sum + f.membersCount, 0)} فرداً
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block font-bold print:text-slate-700">عمليات التوزيع بالبحث</span>
            <span className="text-slate-800 text-base font-black block mt-0.5 print:text-black">{filteredDeliveries.length} طرد</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block font-bold print:text-slate-700">القيمة الإجمالية المصروفة</span>
            <span className="text-slate-800 text-base font-black block mt-0.5 print:text-black">
              {filteredDeliveries.length * (programs.find(p => p.id === selectedProgram)?.value || 150)} شيكل
            </span>
          </div>
        </div>

        {/* Section 1: Citizens / Families Sheet */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-950 border-r-4 border-blue-600 pr-2 pb-0.5 font-cairo">أولاً: كشف وسجل التوزيع العائلي الموحد</h3>
          
          <div className="overflow-x-auto border border-slate-100 rounded-2xl print:border-slate-300 print:rounded-none">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold print:bg-slate-200">
                  <th className="py-2.5 px-4">رقم الملف</th>
                  <th className="py-2.5 px-4">اسم رب الأسرة رباعي</th>
                  <th className="py-2.5 px-4">رقم الهوية الوطنية</th>
                  <th className="py-2.5 px-4">اسم الزوجة الكامل</th>
                  <th className="py-2.5 px-4">عدد الأفراد</th>
                  <th className="py-2.5 px-4">فئة الاستحقاق</th>
                  <th className="py-2.5 px-4">مركز النزوح المعتمد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 print:divide-slate-300">
                {filteredFamilies.slice(0, 15).map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/50 print:bg-white">
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-700 print:text-black">{f.fileNumber}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 print:text-black">{f.headName}</td>
                    <td className="py-2.5 px-4 font-mono font-medium">{f.id}</td>
                    <td className="py-2.5 px-4">{f.spouseName || <span className="text-slate-300 italic">لا يوجد</span>}</td>
                    <td className="py-2.5 px-4 font-bold">{f.membersCount} (أطفال: {f.childrenCount})</td>
                    <td className="py-2.5 px-4 font-semibold">{f.category}</td>
                    <td className="py-2.5 px-4 font-medium">{centers.find(c => c.id === f.centerId)?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredFamilies.length > 15 && (
            <p className="text-[10px] text-slate-400 italic text-left print:hidden">تم عرض أول 15 سجل فقط بالاختصار. يرجى تنزيل الكشف الكامل CSV للاستعراض.</p>
          )}
        </div>

        {/* Section 2: Deliveries Sheet */}
        <div className="space-y-3 pt-6 border-t border-slate-100 print:border-slate-400">
          <h3 className="text-sm font-black text-slate-950 border-r-4 border-emerald-600 pr-2 pb-0.5 font-cairo">ثانياً: سجل تسليم المساعدات وبصمات الإمضاء للمستفيدين</h3>
          
          <div className="overflow-x-auto border border-slate-100 rounded-2xl print:border-slate-300 print:rounded-none">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold print:bg-slate-200">
                  <th className="py-2.5 px-4">رقم الحركة</th>
                  <th className="py-2.5 px-4">المستفيد المعتمد</th>
                  <th className="py-2.5 px-4">رقم الهوية</th>
                  <th className="py-2.5 px-4">المشروع الإغاثي</th>
                  <th className="py-2.5 px-4">تاريخ ووقت التوزيع</th>
                  <th className="py-2.5 px-4">توقيع المستلم والتحقق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 print:divide-slate-300">
                {filteredDeliveries.slice(0, 15).map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/50 print:bg-white">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{d.id}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 print:text-black">{d.receivedBy}</td>
                    <td className="py-2.5 px-4 font-mono font-medium">{d.recipientId}</td>
                    <td className="py-2.5 px-4 font-semibold">{programs.find(p => p.id === d.aidProgramId)?.name}</td>
                    <td className="py-2.5 px-4">{new Date(d.deliveredAt).toLocaleString('ar-EG')}</td>
                    <td className="py-2.5 px-4 font-bold text-emerald-700">
                      {d.signature ? (
                        <div className="flex items-center gap-1.5">
                          <img src={d.signature} alt="توقيع المستلم" className="h-6 w-16 border border-slate-100 rounded bg-white" referrerPolicy="no-referrer" />
                          <span className="text-[9px] text-slate-400 print:hidden">(بصمة توقيع)</span>
                        </div>
                      ) : (
                        <span>بواسطة OTP ({d.verificationMethod})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Official signatures zone at bottom of printable sheet */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs font-cairo border-t-2 border-slate-200 mt-12">
          <div className="space-y-4">
            <p className="font-bold text-slate-600">لجنة الصرف والتسليم الميداني</p>
            <div className="h-10"></div>
            <p className="font-bold text-slate-800">التوقيع والختم: .......................</p>
          </div>
          <div className="space-y-4 border-r border-l border-slate-100">
            <p className="font-bold text-slate-600">مدير مركز الإيواء والنزوح المعتمد</p>
            <div className="h-10"></div>
            <p className="font-bold text-slate-800">التوقيع والختم: .......................</p>
          </div>
          <div className="space-y-4">
            <p className="font-bold text-slate-600">المدير العام لجمعية الركن للإغاثة</p>
            <div className="h-10 text-xs italic text-blue-800 font-bold flex items-center justify-center">م. فراس محمد سحويل</div>
            <p className="font-bold text-slate-800">التوقيع والختم: .......................</p>
          </div>
        </div>

      </section>

    </div>
  );
}
