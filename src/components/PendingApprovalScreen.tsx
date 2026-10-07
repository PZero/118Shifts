import React from 'react';
import { Clock, ShieldAlert, LogOut, RefreshCw, Mail } from 'lucide-react';
import { useAuth, SUPER_ADMIN_EMAIL } from '../context/AuthContext';
import { APP_VERSION } from '../config/version';

export const PendingApprovalScreen: React.FC = () => {
  const { userProfile, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg shadow-amber-950/30 animate-pulse">
          <Clock size={32} />
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            In Attesa di Approvazione
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Ciao <strong className="text-slate-200">{userProfile?.displayName}</strong> ({userProfile?.email}), il tuo account Google è stato registrato con successo.
          </p>
        </div>

        {/* Information box */}
        <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs text-slate-300 text-left space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldAlert size={16} />
            <span>Verifica credenziali mediche</span>
          </div>
          <p>
            Per garantire la riservatezza dei turni di servizio del 118, l'amministratore (<strong>{SUPER_ADMIN_EMAIL}</strong>) o un collega abilitato deve confermare la tua richiesta di primo accesso.
          </p>
          <p className="text-slate-400 text-[11px]">
            Una volta approvato, potrai consultare i tuoi turni, le festività libere e sincronizzare il calendario.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition shadow-lg shadow-sky-950/40 cursor-pointer"
          >
            <RefreshCw size={16} />
            <span>Controlla Stato Approvazione</span>
          </button>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            <LogOut size={14} />
            <span>Esci / Accedi con un altro account</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Turni EMS 118 • {APP_VERSION}
        </div>

      </div>
    </div>
  );
};
