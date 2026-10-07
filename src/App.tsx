import React, { useState } from 'react';
import { AuthProvider, useAuth, SUPER_ADMIN_EMAIL } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { Header } from './components/Header';
import { FreeHolidaysCard } from './components/FreeHolidaysCard';
import { ShiftStatsCard } from './components/ShiftStatsCard';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { DailyColleaguesModal } from './components/DailyColleaguesModal';
import { ExcelUploaderModal } from './components/ExcelUploaderModal';
import { AdminApprovalModal } from './components/AdminApprovalModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';
import { VersionInfoModal } from './components/VersionInfoModal';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import { DayShiftInfo } from './types';
import { APP_VERSION, BUILD_DATE } from './config/version';
import { 
  ShieldCheck, 
  Database, 
  HeartPulse,
  UserCheck
} from 'lucide-react';

const LoginScreen: React.FC<{ onOpenFirebase: () => void }> = ({ onOpenFirebase }) => {
  const { loginWithGoogle, loginDemoUser, isFirebaseActive } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Accesso Google non riuscito. Verifica la connessione o configura Firebase.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-100">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10">
        
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-red-700 flex items-center justify-center mx-auto shadow-xl shadow-red-950/50 border border-red-500/40 text-white font-black text-2xl tracking-tighter">
            118
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight m-0">
              Turni Medici 118
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Emergenza Sanitaria Territoriale EMS
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sky-400">
            <HeartPulse size={16} />
            <span>Accesso Riservato Medici 118</span>
          </div>
          <p className="leading-relaxed">
            Accedi con la tua email Google/Gmail. Al primo accesso, la richiesta verrà inoltrata all'amministratore (<strong>{SUPER_ADMIN_EMAIL}</strong>) per l'approvazione.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 leading-tight">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {isFirebaseActive ? (
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl transition shadow-xl shadow-slate-950/40 disabled:opacity-60 cursor-pointer text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isLoggingIn ? 'Connessione...' : 'Accedi con Google (Gmail)'}</span>
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => loginDemoUser('admin', SUPER_ADMIN_EMAIL, 'Nicora')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition shadow-lg text-sm cursor-pointer"
              >
                <ShieldCheck size={18} />
                <span>Accedi come Dr. Nicora (Super Admin)</span>
              </button>

              <button
                onClick={() => loginDemoUser('doctor', 'caglieris.118@gmail.com', 'Caglieris')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition text-xs cursor-pointer border border-slate-700"
              >
                <UserCheck size={16} />
                <span>Accedi come Dr. Caglieris (Medico)</span>
              </button>
            </div>
          )}

          <div className="pt-2 text-center">
            <button
              onClick={onOpenFirebase}
              className="text-xs text-slate-400 hover:text-sky-400 inline-flex items-center gap-1.5 transition underline cursor-pointer"
            >
              <Database size={12} />
              <span>Configura credenziali Firebase 118shifts</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500 font-mono">
          Turni EMS 118 • {APP_VERSION} ({BUILD_DATE})
        </div>

      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { userProfile, isApproved, loading } = useAuth();
  
  const [selectedDayInfo, setSelectedDayInfo] = useState<DayShiftInfo | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [firebaseModalOpen, setFirebaseModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Caricamento Turni 118...
      </div>
    );
  }

  if (!userProfile) {
    return (
      <>
        <LoginScreen onOpenFirebase={() => setFirebaseModalOpen(true)} />
        {firebaseModalOpen && <FirebaseConfigModal onClose={() => setFirebaseModalOpen(false)} />}
      </>
    );
  }

  if (!isApproved) {
    return <PendingApprovalScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500/30">
      <Header
        onOpenUpload={() => setUploadModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenFirebase={() => setFirebaseModalOpen(true)}
        onOpenVersionInfo={() => setVersionModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
        <ShiftStatsCard />
        <FreeHolidaysCard />
        <MonthlyCalendar onSelectDay={(dayInfo) => setSelectedDayInfo(dayInfo)} />
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            118 Emergenza Sanitaria Territoriale • Sistema Monitoraggio Turni Medici
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVersionModalOpen(true)}
              className="text-sky-400 hover:underline font-mono cursor-pointer"
            >
              Versione {APP_VERSION}
            </button>
            <span>•</span>
            <span>Zero-Cache PWA Auto-Update</span>
          </div>
        </div>
      </footer>

      {selectedDayInfo && (
        <DailyColleaguesModal
          dayInfo={selectedDayInfo}
          onClose={() => setSelectedDayInfo(null)}
        />
      )}

      {uploadModalOpen && (
        <ExcelUploaderModal
          onClose={() => setUploadModalOpen(false)}
        />
      )}

      {adminModalOpen && (
        <AdminApprovalModal
          onClose={() => setAdminModalOpen(false)}
        />
      )}

      {firebaseModalOpen && (
        <FirebaseConfigModal
          onClose={() => setFirebaseModalOpen(false)}
        />
      )}

      {versionModalOpen && (
        <VersionInfoModal
          onClose={() => setVersionModalOpen(false)}
        />
      )}

      <PwaUpdateToast needRefresh={false} onUpdate={() => window.location.reload()} />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <ScheduleProvider>
        <Dashboard />
      </ScheduleProvider>
    </AuthProvider>
  );
}

export default App;
