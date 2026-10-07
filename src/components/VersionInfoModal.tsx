import React from 'react';
import { X, Info, GitCommit, CheckCircle2, ShieldCheck } from 'lucide-react';
import { APP_VERSION, BUILD_DATE, VERSION_HISTORY } from '../config/version';

interface VersionInfoModalProps {
  onClose: () => void;
}

export const VersionInfoModal: React.FC<VersionInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Info size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white m-0">
                Informazioni Versione PWA
              </h3>
              <p className="text-xs text-slate-400 m-0">
                Versione Attiva: <strong className="text-sky-400 font-mono">{APP_VERSION}</strong> ({BUILD_DATE})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-100">
              <GitCommit size={14} className="text-sky-400" />
              <span>Versionamento Semantico Vx.y.z.t</span>
            </div>
            <p>
              Questa PWA è dotata di aggiornamento automatico intelligente della cache (Service Worker Workbox con <code className="text-sky-300">skipWaiting</code> e <code className="text-sky-300">clientsClaim</code>). Ogni nuovo rilascio invalida immediatamente le versioni precedenti senza bisogno di svuotare la cache manuale su iPhone/Android.
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Registro Modifiche (Changelog):
            </div>

            {VERSION_HISTORY.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-400 font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30">
                    {item.version}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {item.releaseDate}
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-slate-300 pl-1">
                  {item.changelog.map((c, cIdx) => (
                    <li key={cIdx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};
