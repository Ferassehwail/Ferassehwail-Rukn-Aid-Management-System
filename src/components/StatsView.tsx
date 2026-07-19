import React from 'react';
import { getStats, getDeliveries, getAidPrograms, getCenters } from '../utils/db';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title,
  Decimation
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title
);

export default function StatsView() {
  const stats = getStats();
  const deliveries = getDeliveries();
  const aidPrograms = getAidPrograms();
  const centers = getCenters();

  // Get active and completed aid counts
  const activeAids = aidPrograms.filter(p => p.status === 'active').length;
  const completedAids = aidPrograms.filter(p => p.status === 'completed').length;

  const recentDeliveries = deliveries.slice(0, 5);

  // 1. Chart.js Calculations: Aid distribution by project types
  const aidTypes = aidPrograms.reduce((acc: { [key: string]: number }, cur) => {
    acc[cur.type] = (acc[cur.type] || 0) + 1;
    return acc;
  }, {});

  const typeLabels = Object.keys(aidTypes);
  const typeValues = Object.values(aidTypes);

  const doughnutData = {
    labels: typeLabels.length > 0 ? typeLabels : ['لا يوجد برامج حالياً'],
    datasets: [
      {
        label: 'عدد المشاريع المجدولة',
        data: typeValues.length > 0 ? typeValues : [0],
        backgroundColor: [
          'rgba(37, 99, 235, 0.85)',   // Blue
          'rgba(16, 185, 129, 0.85)',  // Emerald
          'rgba(79, 70, 229, 0.85)',   // Indigo
          'rgba(249, 115, 22, 0.85)',  // Orange
          'rgba(20, 184, 166, 0.85)',   // Teal
          'rgba(245, 158, 11, 0.85)'   // Amber
        ],
        borderColor: [
          '#ffffff',
        ],
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        rtl: true,
        labels: {
          font: {
            family: 'Inter, Cairo',
            size: 11,
            weight: 'bold' as const
          },
          boxWidth: 12,
          padding: 12,
          usePointStyle: true,
        }
      },
      tooltip: {
        rtl: true,
        titleFont: { family: 'Cairo', size: 12 },
        bodyFont: { family: 'Cairo', size: 11 },
      }
    },
    cutout: '65%'
  };


  // 2. Chart.js Calculations: Deliveries completed per shelter center
  // Calculates real-time deliveries per center dynamically to update with every hand-over!
  const centerLabels = centers.map(c => c.name);
  const centerDeliveryCounts = centers.map(c => {
    // filter actual deliveries for this center
    return deliveries.filter(d => d.centerId === c.id).length;
  });

  const barData = {
    labels: centerLabels.length > 0 ? centerLabels.map(name => name.replace('مركز إيواء ', '')) : ['المركز الرئيسي'],
    datasets: [
      {
        label: 'عمليات التسليم اللحظية المنجزة',
        data: centerDeliveryCounts,
        backgroundColor: 'rgba(37, 99, 235, 0.8)',
        hoverBackgroundColor: 'rgba(37, 99, 235, 0.95)',
        borderRadius: 8,
        borderWidth: 0,
        barThickness: 24,
      },
      {
        label: 'طاقة العائلات الإجمالية بالمركز',
        data: centers.map(c => c.familiesCount),
        backgroundColor: 'rgba(226, 232, 240, 0.6)',
        hoverBackgroundColor: 'rgba(203, 213, 225, 0.8)',
        borderRadius: 8,
        borderWidth: 0,
        barThickness: 24,
      }
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        rtl: true,
        labels: {
          font: {
            family: 'Inter, Cairo',
            size: 11,
            weight: 'bold' as const
          },
          boxWidth: 12,
          usePointStyle: true,
        }
      },
      tooltip: {
        rtl: true,
        titleFont: { family: 'Cairo', size: 12 },
        bodyFont: { family: 'Cairo', size: 11 },
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { family: 'Inter', size: 10 },
        },
        grid: {
          color: 'rgba(241, 245, 249, 1)',
        }
      },
      x: {
        ticks: {
          font: { family: 'Cairo, Inter', size: 10, weight: 'bold' as const },
        },
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 font-sans">
      
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-cairo">لوحة التحليل الفوري للبيانات والإحصائيات الجغرافية</h2>
          <p className="text-slate-500 text-xs mt-1">تتبع مؤشرات الاستلام اللحظي والتقارير الرسومية التفاعلية لمشاريع المساعدات ومراكز الإيواء</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-xl border border-emerald-100 font-bold flex items-center gap-2 self-start md:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>مزامنة مباشرة مع كل عملية تسليم (Real-Time Charting)</span>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Families */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-house-chimney-window"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block font-semibold">إجمالي الأسر</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.familiesCount} عائلة</span>
          </div>
        </div>

        {/* Total Citizens */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block font-semibold">المواطنون المسجلون</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.citizensCount} مواطن</span>
          </div>
        </div>

        {/* Total Deliveries Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-truck-ramp-box"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block font-semibold">تسليمات اليوم</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.deliveriesTodayCount} عملية</span>
          </div>
        </div>

        {/* Total Deliveries Cumulative */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex items-center gap-4">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-clipboard-check"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block font-semibold">مجموع المساعدات المسلمة</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.deliveriesTotalCount} شحنة منجزة</span>
          </div>
        </div>

        {/* Widows */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-venus"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block">أرامل ومطلقات</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.widowsCount} ملف أسرة</span>
          </div>
        </div>

        {/* Orphans */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-children"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block">مكفولو الأيتام</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.orphansCount} عائلة أيتام</span>
          </div>
        </div>

        {/* Disabled */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-wheelchair"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block">ذوو الاحتياجات الخاصة</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.disabledCount} حالة نشطة</span>
          </div>
        </div>

        {/* Elderly */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl text-lg flex items-center justify-center">
            <i className="fa-solid fa-person-cane"></i>
          </div>
          <div>
            <span className="text-slate-400 text-xs block">كبار السن والمسنون</span>
            <span className="text-slate-800 text-base font-black block mt-0.5">{stats.elderlyCount} مستحق مسن</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics / Interactive Chart.js Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Bar Chart of Deliveries per Shelter Center (2/3 width) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="text-blue-600"><i className="fa-solid fa-chart-column"></i></span>
                <span>توزيع عمليات التسليم اللحظية مقارنة بطاقة الاستيعاب الجغرافية</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">يعرض كفاءة التسليم الميداني ومجموع العوائل النازحة المقيمة بكل مركز إيواء معتمد.</p>
            </div>
          </div>
          
          <div className="h-72 relative flex-1">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>

        {/* Chart 2: Doughnut Chart of Aid Types (1/3 width) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="text-emerald-500"><i className="fa-solid fa-chart-pie"></i></span>
              <span>توزيع المشاريع الإغاثية حسب نوع الحزمة</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">نسب توجيه المشاريع الإنشائية والصحية والغذائية القائمة حالياً.</p>
          </div>

          <div className="h-56 relative flex-1">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 grid grid-cols-2 gap-4 text-center text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 text-[9px] block font-bold">مشاريع قيد التوزيع</span>
              <span className="text-slate-800 font-extrabold mt-0.5">{activeAids} نشط</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-slate-400 text-[9px] block font-bold">أغلقت بالكامل</span>
              <span className="text-slate-800 font-extrabold mt-0.5">{completedAids} مكتمل</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Deliveries Table */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="text-blue-600"><i className="fa-solid fa-history"></i></span>
            <span>أحدث عمليات التسليم وتأكيد الاستلام بالمراكز</span>
          </h3>
          <span className="text-xs text-slate-400 font-semibold">تحديث لحظي</span>
        </div>

        {recentDeliveries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/50 text-slate-500 border-b border-slate-100">
                  <th className="py-3 px-5 font-bold">المستفيد</th>
                  <th className="py-3 px-5 font-bold">رقم الهوية</th>
                  <th className="py-3 px-5 font-bold">تاريخ ووقت الاستلام</th>
                  <th className="py-3 px-5 font-bold">الموظف المسؤول</th>
                  <th className="py-3 px-5 font-bold">مركز الإيواء</th>
                  <th className="py-3 px-5 font-bold">عنوان الـ IP المستخدم</th>
                  <th className="py-3 px-5 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentDeliveries.map((d, index) => {
                  const centerObj = getCenters().find(c => c.id === d.centerId);
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-3.5 px-5 font-bold text-slate-800">{d.receivedBy}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-500">{d.recipientId}</td>
                      <td className="py-3.5 px-5 text-slate-500">
                        {new Date(d.deliveredAt).toLocaleString('ar-EG')}
                      </td>
                      <td className="py-3.5 px-5 font-medium">{d.employeeName}</td>
                      <td className="py-3.5 px-5 text-slate-500">{centerObj ? centerObj.name : 'المركز الرئيسي'}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">{d.ipAddress}</td>
                      <td className="py-3.5 px-5">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-0.5">
                          <i className="fa-solid fa-circle-check text-emerald-500"></i>
                          تم الاستلام
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-1">
            <span className="text-3xl block"><i className="fa-solid fa-receipt"></i></span>
            <p className="text-xs font-semibold text-slate-500">لا يوجد عمليات تسليم مقيدة بالنظام حالياً.</p>
          </div>
        )}
      </section>

    </div>
  );
}
