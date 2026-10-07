import * as XLSX from 'xlsx';
import { MonthSchedule, ShiftCategory, ShiftDetails, DoctorSchedule, DoctorStats } from '../types';
import { getDayInfo } from './holidays';

export function interpretShiftCode(code: string): ShiftDetails {
  const clean = code.trim();
  const upper = clean.toUpperCase();

  // Ferie
  if (upper === 'F' || upper === 'FERIE' || upper === 'FER') {
    return {
      code: clean,
      label: 'Ferie',
      category: 'vacation',
      durationHours: 0,
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-400',
      borderColor: 'border-emerald-500/40',
      isWorkingShift: false
    };
  }

  // Malattia o indisponibilità
  if (clean === 'f' || upper === 'MALATTIA' || upper === 'ASS' || upper === 'INDISPONIBILITA') {
    return {
      code: clean,
      label: 'Malattia / Assenza',
      category: 'vacation',
      durationHours: 0,
      badgeBg: 'bg-teal-500/15',
      badgeText: 'text-teal-400',
      borderColor: 'border-teal-500/40',
      isWorkingShift: false
    };
  }

  // Corsi
  if (upper === 'C' || upper.startsWith('CORSO') || upper.startsWith('CORSI') || upper === 'CD') {
    return {
      code: clean,
      label: 'Corso Formazione',
      category: 'course',
      durationHours: 6,
      badgeBg: 'bg-purple-500/15',
      badgeText: 'text-purple-300',
      borderColor: 'border-purple-500/40',
      isWorkingShift: false
    };
  }

  // Elicottero
  if (clean === 'e' || clean === 'Re' || upper === 'E' || upper.includes('ELICOTTERO')) {
    return {
      code: clean,
      label: 'Elicottero 118',
      category: 'heli',
      startTime: '08:00',
      endTime: '20:00',
      durationHours: 12,
      badgeBg: 'bg-cyan-500/20',
      badgeText: 'text-cyan-300',
      borderColor: 'border-cyan-500/50',
      isWorkingShift: true
    };
  }

  // Reperibilità Notte
  if (upper === 'RN' || upper.includes('REP. NOTTE') || upper.includes('REP NOTTE')) {
    return {
      code: clean,
      label: 'Reperibilità Notte',
      category: 'standby_night',
      startTime: '20:00',
      endTime: '08:00',
      durationHours: 12,
      badgeBg: 'bg-indigo-500/20',
      badgeText: 'text-indigo-300',
      borderColor: 'border-indigo-500/40',
      isWorkingShift: false
    };
  }

  // Reperibilità Giorno / Mattina
  if (upper === 'RG' || upper === 'RM' || upper === 'RP' || upper === 'RE' || upper.includes('REP')) {
    return {
      code: clean,
      label: `Reperibilità ${clean}`,
      category: 'standby_day',
      startTime: '08:00',
      endTime: '20:00',
      durationHours: 12,
      badgeBg: 'bg-sky-500/20',
      badgeText: 'text-sky-300',
      borderColor: 'border-sky-500/40',
      isWorkingShift: false
    };
  }

  // Turni Notte (N, N1..N7, NC, NCatt, etc.)
  if (upper.startsWith('N')) {
    return {
      code: clean,
      label: `Notte (${clean})`,
      category: 'night',
      startTime: '20:00',
      endTime: '08:00',
      durationHours: 12,
      badgeBg: 'bg-violet-950/80',
      badgeText: 'text-violet-300',
      borderColor: 'border-violet-500/60',
      isWorkingShift: true
    };
  }

  // Turni Pomeriggio (P, P1..P7, PC, etc.)
  if (upper.startsWith('P')) {
    return {
      code: clean,
      label: `Pomeriggio (${clean})`,
      category: 'afternoon',
      startTime: '14:00',
      endTime: '20:00',
      durationHours: 6,
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-300',
      borderColor: 'border-amber-500/50',
      isWorkingShift: true
    };
  }

  // Turni Mattino (M, M1..M7, MC, etc.)
  if (upper.startsWith('M')) {
    return {
      code: clean,
      label: `Mattino (${clean})`,
      category: 'morning',
      startTime: '08:00',
      endTime: '14:00',
      durationHours: 6,
      badgeBg: 'bg-blue-500/20',
      badgeText: 'text-blue-300',
      borderColor: 'border-blue-500/50',
      isWorkingShift: true
    };
  }

  return {
    code: clean,
    label: clean === '-' ? 'Non Disponibile' : `Altro (${clean})`,
    category: 'other',
    durationHours: 0,
    badgeBg: 'bg-slate-800/60',
    badgeText: 'text-slate-300',
    borderColor: 'border-slate-700/50',
    isWorkingShift: false
  };
}

const MONTH_NAMES_MAP: Record<string, number> = {
  'GENNAIO': 1, 'FEBBRAIO': 2, 'MARZO': 3, 'APRILE': 4,
  'MAGGIO': 5, 'GIUGNO': 6, 'LUGLIO': 7, 'AGOSTO': 8,
  'SETTEMBRE': 9, 'OTTOBRE': 10, 'NOVEMBRE': 11, 'DICEMBRE': 12
};

export function parseExcelWorkbook(workbook: XLSX.WorkBook, uploadedBy?: string): MonthSchedule[] {
  const schedules: MonthSchedule[] = [];

  for (const sName of workbook.SheetNames) {
    const ws = workbook.Sheets[sName];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (!data || data.length < 5) continue;

    const rawMonth = String(data[0]?.[0] || '').trim().toUpperCase();
    const rawYear = data[1]?.[0];

    let monthNum = 0;
    for (const [mName, mNum] of Object.entries(MONTH_NAMES_MAP)) {
      if (rawMonth.includes(mName)) {
        monthNum = mNum;
        break;
      }
    }

    let yearNum = typeof rawYear === 'number' ? rawYear : parseInt(String(rawYear).replace(/\D/g, ''), 10);
    if (!yearNum || isNaN(yearNum)) {
      if (sName.includes('25')) yearNum = 2025;
      else if (sName.includes('26')) yearNum = 2026;
      else yearNum = new Date().getFullYear();
    }
    if (yearNum < 100) yearNum += 2000;

    if (!monthNum) continue;

    const monthKey = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

    let day1Col = -1;
    if (data[1]) {
      for (let c = 0; c < data[1].length; c++) {
        if (data[1][c] === 1) {
          day1Col = c;
          break;
        }
      }
    }
    if (day1Col === -1) continue;

    let totalDays = 0;
    let lastDayCol = day1Col;
    for (let c = day1Col; c < data[1].length; c++) {
      const val = data[1][c];
      if (typeof val === 'number' && val === totalDays + 1) {
        totalDays = val;
        lastDayCol = c;
      }
    }

    const prevMonthLastDay = (data[1] && typeof data[1][day1Col - 1] === 'number') 
      ? Number(data[1][day1Col - 1]) 
      : 30;

    const doctors: Record<string, DoctorSchedule> = {};

    for (let r = 4; r < data.length; r++) {
      const docNameRaw = data[r]?.[0];
      if (docNameRaw && typeof docNameRaw === 'string' && docNameRaw.trim().length > 1) {
        const docName = docNameRaw.trim();
        const upper = docName.toUpperCase();
        if (
          upper === 'TURNO' ||
          upper === 'FERIE' ||
          upper === 'CORSI' ||
          upper === 'GETTONE' ||
          upper === 'INDISPONIBILITA' ||
          upper === 'F' ||
          upper === 'C' ||
          upper.startsWith('Q/MR')
        ) {
          break;
        }

        const days: Record<number, string[]> = {};
        const row1 = data[r] || [];
        const row2 = data[r + 1] || [];

        for (let day = 1; day <= totalDays; day++) {
          const colIdx = day1Col + (day - 1);
          const shift1 = String(row1[colIdx] || '').trim();
          const shift2 = String(row2[colIdx] || '').trim();

          const shifts: string[] = [];
          if (shift1) shifts.push(shift1);
          if (shift2 && shift2 !== shift1) shifts.push(shift2);

          if (shifts.length > 0) {
            days[day] = shifts;
          }
        }

        const totalHoursVal = row1[lastDayCol + 1] || row1[lastDayCol + 2];
        const totalHours = typeof totalHoursVal === 'number' ? totalHoursVal : undefined;

        doctors[docName] = {
          doctorName: docName,
          days,
          totalHours
        };

        if (data[r + 1] && !data[r + 1][0]) {
          r++;
        }
      }
    }

    schedules.push({
      monthKey,
      monthName: rawMonth,
      year: yearNum,
      month: monthNum,
      prevMonthLastDay,
      totalDays,
      doctors,
      uploadedAt: new Date().toISOString(),
      uploadedBy
    });
  }

  return schedules.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export function computeDoctorStats(doctorName: string, schedule: MonthSchedule): DoctorStats {
  const docData = schedule.doctors[doctorName];
  const daysMap = docData?.days || {};

  let totalHours = 0;
  let totalWorkingShifts = 0;
  let mornings = 0;
  let afternoons = 0;
  let nights = 0;
  let standbyDay = 0;
  let standbyNight = 0;
  let heli = 0;
  let vacationDays = 0;
  let courseDays = 0;
  let otherDays = 0;

  let totalHolidaysAndSundays = 0;
  let freeHolidaysAndSundays = 0;
  let workedHolidaysAndSundays = 0;

  for (let day = 1; day <= schedule.totalDays; day++) {
    const dayInfo = getDayInfo(schedule.year, schedule.month, day);
    const shiftsForDay = daysMap[day] || [];
    const interpreted = shiftsForDay.map(interpretShiftCode);

    const isWorkingDay = interpreted.some(s => s.isWorkingShift);

    for (const shift of interpreted) {
      totalHours += shift.durationHours;
      if (shift.category === 'morning') mornings++;
      else if (shift.category === 'afternoon') afternoons++;
      else if (shift.category === 'night') nights++;
      else if (shift.category === 'standby_day') standbyDay++;
      else if (shift.category === 'standby_night') standbyNight++;
      else if (shift.category === 'heli') heli++;
      else if (shift.category === 'vacation') vacationDays++;
      else if (shift.category === 'course') courseDays++;
      else otherDays++;
    }

    if (isWorkingDay) {
      totalWorkingShifts++;
    }

    if (dayInfo.isHolidayOrSunday) {
      totalHolidaysAndSundays++;
      if (isWorkingDay) {
        workedHolidaysAndSundays++;
      } else {
        freeHolidaysAndSundays++;
      }
    }
  }

  return {
    doctorName,
    monthKey: schedule.monthKey,
    totalHours: docData?.totalHours || totalHours,
    totalWorkingShifts,
    mornings,
    afternoons,
    nights,
    standbyDay,
    standbyNight,
    heli,
    vacationDays,
    courseDays,
    otherDays,
    totalHolidaysAndSundays,
    freeHolidaysAndSundays,
    workedHolidaysAndSundays
  };
}
