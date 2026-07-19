import { 
  Employee, 
  ShelterCenter, 
  Family, 
  AidProgram, 
  Beneficiary, 
  DeliveryRecord, 
  AuditLog, 
  WhatsappTemplate, 
  SystemNotification, 
  SystemSettings 
} from '../types';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  getDocs,
  writeBatch
} from "firebase/firestore";

// Storage keys
const EMPLOYEES_KEY = 'alrukn_employees';
const CENTERS_KEY = 'alrukn_centers';
const FAMILIES_KEY = 'alrukn_families';
const AID_PROGRAMS_KEY = 'alrukn_aid_programs';
const BENEFICIARIES_KEY = 'alrukn_beneficiaries';
const DELIVERIES_KEY = 'alrukn_deliveries';
const LOGS_KEY = 'alrukn_logs';
const TEMPLATES_KEY = 'alrukn_templates';
const NOTIFICATIONS_KEY = 'alrukn_notifications';
const SETTINGS_KEY = 'alrukn_settings';

// Seed initial data
const defaultCenters: ShelterCenter[] = [];

const defaultEmployees: Employee[] = [
  {
    id: 'emp-1',
    name: 'م. فراس محمد سحويل',
    username: 'admin',
    password: '123', // Clean, direct password login
    phone: '0599555666',
    centerId: '', // General Admin
    role: 'admin',
    createdAt: '2026-07-01T00:00:00Z',
    status: 'active'
  }
];

const defaultFamilies: Family[] = [];

const defaultAidPrograms: AidProgram[] = [];

// Beneficiaries Seed - map families to projects
const defaultBeneficiaries: Beneficiary[] = [];

const defaultDeliveries: DeliveryRecord[] = [];

const defaultTemplates: WhatsappTemplate[] = [
  {
    id: 'temp-1',
    title: 'رسالة دعوة للاستلام',
    content: `السلام عليكم ورحمة الله وبركاته\n\nالأخ/الأخت: {الاسم}\n\nنفيدكم بأنه تم إدراج اسمكم ضمن مشروع:\n{اسم المشروع}\n\nنوع المساعدة:\n{نوع المساعدة}\n\nمكان التوزيع:\n{المركز}\n\nالتاريخ: {التاريخ}\nالوقت: {الوقت}\n\nيرجى إحضار الهوية الشخصية عند الحضور.\n\nشكراً لكم.`
  },
  {
    id: 'temp-2',
    title: 'رسالة تذكير',
    content: `عاجل وتذكير هام:\n\nالأخ/الأخت: {الاسم}\n\nنذكركم بضرورة الحضور لاستلام مساعدتكم لـ {اسم المشروع} في {المركز} قبل انتهاء فترة التوزيع اليوم في تمام الساعة {الوقت}.\n\nالرجاء الحضور والالتزام بالتعليمات.`
  },
  {
    id: 'temp-3',
    title: 'رسالة تأجيل موعد',
    content: `مواطننا الكريم: {الاسم}\n\nنحيطكم علماً بأنه قد تم تأجيل موعد تسليم المساعدة الخاصة بمشروع {اسم المشروع} إلى موعد لاحق، وسنرسل لكم التاريخ والوقت الجديد فور اعتماده.\n\nنشكر تفهمكم وتعاونكم.`
  },
  {
    id: 'temp-4',
    title: 'رسالة تأكيد وتوثيق الاستلام',
    content: `تم تسليم المساعدة بنجاح ✅\n\nالأخ/الأخت: {الاسم}\n\nتم تقييد استلامكم لـ {نوع المساعدة} في مشروع {اسم المشروع} بموقع {المركز}.\nالتوقيع: معتمد وموثق إلكترونياً بقيد رقم {رقم المعاملة}.\n\nخدمتكم شرف لنا.`
  },
  {
    id: 'temp-5',
    title: 'رسالة إلغاء الاستحقاق',
    content: `الأخ/الأخت: {الاسم}\n\nنعتذر منكم، فقد تم إلغاء استحقاقكم في مشروع {اسم المشروع} لعدم مطابقة بيانات الحالة أو تحديث السجلات العائلية بموقع الإيواء الجديد.\n\nللمراجعة، يرجى التوجه لمكتب الإدارة في مركز النزوح.`
  }
];

const defaultNotifications: SystemNotification[] = [];

const defaultSettings: SystemSettings = {
  orgName: 'جمعية الركن الخيرية للإغاثة الإنسانية',
  logoUrl: 'https://images.unsplash.com/photo-1593113630400-ea4288922497?auto=format&fit=crop&q=80&w=150',
  primaryColor: '#1d4ed8', // blue-700
  accentColor: '#10b981', // emerald-500
  firebaseEmulated: true,
  allowCitizenEdit: true
};

const defaultLogs: AuditLog[] = [
  {
    id: 'log-1',
    username: 'admin',
    action: 'تأسيس النظام الإلكتروني وتهيئة حساب المدير العام م. فراس محمد سحويل بنجاح',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0],
    ip: '127.0.0.1',
    device: 'System Initialization'
  }
];

// Helper to initialize database if empty
export function initDB() {
  if (!localStorage.getItem(EMPLOYEES_KEY)) {
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(defaultEmployees));
  }
  if (!localStorage.getItem(CENTERS_KEY)) {
    localStorage.setItem(CENTERS_KEY, JSON.stringify(defaultCenters));
  }
  if (!localStorage.getItem(FAMILIES_KEY)) {
    localStorage.setItem(FAMILIES_KEY, JSON.stringify(defaultFamilies));
  }
  if (!localStorage.getItem(AID_PROGRAMS_KEY)) {
    localStorage.setItem(AID_PROGRAMS_KEY, JSON.stringify(defaultAidPrograms));
  }
  if (!localStorage.getItem(BENEFICIARIES_KEY)) {
    localStorage.setItem(BENEFICIARIES_KEY, JSON.stringify(defaultBeneficiaries));
  }
  if (!localStorage.getItem(DELIVERIES_KEY)) {
    localStorage.setItem(DELIVERIES_KEY, JSON.stringify(defaultDeliveries));
  }
  if (!localStorage.getItem(TEMPLATES_KEY)) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(defaultTemplates));
  }
  if (!localStorage.getItem(NOTIFICATIONS_KEY)) {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(defaultNotifications));
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
  }
  if (!localStorage.getItem(LOGS_KEY)) {
    localStorage.setItem(LOGS_KEY, JSON.stringify(defaultLogs));
  }
}

// Call initDB immediately on import
initDB();

// General Generic Storage CRUD
function getStored<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

const collectionMap: { [key: string]: string } = {
  [EMPLOYEES_KEY]: 'employees',
  [CENTERS_KEY]: 'centers',
  [FAMILIES_KEY]: 'families',
  [AID_PROGRAMS_KEY]: 'aid_programs',
  [BENEFICIARIES_KEY]: 'beneficiaries',
  [DELIVERIES_KEY]: 'deliveries',
  [LOGS_KEY]: 'logs',
  [TEMPLATES_KEY]: 'templates',
  [NOTIFICATIONS_KEY]: 'notifications'
};

async function syncToFirestore(key: string, data: any[]) {
  const collName = collectionMap[key];
  if (!collName) return;

  try {
    const querySnapshot = await getDocs(collection(db, collName));
    const existingIds = querySnapshot.docs.map(docSnapshot => docSnapshot.id);
    const newIds = new Set(data.map((item: any) => item.id || item.username));

    const batch = writeBatch(db);

    // Save/update items
    for (const item of data) {
      const id = item.id || item.username;
      if (!id) continue;
      const docRef = doc(db, collName, id);
      batch.set(docRef, item);
    }

    // Delete removed items
    for (const existingId of existingIds) {
      if (!newIds.has(existingId)) {
        const docRef = doc(db, collName, existingId);
        batch.delete(docRef);
      }
    }

    await batch.commit();
  } catch (error) {
    console.error(`Error syncing ${key} to Firestore:`, error);
  }
}

async function syncSettingsToFirestore(settings: SystemSettings) {
  try {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, settings);
  } catch (error) {
    console.error('Error syncing settings to Firestore:', error);
  }
}

export function startFirebaseSync() {
  // Array collections sync
  Object.entries(collectionMap).forEach(([storageKey, collectionName]) => {
    onSnapshot(collection(db, collectionName), (snapshot) => {
      const remoteData: any[] = [];
      snapshot.forEach((docSnapshot) => {
        remoteData.push(docSnapshot.data());
      });

      // Sorting
      if (storageKey === LOGS_KEY) {
        remoteData.sort((a, b) => {
          const dateA = `${a.date}T${a.time}`;
          const dateB = `${b.date}T${b.time}`;
          return dateB.localeCompare(dateA);
        });
      } else if (storageKey === DELIVERIES_KEY) {
        remoteData.sort((a, b) => (b.deliveredAt || '').localeCompare(a.deliveredAt || ''));
      } else if (storageKey === NOTIFICATIONS_KEY) {
        remoteData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      } else if (storageKey === TEMPLATES_KEY) {
        remoteData.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      } else if (storageKey === EMPLOYEES_KEY) {
        remoteData.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      } else if (storageKey === CENTERS_KEY) {
        remoteData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      const localStr = localStorage.getItem(storageKey);
      const remoteStr = JSON.stringify(remoteData);

      // Seed if Firestore collection is completely empty
      if (snapshot.empty) {
        const localItems = localStr ? JSON.parse(localStr) : [];
        if (localItems.length > 0) {
          syncToFirestore(storageKey, localItems).catch(console.error);
          return;
        }
      }

      if (localStr !== remoteStr) {
        localStorage.setItem(storageKey, remoteStr);
        dispatchDataUpdate();
      }
    });
  });

  // Settings sync
  onSnapshot(doc(db, 'settings', 'global'), (docSnapshot) => {
    if (docSnapshot.exists()) {
      const remoteSettings = docSnapshot.data() as SystemSettings;
      const localStr = localStorage.getItem(SETTINGS_KEY);
      const remoteStr = JSON.stringify(remoteSettings);

      if (localStr !== remoteStr) {
        localStorage.setItem(SETTINGS_KEY, remoteStr);
        dispatchDataUpdate();
      }
    } else {
      const localSettings = getSettings();
      syncSettingsToFirestore(localSettings).catch(console.error);
    }
  });
}

// Start syncing right away
startFirebaseSync();

function setStored<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
  syncToFirestore(key, data).catch(console.error);
}

// Custom event to trigger updates across tabs/components
function dispatchDataUpdate() {
  window.dispatchEvent(new Event('alrukn_db_update'));
}

// Audit Logs
export function getLogs(): AuditLog[] {
  return getStored<AuditLog>(LOGS_KEY);
}

export function addLog(username: string, action: string, ip: string = '127.0.0.1') {
  const logs = getLogs();
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const dateStr = now.toISOString().split('T')[0];
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username,
    action,
    date: dateStr,
    time: timeStr,
    ip,
    device: navigator.userAgent.substring(0, 50)
  };
  logs.unshift(newLog); // latest first
  setStored(LOGS_KEY, logs);
  dispatchDataUpdate();
}

// Employees
export function getEmployees(): Employee[] {
  return getStored<Employee>(EMPLOYEES_KEY);
}

export function saveEmployee(employee: Employee): { success: boolean; message: string } {
  const employees = getEmployees();
  
  // Check if username already exists for other employees
  const duplicate = employees.find(e => e.username === employee.username && e.id !== employee.id);
  if (duplicate) {
    return { success: false, message: `اسم المستخدم "${employee.username}" مسجل مسبقاً لموظف آخر.` };
  }

  const index = employees.findIndex(e => e.id === employee.id);
  const isEdit = index >= 0;
  if (index >= 0) {
    // Keep password if not changed/provided in edit
    if (!employee.password) {
      employee.password = employees[index].password;
    }
    employees[index] = employee;
  } else {
    employee.id = employee.id || `emp-${Date.now()}`;
    employee.createdAt = new Date().toISOString();
    employees.push(employee);
  }

  setStored(EMPLOYEES_KEY, employees);
  addNotification(
    isEdit ? 'تحديث بيانات موظف' : 'إضافة موظف جديد',
    `${isEdit ? 'تم تحديث بيانات' : 'تم إضافة وتعيين'} الموظف "${employee.name}" بنجاح في النظام.`
  );
  return { success: true, message: 'تم حفظ بيانات الموظف بنجاح.' };
}

export function deleteEmployee(id: string) {
  let employees = getEmployees();
  const matched = employees.find(e => e.id === id);
  const name = matched ? matched.name : '';
  employees = employees.filter(e => e.id !== id);
  setStored(EMPLOYEES_KEY, employees);
  if (name) {
    addNotification('حذف حساب موظف', `تم سحب صلاحيات وحذف الموظف "${name}" نهائياً من كشوفات المنصة.`);
  } else {
    dispatchDataUpdate();
  }
}

// Centers
export function getCenters(): ShelterCenter[] {
  return getStored<ShelterCenter>(CENTERS_KEY);
}

export function saveCenter(center: ShelterCenter) {
  const centers = getCenters();
  const index = centers.findIndex(c => c.id === center.id);
  const isEdit = index >= 0;
  if (index >= 0) {
    centers[index] = center;
  } else {
    center.id = center.id || `center-${Date.now()}`;
    center.createdAt = new Date().toISOString();
    centers.push(center);
  }
  setStored(CENTERS_KEY, centers);
  addNotification(
    isEdit ? 'تعديل مركز نزوح' : 'إضافة مركز نزوح جديد',
    `تم ${isEdit ? 'تعديل بيانات' : 'إضافة'} مركز النزوح "${center.name}" بموقع ${center.location}.`
  );
}

export function deleteCenter(id: string) {
  let centers = getCenters();
  const matched = centers.find(c => c.id === id);
  const name = matched ? matched.name : '';
  centers = centers.filter(c => c.id !== id);
  setStored(CENTERS_KEY, centers);
  if (name) {
    addNotification('حذف مركز نزوح', `تم إزالة وحذف مركز النزوح "${name}" من كشوفات النظام.`);
  } else {
    dispatchDataUpdate();
  }
}

// Families / Citizens
export function getFamilies(): Family[] {
  return getStored<Family>(FAMILIES_KEY);
}

export function saveFamily(family: Family, originalId?: string): { success: boolean; message: string; duplicateInFamilyName?: string } {
  const families = getFamilies();
  const idToExclude = originalId || family.id;

  // Validate Head ID is unique (excluding self)
  const existingHead = families.find(f => f.id === family.id && f.id !== idToExclude);
  if (existingHead) {
    return {
      success: false,
      message: `رقم هوية رب الأسرة (${family.id}) مسجل مسبقاً لعائلة رب أسرتها: ${existingHead.headName}`
    };
  }

  // Validate Spouse ID is unique (excluding self)
  if (family.spouseId) {
    const existingSpouse = families.find(f => f.spouseId === family.spouseId && f.id !== idToExclude);
    if (existingSpouse) {
      return {
        success: false,
        message: `رقم هوية الزوجة (${family.spouseId}) مسجل مسبقاً لعائلة رب أسرتها: ${existingSpouse.headName}`
      };
    }
  }

  // Look for duplicates in spouse or family members ids
  // Ensure that no member id is used elsewhere
  for (const member of family.membersList) {
    const parentFamily = families.find(f => f.id !== idToExclude && (f.id === member.id || f.spouseId === member.id || f.membersList.some(m => m.id === member.id)));
    if (parentFamily) {
      return {
        success: false,
        message: `رقم هوية فرد العائلة (${member.name} - ${member.id}) مسجل مسبقاً ضمن عائلة رب أسرتها: ${parentFamily.headName}`,
        duplicateInFamilyName: parentFamily.headName
      };
    }
  }

  // Check unique file number
  const existingFile = families.find(f => f.fileNumber === family.fileNumber && f.id !== idToExclude);
  if (existingFile) {
    return {
      success: false,
      message: `رقم الملف العائلي (${family.fileNumber}) مسجل مسبقاً باسم رب الأسرة: ${existingFile.headName}`
    };
  }

  const index = families.findIndex(f => f.id === idToExclude);
  const isEdit = index >= 0;
  if (index >= 0) {
    families[index] = family;
  } else {
    family.createdAt = family.createdAt || new Date().toISOString();
    families.push(family);
  }

  setStored(FAMILIES_KEY, families);
  addNotification(
    isEdit ? 'تعديل ملف عائلي' : 'تسجيل عائلة جديدة',
    `تم ${isEdit ? 'تعديل وتحديث بيانات' : 'تسجيل وإدراج'} العائلة لرب الأسرة "${family.headName}" بالملف رقم: ${family.fileNumber}.`
  );
  return { success: true, message: 'تم حفظ بيانات العائلة بنجاح.' };
}

export function deleteFamily(id: string) {
  let families = getFamilies();
  const matched = families.find(f => f.id === id);
  const name = matched ? matched.headName : '';
  families = families.filter(f => f.id !== id);
  setStored(FAMILIES_KEY, families);
  if (name) {
    addNotification('حذف عائلة', `تم حذف ملف عائلة رب الأسرة "${name}" نهائياً من كشوفات المنصة.`);
  } else {
    dispatchDataUpdate();
  }
}

// Aid Programs
export function getAidPrograms(): AidProgram[] {
  return getStored<AidProgram>(AID_PROGRAMS_KEY);
}

export function saveAidProgram(program: AidProgram) {
  const programs = getAidPrograms();
  const index = programs.findIndex(p => p.id === program.id);
  const isEdit = index >= 0;
  if (index >= 0) {
    programs[index] = program;
  } else {
    program.id = program.id || `aid-${Date.now()}`;
    program.createdAt = new Date().toISOString();
    programs.push(program);
  }
  setStored(AID_PROGRAMS_KEY, programs);
  addNotification(
    isEdit ? 'تعديل مشروع إغاثي' : 'إطلاق مشروع إغاثي جديد',
    `تم ${isEdit ? 'تحديث تفاصيل' : 'إطلاق وتنفيذ'} المشروع الإغاثي "${program.name}" بنوع مساعدة ${program.type}.`
  );
}

export function deleteAidProgram(id: string) {
  let programs = getAidPrograms();
  const matched = programs.find(p => p.id === id);
  const name = matched ? matched.name : '';
  programs = programs.filter(p => p.id !== id);
  setStored(AID_PROGRAMS_KEY, programs);
  if (name) {
    addNotification('حذف مشروع إغاثي', `تم حذف وإلغاء المشروع الإغاثي "${name}" نهائياً من النظام.`);
  } else {
    dispatchDataUpdate();
  }
}

// Beneficiaries
export function getBeneficiaries(): Beneficiary[] {
  return getStored<Beneficiary>(BENEFICIARIES_KEY);
}

export function saveBeneficiary(beneficiary: Beneficiary) {
  const beneficiaries = getBeneficiaries();
  const index = beneficiaries.findIndex(b => b.id === beneficiary.id);
  if (index >= 0) {
    beneficiaries[index] = beneficiary;
  } else {
    beneficiary.id = beneficiary.id || `${beneficiary.familyId}-${beneficiary.aidProgramId}`;
    beneficiary.barcode = beneficiary.barcode || `BC${beneficiary.familyId}${Math.floor(10 + Math.random() * 90)}`;
    beneficiary.qrCode = beneficiary.qrCode || `QR${beneficiary.familyId}${Math.floor(10 + Math.random() * 90)}`;
    beneficiaries.push(beneficiary);
  }
  setStored(BENEFICIARIES_KEY, beneficiaries);
  dispatchDataUpdate();
}

export function deleteBeneficiary(id: string) {
  let beneficiaries = getBeneficiaries();
  beneficiaries = beneficiaries.filter(b => b.id !== id);
  setStored(BENEFICIARIES_KEY, beneficiaries);
  dispatchDataUpdate();
}

// Deliveries
export function getDeliveries(): DeliveryRecord[] {
  return getStored<DeliveryRecord>(DELIVERIES_KEY);
}

export function saveDelivery(delivery: DeliveryRecord) {
  const deliveries = getDeliveries();
  // Prevent duplicate ID transactions
  if (deliveries.some(d => d.id === delivery.id)) {
    return;
  }
  deliveries.unshift(delivery); // Newest first
  setStored(DELIVERIES_KEY, deliveries);
  addNotification('صرف مساعدة ناجح', `تم صرف وتوثيق تسليم المساعدة للمستفيد "${delivery.receivedBy}" بنجاح.`);
}

// WhatsApp Templates
export function getTemplates(): WhatsappTemplate[] {
  return getStored<WhatsappTemplate>(TEMPLATES_KEY);
}

export function saveTemplate(template: WhatsappTemplate) {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === template.id);
  if (index >= 0) {
    templates[index] = template;
  } else {
    template.id = template.id || `temp-${Date.now()}`;
    templates.push(template);
  }
  setStored(TEMPLATES_KEY, templates);
  dispatchDataUpdate();
}

export function deleteTemplate(id: string) {
  let templates = getTemplates();
  templates = templates.filter(t => t.id !== id);
  setStored(TEMPLATES_KEY, templates);
  dispatchDataUpdate();
}

// Notifications
export function getNotifications(): SystemNotification[] {
  return getStored<SystemNotification>(NOTIFICATIONS_KEY);
}

export function addNotification(title: string, message: string) {
  const notifications = getNotifications();
  const newNotif: SystemNotification = {
    id: `notif-${Date.now()}`,
    title,
    message,
    date: new Date().toISOString(),
    read: false
  };
  notifications.unshift(newNotif);
  setStored(NOTIFICATIONS_KEY, notifications);
  dispatchDataUpdate();
}

export function markNotificationRead(id: string) {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === id);
  if (index >= 0) {
    notifications[index].read = true;
    setStored(NOTIFICATIONS_KEY, notifications);
    dispatchDataUpdate();
  }
}

export function markAllNotificationsRead() {
  const notifications = getNotifications();
  notifications.forEach(n => n.read = true);
  setStored(NOTIFICATIONS_KEY, notifications);
  dispatchDataUpdate();
}

export function deleteNotification(id: string) {
  let notifications = getNotifications();
  notifications = notifications.filter(n => n.id !== id);
  setStored(NOTIFICATIONS_KEY, notifications);
  dispatchDataUpdate();
}

// Settings
export function getSettings(): SystemSettings {
  const settings = localStorage.getItem(SETTINGS_KEY);
  return settings ? JSON.parse(settings) : defaultSettings;
}

export function saveSettings(settings: SystemSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  dispatchDataUpdate();
  syncSettingsToFirestore(settings).catch(console.error);
}

// Quick database stats
export interface DBStats {
  familiesCount: number;
  citizensCount: number;
  beneficiariesCount: number;
  aidCount: number;
  employeesCount: number;
  centersCount: number;
  widowsCount: number;
  orphansCount: number;
  disabledCount: number;
  elderlyCount: number;
  deliveriesTodayCount: number;
  deliveriesTotalCount: number;
}

export function getStats(): DBStats {
  const families = getFamilies();
  const beneficiaries = getBeneficiaries();
  const employees = getEmployees();
  const centers = getCenters();
  const deliveries = getDeliveries();

  const activeFamilies = families.filter(f => f.status === 'active');
  
  // Total citizens: head + spouse (if exists) + members count
  const citizensCount = families.reduce((acc, f) => {
    let count = 1; // Head
    if (f.spouseName) count++; // Spouse
    count += f.membersList.length; // Members
    return acc + count;
  }, 0);

  // Widows count (socialStatus == أرملة)
  const widowsCount = families.filter(f => f.socialStatus === 'أرملة' || f.socialStatus === 'أرمل').length;

  // Orphans count: Category is "أيتام" or any member marked as orphan / child (under 18) with no father
  const orphansCount = families.filter(f => f.category === 'أيتام').length;

  // Disabled count: Category is "ذوي إعاقة"
  const disabledCount = families.filter(f => f.category === 'ذوي إعاقة').length;

  // Elderly count: Category is "كبار السن"
  const elderlyCount = families.filter(f => f.category === 'كبار السن').length;

  // Deliveries today
  const todayStr = new Date().toISOString().split('T')[0];
  const deliveriesTodayCount = deliveries.filter(d => d.deliveredAt.startsWith(todayStr)).length;

  return {
    familiesCount: families.length,
    citizensCount,
    beneficiariesCount: beneficiaries.length,
    aidCount: getAidPrograms().length,
    employeesCount: employees.length,
    centersCount: centers.length,
    widowsCount,
    orphansCount,
    disabledCount,
    elderlyCount,
    deliveriesTodayCount,
    deliveriesTotalCount: deliveries.length
  };
}
