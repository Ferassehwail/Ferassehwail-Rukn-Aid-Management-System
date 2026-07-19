export type UserRole = 'admin' | 'center_manager' | 'delivery' | 'data_entry' | 'monitor' | 'auditor';

declare global {
  interface Window {
    Swal?: any;
  }
}


export interface Employee {
  id: string;
  name: string;
  username: string;
  password?: string;
  phone: string;
  email?: string; // Optional email address for Google Calendar notifications
  centerId: string; // empty means general admin or not tied to a specific center
  role: UserRole;
  createdAt: string;
  status?: 'active' | 'suspended'; // active or suspended/deactivated account
}

export interface ShelterCenter {
  id: string;
  name: string;
  manager: string;
  location: string;
  familiesCount: number;
  phone: string;
  notes: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string; // 9 digits ID
  name: string;
  age: number;
  relation: string; // Wife, Son, Daughter, Father, Mother, etc.
  gender: 'male' | 'female';
}

export interface Family {
  id: string; // National ID of Head (9 digits)
  fileNumber: string; // Family file number
  headName: string; // Quad-name of head of family
  spouseName: string; // Quad-name of spouse
  spouseId: string; // 9 digits spouse ID
  phone: string;
  whatsapp: string;
  socialStatus: string;
  membersCount: number;
  childrenCount: number;
  malesCount: number;
  femalesCount: number;
  category: string; // e.g. أرامل، أيتام، ذوي إعاقة، كبار سن، إلخ
  centerId: string; // Shelter Center ID
  status: 'active' | 'suspended' | 'review'; // نشط، موقوف، قيد المراجعة
  notes: string;
  createdAt: string;
  canAddMembers: boolean; // Citizen can add members for first time, then false
  membersList: FamilyMember[];
}

export interface AidProgram {
  id: string;
  name: string;
  type: string; // طرد غذائي، قسيمة، كرتونة، مساعدة مالية، إلخ
  startDate: string;
  endDate: string;
  value: number; // Value in ILS / USD
  unitCount: number; // e.g., total packets / boxes / vouchers
  targetCategories: string[];
  targetCenters: string[]; // Center IDs
  notes: string;
  status: 'active' | 'completed';
  createdAt: string;
  calendarEventId?: string; // Stored Google Calendar event ID for programmatic updates
}

export interface Beneficiary {
  id: string; // unique ID (familyId + aidProgramId)
  familyId: string;
  aidProgramId: string;
  status: 'nominated' | 'approved' | 'rejected' | 'delivered' | 'cancelled' | 'delayed';
  nominationReason: string;
  assignedCenterId: string;
  barcode: string;
  qrCode: string;
  deliveryDate?: string;
  deliveryEmployeeId?: string;
  deliveryEmployeeName?: string;
  receivedBy?: string;
  recipientId?: string;
  notes?: string;
}

export interface DeliveryRecord {
  id: string; // delivery transaction ID
  beneficiaryId: string;
  familyId: string;
  aidProgramId: string;
  receivedBy: string;
  recipientId: string;
  deliveredAt: string;
  employeeName: string;
  employeeId: string;
  centerId: string;
  ipAddress: string;
  deviceInfo: string;
  gpsLocation?: string;
  signature?: string; // Base64 data URI of electronic signature
  verificationMethod: 'signature' | 'image' | 'otp' | 'qr' | 'barcode';
  notes: string;
}

export interface AuditLog {
  id: string;
  username: string;
  action: string;
  date: string;
  time: string;
  ip: string;
  device?: string;
}

export interface WhatsappTemplate {
  id: string;
  title: string;
  content: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface SystemSettings {
  orgName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  firebaseEmulated: boolean;
  allowCitizenEdit: boolean;
}
