import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AidProgram, ShelterCenter, Employee } from '../types';

// Initialize Firebase App & Auth
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export interface GoogleUser {
  accessToken: string;
  email: string;
  name: string;
}

/**
 * Trigger authentic Google Sign-In with required Calendar Scopes
 */
export async function signInWithGoogleForCalendar(): Promise<GoogleUser> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar');
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) {
    throw new Error('لم يتم الحصول على رمز الوصول الصالح (Access Token) من حساب Google.');
  }

  return {
    accessToken,
    email: result.user.email || '',
    name: result.user.displayName || ''
  };
}

/**
 * Creates or updates an event in Google Calendar primary calendar.
 * Includes staff members as attendees based on center target mapping!
 */
export async function createOrUpdateCalendarEvent(
  program: AidProgram,
  centers: ShelterCenter[],
  employees: Employee[],
  accessToken: string
): Promise<string> {
  const targetCentersList = centers.filter(c => program.targetCenters.includes(c.id));
  const locationText = targetCentersList.map(c => `${c.name} (${c.location})`).join('، ') || 'مراكز الإيواء المعتمدة';
  
  // Map employees assigned to the target shelter centers or general staff, who have email addresses
  const attendeesEmails = employees
    .filter(emp => emp.email && (emp.centerId === '' || program.targetCenters.includes(emp.centerId)))
    .map(emp => ({ 
      email: emp.email, 
      displayName: emp.name 
    }));

  const descriptionText = `
الموضوع: حملة توزيع وتسهيل المساعدات الإنسانية - منصة الركن
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• اسم المشروع: ${program.name}
• نوع المساعدة: ${program.type}
• القيمة التقديرية للحزمة: ${program.value} شيكل
• إجمالي الكمية المجهزة: ${program.unitCount} طرد / وحدة
• الفئات المشمولة بالتلقي: ${program.targetCategories.join('، ')}
• الملاحظات والتعليمات الميدانية: ${program.notes || 'لا يوجد ملاحظات إضافية للموظفين.'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
تمت الجدولة والمزامنة تلقائياً بواسطة نظام إدارة منصة الركن.
يرجى من الموظفين مراجعة مواعيد الحضور والمناوبة لضمان انسيابية التسليم للمستفيدين.
  `.trim();

  const eventBody = {
    summary: `منصة الركن: توزيع [${program.name}] - ${locationText}`,
    description: descriptionText,
    location: locationText,
    start: {
      date: program.startDate // All-day events use "date" format YYYY-MM-DD
    },
    end: {
      date: program.endDate // All-day events use "date" format YYYY-MM-DD
    },
    attendees: attendeesEmails,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // Notification via email 1 day prior
        { method: 'popup', minutes: 60 }       // Direct alert popup 1 hour prior
      ]
    }
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  if (program.calendarEventId) {
    // PUT /v3/calendars/primary/events/eventId to update programmatically
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${program.calendarEventId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(eventBody)
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      console.error('Google Calendar Update Error:', errText);
      throw new Error(`فشل تحديث تقويم جوجل: ${response.statusText}`);
    }
    const data = await response.json();
    return data.id;
  } else {
    // POST /v3/calendars/primary/events to insert new event
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(eventBody)
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      console.error('Google Calendar Creation Error:', errText);
      throw new Error(`فشل إنشاء حدث تقويم جوجل: ${response.statusText}`);
    }
    const data = await response.json();
    return data.id;
  }
}

/**
 * Removes event from Google Calendar programmatically
 */
export async function deleteCalendarEvent(eventId: string, accessToken: string): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`
  };
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers
    }
  );
  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    console.error('Google Calendar Deletion Error:', errText);
    throw new Error(`فشل حذف حدث تقويم جوجل: ${response.statusText}`);
  }
}
