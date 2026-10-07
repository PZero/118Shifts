import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { MonthSchedule, DoctorStats, DayShiftInfo } from '../types';
import { INITIAL_SCHEDULES, ALL_INITIAL_DOCTORS } from '../data/initialDemoData';
import { parseExcelWorkbook, computeDoctorStats, interpretShiftCode } from '../utils/shiftParser';
import { getDayInfo } from '../utils/holidays';
import { useAuth } from './AuthContext';

interface ScheduleContextType {
  schedules: MonthSchedule[];
  availableMonths: { monthKey: string; label: string; year: number; month: number }[];
  selectedMonthKey: string;
  setSelectedMonthKey: (key: string) => void;
  selectedDoctor: string;
  setSelectedDoctor: (docName: string) => void;
  currentMonthSchedule: MonthSchedule | undefined;
  allDoctors: string[];
  doctorStats: DoctorStats | null;
  doctorDaysInfo: DayShiftInfo[];
  freeHolidaysList: DayShiftInfo[];
  uploadExcelFile: (file: File) => Promise<{ success: boolean; message: string; monthsCount: number }>;
  isUploading: boolean;
  goToNextMonth: () => void;
  goToPrevMonth: () => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

const LOCAL_SCHEDULES_KEY = 'turni118_schedules_cache';

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isFirebaseActive } = useAuth();
  
  const [schedules, setSchedules] = useState<MonthSchedule[]>(() => {
    const cached = localStorage.getItem(LOCAL_SCHEDULES_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { }
    }
    return INITIAL_SCHEDULES;
  });

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const last = INITIAL_SCHEDULES[INITIAL_SCHEDULES.length - 1];
    return last ? last.monthKey : '2026-10';
  });

  const [selectedDoctor, setSelectedDoctor] = useState<string>(() => {
    return userProfile?.doctorName || 'Nicora';
  });

  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    if (userProfile?.doctorName) {
      setSelectedDoctor(userProfile.doctorName);
    }
  }, [userProfile?.doctorName]);

  useEffect(() => {
    localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    if (!isFirebaseActive) return;

    const shiftsCol = collection(db, 'shifts');
    const unsubscribe = onSnapshot(shiftsCol, (snapshot) => {
      if (!snapshot.empty) {
        const remoteSchedules: MonthSchedule[] = [];
        snapshot.forEach(docSnap => {
          remoteSchedules.push(docSnap.data() as MonthSchedule);
        });
        remoteSchedules.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
        setSchedules(remoteSchedules);
      }
    });

    return () => unsubscribe();
  }, [isFirebaseActive]);

  const allDoctors = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach(s => {
      Object.keys(s.doctors || {}).forEach(doc => set.add(doc));
    });
    if (set.size === 0) return ALL_INITIAL_DOCTORS;
    return Array.from(set).sort();
  }, [schedules]);

  const availableMonths = useMemo(() => {
    return schedules.map(s => ({
      monthKey: s.monthKey,
      label: s.monthName + ' ' + s.year,
      year: s.year,
      month: s.month
    }));
  }, [schedules]);

  const currentMonthSchedule = useMemo(() => {
    return schedules.find(s => s.monthKey === selectedMonthKey) || schedules[schedules.length - 1];
  }, [schedules, selectedMonthKey]);

  const doctorStats = useMemo(() => {
    if (!currentMonthSchedule || !selectedDoctor) return null;
    return computeDoctorStats(selectedDoctor, currentMonthSchedule);
  }, [currentMonthSchedule, selectedDoctor]);

  const doctorDaysInfo = useMemo(() => {
    if (!currentMonthSchedule) return [];
    const docData = currentMonthSchedule.doctors[selectedDoctor];
    const daysMap = docData?.days || {};

    const list: DayShiftInfo[] = [];

    for (let day = 1; day <= currentMonthSchedule.totalDays; day++) {
      const dayInfo = getDayInfo(currentMonthSchedule.year, currentMonthSchedule.month, day);
      const rawCodes = daysMap[day] || [];
      const shifts = rawCodes.map(interpretShiftCode);

      const hasWorkingShift = shifts.some(s => s.isWorkingShift);
      const isFreeHolidayOrSunday = dayInfo.isHolidayOrSunday && !hasWorkingShift;

      const dateStr = currentMonthSchedule.year + '-' + String(currentMonthSchedule.month).padStart(2, '0') + '-' + String(day).padStart(2, '0');

      list.push({
        day,
        dateStr,
        dayOfWeekShort: dayInfo.dayOfWeekShort,
        dayOfWeekFull: dayInfo.dayOfWeekFull,
        rawCodes,
        shifts,
        isHoliday: dayInfo.isHoliday,
        holidayName: dayInfo.holidayName,
        isSunday: dayInfo.isSunday,
        isFreeHolidayOrSunday
      });
    }

    return list;
  }, [currentMonthSchedule, selectedDoctor]);

  const freeHolidaysList = useMemo(() => {
    return doctorDaysInfo.filter(d => d.isFreeHolidayOrSunday);
  }, [doctorDaysInfo]);

  const goToNextMonth = () => {
    const idx = availableMonths.findIndex(m => m.monthKey === selectedMonthKey);
    if (idx !== -1 && idx < availableMonths.length - 1) {
      setSelectedMonthKey(availableMonths[idx + 1].monthKey);
    }
  };

  const goToPrevMonth = () => {
    const idx = availableMonths.findIndex(m => m.monthKey === selectedMonthKey);
    if (idx > 0) {
      setSelectedMonthKey(availableMonths[idx - 1].monthKey);
    }
  };

  const uploadExcelFile = async (file: File): Promise<{ success: boolean; message: string; monthsCount: number }> => {
    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const parsedSchedules = parseExcelWorkbook(workbook, userProfile?.email || 'utente');

      if (parsedSchedules.length === 0) {
        throw new Error('Nessun foglio mensile valido trovato nel file Excel caricato.');
      }

      if (isFirebaseActive) {
        for (const sched of parsedSchedules) {
          const shiftDocRef = doc(db, 'shifts', sched.monthKey);
          await setDoc(shiftDocRef, sched);
        }
      }

      setSchedules(parsedSchedules);
      if (parsedSchedules.length > 0) {
        setSelectedMonthKey(parsedSchedules[parsedSchedules.length - 1].monthKey);
      }

      setIsUploading(false);
      return {
        success: true,
        message: 'Caricati con successo ' + parsedSchedules.length + ' mesi di turni!',
        monthsCount: parsedSchedules.length
      };
    } catch (err: any) {
      setIsUploading(false);
      return {
        success: false,
        message: err.message || 'Errore durante il caricamento del file Excel.',
        monthsCount: 0
      };
    }
  };

  return (
    <ScheduleContext.Provider
      value={{
        schedules,
        availableMonths,
        selectedMonthKey,
        setSelectedMonthKey,
        selectedDoctor,
        setSelectedDoctor,
        currentMonthSchedule,
        allDoctors,
        doctorStats,
        doctorDaysInfo,
        freeHolidaysList,
        uploadExcelFile,
        isUploading,
        goToNextMonth,
        goToPrevMonth
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};
