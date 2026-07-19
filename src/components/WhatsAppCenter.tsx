import React, { useState, useEffect } from 'react';
import { WhatsappTemplate, Family, AidProgram, Beneficiary, ShelterCenter } from '../types';
import { 
  getTemplates, 
  saveTemplate, 
  deleteTemplate, 
  getFamilies, 
  getAidPrograms, 
  getBeneficiaries, 
  getCenters, 
  addLog 
} from '../utils/db';

interface WhatsAppCenterProps {
  currentEmployee: { name: string };
}

export default function WhatsAppCenter({ currentEmployee }: WhatsAppCenterProps) {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [programs, setPrograms] = useState<AidProgram[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [centers, setCenters] = useState<ShelterCenter[]>([]);
  
  // Active state
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Sender Category filters
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'delivered' | 'pending' | 'center'>('all');
  const [selectedCenterId, setSelectedCenterId] = useState('');

  // Template CRUD states
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // New Template form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Bulk Sender wizard state
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkQueue, setBulkQueue] = useState<{ family: Family; beneficiary: Beneficiary }[]>([]);
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState(0);
  const [bulkSentCount, setBulkSentCount] = useState(0);
  const [bulkMode, setBulkMode] = useState<'simulated' | 'sequential'>('simulated'); // simulated api send vs sequential click-to-open
  const [bulkLogs, setBulkLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadData = () => {
    const loadedTemplates = getTemplates();
    setTemplates(loadedTemplates);
    setFamilies(getFamilies());
    const activeProgs = getAidPrograms();
    setPrograms(activeProgs);
    setCenters(getCenters());

    if (activeProgs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(activeProgs[0].id);
    }
    if (loadedTemplates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(loadedTemplates[0].id);
    }
    setBeneficiaries(getBeneficiaries());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, []);

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];
  const activeProgram = programs.find(p => p.id === selectedProgramId);

  // Load editing values
  useEffect(() => {
    if (activeTemplate) {
      setEditTitle(activeTemplate.title);
      setEditContent(activeTemplate.content);
    }
  }, [activeTemplate]);

  // Save template modifications
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;

    const updated: WhatsappTemplate = {
      ...activeTemplate,
      title: editTitle,
      content: editContent
    };

    saveTemplate(updated);
    setIsEditing(false);
    addLog(currentEmployee.name, `تحديث قالب رسالة واتساب: ${updated.title}`);

    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'تم تحديث القالب',
        text: 'تم حفظ صيغة المتغيرات التلقائية بنجاح.',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      alert('تم تحديث قالب الرسالة بنجاح.');
    }
    loadData();
  };

  // Add new template
  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert('يرجى كتابة عنوان ونص القالب.');
      return;
    }

    const newTemp: WhatsappTemplate = {
      id: `temp-${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim()
    };

    saveTemplate(newTemp);
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
    setSelectedTemplateId(newTemp.id);
    addLog(currentEmployee.name, `إنشاء قالب رسالة واتساب جديد: ${newTemp.title}`);

    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'تم إنشاء القالب',
        text: 'تمت إضافة قالب الرسالة الجاهزة الجديد لقائمة القوالب.',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      alert('تم إضافة القالب الجديد بنجاح.');
    }
    loadData();
  };

  // Delete Template
  const handleDeleteTemplateClick = (id: string, title: string) => {
    const proceed = window.confirm(`هل أنت متأكد من حذف قالب المراسلة: "${title}"؟`);
    if (!proceed) return;

    deleteTemplate(id);
    addLog(currentEmployee.name, `حذف قالب رسالة واتساب: ${title}`);
    if (selectedTemplateId === id) {
      setSelectedTemplateId('');
    }

    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'تم الحذف',
        text: 'تم إزالة قالب المراسلة من النظام.',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      alert('تم حذف القالب.');
    }
    loadData();
  };

  // Filter candidates/recipients for the active program and based on selected category / center
  const queue = beneficiaries.filter(b => {
    if (!activeProgram) return false;
    if (b.aidProgramId !== activeProgram.id) return false;

    const fam = families.find(f => f.id === b.familyId);
    if (!fam) return false;

    // Filter by delivery status category
    if (selectedCategory === 'delivered') {
      if (b.status !== 'delivered') return false;
    } else if (selectedCategory === 'pending') {
      if (b.status === 'delivered') return false;
    } else if (selectedCategory === 'center') {
      if (selectedCenterId && fam.centerId !== selectedCenterId) return false;
    }

    return true;
  });

  // Filter visible queue by search query (name or phone or national ID)
  const visibleQueue = queue.filter(b => {
    const fam = families.find(f => f.id === b.familyId);
    if (!fam) return false;
    return (
      fam.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fam.id.includes(searchQuery) ||
      fam.phone.includes(searchQuery) ||
      fam.whatsapp.includes(searchQuery)
    );
  });

  // Generate personalized template message text
  const generateMessageText = (fam: Family, b: Beneficiary): string => {
    const templateToUse = activeTemplate || templates[0];
    if (!templateToUse || !activeProgram) return '';

    const centerObj = centers.find(c => c.id === fam.centerId);

    let text = templateToUse.content;
    text = text.replace(/{الاسم}/g, fam.headName);
    text = text.replace(/{اسم المشروع}/g, activeProgram.name);
    text = text.replace(/{نوع المساعدة}/g, activeProgram.type);
    text = text.replace(/{المركز}/g, centerObj ? centerObj.name : 'مركز النزوح المعتمد لك');
    text = text.replace(/{التاريخ}/g, new Date().toLocaleDateString('ar-EG'));
    text = text.replace(/{الوقت}/g, '09:00 صباحاً إلى 02:00 مساءً');
    text = text.replace(/{رقم المعاملة}/g, b.id);

    return text;
  };

  // Build the clean WhatsApp Link and return it
  const getWhatsAppLink = (fam: Family, b: Beneficiary): { phone: string; text: string; url: string } => {
    const text = generateMessageText(fam, b);
    const phoneNo = fam.whatsapp || fam.phone;
    
    let formattedPhone = phoneNo.replace(/\D/g, '');
    if (formattedPhone.startsWith('05')) {
      formattedPhone = '970' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('5')) {
      formattedPhone = '970' + formattedPhone;
    } else if (formattedPhone.startsWith('00')) {
      formattedPhone = formattedPhone.slice(2);
    }

    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
    return { phone: formattedPhone, text, url };
  };

  // Open direct WhatsApp link for one family
  const handleSendWhatsAppSingle = (fam: Family, b: Beneficiary) => {
    const { url } = getWhatsAppLink(fam, b);
    window.open(url, '_blank');
    addLog(currentEmployee.name, `إرسال تنبيه واتساب فردي للمستفيد: ${fam.headName}`);
  };

  // Open the Bulk Sending Setup wizard
  const handleOpenBulkSender = () => {
    if (visibleQueue.length === 0) {
      alert('لا توجد أسماء مطابقة ومجهّزة للإرسال الجماعي حالياً بناءً على تصفيتك الحالية.');
      return;
    }

    const items = visibleQueue.map(b => {
      const fam = families.find(f => f.id === b.familyId)!;
      return { family: fam, beneficiary: b };
    });

    setBulkQueue(items);
    setBulkCurrentIndex(0);
    setBulkSentCount(0);
    setBulkLogs([`تم تجهيز حملة إرسال جماعية لعدد ${items.length} مستفيد.`]);
    setIsSendingBulk(true);
  };

  // Handle simulated bulk broadcast
  const startSimulatedBulk = async () => {
    if (isSimulating) return;
    setIsSimulating(true);

    const logs: string[] = [...bulkLogs, 'بدء المراسلة التلقائية التشبيهية الذكية...'];
    setBulkLogs(logs);

    for (let i = bulkCurrentIndex; i < bulkQueue.length; i++) {
      const item = bulkQueue[i];
      
      // Artificial delay to simulate actual gateway sending
      await new Promise(resolve => setTimeout(resolve, 1500));

      const logMsg = `✓ تم تسليم الرسالة بنجاح إلى الرقم (${item.family.whatsapp || item.family.phone}) - المستفيد: ${item.family.headName}`;
      
      setBulkCurrentIndex(i + 1);
      setBulkSentCount(prev => prev + 1);
      setBulkLogs(prev => [...prev, logMsg]);

      // Add audit log
      addLog(currentEmployee.name, `إرسال آلي للرسالة الجماعية: ${item.family.headName} [جوال: ${item.family.whatsapp || item.family.phone}]`);
    }

    setIsSimulating(false);
    setBulkLogs(prev => [...prev, '🏁 تم الانتهاء بنجاح من إرسال كامل كشف الحملة المحددة!']);
    
    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'اكتمل الإرسال الجماعي',
        text: `تم بث رسائل الحملة التذكيرية بنجاح لعدد ${bulkQueue.length} مستفيد عبر خادم البوابة الرقمية.`,
        confirmButtonText: 'ممتاز',
        confirmButtonColor: '#10b981'
      });
    }
  };

  // Sequential manual trigger
  const handleSequentialSendNext = () => {
    if (bulkCurrentIndex >= bulkQueue.length) return;

    const item = bulkQueue[bulkCurrentIndex];
    const { url } = getWhatsAppLink(item.family, item.beneficiary);
    
    window.open(url, '_blank');

    setBulkLogs(prev => [
      ...prev,
      `[يدوي] تم فتح رابط المراسلة للمستفيد: ${item.family.headName} (${item.family.whatsapp || item.family.phone})`
    ]);
    
    setBulkCurrentIndex(prev => prev + 1);
    setBulkSentCount(prev => prev + 1);
    addLog(currentEmployee.name, `فتح نافذة واتساب جماعية متسلسلة للمستفيد: ${item.family.headName}`);
  };

  const handleSkipNext = () => {
    if (bulkCurrentIndex >= bulkQueue.length) return;
    const item = bulkQueue[bulkCurrentIndex];

    setBulkLogs(prev => [
      ...prev,
      `[تخطي] تم تجاوز المستفيد: ${item.family.headName}`
    ]);
    setBulkCurrentIndex(prev => prev + 1);
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in font-sans">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-cairo text-slate-800 flex items-center gap-2">
            <i className="fa-brands fa-whatsapp text-emerald-600 text-2xl"></i>
            <span>بوابة المراسلات وإرسال التنبيهات الجماعية (WhatsApp Engine)</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">تخصيص وإدارة قوالب الرسائل الجاهزة وإطلاق حملات التذكير الجماعية للمستفيدين بالاستلام الميداني.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdding(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 transition-all flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-plus"></i>
            <span>إضافة قالب رسالة جديد</span>
          </button>
        </div>
      </div>

      {/* Adding template mode */}
      {isAdding && (
        <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-3xl shadow-sm space-y-4 animate-slide-up">
          <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
            <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
              <i className="fa-solid fa-file-signature"></i>
              <span>تصميم قالب مراسلة واتساب جاهز جديد</span>
            </h3>
            <button 
              onClick={() => setIsAdding(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold"
            >
              إلغاء وتراجع
            </button>
          </div>
          <form onSubmit={handleCreateTemplate} className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="md:col-span-1 space-y-3">
              <div>
                <label className="text-slate-600 block mb-1 font-bold">اسم القالب التعريفي:</label>
                <input
                  type="text"
                  placeholder="مثال: إشعار استلام سلة غذائية"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl outline-none font-bold text-slate-800"
                />
              </div>
              <div className="p-4 bg-emerald-100/30 rounded-2xl border border-emerald-200/40 text-[11px] text-slate-600 space-y-2 leading-relaxed">
                <span className="font-bold text-emerald-800 block">💡 الرموز التلقائية المتاحة للتخصيص:</span>
                <p>يمكنك نسخ الرموز أدناه ولصقها بنص الرسالة ليقوم النظام باستبدالها تلقائياً لكل مواطن ومستلم عند الإرسال المباشر:</p>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  <code className="bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 font-bold">{`{الاسم}`}</code>
                  <code className="bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 font-bold">{`{اسم المشروع}`}</code>
                  <code className="bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 font-bold">{`{نوع المساعدة}`}</code>
                  <code className="bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 font-bold">{`{المركز}`}</code>
                  <code className="bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 font-bold">{`{التاريخ}`}</code>
                  <code className="bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 font-bold">{`{الوقت}`}</code>
                  <code className="bg-white border border-emerald-100 px-1.5 py-0.5 rounded text-emerald-700 font-bold">{`{رقم المعاملة}`}</code>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="text-slate-600 block mb-1 font-bold">صياغة نص الرسالة الذكي:</label>
                <textarea
                  rows={8}
                  placeholder="الأخ/النائب الفاضل {الاسم}... يرجى الحضور لمركز {المركز} لاستلام {نوع المساعدة} الخاصة بـ {اسم المشروع}..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl outline-none font-sans leading-relaxed text-slate-800"
                ></textarea>
              </div>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
              >
                <i className="fa-solid fa-save"></i>
                <span>حفظ وإضافة القالب لقائمة الاختيارات</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Templates Panel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <i className="fa-solid fa-sliders text-blue-600"></i>
              <span>قوالب الرسائل الجاهزة</span>
            </h3>
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-bold">المجموع: {templates.length}</span>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 block font-bold">اختر القالب الحالي للمعالجة والتشغيل:</label>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {templates.map(t => (
                <div 
                  key={t.id}
                  className={`group relative rounded-xl text-xs font-bold transition-all flex items-center justify-between p-1.5 ${selectedTemplateId === t.id ? 'bg-blue-600 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
                >
                  <button
                    onClick={() => { setSelectedTemplateId(t.id); setIsEditing(false); }}
                    className="flex-1 text-right px-3 py-2 outline-none"
                  >
                    <span>{t.title}</span>
                  </button>
                  {templates.length > 1 && (
                    <button
                      onClick={() => handleDeleteTemplateClick(t.id, t.title)}
                      className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ml-1 cursor-pointer hover:bg-red-500 hover:text-white ${selectedTemplateId === t.id ? 'text-blue-200' : 'text-slate-400'}`}
                      title="حذف القالب"
                    >
                      <i className="fa-solid fa-trash text-[10px]"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {activeTemplate && (
            <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-3 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800">{activeTemplate.title}</span>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                >
                  {isEditing ? 'إلغاء التعديل' : 'تعديل الصياغة'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">اسم القالب:</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">نص الرسالة والرموز التلقائية:</label>
                    <textarea
                      rows={6}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-sans text-xs leading-relaxed"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-md shadow-blue-600/10"
                  >
                    حفظ التعديلات
                  </button>
                </form>
              ) : (
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-400 font-bold block mb-1">صيغة المعاينة الافتراضية:</p>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-sans bg-white p-3 rounded-xl border border-slate-100">{activeTemplate.content}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recipients list and Bulk Sender filter controls */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          
          {/* Header & Program filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <i className="fa-solid fa-users-gear text-emerald-600"></i>
              <span>بث الرسائل وتصفية فئات التوزيع</span>
            </h3>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">للمشروع الحالي:</span>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 focus:ring-0 outline-none"
              >
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filtering Categories (المستلمون، غير المستلمين، أو حسب المركز) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 block">اختر الفئة المستهدفة بالبث الجماعي:</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${selectedCategory === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`}
              >
                <i className="fa-solid fa-layer-group"></i>
                <span>جميع الأسماء بالملف</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('delivered')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${selectedCategory === 'delivered' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`}
              >
                <i className="fa-solid fa-circle-check"></i>
                <span>المستلمون فقط</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('pending')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${selectedCategory === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`}
              >
                <i className="fa-solid fa-clock-rotate-left"></i>
                <span>غير المستلمين</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('center')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${selectedCategory === 'center' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`}
              >
                <i className="fa-solid fa-house-user"></i>
                <span>توزيع حسب المركز</span>
              </button>
            </div>

            {selectedCategory === 'center' && (
              <div className="pt-2 animate-slide-up flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-bold">مركز الإيواء المستهدف:</span>
                <select
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 focus:ring-0 outline-none flex-1 max-w-xs"
                >
                  <option value="">-- اختر مركز إيواء معين --</option>
                  {centers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search filter input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="ابحث بالاسم الكامل، رقم الجوال أو رقم الهوية الوطنية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-11 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs transition-all outline-none text-slate-700 font-bold"
              />
              <div className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </div>
            </div>
            
            {/* Launch Campaign Button */}
            <button
              onClick={handleOpenBulkSender}
              disabled={visibleQueue.length === 0}
              className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-paper-plane"></i>
              <span>بث جماعي للكشف ({visibleQueue.length})</span>
            </button>
          </div>

          {/* Recipients Data Table */}
          {visibleQueue.length > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] text-slate-400 px-1">
                <span>تظهر النتائج المطابقة للتصفية: <strong className="text-slate-600">{visibleQueue.length} مستفيد</strong></span>
                <span>قالب المراسلة المربوط: <strong className="text-blue-600">{activeTemplate ? activeTemplate.title : templates[0]?.title}</strong></span>
              </div>
              <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-[380px] overflow-y-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/60 text-slate-500 border-b border-slate-100 sticky top-0 z-10">
                      <th className="py-3 px-4 font-bold">اسم رب الأسرة</th>
                      <th className="py-3 px-4 font-bold">رقم الهوية الوطنية</th>
                      <th className="py-3 px-4 font-bold">رقم الجوال / واتساب</th>
                      <th className="py-3 px-4 font-bold text-center">حالة المشروع</th>
                      <th className="py-3 px-4 text-center">تنبيه واتساب مفرد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {visibleQueue.map(b => {
                      const fam = families.find(f => f.id === b.familyId);
                      if (!fam) return null;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800">{fam.headName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-500">{fam.id}</td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-600">{fam.whatsapp || fam.phone}</td>
                          <td className="py-3 px-4 text-center">
                            {b.status === 'delivered' ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded font-bold text-[10px] inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                تم الاستلام
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded font-bold text-[10px] inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                بانتظار الاستلام
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => handleSendWhatsAppSingle(fam, b)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-lg text-[11px] transition-all inline-flex items-center gap-1.5 cursor-pointer"
                              title="إرسال تنبيه عبر واتساب"
                            >
                              <i className="fa-brands fa-whatsapp text-sm text-emerald-500"></i>
                              <span>إرسال فردي</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <span className="text-4xl block"><i className="fa-brands fa-whatsapp text-slate-300"></i></span>
              <p className="text-xs font-bold text-slate-500">لا يوجد مستلمين مطابقين للتصفية في هذا المشروع حالياً.</p>
              <p className="text-[11px] text-slate-400">يرجى تعديل الفئات المستهدفة أو البحث باسم آخر.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Sender Wizard Modal (بوابة حملة الإرسال الجماعي) */}
      {isSendingBulk && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 space-y-6 relative overflow-hidden animate-scale-up">
            
            {/* Background elements */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400"></div>

            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">بوابة الإرسال الجماعي التفاعلية</span>
                <h3 className="text-lg font-bold text-slate-800 font-cairo mt-1.5">حملة مراسلة كشف التوزيع: {activeProgram?.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">القالب المعتمد: {activeTemplate?.title}</p>
              </div>
              <button 
                onClick={() => {
                  if (isSimulating) {
                    if (!window.confirm('الحملة قيد المراسلة الآن، هل تود إنهاؤها وإلغاؤها؟')) return;
                  }
                  setIsSendingBulk(false);
                }}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Campaign info cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي الكشف</span>
                <span className="text-slate-800 text-lg font-extrabold mt-0.5">{bulkQueue.length} مستفيد</span>
              </div>
              <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/30">
                <span className="text-[10px] text-blue-500 block font-bold">المعالج حالياً</span>
                <span className="text-blue-700 text-lg font-extrabold mt-0.5">{bulkCurrentIndex + 1} / {bulkQueue.length}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                <span className="text-[10px] text-emerald-500 block font-bold">تم إرساله</span>
                <span className="text-emerald-700 text-lg font-extrabold mt-0.5">{bulkSentCount} عائلة</span>
              </div>
            </div>

            {/* Main Action Area */}
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
              
              {/* Select Mode */}
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
                <span className="font-bold text-slate-600">طريقة الإرسال المتبعة:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkMode('simulated')}
                    disabled={isSimulating}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${bulkMode === 'simulated' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-100'}`}
                  >
                    بث تلقائي (محاكي بوابة الإغاثة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode('sequential')}
                    disabled={isSimulating}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${bulkMode === 'sequential' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-100'}`}
                  >
                    يدوي متتابع (WhatsApp Web)
                  </button>
                </div>
              </div>

              {bulkCurrentIndex < bulkQueue.length ? (
                <div className="space-y-3 animate-fade-in text-xs">
                  {/* Current target beneficiary */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">المواطن المستهدف بالمراسلة:</span>
                      <span className="font-extrabold text-slate-800 text-sm">{bulkQueue[bulkCurrentIndex].family.headName}</span>
                      <span className="text-slate-500 text-[10px] block mt-0.5 font-mono">هاتف/واتساب: {bulkQueue[bulkCurrentIndex].family.whatsapp || bulkQueue[bulkCurrentIndex].family.phone}</span>
                    </div>
                    <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg text-[10px]">
                      {bulkQueue[bulkCurrentIndex].family.category}
                    </span>
                  </div>

                  {/* Message preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold">صورة ومعاينة نص الرسالة الشخصية له:</span>
                    <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50 max-h-32 overflow-y-auto leading-relaxed text-slate-700 whitespace-pre-wrap font-sans text-[11px]">
                      {generateMessageText(bulkQueue[bulkCurrentIndex].family, bulkQueue[bulkCurrentIndex].beneficiary)}
                    </div>
                  </div>

                  {/* Wizard Buttons */}
                  <div className="flex gap-2.5 pt-2">
                    {bulkMode === 'simulated' ? (
                      <button
                        onClick={startSimulatedBulk}
                        disabled={isSimulating}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
                      >
                        {isSimulating ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            <span>بث الرسائل الجاري تلقائياً...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-play"></i>
                            <span>بدء البث التلقائي السريع</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleSequentialSendNext}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/10"
                        >
                          <i className="fa-brands fa-whatsapp text-base"></i>
                          <span>إرسال وفتح WhatsApp التالي</span>
                        </button>
                        <button
                          onClick={handleSkipNext}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl transition-all text-xs cursor-pointer"
                        >
                          تخطي هذا الاسم
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-emerald-800 space-y-2 animate-fade-in">
                  <span className="text-4xl block">🎉</span>
                  <h4 className="text-sm font-bold">تم الانتهاء من بث الحملة بالكامل!</h4>
                  <p className="text-[11px] text-slate-500">تم إرسال/معالجة كافة كشوف الأسماء المختارة بنجاح.</p>
                </div>
              )}
            </div>

            {/* Campaign Logs */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <i className="fa-solid fa-receipt text-slate-400"></i>
                <span>سجل المخرجات المباشرة للحملة:</span>
              </span>
              <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-[10px] h-32 overflow-y-auto space-y-1.5 leading-relaxed">
                {bulkLogs.map((log, index) => (
                  <div key={index} className="flex gap-1.5">
                    <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span>
                    <span className={log.startsWith('✓') ? 'text-emerald-400 font-bold' : log.startsWith('[تخطي]') ? 'text-amber-400' : 'text-slate-300'}>{log}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom buttons */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsSendingBulk(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-5 rounded-xl cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
