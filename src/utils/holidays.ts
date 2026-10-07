/**
 * Calcolo festività italiane e domeniche
 */

export interface HolidayInfo {
  isHoliday: boolean;
  name?: string;
}

// Calcolo data della Pasqua (Algoritmo di Butcher / Gauss)
export function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Calcolo data di Pasquetta (Lunedì dell'Angelo)
export function getEasterMondayDate(year: number): { month: number; day: number } {
  const easter = getEasterDate(year);
  const d = new Date(year, easter.month - 1, easter.day + 1);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

export function getItalianHolidays(year: number): Record<string, string> {
  const easter = getEasterDate(year);
  const easterMonday = getEasterMondayDate(year);

  const holidays: Record<string, string> = {
    '01-01': 'Capodanno',
    '01-06': 'Epifania',
    '04-25': 'Festa della Liberazione',
    '05-01': 'Festa del Lavoro',
    '06-02': 'Festa della Repubblica',
    '08-15': 'Assunzione / Ferragosto',
    '11-01': 'Tutti i Santi',
    '12-08': 'Immacolata Concezione',
    '12-25': 'Natale',
    '12-26': 'Santo Stefano',
  };

  const easterKey = `${String(easter.month).padStart(2, '0')}-${String(easter.day).padStart(2, '0')}`;
  const easterMondayKey = `${String(easterMonday.month).padStart(2, '0')}-${String(easterMonday.day).padStart(2, '0')}`;

  holidays[easterKey] = 'Pasqua';
  holidays[easterMondayKey] = "Lunedì dell'Angelo (Pasquetta)";

  return holidays;
}

export function checkItalianHoliday(year: number, month: number, day: number): HolidayInfo {
  const holidays = getItalianHolidays(year);
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (holidays[key]) {
    return { isHoliday: true, name: holidays[key] };
  }
  return { isHoliday: false };
}

export function isDateSunday(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0;
}

export function getDayInfo(year: number, month: number, day: number): {
  isHoliday: boolean;
  holidayName?: string;
  isSunday: boolean;
  isHolidayOrSunday: boolean;
  dayOfWeekShort: string;
  dayOfWeekFull: string;
} {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const isSunday = dayOfWeek === 0;
  const holiday = checkItalianHoliday(year, month, day);

  const shortDays = ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'];
  const fullDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  return {
    isHoliday: holiday.isHoliday,
    holidayName: holiday.name,
    isSunday,
    isHolidayOrSunday: holiday.isHoliday || isSunday,
    dayOfWeekShort: shortDays[dayOfWeek],
    dayOfWeekFull: fullDays[dayOfWeek]
  };
}
