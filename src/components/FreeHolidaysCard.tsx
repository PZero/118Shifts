import React from 'react';
import { Sparkles, Calendar, CheckCircle2, AlertCircle, SunMedium } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';

export const FreeHolidaysCard: React.FC = () => {
  const { doctorDaysInfo, freeHolidaysList, selectedDoctor, currentMonthSchedule } = useSchedule();

  // Filter all holidays and Sundays in the month
  const allHolidaysAndSundays = doctorDaysInfo.filter(d => d.isHoliday || d.isSunday);
  const totalHolidaysAndSundays = allHolidaysAndSundays.length;
  const freeCount = freeHolidaysList.length;
  const workedCount = totalHolidaysAndSundays - freeCount;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl shadow-slate-950/40 relative overflow-hidden">
      {/* Decorative ambient background glow */}
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight m-0">
              Festività & Domeniche Libere
            </h2>
            <p className="text-xs text-slate-400 m-0">
              Riepilogo non lavorative per Dr. {selectedDoctor} ({currentMonthSchedule?.monthName} {currentMonthSchedule?.year})
            </p>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-inner">
          <span className="text-xs text-slate-400 font-medium">Libere:</span>
          <span className="text-sm font-extrabold text-emerald-400">{freeCount}</span>
          <span className="text-xs text-slate-500">/ {totalHolidaysAndSundays}</span>
        </div>
      </div>

      {/* Summary Message */}
      <div className="mb-4 text-xs sm:text-sm text-slate-300 bg-slate-800/40 rounded-xl p-3 border border-slate-700/40 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            Hai <strong className="text-emerald-400 font-bold">{freeCount}</strong> date festive/domenicali libere su {totalHolidaysAndSundays} questo mese.
          </span>
        </div>
        {workedCount > 0 && (
          <span className="text-amber-300 font-medium text-xs bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            {workedCount} in turno di servizio
          </span>
        )}
      </div>

      {/* List of Holidays and Sundays */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {allHolidaysAndSundays.map((day) => {
          const isFree = day.isFreeHolidayOrSunday;
          const workingShifts = day.shifts.filter(s => s.isWorkingShift);

          return (
            <div
              key={day.day}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                isFree
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100 hover:bg-emerald-950/30'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-100 hover:bg-amber-950/30'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-bold text-xs flex-shrink-0 ${
                  isFree ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  <span className="text-[10px] leading-none uppercase">{day.dayOfWeekShort}</span>
                  <span className="text-sm leading-none font-black">{day.day}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    {day.dayOfWeekFull} {day.day} {currentMonthSchedule?.monthName}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                    {day.holidayName ? `🎉 ${day.holidayName}` : 'Domenica'}
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex-shrink-0">
                {isFree ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle2 size={12} />
                    <span>Libero</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-500/25 text-amber-200 border border-amber-500/40">
                    <AlertCircle size={12} />
                    <span>{workingShifts.map(s => s.code).join(' + ') || 'Turno'}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
