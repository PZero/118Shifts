// Schermate di stato dell'account: attesa di approvazione, disabilitato, errore, caricamento.

import type { ReactNode } from 'react';
import { useSessione } from '../sessione/contesto';
import { Icona, Marchio, type NomeIcona } from '../ui/Icona';
import { SelettoreTema } from '../ui/Tema';

function SchermataStato({ icona, tono, titolo, children }: { icona: NomeIcona; tono: string; titolo: string; children: ReactNode }) {
  const { esci } = useSessione();
  return (
    <div className="stato-pagina">
      <header className="stato-testata">
        <span className="marchio">
          <Marchio lato={30} />
          <span className="marchio-testo">
            <span className="marchio-nome">GestioneTurni</span>
            <span className="marchio-sotto">Medici 112 · Genova</span>
          </span>
        </span>
        <SelettoreTema />
      </header>
      <main id="contenuto" className="stato-centro">
        <div className="card stato-card">
          <span className={`stato-icona stato-icona-${tono}`}>
            <Icona nome={icona} />
          </span>
          <h1>{titolo}</h1>
          {children}
          <button type="button" className="btn btn-secondario btn-blocco" onClick={() => void esci()}>
            <Icona nome="esci" /> Esci
          </button>
        </div>
      </main>
    </div>
  );
}

export function InAttesa({ email }: { email: string }) {
  return (
    <SchermataStato icona="attesa" tono="info" titolo="Richiesta di accesso inviata">
      <p>
        L’account <strong>{email}</strong> è in attesa di approvazione da parte dell’amministratore o di un delegato.
      </p>
      <ol className="passi">
        <li className="fatto">
          <Icona nome="spunta" piccola /> Accesso con Google
        </li>
        <li className="attuale">
          <Icona nome="attesa" piccola /> Associazione al tuo nominativo
        </li>
        <li>
          <Icona nome="calendario" piccola /> Consultazione dei turni
        </li>
      </ol>
      <p className="nota">Questa pagina si aggiorna da sola appena l’account viene approvato.</p>
    </SchermataStato>
  );
}

export function Disabilitato({ email }: { email: string }) {
  return (
    <SchermataStato icona="blocco" tono="danger" titolo="Account disabilitato">
      <p>
        L’accesso per <strong>{email}</strong> è stato disabilitato. Per informazioni rivolgiti all’amministratore o a un delegato.
      </p>
    </SchermataStato>
  );
}

export function Errore({ messaggio }: { messaggio: string }) {
  return (
    <SchermataStato icona="attenzione" tono="warn" titolo="Qualcosa non ha funzionato">
      <p>{messaggio}</p>
      <button type="button" className="btn btn-primario btn-blocco" onClick={() => window.location.reload()}>
        <Icona nome="aggiorna" /> Riprova
      </button>
    </SchermataStato>
  );
}

export function Caricamento({ testo = 'Caricamento…' }: { testo?: string }) {
  return (
    <div className="centro-pagina" role="status">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
        <div className="rotella" />
        <span>{testo}</span>
      </div>
    </div>
  );
}
