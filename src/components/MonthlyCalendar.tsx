import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sun, 
  Moon, 
  Sunrise, 
  Radio, 
  Plane, 
  Palmtree, 
  GraduationCap, 
  Info,
  Users,
  Sparkles
} from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';
import { DayShiftInfo, ShiftDetails } from '../types';

interface MonthlyCalendarProps {
  onSelectDay: (dayInfo: DayShiftInfo) => void;
}

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ onSelectDay }) => {
  const { doctorDaysInfo, currentMonthSchedule, selectedDoctor } = useSchedule();

  const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const daysOfWeekShort = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];

  // Calculate day offset for 1st day of month (0 = Mon, 6 = Sun)
  const firstDayDate = currentMonthSchedule 
    ? new Date(currentMonthSchedule.year, currentMonthSchedule.month - 1, 1) 
    : new Date();
  
  // JavaScript getDay(): 0 is Sunday, 1 is Monday ... convert to Monday=0
  const startDayOffset = (firstDayDate.getDay() + 6) % 7;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-sky-400" size={20} />
          <h2 className="text-lg font-bold text-white tracking-tight m-0">
            Calendario Turni - {currentMonthSchedule?.monthName} {currentMonthSchedule?.year}
          </h2>
        </div>
        <div className="text-xs text-slate-400">
          Tocca un giorno per visualizzare i dettagli e i colleghi in servizio
        </div>
      </div>

      {/* Weekday Labels Header */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
        {daysOfWeekShort.map((dayName, idx) => {
          const isSun = idx === 6;
          return (
            <div
              key={dayName}
              className={`text-xs font-bold py-1.5 rounded-lg ${
                isSun ? 'text-red-400 bg-red-950/20' : 'text-slate-400 bg-slate-800/40'
              }`}
            >
              <span className="hidden sm:inline">{daysOfWeek[idx]}</span>
              <span className="sm:hidden">{dayName}</span>
            </div>
          );
        })}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {/* Empty padding slots for days before 1st day of month */}
        {Array.from({ length: startDayOffset }).map((_, i) => (
          <div 
            key={`empty-${i}`} 
            className="min-h-[85px] sm:min-h-[110px] rounded-xl bg-slate-950/30 border border-slate-900/50 opacity-20 pointer-events-none"
          />
        ))}

        {/* Actual Month Days */}
        {doctorDaysInfo.map((dayInfo) => {
          const isHoliday = dayInfo.isHoliday;
          const isSunday = dayInfo.isSunday;
          const isHolidayOrSunday = isHoliday || isSunday;
          const hasWorkingShift = dayInfo.shifts.some(s => s.isWorkingShift);
          const isFree = isHolidayOrSunday && !hasWorkingShift;

          return (
            <button
              key={dayInfo.day}
              onClick={() => onSelectDay(dayInfo)}
              className={`min-h-[90px] sm:min-h-[115px] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer group hover:scale-[1.02] hover:shadow-lg relative overflow-hidden ${
                isHoliday
                  ? 'bg-red-950/25 border-red-500/40 hover:border-red-400'
                  : isSunday
                  ? 'bg-rose-950/15 border-rose-500/30 hover:border-rose-400'
                  : 'bg-slate-800/60 border-slate-700/60 hover:border-sky-500/60 hover:bg-slate-800'
              }`}
            >
              {/* Day Header Row */}
              <div className="flex items-center justify-between w-full">
                <span className={`text-xs sm:text-sm font-extrabold px-1.5 py-0.5 rounded-md ${
                  isHoliday 
                    ? 'bg-red-500/20 text-red-300' 
                    : isSunday 
                    ? 'bg-rose-500/20 text-rose-300' 
                    : 'bg-slate-700/60 text-slate-200'
                }`}>
                  {dayInfo.day}
                </span>

                {/* Free holiday badge indicator */}
                {isFree && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-1 rounded flex items-center gap-0.5 border border-emerald-500/30">
                    <Sparkles size={10} />
                    <span className="hidden sm:inline">Libero</span>
                  </span>
                )}
              </div>

              {/* Holiday Name (if applicable) */}
              {dayInfo.holidayName && (
                <div className="text-[10px] leading-tight font-semibold text-red-300/90 truncate my-0.5">
                  {dayInfo.holidayName}
                </div>
              )}

              {/* Shifts List for Day */}
              <div className="flex flex-col gap-1 my-1 w-full">
                {dayInfo.shifts.length === 0 ? (
                  <span className="text-[11px] text-slate-600 font-mono italic">
                    --
                  </span>
                ) : (
                  dayInfo.shifts.map((shift, sIdx) => {
                    return (
                      <div
                        key={sIdx}
                        className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-lg border flex items-center justify-between gap-1 shadow-sm ${shift.badgeBg} ${shift.badgeText} ${shift.borderColor}`}
                      >
                        <span className="truncate">{shift.code}</span>
                        {shift.startTime && (
                          <span className="text-[9px] opacity-80 hidden md:inline">
                            {shift.startTime}-{shift.endTime}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Indicator on Hover */}
              <div className="text-[9px] text-slate-500 flex items-center justify-end w-full opacity-0 group-hover:opacity-100 transition">
                <Users size={10} className="mr-0.5" />
                <span>Turni 118</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Shift Legend & Time Codes */}
      <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center gap-3">
        <span className="font-bold text-slate-300">Legenda Orari:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span>Mattino (M): <strong>08:00 - 14:00</strong> (6h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Pomeriggio (P): <strong>14:00 - 20:00</strong> (6h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
          <span>Notte (N): <strong>20:00 - 08:00</strong> (12h)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
          <span>Elicottero (e): <strong>08:00 - 20:00</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span>Reperibilità (RG / RN)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Ferie (F)</span>
        </div>
      </div>
    </div>
  );
};
