import React, { useState, useEffect } from 'react';
import { Employee, ShelterCenter, UserRole } from '../types';
import { getEmployees, getCenters, saveEmployee, deleteEmployee, addLog } from '../utils/db';

interface EmployeeManagementProps {
  currentEmployee: { name: string; role: string };
}

export default function EmployeeManagement({ currentEmployee }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [centers, setCenters] = useState<ShelterCenter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('data_entry');
  const [centerId, setCenterId] = useState('');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [isUsernameDuplicate, setIsUsernameDuplicate] = useState(false);

  const loadData = () => {
    setEmployees(getEmployees());
    setCenters(getCenters());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('alrukn_db_update', loadData);
    return () => window.removeEventListener('alrukn_db_update', loadData);
  }, []);

  const handleUsernameChange = (val: string) => {
    const clean = val.trim().toLowerCase();
    setUsername(clean);
    if (!clean) {
      setIsUsernameDuplicate(false);
      return;
    }
    const duplicate = employees.some(e => e.username.toLowerCase() === clean && (!editingEmployee || e.id !== editingEmployee.id));
    setIsUsernameDuplicate(duplicate);
  };

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setName('');
    setUsername('');
    setPassword('');
    setPhone('');
    setRole('data_entry');
    setCenterId('');
    setStatus('active');
    setIsUsernameDuplicate(false);
    setShowForm(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setUsername(emp.username);
    setPassword(''); // leave blank if password is not being changed
    setPhone(emp.phone);
    setRole(emp.role);
    setCenterId(emp.centerId);
    setStatus(emp.status || 'active');
    setIsUsernameDuplicate(false);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !username.trim()) {
      alert('الرجاء كتابة الاسم الكامل للموظف واسم المستخدم الخاص بدخوله.');
      return;
    }

    if (isUsernameDuplicate) {
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'اسم مستخدم مكرر',
          text: 'لا يمكن حفظ التعديلات لأن اسم المستخدم المدخل مسجل مسبقاً لموظف آخر.',
          confirmButtonColor: '#d33'
        });
      } else {
        alert('خطأ: اسم المستخدم المدخل مكرر بالفعل.');
      }
      return;
    }

    if (!editingEmployee && !password.trim()) {
      alert('الرجاء كتابة كلمة مرور الدخول الأولية للموظف الجديد.');
      return;
    }

    const isFeras = editingEmployee && editingEmployee.id === 'emp-1';

    const employeeData: Employee = {
      id: editingEmployee ? editingEmployee.id : `emp-${Date.now()}`,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      phone: phone.trim(),
      role: isFeras ? 'admin' : role,
      centerId: (role === 'center_manager' || role === 'delivery' || role === 'data_entry') ? centerId : '',
      status: isFeras ? 'active' : status,
      createdAt: editingEmployee ? editingEmployee.createdAt : new Date().toISOString()
    };

    if (password.trim()) {
      employeeData.password = password.trim();
    }

    const res = saveEmployee(employeeData);
    if (res.success) {
      addLog(
        currentEmployee.name,
        `${editingEmployee ? 'تعديل بيانات وصلاحيات' : 'إضافة وتعيين الموظف الجديد'}: ${employeeData.name} بصلاحية ${employeeData.role}`
      );
      setShowForm(false);
      const wasAdding = !editingEmployee;
      setEditingEmployee(null);

      if (window.Swal) {
        window.Swal.fire({
          icon: 'success',
          title: wasAdding ? 'تم إنشاء حساب الموظف بنجاح' : 'تم تعديل صلاحيات الموظف',
          text: wasAdding ? `تم تعيين الموظف ${employeeData.name} في النظام بنجاح.` : `تم حفظ التحديثات للموظف ${employeeData.name} بنجاح.`,
          showCancelButton: wasAdding,
          confirmButtonColor: '#2563eb',
          cancelButtonColor: '#64748b',
          confirmButtonText: wasAdding ? 'تسجيل دخول فوري كـ الموظف الجديد' : 'حسناً وموافق',
          cancelButtonText: 'إغلاق ومتابعة'
        }).then((result) => {
          if (wasAdding && result.isConfirmed) {
            window.dispatchEvent(new CustomEvent('alrukn_switch_employee', { detail: employeeData }));
          }
        });
      } else {
        alert(res.message);
      }
    } else {
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'فشل الحفظ',
          text: res.message,
          confirmButtonColor: '#d33'
        });
      } else {
        alert(res.message);
      }
    }
  };

  const handleDelete = (id: string, empName: string) => {
    if (id === 'emp-1') {
      if (window.Swal) {
        window.Swal.fire({
          icon: 'error',
          title: 'إجراء محظور',
          text: 'لا يمكن حذف حساب المدير العام للمنصة م. فراس محمد سحويل!',
          confirmButtonColor: '#ef4444'
        });
      } else {
        alert('لا يمكن حذف حساب المدير العام للمنصة م. فراس محمد سحويل!');
      }
      return;
    }

    if (window.Swal) {
      window.Swal.fire({
        title: 'هل أنت متأكد؟',
        text: `أنت على وشك سحب صلاحيات وحذف حساب الموظف (${empName}) نهائياً من كشوفات المنصة.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف الحساب',
        cancelButtonText: 'تراجع وإلغاء'
      }).then((result) => {
        if (result.isConfirmed) {
          deleteEmployee(id);
          addLog(currentEmployee.name, `سحب وحذف حساب الموظف: ${empName}`);
          window.Swal.fire({
            icon: 'success',
            title: 'تم الحذف',
            text: 'تم سحب الصلاحيات وإزالة الحساب من النظام.',
            timer: 1500,
            showConfirmButton: false
          });
        }
      });
    } else {
      if (confirm(`هل أنت متأكد من سحب صلاحيات وحذف حساب الموظف (${empName}) نهائياً؟`)) {
        deleteEmployee(id);
        addLog(currentEmployee.name, `سحب وحذف حساب الموظف: ${empName}`);
      }
    }
  };

  // Convert role standard english word to a beautiful Arabic human-readable label
  const getRoleLabel = (roleStr: UserRole) => {
    switch (roleStr) {
      case 'admin': return 'المدير العام لـ النظام (Admin)';
      case 'center_manager': return 'مدير مركز نزوح إيوائي (Center Manager)';
      case 'delivery': return 'لجنة صرف وتسليم ميداني (Delivery)';
      case 'data_entry': return 'مأمور إدخال بيانات (Data Entry)';
      case 'auditor': return 'المدقق والمراقب المالي (Auditor)';
      case 'monitor': return 'لجنة رقابة وتقييم مستقلة (Monitor)';
      default: return roleStr;
    }
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-cairo">هيكلية الموظفين وإدارة الصلاحيات (RBAC)</h2>
          <p className="text-slate-500 text-xs mt-1">تحديد المجموعات الوظيفية، وصلاحيات الوصول للمراكز، وتأمين كلمات المرور المعتمدة</p>
        </div>
        {currentEmployee.role === 'admin' && (
          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-md shadow-blue-100 cursor-pointer"
          >
            <i className="fa-solid fa-user-shield"></i>
            تعيين موظف وصلاحية جديد
          </button>
        )}
      </div>

      {/* Employees Table List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                <th className="py-4 px-5">الاسم الوظيفي الكامل</th>
                <th className="py-4 px-5">اسم مستخدم الدخول</th>
                <th className="py-4 px-5">المجموعة والصلاحية</th>
                <th className="py-4 px-5">المركز التابع له</th>
                <th className="py-4 px-5">حالة الحساب</th>
                <th className="py-4 px-5">تاريخ التعيين</th>
                {currentEmployee.role === 'admin' && <th className="py-4 px-5 text-center">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {employees.map(emp => {
                const centerObj = centers.find(c => c.id === emp.centerId);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/40 transition-all">
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-slate-800 text-sm">{emp.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">الهاتف: {emp.phone}</p>
                    </td>
                    <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                      @{emp.username}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] ${emp.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-100' : emp.role === 'auditor' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                        {getRoleLabel(emp.role)}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-700">
                      {centerObj ? centerObj.name : <span className="text-slate-400 italic">كل المراكز (عام)</span>}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${emp.status !== 'suspended' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {emp.status !== 'suspended' ? 'نشط ومعتمد' : 'موقوف إدارياً'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400">
                      {new Date(emp.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    {currentEmployee.role === 'admin' && (
                      <td className="py-3.5 px-5">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors cursor-pointer text-xs"
                            title="تعديل الموظف"
                          >
                            <i className="fa-solid fa-user-gear"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id, emp.name)}
                            disabled={emp.id === 'emp-1'}
                            className="bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-600 p-2 rounded-lg transition-colors cursor-pointer text-xs"
                            title="حذف الموظف وسحب صلاحياته"
                          >
                            <i className="fa-solid fa-user-minus"></i>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide overlay Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-6 md:p-8 relative animate-scale-up">
            
            <h3 className="text-base font-black font-cairo text-slate-800 border-b border-slate-100 pb-3 mb-5">
              {editingEmployee ? `تعديل صلاحيات الموظف: ${editingEmployee.name}` : 'تعيين وإعداد حساب موظف جديد'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs md:text-sm">
              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">الاسم الموظف الكامل رباعي *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="الاسم رباعي"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-bold mb-1 block">اسم المستخدم (للدخول) *</label>
                  <input
                    type="text"
                    required
                    disabled={editingEmployee !== null}
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="e.g., manager_kh"
                    className={`w-full px-3.5 py-2 border rounded-xl text-xs font-mono font-bold outline-none transition-all ${isUsernameDuplicate ? 'border-red-500 bg-red-50/50' : username.trim() !== '' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200'}`}
                  />
                  {isUsernameDuplicate && (
                    <p className="text-red-500 text-[10px] font-bold mt-1.5 flex items-center gap-1">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>اسم المستخدم مكرر ومسجل لموظف آخر!</span>
                    </p>
                  )}
                  {!isUsernameDuplicate && username.trim() !== '' && (
                    <p className="text-emerald-600 text-[10px] font-bold mt-1.5 flex items-center gap-1">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>اسم مستخدم متاح وفريد للتسجيل.</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">جوال الموظف</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0599000000"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">كلمة المرور الآمنة *</label>
                <input
                  type="password"
                  required={!editingEmployee}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingEmployee ? 'اتركها فارغة إذا لا تريد تغييرها' : 'أدخل كلمة مرور قوية للموظف'}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-bold mb-1 block">الدور والترخيص والوظيفة *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-blue-700"
                  >
                    <option value="data_entry">مأمور إدخال بيانات (Data Entry)</option>
                    <option value="center_manager">مدير مركز إيواء نزوح (Center Manager)</option>
                    <option value="delivery">لجنة تسليم وصرف ميداني (Delivery)</option>
                    <option value="auditor">المدقق والمراقب المالي (Auditor)</option>
                    <option value="monitor">لجنة تقييم ورقابة خارجية (Monitor)</option>
                    <option value="admin">مدير عام النظام بـ صلاحية شاملة (Admin)</option>
                  </select>
                </div>

                {/* Account status for non-Feras users */}
                {(!editingEmployee || editingEmployee.id !== 'emp-1') ? (
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">حالة الحساب *</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700"
                    >
                      <option value="active">نشط ومصرح بالدخول</option>
                      <option value="suspended">موقوف ومجمد إدارياً</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-500 font-bold mb-1 block">حالة الحساب *</label>
                    <input
                      type="text"
                      disabled
                      value="نشط ومصرح بالدخول (المدير العام)"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-emerald-700"
                    />
                  </div>
                )}
              </div>

              {/* Show center selector only if employee needs a center binding */}
              {(role === 'center_manager' || role === 'delivery' || role === 'data_entry') && (
                <div>
                  <label className="text-xs text-slate-500 font-bold mb-1 block">المركز التابع له بالتحديد *</label>
                  <select
                    value={centerId}
                    required
                    onChange={(e) => setCenterId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-emerald-800"
                  >
                    <option value="">اختر مركز الإيواء للموظف</option>
                    {centers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingEmployee(null); }}
                  className="px-5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl text-xs shadow-md shadow-blue-100 cursor-pointer"
                >
                  حفظ الصلاحيات والموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
