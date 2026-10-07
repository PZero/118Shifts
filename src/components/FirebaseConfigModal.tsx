import React, { useState } from 'react';
import { X, Database, CheckCircle2, ShieldCheck, Key, RefreshCw } from 'lucide-react';
import { getFirebaseConfig, isFirebaseConfigured } from '../config/firebase';
import { useAuth, SUPER_ADMIN_EMAIL } from '../context/AuthContext';

interface FirebaseConfigModalProps {
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ onClose }) => {
  const currentConfig = getFirebaseConfig();
  const isConfigured = isFirebaseConfigured();
  const { loginDemoUser } = useAuth();

  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '118shifts.firebaseapp.com');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '118shifts');
  const [storageBucket, setStorageBucket] = useState(currentConfig.storageBucket || '118shifts.appspot.com');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const config = {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    };
    localStorage.setItem('turni118_firebase_config', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleClear = () => {
    localStorage.removeItem('turni118_firebase_config');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white m-0">
                Configurazione Firebase
              </h3>
              <p className="text-xs text-slate-400 m-0">
                Progetto: <strong>118shifts</strong>
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
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-sky-950/30 rounded-xl border border-sky-500/30 text-sky-200">
            <p className="font-semibold mb-1">Come collegare il tuo progetto Firebase 118shifts:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Apri <strong>Firebase Console</strong> → Progetto 118shifts.</li>
              <li>Vai in <strong>Impostazioni Progetto</strong> (icona ingranaggio) → <strong>Generale</strong>.</li>
              <li>In basso, aggiungi un'app Web (<strong>&lt;/&gt;</strong>) e copia le chiavi qui sotto.</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">API Key (apiKey):</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:border-sky-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Project ID:</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:border-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">App ID:</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:123456:web:..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:border-sky-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Demo Mode Account Switcher */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 space-y-2">
            <p className="font-semibold text-slate-200">Prova subito in Modalità Demo Locale:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { loginDemoUser('admin', SUPER_ADMIN_EMAIL, 'Nicora'); onClose(); }}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-bold hover:bg-red-500/30"
              >
                Dr. Nicora (Admin)
              </button>
              <button
                onClick={() => { loginDemoUser('doctor', 'caglieris.118@gmail.com', 'Caglieris'); onClose(); }}
                className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold hover:bg-sky-500/30"
              >
                Dr. Caglieris (Medico)
              </button>
            </div>
          </div>

          {saved && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>Configurazione salvata! Ricaricamento in corso...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={handleClear}
            className="text-xs text-red-400 hover:underline cursor-pointer"
          >
            Ripristina Demo
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Chiudi
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg"
            >
              Salva e Applica
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
