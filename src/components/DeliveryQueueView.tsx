import React, { useState, useEffect, useRef } from 'react';
import { AidProgram, Family, Beneficiary, ShelterCenter, DeliveryRecord } from '../types';
import { getAidPrograms, getFamilies, getBeneficiaries, saveBeneficiary, saveDelivery, getCenters, getDeliveries, addLog } from '../utils/db';

interface DeliveryQueueViewProps {
  currentEmployee: { id: string; name: string; role: string; centerId: string };
}

export default function DeliveryQueueView({ currentEmployee }: DeliveryQueueViewProps) {
  const [programs, setPrograms] = useState<AidProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [families, setFamilies] = useState<Family[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [centers, setCenters] = useState<ShelterCenter[]>([]);

  // Search and scanning
  const [searchQuery, setSearchQuery] = useState('');
  const [scanMode, setScanMode] = useState(false);

  // Active delivery processing
  const [processingBeneficiary, setProcessingBeneficiary] = useState<Beneficiary | null>(null);
  const [processingFamily, setProcessingFamily] = useState<Family | null>(null);

  // Verification options
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'signature' | 'otp' | 'qr'>('signature');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Signature Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const loadData = () => {
    const activeProgs = getAidPrograms().filter(p => p.status === 'active');
    setPrograms(activeProgs);
    if (activeProgs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(activeProgs[0].id);
    }

    setFamilies(getFamilies());
    setBeneficiaries(getBeneficiaries());
    setCenters(getCenters());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, [selectedProgramId]);

  const selectedProgram = programs.find(p => p.id === selectedProgramId);

  // Filter approved beneficiaries for this project and center (if center manager or delivery staff)
  const approvedBeneficiaries = beneficiaries.filter(b => {
    if (!selectedProgram) return false;
    if (b.aidProgramId !== selectedProgram.id) return false;
    
    // Center manager/delivery restriction
    if ((currentEmployee.role === 'center_manager' || currentEmployee.role === 'delivery') && currentEmployee.centerId) {
      return b.assignedCenterId === currentEmployee.centerId;
    }
    return true;
  });

  // Calculate statistics
  const totalApproved = approvedBeneficiaries.length;
  const totalDelivered = approvedBeneficiaries.filter(b => b.status === 'delivered').length;
  const remaining = totalApproved - totalDelivered;
  const completionRate = totalApproved > 0 ? Math.round((totalDelivered / totalApproved) * 100) : 0;
  const totalValueDisbursed = totalDelivered * (selectedProgram?.value || 0);

  // Search matching families inside the approved list
  const visibleBeneficiaries = approvedBeneficiaries.filter(b => {
    const fam = families.find(f => f.id === b.familyId);
    if (!fam) return false;

    const matchesQuery = 
      fam.headName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fam.id.includes(searchQuery) ||
      fam.fileNumber.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesQuery;
  });

  // Open delivery confirmation modal
  const handleStartDelivery = (b: Beneficiary) => {
    const fam = families.find(f => f.id === b.familyId);
    if (!fam) return;

    if (b.status === 'delivered') {
      if (window.Swal) {
        window.Swal.fire({
          icon: 'info',
          title: 'طرد مسلّم مسبقاً',
          text: `هذه العائلة (${fam.headName}) استلمت المساعدة بالفعل في وقت سابق.`,
          confirmButtonText: 'موافق',
          confirmButtonColor: '#1d4ed8'
        });
      }
      return;
    }

    setProcessingBeneficiary(b);
    setProcessingFamily(fam);
    setOtpSent(false);
    setOtpCode('');
    setEnteredOtp('');
    setVerificationMethod('signature');
    setDeliveryNotes('');
    setHasSigned(false);

    // Give time for canvas to mount
    setTimeout(() => {
      initCanvas();
    }, 200);
  };

  // Canvas Drawing Logic
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a'; // Deep blue
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    
    // Get mouse/touch coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      // Prevent scrolling on touch devices when signing
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    initCanvas();
    setHasSigned(false);
  };

  // OTP Simulation
  const handleSendOtp = () => {
    if (!processingFamily) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(code);
    setOtpSent(true);

    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'تم إرسال رمز التحقق OTP',
        text: `تم محاكاة إرسال كود التحقق في رسالة نصية قصيرة لجوال المستفيد ${processingFamily.phone}: (الرمز هو: ${code})`,
        confirmButtonText: 'متابعة التحقق',
        confirmButtonColor: '#10b981'
      });
    }
  };

  // Confirm complete delivery and commit transaction
  const handleConfirmDelivery = (e: React.FormEvent) => {
    e.preventDefault();

    if (!processingBeneficiary || !processingFamily || !selectedProgram) return;

    // Validation
    if (verificationMethod === 'signature' && !hasSigned) {
      alert('الرجاء مطالبة المستفيد بالتوقيع على الشاشة أولاً لتأكيد الاستحقاق.');
      return;
    }

    if (verificationMethod === 'otp') {
      if (enteredOtp !== otpCode) {
        alert('رمز التحقق OTP غير صحيح. يرجى إدخال الكود المكون من 6 أرقام والمكتوب بالتنبيه.');
        return;
      }
    }

    // Capture Signature image if drawn
    let signatureBase64 = '';
    if (verificationMethod === 'signature' && canvasRef.current) {
      signatureBase64 = canvasRef.current.toDataURL('image/png');
    }

    // Try to get current Geolocation
    let gpsStr = '31.3462, 34.3023'; // Default central Gaza/Khan Younis
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsStr = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
        },
        () => {}
      );
    }

    // Create delivery record
    const deliveryId = `TX-${Date.now()}`;
    const newDelivery: DeliveryRecord = {
      id: deliveryId,
      beneficiaryId: processingBeneficiary.id,
      familyId: processingFamily.id,
      aidProgramId: selectedProgram.id,
      receivedBy: processingFamily.headName,
      recipientId: processingFamily.id,
      deliveredAt: new Date().toISOString(),
      employeeName: currentEmployee.name,
      employeeId: currentEmployee.id,
      centerId: processingFamily.centerId,
      ipAddress: '192.168.1.' + Math.floor(20 + Math.random() * 200),
      deviceInfo: navigator.userAgent.substring(0, 50),
      gpsLocation: gpsStr,
      signature: signatureBase64 || undefined,
      verificationMethod: verificationMethod === 'signature' ? 'signature' : 'otp',
      notes: deliveryNotes.trim() || 'تسليم قانوني فوري باليد للمستفيد بموجب الهوية الشخصية.'
    };

    // Update Beneficiary status
    const updatedBeneficiary: Beneficiary = {
      ...processingBeneficiary,
      status: 'delivered',
      deliveryDate: newDelivery.deliveredAt,
      deliveryEmployeeId: currentEmployee.id,
      deliveryEmployeeName: currentEmployee.name,
      receivedBy: processingFamily.headName,
      recipientId: processingFamily.id,
      notes: newDelivery.notes
    };

    saveDelivery(newDelivery);
    saveBeneficiary(updatedBeneficiary);
    addLog(
      currentEmployee.name,
      `إتمام عملية تسليم المساعدة بنجاح للمستفيد (${processingFamily.headName}) بمشروع: ${selectedProgram.name}`
    );

    // Close Modal
    setProcessingBeneficiary(null);
    setProcessingFamily(null);

    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'تم إتمام التسليم وتوثيق العقد',
        text: `تم تقييد تسليم الطرد للمستفيد بنجاح برقم قيد معتمد: ${deliveryId}.`,
        confirmButtonText: 'حسناً، رائع',
        confirmButtonColor: '#10b981'
      });
    }
  };

  // Fast Barcode scanning simulation
  const handleSimulateScan = () => {
    const unDelivered = visibleBeneficiaries.find(b => b.status === 'approved');
    if (unDelivered) {
      handleStartDelivery(unDelivered);
    } else {
      alert('لا توجد عوائل غير مستلمة مطابقة حالياً لمحاكاة مسح الكود.');
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-cairo">منصة وجدول التوزيع الميداني الرقمي</h2>
          <p className="text-slate-500 text-xs mt-1">تأكيد تسليم الطرود الغذائية، المساعدات النقدية، وإمضاء المستلم على اللوحة الإلكترونية كإثبات رسمي</p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">المشروع الإغاثي النشط:</span>
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-blue-700 focus:ring-0 outline-none shadow-sm"
          >
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedProgram ? (
        <>
          {/* Real-time stats header */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
              <span className="text-slate-400 text-[10px] font-bold block">مجموع المستهدفين بالموقع</span>
              <span className="text-slate-800 text-lg font-black block mt-1">{totalApproved} عائلات</span>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
              <span className="text-slate-400 text-[10px] font-bold block">مستفيدين تم تسليمهم</span>
              <span className="text-emerald-700 text-lg font-black block mt-1">{totalDelivered} طرد</span>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
              <span className="text-slate-400 text-[10px] font-bold block">العوائل المتبقية بالانتظار</span>
              <span className="text-amber-700 text-lg font-black block mt-1">{remaining} عائلة</span>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
              <span className="text-slate-400 text-[10px] font-bold block">نسبة اكتمال التوزيع</span>
              <span className="text-blue-700 text-lg font-black block mt-1">{completionRate}%</span>
            </div>
            <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 text-center col-span-2 md:col-span-1">
              <span className="text-slate-400 text-[10px] font-bold block">إجمالي القيمة الموزعة</span>
              <span className="text-violet-700 text-lg font-black block mt-1">{totalValueDisbursed} شيكل</span>
            </div>
          </div>

          {/* Search bar and Scan Sim */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="ابحث بالهوية الوطنية للمستفيد أو اسمه الكامل للبدء بالتسليم المعتمد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-11 py-2.5 bg-slate-100 hover:bg-slate-200/50 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl text-xs transition-all outline-none"
              />
              <div className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400">
                <i className="fa-solid fa-barcode text-sm"></i>
              </div>
            </div>

            <button
              onClick={handleSimulateScan}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-expand"></i>
              محاكاة مسح QR/Barcode كرت العائلة
            </button>
          </div>

          {/* Delivery Queue Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {visibleBeneficiaries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                      <th className="py-4 px-5">رقم الكرت الدولي</th>
                      <th className="py-4 px-5">المستفيد المسجل</th>
                      <th className="py-4 px-5">أفراد الأسرة</th>
                      <th className="py-4 px-5">رقم الهوية والجوال</th>
                      <th className="py-4 px-5">حالة التسليم</th>
                      <th className="py-4 px-5 text-center">الإجراء الميداني</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {visibleBeneficiaries.map(b => {
                      const fam = families.find(f => f.id === b.familyId);
                      if (!fam) return null;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="py-3.5 px-5 font-mono text-blue-700 font-bold">{b.qrCode}</td>
                          <td className="py-3.5 px-5">
                            <p className="font-bold text-slate-800 text-sm">{fam.headName}</p>
                            <p className="text-slate-400 text-xs mt-0.5">الملف: {fam.fileNumber}</p>
                          </td>
                          <td className="py-3.5 px-5 font-bold">
                            {fam.membersCount} أشخاص ({fam.childrenCount} أطفال)
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-semibold text-slate-600">{fam.id}</p>
                            <p className="text-slate-400 text-xs mt-0.5">{fam.phone}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            {b.status === 'delivered' ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-0.5">
                                <i className="fa-solid fa-circle-check"></i>
                                تم تسليمه بنجاح
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                                بانتظار الحضور والاستلام
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            {b.status === 'delivered' ? (
                              <button
                                disabled
                                className="bg-slate-100 text-slate-400 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold w-32"
                              >
                                تم الاستلام بالفعل
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartDelivery(b)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs w-32 transition-colors cursor-pointer"
                              >
                                البدء بالتسليم والتوثيق
                              </button>
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
                <span className="text-4xl block"><i className="fa-solid fa-people-arrows"></i></span>
                <p className="font-bold">لا يوجد أي مستفيدين بانتظار الاستلام مطابقين لبحثك حالياً.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center text-slate-400 space-y-2">
          <span className="text-4xl block"><i className="fa-solid fa-folder-open"></i></span>
          <p className="font-bold text-slate-600">الرجاء جدولة أو اختيار مشروع توزيع مساعدات نشط أولاً.</p>
        </div>
      )}

      {/* Verification / Signature Modal */}
      {processingBeneficiary && processingFamily && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] overflow-y-auto relative animate-scale-up">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-base font-black font-cairo text-slate-800">
                  توثيق وتسليم مساعدة: {selectedProgram?.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">معرف المعاملة الميداني: {processingBeneficiary.qrCode}</p>
              </div>
              <button
                onClick={() => { setProcessingBeneficiary(null); setProcessingFamily(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-lg"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleConfirmDelivery} className="p-6 space-y-6">
              
              {/* Family mini profile */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2 leading-relaxed">
                <p><span className="font-bold text-slate-500 ml-1">اسم المستلم الأصلي:</span> <span className="font-extrabold text-slate-800 text-sm">{processingFamily.headName}</span></p>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <p><span>رقم الهوية:</span> <span className="font-bold">{processingFamily.id}</span></p>
                  <p><span>اسم الزوجة:</span> <span className="font-bold">{processingFamily.spouseName || 'لا يوجد'}</span></p>
                  <p><span>عدد الأفراد:</span> <span className="font-bold">{processingFamily.membersCount} أفراد</span></p>
                  <p><span>مركز الإيواء:</span> <span className="font-bold text-blue-700">{centers.find(c => c.id === processingFamily.centerId)?.name}</span></p>
                </div>
              </div>

              {/* Verification Tabs */}
              <div className="space-y-3">
                <label className="text-xs text-slate-500 font-bold block">طريقة التحقق وبصمة الأمان بالميدان:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerificationMethod('signature')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${verificationMethod === 'signature' ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm shadow-blue-50' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    <i className="fa-solid fa-signature"></i>
                    توقيع إلكتروني حي
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVerificationMethod('otp'); handleSendOtp(); }}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${verificationMethod === 'otp' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm shadow-emerald-50' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    <i className="fa-solid fa-mobile-screen"></i>
                    رمز التحقق بجواله (OTP)
                  </button>
                </div>
              </div>

              {/* Signature drawing zone */}
              {verificationMethod === 'signature' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">وقّع هنا بالإصبع أو بالماوس داخل المربع الأبيض:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-eraser"></i>
                      مسح التوقيع والبدء مجدداً
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-white shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={180}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[180px] bg-white cursor-crosshair touch-none block"
                    ></canvas>
                  </div>
                </div>
              )}

              {/* OTP verifying zone */}
              {verificationMethod === 'otp' && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 text-center">
                  <span className="text-3xl text-emerald-500 block animate-bounce"><i className="fa-solid fa-circle-check"></i></span>
                  <p className="text-xs text-slate-500">تم إرسال كود التحقق لجوال المستفيد {processingFamily.phone}.</p>
                  
                  <div className="max-w-xs mx-auto">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="أدخل الكود المكون من 6 أرقام"
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.5em] px-4 py-3 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-lg font-black outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                  >
                    إعادة إرسال كود التحقق OTP
                  </button>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">ملاحظات ميدانية خاصة بعملية التسليم:</label>
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="مثال: تم الاستلام بموجب توكيل رسمي أو حضور شخصي..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Confirm Submit */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setProcessingBeneficiary(null); setProcessingFamily(null); }}
                  className="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء المعاملة
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl text-xs shadow-md shadow-emerald-50 cursor-pointer"
                >
                  إثبات وصرف المعاملة الآن
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
