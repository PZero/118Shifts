// Avviso di nuova versione della PWA: l'utente decide quando ricaricare.

import { useRegisterSW } from 'virtual:pwa-register/react';
import { Icona } from './Icona';

export function AvvisoAggiornamento() {
  const {
    needRefresh: [daAggiornare, setDaAggiornare],
    offlineReady: [prontaOffline, setProntaOffline],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registrazione) {
      // Controllo periodico degli aggiornamenti (ogni ora) per le app lasciate aperte.
      if (registrazione) setInterval(() => void registrazione.update(), 60 * 60 * 1000);
    },
  });

  if (daAggiornare) {
    return (
      <div className="toast" role="status">
        <Icona nome="aggiorna" />
        <span>È disponibile una nuova versione.</span>
        <button type="button" className="btn btn-primario btn-piccolo" onClick={() => void updateServiceWorker(true)}>
          Aggiorna
        </button>
        <button type="button" className="btn btn-fantasma btn-piccolo btn-icona" aria-label="Più tardi" onClick={() => setDaAggiornare(false)} style={{ color: 'inherit' }}>
          <Icona nome="chiudi" piccola />
        </button>
      </div>
    );
  }
  if (prontaOffline) {
    return (
      <div className="toast" role="status">
        <Icona nome="spunta" />
        <span>App pronta per l’uso offline.</span>
        <button type="button" className="btn btn-fantasma btn-piccolo btn-icona" aria-label="Chiudi" onClick={() => setProntaOffline(false)} style={{ color: 'inherit' }}>
          <Icona nome="chiudi" piccola />
        </button>
      </div>
    );
  }
  return null;
}
