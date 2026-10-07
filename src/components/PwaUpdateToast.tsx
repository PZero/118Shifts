import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { APP_VERSION } from '../config/version';

interface PwaUpdateToastProps {
  needRefresh: boolean;
  onUpdate: () => void;
}

export const PwaUpdateToast: React.FC<PwaUpdateToastProps> = ({ needRefresh, onUpdate }) => {
  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 sm:max-w-md bg-gradient-to-r from-sky-600 to-blue-700 text-white p-4 rounded-2xl shadow-2xl border border-sky-400/40 flex items-center justify-between gap-3 animate-bounce">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/20">
          <Sparkles size={18} />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-bold m-0">Nuova Versione Disponibile!</h4>
          <p className="text-[11px] text-sky-100 m-0">Tocca per aggiornare subito alla versione {APP_VERSION}</p>
        </div>
      </div>
      <button
        onClick={onUpdate}
        className="px-3.5 py-1.5 rounded-xl bg-white text-sky-700 font-extrabold text-xs shadow hover:bg-sky-50 transition cursor-pointer flex-shrink-0 flex items-center gap-1.5"
      >
        <RefreshCw size={13} />
        <span>Aggiorna</span>
      </button>
    </div>
  );
};
