import React, { useState } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  ShieldCheck, 
  UserCheck, 
  Flame, 
  LogOut, 
  Database, 
  Smartphone,
  Info,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { APP_VERSION } from '../config/version';

interface HeaderProps {
  onOpenUpload: () => void;
  onOpenAdmin: () => void;
  onOpenFirebase: () => void;
  onOpenVersionInfo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenUpload,
  onOpenAdmin,
  onOpenFirebase,
  onOpenVersionInfo
}) => {
  const { userProfile, isSuperAdmin, isAdminOrApprover, isFirebaseActive, logout, loginDemoUser, allUsers } = useAuth();
  const { 
    availableMonths, 
    selectedMonthKey, 
    setSelectedMonthKey, 
    selectedDoctor, 
    setSelectedDoctor, 
    allDoctors,
    goToNextMonth,
    goToPrevMonth
  } = useSchedule();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pendingCount = allUsers.filter(u => u.status === 'pending').length;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-md shadow-red-900/30 text-white font-bold text-lg border border-red-500/30 flex-shrink-0">
            <span className="tracking-tighter">118</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white m-0 p-0 flex items-center gap-1.5">
                Turni EMS
              </h1>
              <button
                onClick={onOpenVersionInfo}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition cursor-pointer"
                title="Visualizza changelog versione"
              >
                {APP_VERSION}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 m-0">Emergenza Sanitaria Territoriale</p>
          </div>
        </div>

        {/* Month Selector & Navigation */}
        <div className="hidden sm:flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 shadow-inner">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-40 cursor-pointer"
            title="Mese precedente"
          >
            <ChevronLeft size={18} />
          </button>
          
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            aria-label="Seleziona Mese"
            className="bg-transparent text-sm font-semibold text-slate-200 px-2 py-1 outline-none cursor-pointer text-center font-sans appearance-none hover:text-white transition"
          >
            {availableMonths.map(m => (
              <option key={m.monthKey} value={m.monthKey} className="bg-slate-900 text-slate-100">
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-40 cursor-pointer"
            title="Mese successivo"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Doctor Selector */}
        <div className="hidden md:flex items-center gap-2 bg-slate-800/80 rounded-xl px-3 py-1.5 border border-slate-700/60">
          <span className="text-xs text-slate-400">Medico:</span>
          <select
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            aria-label="Seleziona Medico"
            className="bg-transparent text-sm font-bold text-sky-400 outline-none cursor-pointer max-w-[150px] truncate"
          >
            {allDoctors.map(doc => (
              <option key={doc} value={doc} className="bg-slate-900 text-slate-100">
                Dr. {doc}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons (Desktop) */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Upload Excel Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition shadow-sm cursor-pointer"
          >
            <Upload size={14} />
            <span>Carica Excel</span>
          </button>

          {/* Admin / Approver Button */}
          {isAdminOrApprover && (
            <button
              onClick={onOpenAdmin}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer"
            >
              <ShieldCheck size={14} />
              <span>Approvazioni</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center animate-pulse border-2 border-slate-900">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          {/* Firebase Connection Button */}
          <button
            onClick={onOpenFirebase}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
              isFirebaseActive
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title={isFirebaseActive ? 'Firebase collegato' : 'Configura credenziali Firebase'}
          >
            <Database size={13} />
            <span>{isFirebaseActive ? 'Firebase OK' : 'Demo / Config'}</span>
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                {userProfile?.displayName || 'Dr. ' + selectedDoctor}
              </div>
              <div className="text-[10px] text-slate-400 capitalize">
                {userProfile?.role === 'admin' ? 'Super Admin' : userProfile?.role === 'approver' ? 'Approvatore' : 'Medico'}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition cursor-pointer"
              title="Disconnetti"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          {isAdminOrApprover && pendingCount > 0 && (
            <button
              onClick={onOpenAdmin}
              className="relative p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40"
            >
              <ShieldCheck size={18} />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center">
                {pendingCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-white"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 pt-3 border-t border-slate-800 space-y-3 pb-2 animate-fadeIn">
          {/* Mobile Month Navigation */}
          <div className="flex items-center justify-between bg-slate-800 rounded-xl p-2 border border-slate-700">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg bg-slate-700/60 text-slate-200"
            >
              <ChevronLeft size={18} />
            </button>
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              aria-label="Seleziona Mese"
              className="bg-transparent text-sm font-bold text-slate-100 text-center outline-none"
            >
              {availableMonths.map(m => (
                <option key={m.monthKey} value={m.monthKey} className="bg-slate-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg bg-slate-700/60 text-slate-200"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Mobile Doctor Selector */}
          <div className="flex items-center justify-between bg-slate-800 rounded-xl p-2.5 border border-slate-700">
            <span className="text-xs text-slate-400 font-medium">Visualizza Medico:</span>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              aria-label="Visualizza Medico"
              className="bg-slate-900 text-sm font-bold text-sky-400 rounded-lg px-2 py-1 border border-slate-700"
            >
              {allDoctors.map(doc => (
                <option key={doc} value={doc}>
                  Dr. {doc}
                </option>
              ))}
            </select>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { onOpenUpload(); setMobileMenuOpen(false); }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold"
            >
              <Upload size={14} />
              <span>Carica Excel</span>
            </button>

            {isAdminOrApprover && (
              <button
                onClick={() => { onOpenAdmin(); setMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold"
              >
                <ShieldCheck size={14} />
                <span>Approvazioni ({pendingCount})</span>
              </button>
            )}

            <button
              onClick={() => { onOpenFirebase(); setMobileMenuOpen(false); }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-medium"
            >
              <Database size={14} />
              <span>Firebase / Demo</span>
            </button>

            <button
              onClick={() => { onOpenVersionInfo(); setMobileMenuOpen(false); }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium"
            >
              <Info size={14} />
              <span>Versione {APP_VERSION}</span>
            </button>
          </div>

          {/* User Account / Logout */}
          <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-800 text-xs text-slate-300">
            <div>
              <p className="font-semibold text-slate-100">{userProfile?.displayName}</p>
              <p className="text-[11px] text-slate-400">{userProfile?.email}</p>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-1 text-red-400 font-semibold px-2.5 py-1 bg-red-500/10 rounded-lg border border-red-500/20"
            >
              <LogOut size={13} />
              <span>Esci</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
