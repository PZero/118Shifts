export type UserRole = 'admin' | 'approver' | 'doctor';

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  doctorName?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export type ShiftCategory = 
  | 'morning'        // Mattino: 08:00 - 14:00 (M, M1-M7, MC, RM, etc.)
  | 'afternoon'      // Pomeriggio: 14:00 - 20:00 (P, P1-P7, PC, RP, etc.)
  | 'night'          // Notte: 20:00 - 08:00 (N, N1-N7, NC, etc.)
  | 'standby_day'    // Reperibilità Giorno (RG)
  | 'standby_night'  // Reperibilità Notte (RN)
  | 'heli'           // Elicottero (e, Re, E)
  | 'vacation'       // Ferie (F, f, FERIE)
  | 'course'         // Corsi formazione (C, CORSO)
  | 'other';         // Altro (Q, G, A, Ex, -, etc.)

export interface ShiftDetails {
  code: string;
  label: string;
  category: ShiftCategory;
  startTime?: string;
  endTime?: string;
  durationHours: number;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  isWorkingShift: boolean;
}

export interface DayShiftInfo {
  day: number;
  dateStr: string; // YYYY-MM-DD
  dayOfWeekShort: string; // Lu, Ma, Me, Gi, Ve, Sa, Do
  dayOfWeekFull: string;
  rawCodes: string[];
  shifts: ShiftDetails[];
  isHoliday: boolean;
  holidayName?: string;
  isSunday: boolean;
  isFreeHolidayOrSunday: boolean;
}

export interface DoctorSchedule {
  doctorName: string;
  days: Record<number, string[]>; // day (1..31) -> raw shift codes ['M6', 'P6']
  totalHours?: number;
}

export interface MonthSchedule {
  monthKey: string; // '2026-10'
  monthName: string; // 'OTTOBRE'
  year: number;
  month: number; // 1..12
  prevMonthLastDay: number;
  totalDays: number;
  doctors: Record<string, DoctorSchedule>;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface DoctorStats {
  doctorName: string;
  monthKey: string;
  totalHours: number;
  totalWorkingShifts: number;
  mornings: number;
  afternoons: number;
  nights: number;
  standbyDay: number;
  standbyNight: number;
  heli: number;
  vacationDays: number;
  courseDays: number;
  otherDays: number;
  totalHolidaysAndSundays: number;
  freeHolidaysAndSundays: number;
  workedHolidaysAndSundays: number;
}
