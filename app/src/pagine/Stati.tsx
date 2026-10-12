// Schermate di stato dell'account: attesa di approvazione, disabilitato, errore, caricamento.

import { useState, type ReactNode } from 'react';
import { LIMITI_FEEDBACK, validaPresentazione } from '../domain/feedback';
import type { Utente } from '../servizi/tipi';
import { useServizi, useSessione } from '../sessione/contesto';
import { messaggioErroreGenerico } from '../ui/errori';
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

/** Presentazione all'amministratore: facilita l'associazione dell'account al medico. Resta visibile e modificabile. */
function Presentazione({ utente }: { utente: Utente }) {
  const servizi = useServizi();
  const [inviato, setInviato] = useState<string>();
  const salvata = inviato ?? utente.presentazione ?? '';
  const [testo, setTesto] = useState(salvata);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string>();
  const [inviata, setInviata] = useState(false);
  const errValidazione = validaPresentazione(testo);
  const invariata = testo.trim() === salvata;

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errValidazione || invariata) return;
    setInvio(true);
    setErrore(undefined);
    try {
      await servizi.salvaPresentazione(utente.uid, testo);
      setInviato(testo.trim());
      setInviata(true);
    } catch (err) {
      setErrore(messaggioErroreGenerico(err));
    } finally {
      setInvio(false);
    }
  };

  return (
    <form className="presentazione-modulo" onSubmit={invia}>
      <label className="campo">
        <span>Presentati all’amministratore per facilitare l’associazione</span>
        <textarea
          className="textarea"
          rows={3}
          value={testo}
          placeholder="Es. Sono il dr Rossi / Sono la moglie del dr Bianchi"
          onChange={(e) => {
            setTesto(e.target.value);
            setInviata(false);
          }}
        />
        <small className={`contatore num ${testo.trim().length > LIMITI_FEEDBACK.presentazione ? 'contatore-oltre' : ''}`} aria-live="polite">
          {testo.trim().length}/{LIMITI_FEEDBACK.presentazione}
        </small>
      </label>
      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}
      {inviata && invariata && (
        <p className="avviso avviso-ok" role="status">
          <Icona nome="spunta" /> Messaggio inviato all’amministratore. Puoi modificarlo quando vuoi.
        </p>
      )}
      <button type="submit" className="btn btn-primario btn-blocco" disabled={invio || invariata || errValidazione !== null}>
        <Icona nome="invia" /> {invio ? 'Invio…' : salvata ? 'Aggiorna' : 'Invia'}
      </button>
    </form>
  );
}

export function InAttesa({ email, utente }: { email: string; utente?: Utente }) {
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
      {utente?.stato === 'attesa' && <Presentazione utente={utente} />}
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
