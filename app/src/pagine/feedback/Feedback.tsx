// Feedback e suggerimenti: conversazioni riservate tra gli utenti e l'amministratore.
// Stesse schermate per due viste: medico (/feedback) e amministratore (/gestione/feedback).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { LIMITI_FEEDBACK, MAX_MESSAGGI_GIORNO, nonLetta, ordinaConversazioni, validaArgomento, validaTestoMessaggio } from '../../domain/feedback';
import { useProfilo, useServizi } from '../../sessione/contesto';
import type { Conversazione, MessaggioFeedback } from '../../servizi/tipi';
import { Dialogo } from '../../ui/Dialogo';
import { messaggioErroreGenerico } from '../../ui/errori';
import { Icona } from '../../ui/Icona';
import { useFeedback } from './contestoFeedback';

export function FeedbackMedico() {
  return <PaginaFeedback base="/feedback" />;
}

export function FeedbackAdmin() {
  return <PaginaFeedback base="/gestione/feedback" />;
}

function PaginaFeedback({ base }: { base: string }) {
  const { id } = useParams<{ id?: string }>();
  return id ? <Chat key={id} id={id} base={base} /> : <Elenco base={base} />;
}

/** Orario del messaggio: solo l'ora se è di oggi, altrimenti data breve e ora. */
function quando(d: Date | undefined): string {
  if (!d) return '';
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return ora;
  return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${ora}`;
}

const ERRORE_LIMITE = `Hai raggiunto il limite di ${MAX_MESSAGGI_GIORNO} messaggi per oggi`;

function erroreInvio(e: unknown): string {
  const codice = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  return codice === 'permission-denied' ? ERRORE_LIMITE : messaggioErroreGenerico(e);
}

function InfoLimite({ restanti }: { restanti: number | null }) {
  if (restanti === null) return null;
  return (
    <p className="nota" aria-live="polite">
      Puoi inviare fino a {MAX_MESSAGGI_GIORNO} messaggi al giorno. Oggi te ne restano <strong className="num">{restanti}</strong>
      <span className="testo-tenue"> (il conteggio riparte ogni notte).</span>
    </p>
  );
}

function Contatore({ n, max }: { n: number; max: number }) {
  return (
    <small className={`contatore num ${n > max ? 'contatore-oltre' : ''}`} aria-live="polite">
      {n}/{max}
    </small>
  );
}

/* ---------- Elenco ---------- */

function Elenco({ base }: { base: string }) {
  const { conversazioni, errore, comeAdmin, nonLette, restanti } = useFeedback();
  const [nuova, setNuova] = useState(false);
  const ordinate = useMemo(() => (conversazioni ? ordinaConversazioni(conversazioni, comeAdmin) : null), [conversazioni, comeAdmin]);

  return (
    <section aria-labelledby="titolo-feedback" className={comeAdmin ? undefined : 'pagina'}>
      {!comeAdmin && (
        <p className="avviso avviso-info avviso-riservato">
          <Icona nome="lucchetto" />
          <span>
            <strong>Conversazioni riservate.</strong> Le legge solo l’amministratore. Usa questo spazio per dare feedback sull’app o suggerire nuove
            funzionalità. Non scrivere dati di pazienti.
          </span>
        </p>
      )}
      <div className="intestazione-sezione">
        <div>
          <h1 id="titolo-feedback">{comeAdmin ? 'Feedback' : 'Feedback e suggerimenti'}</h1>
          <p className="testo-tenue">
            {comeAdmin
              ? 'Conversazioni riservate con i medici: le leggi solo tu.'
              : nonLette > 0
                ? `${nonLette} ${nonLette === 1 ? 'risposta non letta' : 'risposte non lette'}`
                : 'Scrivi all’amministratore.'}
          </p>
        </div>
        {!comeAdmin && (
          <button type="button" className="btn btn-primario" onClick={() => setNuova(true)} disabled={restanti === 0}>
            <Icona nome="piu" /> Nuova conversazione
          </button>
        )}
      </div>

      {!comeAdmin && <InfoLimite restanti={restanti} />}

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}

      {ordinate === null ? (
        errore ? null : <div className="scheletro" style={{ height: 160 }} />
      ) : ordinate.length === 0 ? (
        <div className="vuoto">
          <Icona nome="messaggio" />
          <p>{comeAdmin ? 'Nessuna conversazione.' : 'Nessuna conversazione. Avviane una con “Nuova conversazione”.'}</p>
        </div>
      ) : (
        <ul className="elenco-righe elenco-conversazioni" role="list">
          {ordinate.map((c) => {
            const nl = nonLetta(c, comeAdmin);
            return (
              <li key={c.id}>
                <Link href={`${base}/${c.id}`} className={`conv-riga ${nl ? 'conv-non-letta' : ''}`}>
                  <span className="conv-corpo">
                    <span className="conv-testa">
                      <strong className="conv-argomento">{c.argomento}</strong>
                      <span className="conv-data nota">{quando(c.aggiornatoIl)}</span>
                    </span>
                    {comeAdmin && <span className="conv-autore">{c.autoreNome}</span>}
                    <span className="conv-anteprima">{c.ultimoTesto}</span>
                  </span>
                  {nl && <span className="etichetta etichetta-info conv-etichetta">Nuovo</span>}
                  <Icona nome="avanti" piccola />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!comeAdmin && <NuovaConversazione aperto={nuova} base={base} onChiudi={() => setNuova(false)} />}
    </section>
  );
}

function NuovaConversazione({ aperto, base, onChiudi }: { aperto: boolean; base: string; onChiudi: () => void }) {
  return (
    <Dialogo aperto={aperto} titolo="Nuova conversazione" onChiudi={onChiudi}>
      <ModuloNuova base={base} onChiudi={onChiudi} />
    </Dialogo>
  );
}

function ModuloNuova({ base, onChiudi }: { base: string; onChiudi: () => void }) {
  const servizi = useServizi();
  const profilo = useProfilo();
  const [, vai] = useLocation();
  const [argomento, setArgomento] = useState('');
  const [testo, setTesto] = useState('');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string>();
  const { restanti } = useFeedback();
  const esaurito = restanti === 0;
  const valido = !esaurito && validaArgomento(argomento) === null && validaTestoMessaggio(testo) === null;

  const crea = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validaArgomento(argomento) ?? validaTestoMessaggio(testo);
    if (err) return setErrore(err);
    setInvio(true);
    setErrore(undefined);
    try {
      const id = await servizi.creaConversazione({ uid: profilo.uid, nome: profilo.nome }, argomento, testo);
      onChiudi();
      vai(`${base}/${id}`);
    } catch (e2) {
      setErrore(erroreInvio(e2));
      setInvio(false);
    }
  };

  return (
    <form className="modulo" onSubmit={crea}>
      <label className="campo">
        <span>Argomento</span>
        <input className="input" value={argomento} onChange={(e) => setArgomento(e.target.value)} placeholder="Es. Idea per il calendario" />
        <Contatore n={argomento.trim().length} max={LIMITI_FEEDBACK.argomento} />
      </label>
      <label className="campo">
        <span>Messaggio</span>
        <textarea className="textarea" rows={5} value={testo} onChange={(e) => setTesto(e.target.value)} />
        <Contatore n={testo.trim().length} max={LIMITI_FEEDBACK.testo} />
      </label>
      <p className="nota">
        <Icona nome="lucchetto" piccola /> Lo leggerà solo l’amministratore.
      </p>
      <InfoLimite restanti={restanti} />
      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}
      <div className="dialogo-piede dialogo-piede-interno">
        <button type="button" className="btn btn-secondario" onClick={onChiudi}>
          Annulla
        </button>
        <button type="submit" className="btn btn-primario" disabled={invio || !valido}>
          {invio ? 'Invio…' : 'Invia'}
        </button>
      </div>
    </form>
  );
}

/* ---------- Conversazione ---------- */

function Chat({ id, base }: { id: string; base: string }) {
  const servizi = useServizi();
  const profilo = useProfilo();
  const { conversazioni, comeAdmin, restanti } = useFeedback();
  const esaurito = !comeAdmin && restanti === 0;
  const [, vai] = useLocation();
  const conv: Conversazione | undefined = conversazioni?.find((c) => c.id === id);
  const [messaggi, setMessaggi] = useState<MessaggioFeedback[] | null>(null);
  const [errore, setErrore] = useState<string>();
  const [testo, setTesto] = useState('');
  const [invio, setInvio] = useState(false);
  const [chiudi, setChiudi] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const fine = useRef<HTMLDivElement>(null);

  // Messaggi in tempo reale; dopo "Chiudi e cancella" gli errori di lettura non interessano.
  useEffect(() => {
    if (eliminando) return;
    return servizi.osservaMessaggi(
      id,
      (m) => {
        setMessaggi(m);
        setErrore(undefined);
      },
      (e) => setErrore(messaggioErroreGenerico(e)),
    );
  }, [servizi, id, eliminando]);

  // Aperta la conversazione (e a ogni nuovo messaggio dell'altra parte) la si segna come letta.
  const mioNonLetto = conv ? nonLetta(conv, comeAdmin) : false;
  useEffect(() => {
    if (mioNonLetto && !eliminando) servizi.segnaLetta(id, comeAdmin).catch(() => undefined);
  }, [mioNonLetto, servizi, id, comeAdmin, eliminando]);

  const numero = messaggi?.length ?? 0;
  useEffect(() => {
    fine.current?.scrollIntoView?.({ block: 'end' });
  }, [numero]);

  const invia = async () => {
    if (!conv || invio || esaurito || validaTestoMessaggio(testo) !== null) return;
    setInvio(true);
    setErrore(undefined);
    try {
      await servizi.inviaMessaggio(conv, { uid: profilo.uid, nome: profilo.nome }, testo, comeAdmin);
      setTesto('');
    } catch (e) {
      setErrore(erroreInvio(e));
    } finally {
      setInvio(false);
    }
  };

  const elimina = async () => {
    setEliminando(true);
    try {
      await servizi.eliminaConversazione(id);
      vai(base);
    } catch (e) {
      setErrore(messaggioErroreGenerico(e));
      setEliminando(false);
      setChiudi(false);
    }
  };

  const altraParte = comeAdmin ? (conv?.autoreNome ?? 'Medico') : 'Amministratore';
  const indietro = (
    <Link href={base} className="btn btn-fantasma btn-piccolo">
      <Icona nome="indietro" piccola /> Conversazioni
    </Link>
  );

  if (!conv && conversazioni !== null && !eliminando) {
    return (
      <section className={comeAdmin ? undefined : 'pagina'}>
        {indietro}
        <div className="vuoto">
          <p>Conversazione non trovata: potrebbe essere stata chiusa.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={comeAdmin ? undefined : 'pagina'} aria-labelledby="titolo-chat">
      <div className="chat-testa">
        {indietro}
        <button type="button" className="btn btn-fantasma btn-piccolo testo-pericolo" onClick={() => setChiudi(true)} disabled={!conv}>
          <Icona nome="cestino" piccola /> Chiudi e cancella
        </button>
      </div>
      <div className="chat-titolo">
        <h1 id="titolo-chat">{conv?.argomento ?? '…'}</h1>
        {comeAdmin && conv && <p className="testo-tenue">{conv.autoreNome}</p>}
      </div>

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}

      <div className="chat" role="log" aria-label="Messaggi" aria-live="polite">
        {messaggi === null ? (
          <div className="scheletro" style={{ height: 120 }} />
        ) : (
          messaggi.map((m) => {
            const mio = m.daAdmin === comeAdmin;
            return (
              <div key={m.id} className={`bolla ${mio ? 'bolla-mia' : 'bolla-altra'}`}>
                <span className="bolla-autore">{mio ? 'Tu' : altraParte}</span>
                <p className="bolla-testo">{m.testo}</p>
                <span className="bolla-ora num">{quando(m.creatoIl)}</span>
              </div>
            );
          })
        )}
        <div ref={fine} />
      </div>

      <form
        className="chat-scrivi"
        onSubmit={(e) => {
          e.preventDefault();
          void invia();
        }}
      >
        <label className="campo">
          <span className="sr-only">Messaggio</span>
          <textarea
            className="textarea"
            rows={3}
            value={testo}
            placeholder={comeAdmin ? 'Scrivi una risposta…' : 'Scrivi un messaggio…'}
            disabled={esaurito}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void invia();
              }
            }}
          />
        </label>
        {!comeAdmin && <InfoLimite restanti={restanti} />}
        {esaurito && (
          <p className="avviso avviso-info" role="status">
            <Icona nome="attenzione" /> {ERRORE_LIMITE}. Potrai scrivere di nuovo da domani.
          </p>
        )}
        <div className="chat-scrivi-azioni">
          <Contatore n={testo.trim().length} max={LIMITI_FEEDBACK.testo} />
          <button type="submit" className="btn btn-primario" disabled={invio || !conv || esaurito || validaTestoMessaggio(testo) !== null}>
            <Icona nome="invia" /> {invio ? 'Invio…' : 'Invia'}
          </button>
        </div>
      </form>

      <Dialogo
        aperto={chiudi}
        titolo="Chiudere e cancellare?"
        onChiudi={() => !eliminando && setChiudi(false)}
        piede={
          <>
            <button type="button" className="btn btn-secondario" onClick={() => setChiudi(false)} disabled={eliminando}>
              Annulla
            </button>
            <button type="button" className="btn btn-pericolo" onClick={() => void elimina()} disabled={eliminando}>
              {eliminando ? 'Cancellazione…' : 'Chiudi e cancella'}
            </button>
          </>
        }
      >
        <p className="testo-tenue">
          La conversazione e tutti i suoi messaggi saranno cancellati definitivamente, anche per {comeAdmin ? 'il medico' : 'l’amministratore'}.
        </p>
      </Dialogo>
    </section>
  );
}
