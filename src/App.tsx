/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Employee } from './types';
import { initDB } from './utils/db';

// Component imports
import CitizenPortal from './components/CitizenPortal';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

type ScreenType = 'citizen_portal' | 'admin_login' | 'admin_dashboard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('citizen_portal');
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);

  // Initialize DB on mount and check if there's a stored session
  useEffect(() => {
    initDB();

    const savedEmp = localStorage.getItem('alrukn_active_employee');
    if (savedEmp) {
      try {
        const emp = JSON.parse(savedEmp);
        setActiveEmployee(emp);
        setCurrentScreen('admin_dashboard');
      } catch (err) {
        console.error('Failed to parse active employee session', err);
      }
    }

    const handleSwitchEmployee = (e: any) => {
      if (e.detail) {
        handleLoginSuccess(e.detail);
      }
    };

    window.addEventListener('alrukn_switch_employee', handleSwitchEmployee);
    return () => {
      window.removeEventListener('alrukn_switch_employee', handleSwitchEmployee);
    };
  }, []);

  const handleLoginSuccess = (employee: Employee) => {
    setActiveEmployee(employee);
    localStorage.setItem('alrukn_active_employee', JSON.stringify(employee));
    setCurrentScreen('admin_dashboard');
  };

  const handleLogout = () => {
    setActiveEmployee(null);
    localStorage.removeItem('alrukn_active_employee');
    localStorage.removeItem('alrukn_active_username');
    setCurrentScreen('citizen_portal');
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans" dir="rtl">
      {currentScreen === 'citizen_portal' && (
        <CitizenPortal 
          onAdminLoginClick={() => setCurrentScreen('admin_login')} 
        />
      )}

      {currentScreen === 'admin_login' && (
        <AdminLogin
          onLoginSuccess={handleLoginSuccess}
          onBackToCitizenPortal={() => setCurrentScreen('citizen_portal')}
        />
      )}

      {currentScreen === 'admin_dashboard' && activeEmployee && (
        <AdminDashboard
          employee={activeEmployee}
          onLogout={handleLogout}
          onGoToCitizenPortal={() => setCurrentScreen('citizen_portal')}
        />
      )}
    </div>
  );
}

