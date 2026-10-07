import React from 'react';
import { Clock, Sun, Moon, Sunrise, Radio, Plane, Palmtree, GraduationCap, ShieldCheck } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';

export const ShiftStatsCard: React.FC = () => {
  const { doctorStats, selectedDoctor, currentMonthSchedule } = useSchedule();

  if (!doctorStats) return null;

  const statItems = [
    {
      label: 'Ore Totali',
      value: doctorStats.totalHours ? `${doctorStats.totalHours} h` : '0 h',
      icon: Clock,
      color: 'from-blue-600 to-sky-600',
      textColor: 'text-sky-300',
      borderColor: 'border-sky-500/40'
    },
    {
      label: 'Mattini (8-14)',
      value: doctorStats.mornings,
      icon: Sunrise,
      color: 'from-sky-600 to-cyan-600',
      textColor: 'text-sky-300',
      borderColor: 'border-sky-500/30'
    },
    {
      label: 'Pomeriggi (14-20)',
      value: doctorStats.afternoons,
      icon: Sun,
      color: 'from-amber-600 to-orange-600',
      textColor: 'text-amber-300',
      borderColor: 'border-amber-500/30'
    },
    {
      label: 'Notti (20-8)',
      value: doctorStats.nights,
      icon: Moon,
      color: 'from-indigo-600 to-violet-600',
      textColor: 'text-indigo-300',
      borderColor: 'border-indigo-500/30'
    },
    {
      label: 'Reperibilità G/N',
      value: `${doctorStats.standbyDay}G / ${doctorStats.standbyNight}N`,
      icon: Radio,
      color: 'from-teal-600 to-emerald-600',
      textColor: 'text-teal-300',
      borderColor: 'border-teal-500/30'
    },
    {
      label: 'Elicottero 118',
      value: doctorStats.heli,
      icon: Plane,
      color: 'from-emerald-600 to-green-600',
      textColor: 'text-emerald-300',
      borderColor: 'border-emerald-500/30'
    },
    {
      label: 'Ferie',
      value: doctorStats.vacationDays,
      icon: Palmtree,
      color: 'from-green-600 to-lime-600',
      textColor: 'text-green-300',
      borderColor: 'border-green-500/30'
    },
    {
      label: 'Corsi Formazione',
      value: doctorStats.courseDays,
      icon: GraduationCap,
      color: 'from-purple-600 to-fuchsia-600',
      textColor: 'text-purple-300',
      borderColor: 'border-purple-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
      {statItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={`bg-slate-900/90 border ${item.borderColor} rounded-xl p-3 shadow-md hover:border-slate-600 transition flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-slate-400 truncate">{item.label}</span>
              <Icon size={14} className={item.textColor} />
            </div>
            <div className={`text-lg font-extrabold ${item.textColor}`}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};
