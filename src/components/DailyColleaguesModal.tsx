import React from 'react';
import { X, Calendar, Clock, User, ShieldCheck } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';
import { DayShiftInfo } from '../types';
import { interpretShiftCode } from '../utils/shiftParser';

interface DailyColleaguesModalProps {
  dayInfo: DayShiftInfo | null;
  onClose: () => void;
}

export const DailyColleaguesModal: React.FC<DailyColleaguesModalProps> = ({ dayInfo, onClose }) => {
  const { currentMonthSchedule, selectedDoctor } = useSchedule();

  if (!dayInfo || !currentMonthSchedule) return null;

  // Extract all doctors working on this day
  const doctorsList = Object.keys(currentMonthSchedule.doctors || {}).map(docName => {
    const docData = currentMonthSchedule.doctors[docName];
    const rawCodes = docData?.days[dayInfo.day] || [];
    const shifts = rawCodes.map(interpretShiftCode);
    const isSelected = docName === selectedDoctor;

    return {
      docName,
      rawCodes,
      shifts,
      isSelected
    };
  }).filter(d => d.shifts.length > 0);

  // Sort: selected doctor first, then alphabetically
  doctorsList.sort((a, b) => {
    if (a.isSelected) return -1;
    if (b.isSelected) return 1;
    return a.docName.localeCompare(b.docName);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
              {dayInfo.day}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white m-0">
                Turni 118 del {dayInfo.dayOfWeekFull} {dayInfo.day} {currentMonthSchedule.monthName} {currentMonthSchedule.year}
              </h3>
              {dayInfo.holidayName && (
                <p className="text-xs text-red-400 font-semibold m-0">🎉 {dayInfo.holidayName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body - Doctors list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          <div className="text-xs font-semibold text-slate-400 mb-2">
            Medici in servizio / pianificati ({doctorsList.length} colleghi):
          </div>

          {doctorsList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Nessun turno assegnato per questa giornata.
            </div>
          ) : (
            doctorsList.map((docItem) => (
              <div
                key={docItem.docName}
                className={`flex items-center justify-between p-3 rounded-xl border transition ${
                  docItem.isSelected
                    ? 'bg-sky-950/40 border-sky-500/50 ring-1 ring-sky-500/40'
                    : 'bg-slate-800/50 border-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    docItem.isSelected ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    <User size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <span>Dr. {docItem.docName}</span>
                      {docItem.isSelected && (
                        <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded border border-sky-500/30">
                          Tu
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shift Badges */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {docItem.shifts.map((shift, idx) => (
                    <div
                      key={idx}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${shift.badgeBg} ${shift.badgeText} ${shift.borderColor}`}
                    >
                      <span>{shift.code}</span>
                      {shift.startTime && (
                        <span className="text-[10px] opacity-75">
                          ({shift.startTime}-{shift.endTime})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};
