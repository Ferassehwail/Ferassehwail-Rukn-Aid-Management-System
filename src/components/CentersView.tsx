import React, { useState, useEffect } from 'react';
import { ShelterCenter } from '../types';
import { getCenters, saveCenter, deleteCenter, addLog } from '../utils/db';

interface CentersViewProps {
  currentEmployee: { name: string; role: string };
}

export default function CentersView({ currentEmployee }: CentersViewProps) {
  const [centers, setCenters] = useState<ShelterCenter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCenter, setEditingCenter] = useState<ShelterCenter | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [location, setLocation] = useState('');
  const [familiesCount, setFamiliesCount] = useState('100');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = () => {
    setCenters(getCenters());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, []);

  const handleOpenAdd = () => {
    setEditingCenter(null);
    setName('');
    setManager('');
    setLocation('');
    setFamiliesCount('100');
    setPhone('');
    setNotes('');
    setShowForm(true);
  };

  const handleOpenEdit = (c: ShelterCenter) => {
    setEditingCenter(c);
    setName(c.name);
    setManager(c.manager);
    setLocation(c.location);
    setFamiliesCount(String(c.familiesCount));
    setPhone(c.phone);
    setNotes(c.notes);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !manager.trim() || !location.trim()) {
      alert('الرجاء كتابة اسم المركز، والمدير، والعنوان التفصيلي.');
      return;
    }

    const centerData: ShelterCenter = {
      id: editingCenter ? editingCenter.id : `center-${Date.now()}`,
      name: name.trim(),
      manager: manager.trim(),
      location: location.trim(),
      familiesCount: parseInt(familiesCount) || 0,
      phone: phone.trim(),
      notes: notes.trim(),
      createdAt: editingCenter ? editingCenter.createdAt : new Date().toISOString()
    };

    saveCenter(centerData);
    addLog(currentEmployee.name, `${editingCenter ? 'تعديل' : 'إضافة'} مركز إيواء نزوح: ${centerData.name}`);
    setShowForm(false);
    setEditingCenter(null);

    if (window.Swal) {
      window.Swal.fire({
        icon: 'success',
        title: 'تم حفظ المركز بنجاح',
        text: 'تم تقييد المركز وإتاحته للتوزيع والاستهداف السكني.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const handleDelete = (id: string, cName: string) => {
    if (confirm(`هل أنت متأكد من حذف مركز الإيواء (${cName}) نهائياً من النظام؟`)) {
      deleteCenter(id);
      addLog(currentEmployee.name, `حذف مركز إيواء: ${cName}`);
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-cairo">إدارة قطاعات ومراكز النزوح والإيواء</h2>
          <p className="text-slate-500 text-xs mt-1">إضافة المدارس، والمخيمات، ومجمعات النزوح المعتمدة وتعيين المدراء لمتابعة الاستلام</p>
        </div>
        {(currentEmployee.role === 'admin' || currentEmployee.role === 'auditor') && (
          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-md shadow-blue-100"
          >
            <i className="fa-solid fa-hotel"></i>
            إضافة مركز جديد
          </button>
        )}
      </div>

      {/* Grid of centers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {centers.map(c => (
          <div key={c.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between space-y-4">
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl text-base flex items-center justify-center w-fit">
                  <i className="fa-solid fa-school"></i>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">ID: {c.id}</span>
              </div>
              
              <h3 className="font-extrabold text-slate-800 text-sm">{c.name}</h3>
              <p className="text-xs text-slate-500 font-medium"><i className="fa-solid fa-map-pin ml-1 text-slate-400"></i> {c.location}</p>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/60 text-xs">
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold">مدير الموقع</span>
                  <span className="text-slate-700 font-bold">{c.manager}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold">طاقة الإيواء الفورية</span>
                  <span className="text-slate-700 font-bold">{c.familiesCount} عائلة نازحة</span>
                </div>
              </div>

              {c.phone && (
                <p className="text-xs text-slate-500 font-medium"><i className="fa-solid fa-phone ml-1 text-slate-400"></i> جوال: {c.phone}</p>
              )}

              {c.notes && (
                <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded-lg leading-relaxed whitespace-pre-wrap">{c.notes}</p>
              )}
            </div>

            {(currentEmployee.role === 'admin' || currentEmployee.role === 'auditor') && (
              <div className="border-t border-slate-50 pt-3 flex justify-end gap-1.5">
                <button
                  onClick={() => handleOpenEdit(c)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 p-2 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                  title="تعديل المركز"
                >
                  <i className="fa-solid fa-pen-to-square ml-1"></i>
                  تعديل
                </button>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                  title="حذف المركز"
                >
                  <i className="fa-solid fa-trash ml-1"></i>
                  حذف
                </button>
              </div>
            )}

          </div>
        ))}
      </div>

      {/* Form Overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-6 md:p-8 relative animate-scale-up">
            
            <h3 className="text-base font-black font-cairo text-slate-800 border-b border-slate-100 pb-3 mb-5">
              {editingCenter ? 'تعديل بيانات مركز الإيواء' : 'إضافة وتثبيت مركز إيواء جديد'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs md:text-sm">
              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">اسم مركز النزوح / مدرسة الإيواء *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مدرسة الإمام الشافعي للبنين"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">اسم المدير المسؤول عن المركز *</label>
                <input
                  type="text"
                  required
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  placeholder="الاسم كامل ثلاثي"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">العنوان التفصيلي الجغرافي *</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="المحافظة - الحي - اسم الشارع"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">طاقة الإيواء (عدد الأسر)</label>
                  <input
                    type="number"
                    value={familiesCount}
                    onChange={(e) => setFamiliesCount(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">رقم جوال المدير / المركز</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">تفاصيل أو نواقص الموقع</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات حول الإضاءة، المياه، التموين..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingCenter(null); }}
                  className="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl text-xs shadow-md shadow-blue-100 cursor-pointer"
                >
                  تثبيت المركز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
