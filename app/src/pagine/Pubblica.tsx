import { useState } from 'react';
import { useSessione } from '../sessione/contesto';
import { Icona, LogoGoogle, Marchio, type NomeIcona } from '../ui/Icona';
import { SelettoreTema } from '../ui/Tema';

const FUNZIONI: { icona: NomeIcona; titolo: string; testo: string }[] = [
  { icona: 'calendario', titolo: 'Calendario mensile', testo: 'I tuoi turni giorno per giorno, con fascia oraria e sede. Weekend e festività in evidenza, compresi il 24 giugno e il 4 ottobre.' },
  { icona: 'scambio', titolo: 'Cambi turno', testo: 'Registra i turni ceduti e ricevuti scegliendo il collega dall’elenco. Restano privati: li vedi solo tu e chi ha un tuo accesso in sola lettura.' },
  { icona: 'utenti', titolo: 'Accesso per i familiari', testo: 'Puoi collegare altri account Google, per esempio di un familiare, in sola lettura: vedono turni e cambi ma non possono modificarli.' },
  { icona: 'orologio', titolo: 'Ore del mese', testo: 'Totale calcolato dall’app con i cambi inclusi. La notte conta 4 ore sul giorno e 8 sul successivo.' },
  { icona: 'stella', titolo: 'Weekend e reperibilità', testo: 'Sabati e domeniche liberi o parzialmente liberi, stato delle festività e giorni di reperibilità RM, RP, RN, RG.' },
  { icona: 'previsione', titolo: 'Previsione', testo: 'Proiezione indicativa del ciclo MP-N per i 12 mesi successivi all’ultimo mese pubblicato.' },
  { icona: 'telefono', titolo: 'Sul telefono', testo: 'Si installa sulla schermata Home di iPhone e Android e resta consultabile anche senza rete.' },
];

export function Pubblica() {
  const { accedi, erroreAccesso, sessione } = useSessione();
  const [inCorso, setInCorso] = useState(false);
  const configurazioneMancante = sessione.tipo === 'errore';

  const entra = async () => {
    setInCorso(true);
    try {
      await accedi();
    } finally {
      setInCorso(false);
    }
  };

  const pulsante = (
    <button type="button" className="btn btn-google btn-grande" onClick={() => void entra()} disabled={inCorso || configurazioneMancante}>
      <LogoGoogle />
      {inCorso ? 'Accesso in corso…' : 'Accedi con Google'}
    </button>
  );

  return (
    <div className="pubblica">
      <header className="pubblica-testata">
        <div className="pubblica-contenitore pubblica-testata-interno">
          <span className="marchio">
            <Marchio lato={32} />
            <span className="marchio-testo">
              <span className="marchio-nome">GestioneTurni</span>
              <span className="marchio-sotto">Medici 112 · Genova</span>
            </span>
          </span>
          <SelettoreTema />
        </div>
      </header>

      <main id="contenuto">
        <section className="eroe">
          <div className="pubblica-contenitore eroe-griglia">
            <div className="eroe-testo">
              <p className="occhiello">Area riservata ai medici del 112</p>
              <h1>Turni, cambi e ore del mese, in un’unica vista.</h1>
              <p className="eroe-sotto">
                Consulta i turni pubblicati, registra i cambi con i colleghi e tieni sotto controllo ore, weekend e reperibilità. Su telefono e computer.
              </p>
              <div className="eroe-azioni">
                {pulsante}
                <p className="nota">
                  <Icona nome="scudo" piccola /> Il primo accesso va approvato dall’amministratore.
                </p>
              </div>
              {erroreAccesso && (
                <p className="avviso avviso-danger" role="alert">
                  <Icona nome="attenzione" /> {erroreAccesso}
                </p>
              )}
              {configurazioneMancante && (
                <p className="avviso avviso-warn" role="alert">
                  <Icona nome="attenzione" /> {sessione.messaggio}
                </p>
              )}
            </div>
            <AnteprimaCalendario />
          </div>
        </section>

        <VideoPresentazione />

        <section className="sezione" aria-labelledby="titolo-funzioni">
          <div className="pubblica-contenitore">
            <h2 id="titolo-funzioni" className="titolo-sezione">
              Cosa puoi fare
            </h2>
            <ul className="griglia-funzioni" role="list">
              {FUNZIONI.map((f) => (
                <li key={f.titolo} className="funzione">
                  <span className="funzione-icona">
                    <Icona nome={f.icona} />
                  </span>
                  <h3>{f.titolo}</h3>
                  <p>{f.testo}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sezione sezione-alternata" id="privacy" aria-labelledby="titolo-privacy">
          <div className="pubblica-contenitore privacy-griglia">
            <div>
              <h2 id="titolo-privacy" className="titolo-sezione">
                Privacy e sicurezza
              </h2>
              <p className="testo-sezione">
                I turni sono dati personali di lavoro: l’accesso è controllato dalle regole del database, non solo dall’interfaccia.
              </p>
            </div>
            <ul className="lista-privacy" role="list">
              <li>
                <Icona nome="lucchetto" />
                <div>
                  <strong>Ognuno vede solo i propri turni.</strong> I cambi sono privati e visibili solo agli account del medico interessato.
                </div>
              </li>
              <li>
                <Icona nome="scudo" />
                <div>
                  <strong>Dati minimi.</strong> Dell’account Google si usano solo nome ed email; le assenze sono mostrate in forma generica.
                </div>
              </li>
              <li>
                <Icona nome="utente" />
                <div>
                  <strong>Accesso approvato.</strong> Ogni account è associato a mano a un medico dall’amministratore o da un delegato.
                </div>
              </li>
              <li>
                <Icona nome="blocco" />
                <div>
                  <strong>Nessuna pubblicità né tracciamento.</strong> All’uscita i dati salvati sul dispositivo vengono cancellati.
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="sezione" aria-labelledby="titolo-installa">
          <div className="pubblica-contenitore">
            <h2 id="titolo-installa" className="titolo-sezione">
              Installa l’app
            </h2>
            <div className="griglia-installa">
              <div className="card card-corpo">
                <h3>iPhone e iPad</h3>
                <p>In Safari tocca <strong>Condividi</strong>, poi <strong>Aggiungi alla schermata Home</strong>.</p>
              </div>
              <div className="card card-corpo">
                <h3>Android</h3>
                <p>In Chrome apri il menu <strong>⋮</strong> e scegli <strong>Installa app</strong>.</p>
              </div>
              <div className="card card-corpo">
                <h3>Computer</h3>
                <p>Usala dal browser, oppure installala dall’icona nella barra degli indirizzi.</p>
              </div>
            </div>
            <div className="chiusura">{pulsante}</div>
          </div>
        </section>
      </main>

      <footer className="pubblica-piede">
        <div className="pubblica-contenitore">
          <p>
            GestioneTurni è uno strumento di supporto per l’organizzazione personale dei turni: fanno fede le comunicazioni ufficiali del servizio.
          </p>
        </div>
      </footer>
    </div>
  );
}

const ID_VIDEO = 'scJRPhcOiV4';

/** Video di presentazione con "facciata": nessuna richiesta a YouTube finché non si preme play. */
function VideoPresentazione() {
  const [avviato, setAvviato] = useState(false);
  return (
    <section className="sezione sezione-video" aria-labelledby="titolo-video">
      <div className="pubblica-contenitore">
        <div className="card video-card">
          <div className="video-intestazione">
            <h2 id="titolo-video" className="video-titolo">
              Guarda la presentazione
            </h2>
            <p className="video-sotto">Un minuto per scoprire l’app</p>
          </div>
          <div className="video-riquadro">
            {avviato ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ID_VIDEO}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title="Presentazione di GestioneTurni"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
              />
            ) : (
              <>
                <img src="/video/copertina.jpg" alt="" width={1280} height={720} loading="lazy" decoding="async" />
                <button type="button" className="video-play" aria-label="Riproduci il video di presentazione" onClick={() => setAvviato(true)}>
                  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="currentColor">
                    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <p className="video-nota">
            Su YouTube: dati di esempio, inventati.{' '}
            <a href={`https://youtu.be/${ID_VIDEO}`} target="_blank" rel="noopener noreferrer">
              youtu.be/{ID_VIDEO}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/** Illustrazione statica (dati di fantasia) della vista calendario. */
function AnteprimaCalendario() {
  const giorni: { n: number; t?: [string, string]; fest?: boolean; sab?: boolean; prev?: boolean; ceduto?: boolean }[] = [
    { n: 12, t: ['P', 'P4'] },
    { n: 13, t: ['M', 'M6'] },
    { n: 14, t: ['N', 'N2'] },
    { n: 15 },
    { n: 16 },
    { n: 17, t: ['P', 'P6'], sab: true, ceduto: true },
    { n: 18, t: ['M', 'M1'], fest: true },
  ];
  return (
    <div className="anteprima" aria-hidden="true">
      <div className="anteprima-testa">
        <strong>Ottobre</strong>
        <span className="etichetta etichetta-cambio">126 h</span>
      </div>
      <div className="anteprima-griglia">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((g, i) => (
          <span key={i} className="anteprima-intest">
            {g}
          </span>
        ))}
        {giorni.map((g) => (
          <span key={g.n} className={`anteprima-giorno ${g.sab ? 'sabato' : ''} ${g.fest ? 'festivo' : ''}`}>
            <span className="cal-num">{g.n}</span>
            {g.t && (
              <span className={`chip chip-${g.t[0]} ${g.ceduto ? 'chip-ceduto' : ''}`}>
                <b>{g.t[1]}</b>
              </span>
            )}
          </span>
        ))}
        {[19, 20, 21, 22, 23, 24, 25].map((n, i) => (
          <span key={n} className={`anteprima-giorno ${i === 5 ? 'sabato' : ''} ${i === 6 ? 'festivo' : ''}`}>
            <span className="cal-num">{n}</span>
            {i === 0 && <span className="chip chip-N chip-ricevuto"><Icona nome="ricevuto" piccola /><b>N5</b></span>}
            {i === 3 && <span className="chip chip-P chip-previsione"><b>P</b></span>}
            {i === 4 && <span className="chip chip-M chip-previsione"><b>M</b></span>}
            {i === 5 && <span className="chip chip-N chip-previsione"><b>N</b></span>}
          </span>
        ))}
      </div>
    </div>
  );
}
