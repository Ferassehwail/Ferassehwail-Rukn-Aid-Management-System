import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Family, ShelterCenter } from '../types';
import { getFamilies, getCenters, saveFamily, addLog } from '../utils/db';

interface ExcelImportViewProps {
  currentEmployee: { name: string; role: string; centerId: string };
}

export default function ExcelImportView({ currentEmployee }: ExcelImportViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const [successRate, setSuccessRate] = useState<number | null>(null);
  const [reportLogs, setReportLogs] = useState<{ row: number; name: string; id: string; reason: string }[]>([]);

  // Columns A-M Representation from Screenshot/Template
  const COL_A_FILE_NO = 'رقم الملف العائلي *';
  const COL_B_HEAD_ID = 'هوية رب الأسرة (9 خانات) *';
  const COL_C_HEAD_NAME = 'اسم رب الأسرة رباعي *';
  const COL_D_SPOUSE_NAME = 'اسم الزوجة الكامل رباعي';
  const COL_E_SPOUSE_ID = 'هوية الزوجة (9 خانات)';
  const COL_F_PHONE = 'رقم جوال رب الأسرة';
  const COL_G_WHATSAPP = 'رقم جوال مرتبط بالواتساب';
  const COL_H_SOCIAL_STATUS = 'الحالة الاجتماعية';
  const COL_I_CATEGORY = 'فئة العائلة / نوع الاستهداف';
  const COL_J_CENTER_NAME = 'مركز النزوح المعتمد';
  const COL_K_STATUS = 'حالة المواطن والملف';
  const COL_L_SELF_ADD = 'إضافة ذاتية للمواطن';
  const COL_M_NOTES = 'تفاصيل التقييم وملاحظات الحالة';

  // Download Arabic Excel Template aligning exactly with Columns A-M
  const handleDownloadTemplate = () => {
    const centers = getCenters();
    const defaultCenterName = centers[0]?.name || 'مركز إيواء خانيونس المركزي';

    const templateData = [
      {
        [COL_A_FILE_NO]: '', // Left blank because "النظام بعبيها لحاله"
        [COL_B_HEAD_ID]: '111222333',
        [COL_C_HEAD_NAME]: 'سليم أحمد محمود المصري',
        [COL_D_SPOUSE_NAME]: 'منى كمال سليم المصري',
        [COL_E_SPOUSE_ID]: '999888777',
        [COL_F_PHONE]: '0599000111',
        [COL_G_WHATSAPP]: '0599000111',
        [COL_H_SOCIAL_STATUS]: 'متزوج',
        [COL_I_CATEGORY]: 'نازحون مهجرون',
        [COL_J_CENTER_NAME]: defaultCenterName,
        [COL_K_STATUS]: 'نشط ومعتمد',
        [COL_L_SELF_ADD]: 'كلا',
        [COL_M_NOTES]: 'نازح مهجر من الشجاعية، المنزل دمر بالكامل، حالة طارئة عاجلة.'
      },
      {
        [COL_A_FILE_NO]: '',
        [COL_B_HEAD_ID]: '222333444',
        [COL_C_HEAD_NAME]: 'جميلة عبد القادر شاهين',
        [COL_D_SPOUSE_NAME]: '',
        [COL_E_SPOUSE_ID]: '',
        [COL_F_PHONE]: '0599000222',
        [COL_G_WHATSAPP]: '0599000222',
        [COL_H_SOCIAL_STATUS]: 'أرملة',
        [COL_I_CATEGORY]: 'أرامل ومطلقات',
        [COL_J_CENTER_NAME]: defaultCenterName,
        [COL_K_STATUS]: 'نشط ومعتمد',
        [COL_L_SELF_ADD]: 'كلا',
        [COL_M_NOTES]: 'أرملة نازحة تعيل أيتام بحاجة لحليب ومستلزمات طبية.'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف المستفيدين');
    XLSX.writeFile(wb, 'نموذج_كشف_عائلات_الركن.xlsx');
    addLog(currentEmployee.name, 'تحميل نموذج كشف الإكسل لتسجيل المستفيدين (الأعمدة A-M)');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleImportExcel = () => {
    if (!file) {
      alert('الرجاء اختيار ملف كشف إكسل أولاً.');
      return;
    }

    setParsing(true);
    setReportLogs([]);
    setImportedCount(null);
    setDuplicateCount(null);
    setSuccessRate(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('فشل قراءة ملف الإكسل.');

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON array of arrays to handle columns strictly by position (A-M)
        // This is extremely robust if header text has minor whitespace differences
        const sheetRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (sheetRows.length <= 1) {
          alert('الكشف المدخل فارغ ولا يحتوي على سجلات كافية بعد السطر الأول (الترويسة).');
          setParsing(false);
          return;
        }

        const headers: any[] = sheetRows[0];
        const rowsData = sheetRows.slice(1);

        const systemCenters = getCenters();
        let added = 0;
        let duplicates = 0;
        const localLogs: typeof reportLogs = [];

        // Helper to find column index by header name or fallback to index
        const getColVal = (row: any[], headerName: string, fallbackIdx: number) => {
          const idx = headers.findIndex(h => String(h || '').trim() === headerName.trim());
          if (idx !== -1) return row[idx];
          return row[fallbackIdx];
        };

        rowsData.forEach((row, idx) => {
          const rowNum = idx + 2; // Excel row starts from 2 (header is row 1)
          if (!row || row.length === 0) return;

          // Parse values by column headers or their relative positions (A-M)
          const fileNoRaw = String(getColVal(row, COL_A_FILE_NO, 0) || '').trim();
          const headIdRaw = String(getColVal(row, COL_B_HEAD_ID, 1) || '').trim();
          const headNameRaw = String(getColVal(row, COL_C_HEAD_NAME, 2) || '').trim();
          const spouseNameRaw = String(getColVal(row, COL_D_SPOUSE_NAME, 3) || '').trim();
          const spouseIdRaw = String(getColVal(row, COL_E_SPOUSE_ID, 4) || '').trim();
          const phoneRaw = String(getColVal(row, COL_F_PHONE, 5) || '').trim();
          const whatsappRaw = String(getColVal(row, COL_G_WHATSAPP, 6) || '').trim();
          const socialStatusRaw = String(getColVal(row, COL_H_SOCIAL_STATUS, 7) || 'متزوج').trim();
          const categoryRaw = String(getColVal(row, COL_I_CATEGORY, 8) || 'نازحون مهجرون').trim();
          const centerNameRaw = String(getColVal(row, COL_J_CENTER_NAME, 9) || '').trim();
          const statusRaw = String(getColVal(row, COL_K_STATUS, 10) || 'نشط ومعتمد').trim();
          const selfAddRaw = String(getColVal(row, COL_L_SELF_ADD, 11) || '').trim();
          const notesRaw = String(getColVal(row, COL_M_NOTES, 12) || '').trim();

          // Validation of required fields
          if (!headIdRaw || !headNameRaw) {
            localLogs.push({
              row: rowNum,
              name: headNameRaw || 'غير معروف',
              id: headIdRaw || 'غير معروف',
              reason: 'الحقل الإجباري (اسم رب الأسرة أو رقم الهوية الوطنية) فارغ في السطر.'
            });
            duplicates++;
            return;
          }

          // Robust check and pad ID to 9 digits if numeric and has length 7 or 8 (e.g. leading zeros stripped by Excel)
          let headIdProcessed = headIdRaw;
          if (/^\d+$/.test(headIdProcessed) && headIdProcessed.length >= 7 && headIdProcessed.length < 9) {
            headIdProcessed = headIdProcessed.padStart(9, '0');
          }

          if (headIdProcessed.length !== 9 || !/^\d+$/.test(headIdProcessed)) {
            localLogs.push({
              row: rowNum,
              name: headNameRaw,
              id: headIdProcessed,
              reason: 'رقم الهوية لرب الأسرة غير صالح (يجب أن يتكون من 9 خانات رقمية بالضبط).'
            });
            duplicates++;
            return;
          }

          // Process Spouse ID similarly
          let spouseIdProcessed = spouseIdRaw;
          if (spouseIdProcessed && /^\d+$/.test(spouseIdProcessed) && spouseIdProcessed.length >= 7 && spouseIdProcessed.length < 9) {
            spouseIdProcessed = spouseIdProcessed.padStart(9, '0');
          }

          // Check duplicate in same file list (before db save) to prevent duplicates within the spreadsheet itself
          const isDuplicateInFile = rowsData.slice(0, idx).some(r => {
            const id = String(getColVal(r, COL_B_HEAD_ID, 1) || '').trim();
            let procId = id;
            if (/^\d+$/.test(procId) && procId.length >= 7 && procId.length < 9) {
              procId = procId.padStart(9, '0');
            }
            return procId === headIdProcessed;
          });

          if (isDuplicateInFile) {
            localLogs.push({
              row: rowNum,
              name: headNameRaw,
              id: headIdProcessed,
              reason: 'رقم هوية رب الأسرة مكرر في نفس ملف كشف الإكسل المرفوع.'
            });
            duplicates++;
            return;
          }

          // Match Shelter Center ID dynamically
          let matchedCenterId = currentEmployee.centerId || '';
          if (!matchedCenterId && centerNameRaw) {
            const matchedCenter = systemCenters.find(c => 
              c.name.trim().toLowerCase() === centerNameRaw.trim().toLowerCase() ||
              c.name.trim().includes(centerNameRaw.trim()) ||
              centerNameRaw.trim().includes(c.name.trim())
            );
            if (matchedCenter) {
              matchedCenterId = matchedCenter.id;
            } else {
              // Automatically link to first shelter center or create a generic default
              matchedCenterId = systemCenters[0]?.id || '';
            }
          } else if (!matchedCenterId) {
            matchedCenterId = systemCenters[0]?.id || '';
          }

          // Auto-generate or use existing Family File Number
          let fileNo = fileNoRaw;
          if (!fileNo || fileNo === 'undefined' || fileNo === '-') {
            const randomSuffix = Math.floor(10000 + Math.random() * 90000);
            fileNo = `FL-${randomSuffix}`;
          }

          // Default category to 'نازحون مهجرون' as requested if empty
          const finalCategory = categoryRaw || 'نازحون مهجرون';

          // Default status to 'active' ('نشط ومعتمد')
          let finalStatus: 'active' | 'suspended' | 'review' = 'active';
          if (statusRaw.includes('موقوف') || statusRaw.includes('تجميد')) {
            finalStatus = 'suspended';
          } else if (statusRaw.includes('مراجعة')) {
            finalStatus = 'review';
          }

          // Create Family Object
          const newFamily: Family = {
            id: headIdProcessed,
            fileNumber: fileNo,
            headName: headNameRaw,
            spouseName: spouseNameRaw,
            spouseId: spouseIdProcessed,
            phone: phoneRaw,
            whatsapp: whatsappRaw || phoneRaw,
            socialStatus: socialStatusRaw,
            membersCount: spouseNameRaw ? 2 : 1, // Start with 2 if spouse is set, otherwise 1
            childrenCount: 0,
            malesCount: spouseNameRaw ? 1 : 1,
            femalesCount: spouseNameRaw ? 1 : 0,
            category: finalCategory,
            centerId: matchedCenterId,
            status: finalStatus,
            notes: notesRaw || 'تم الاستيراد التلقائي للبيانات عبر كشف إكسل (A-M).',
            canAddMembers: true,
            membersList: [],
            createdAt: new Date().toISOString()
          };

          // Save family and let the utility handle DB unique key check
          const saveRes = saveFamily(newFamily);
          if (saveRes.success) {
            added++;
          } else {
            duplicates++;
            localLogs.push({
              row: rowNum,
              name: headNameRaw,
              id: headIdProcessed,
              reason: saveRes.message
            });
          }
        });

        // Compute results
        const totalRows = rowsData.filter(r => r && r.length > 0).length;
        const rate = totalRows > 0 ? Math.round((added / totalRows) * 100) : 0;
        setImportedCount(added);
        setDuplicateCount(duplicates);
        setSuccessRate(rate);
        setReportLogs(localLogs);

        addLog(
          currentEmployee.name,
          `استيراد كشف إكسل (A-M) وتصفية السجلات: تم بنجاح إضافة ${added} أسرة وتخطي ${duplicates} سجلات غير مطابقة.`
        );

        if (window.Swal) {
          window.Swal.fire({
            icon: added > 0 ? 'success' : 'info',
            title: 'تمت معالجة كشف الإكسل',
            text: `تم استيراد ${added} أسرة وتوزيعها تلقائياً على مراكز الإيواء المعنية، وتم تصفية وحجب ${duplicates} سجلات مكررة أو خاطئة لتفادي تداخل البيانات.`,
            confirmButtonText: 'موافق، مراجعة التقرير الإحصائي',
            confirmButtonColor: '#2563eb'
          });
        }

      } catch (err) {
        console.error(err);
        alert('حدث خطأ فني أثناء قراءة ملف الإكسل. يرجى مراجعة ترويسة الأعمدة وتنسيق البيانات.');
      } finally {
        setParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* Header Block */}
      <div>
        <h2 className="text-xl font-bold font-cairo text-slate-800">بوابة استيراد وتوزيع كشوفات المستفيدين (Excel)</h2>
        <p className="text-slate-500 text-xs mt-1">
          قم برفع وتدقيق كشوفات العائلات في ثوانٍ معدودة. يقوم النظام تلقائياً بتوزيع البيانات ومنع الازدواجية في الأرقام الوطنية مع التوليد الفوري لأرقام الملفات العائلية.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Download Template */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2 text-right">
            <span className="text-3xl text-emerald-600 block"><i className="fa-solid fa-file-excel animate-bounce"></i></span>
            <h3 className="font-bold text-slate-800 text-sm">أولاً: تحميل كشف الهيكلية المعتمدة (A-M)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تشتمل الأعمدة الموحدة من العمود A حتى العمود M على كروكيات البيانات الأساسية للعائلة (الهوية، اسم الزوجة، المواليد، الأطفال، والمركز) دون حقل "رقم الملف" ليتولى النظام إنشائه آلياً.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-200"
          >
            <i className="fa-solid fa-cloud-arrow-down"></i>
            تحميل النموذج المعتمد (Columns A-M)
          </button>
        </div>

        {/* Card 2: Upload File Area */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm md:col-span-2 flex flex-col justify-between space-y-4">
          <div className="space-y-2 text-right">
            <h3 className="font-bold text-slate-800 text-sm">
              <i className="fa-solid fa-file-arrow-up ml-1 text-blue-600"></i>
              ثانياً: سحب وإسقاط ملف الكشف المعبأ
            </h3>
            <p className="text-xs text-slate-400">
              يقبل النظام الامتدادات القياسية لجداول البيانات (.xlsx, .xls) ويقوم تلقائياً بتدقيق رقم الهوية الوطنية المؤلف من 9 خانات للتخلص من حالات ازدواج المساعدات.
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-blue-500 transition-all bg-slate-50 relative cursor-pointer">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <span className="text-3xl text-slate-400 block mb-2"><i className="fa-solid fa-cloud-arrow-up"></i></span>
            <p className="text-xs font-bold text-slate-600">{file ? `تم اختيار الكشف: ${file.name}` : 'اسحب ملف الكشوفات هنا أو اضغط للتصفح المباشر'}</p>
            <p className="text-[10px] text-slate-400 mt-1">الحد الأقصى المسموح به للملف: 10 ميجابايت</p>
          </div>

          <button
            onClick={handleImportExcel}
            disabled={!file || parsing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-100"
          >
            {parsing ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <i className="fa-solid fa-circle-check"></i>
                <span>بدء تدقيق ومعالجة وتوزيع الكشف</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Reports */}
      {successRate !== null && (
        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="text-blue-600"><i className="fa-solid fa-chart-line"></i></span>
            <span>تقرير مطابقة وفلترة كشف استيراد المستفيدين</span>
          </h3>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <span className="text-slate-400 text-xs font-bold block">تم إدراجهم وتوزيعهم بنجاح</span>
              <span className="text-emerald-700 text-2xl font-black block mt-1">{importedCount} عائلة</span>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
              <span className="text-slate-400 text-xs font-bold block">سجلات مكررة أو خاطئة محجوبة</span>
              <span className="text-red-700 text-2xl font-black block mt-1">{duplicateCount} سجل</span>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <span className="text-slate-400 text-xs font-bold block">نسبة نجاح تصفية البيانات</span>
              <span className="text-blue-700 text-2xl font-black block mt-1">{successRate}%</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-600">
              <span>معدل قبول وسلامة السجلات المستوردة</span>
              <span>{successRate}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div 
                style={{ width: `${successRate}%` }}
                className="bg-gradient-to-r from-emerald-500 to-blue-600 h-full rounded-full transition-all duration-1000"
              ></div>
            </div>
          </div>

          {/* Detail log of skipped records */}
          {reportLogs.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700"><i className="fa-solid fa-triangle-exclamation text-amber-500"></i> تفاصيل السجلات المحجوبة والمحذرة (لمنع تكرار صرف المساعدات):</h4>
              
              <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <th className="py-2.5 px-4 font-bold">رقم السطر (إكسل)</th>
                      <th className="py-2.5 px-4 font-bold">الاسم المكتشف</th>
                      <th className="py-2.5 px-4 font-bold">رقم هوية رب العائلة</th>
                      <th className="py-2.5 px-4 font-bold text-red-600">سبب الاستبعاد والتحذير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {reportLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-2 px-4 font-bold font-mono text-slate-700">سطر {log.row}</td>
                        <td className="py-2 px-4 font-bold">{log.name}</td>
                        <td className="py-2 px-4 font-mono">{log.id}</td>
                        <td className="py-2 px-4 text-red-600 font-medium">{log.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
