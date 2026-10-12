import { useEffect, useMemo, useRef, useState } from 'react';
import type { Fascia } from '../../domain/codici';
import { aggiungiGiorni, scomponi, type DataISO } from '../../domain/date';
import { colleghiDisponibili } from '../../domain/disponibilita';
import { testoRichiestaCambio } from '../../domain/richiestaCambio';
import { copiaNegliAppunti } from '../../ui/appunti';
import { useServizi } from '../../sessione/contesto';
import type { NuovoCambio, QuadroMese, Sedi, VoceElenco } from '../../servizi/tipi';
import { Dialogo } from '../../ui/Dialogo';
import { NOME_FASCIA, ORARIO_FASCIA, dataEstesa, etichettaCodice } from '../../ui/etichette';
import { Icona } from '../../ui/Icona';
import { caricaQuadro } from './quadriCache';
import type { GiornoVista, VoceVista } from './vista';

export type RichiestaCambio =
  | { tipo: 'cedi'; giorno: GiornoVista; voce: VoceVista }
  | { tipo: 'ricevuto'; giorno: GiornoVista };

interface Props {
  richiesta: RichiestaCambio | null;
  /** Account principale: solo lui può leggere il quadro dei colleghi. */
  principale: boolean;
  colleghi: VoceElenco[];
  sedi: Sedi;
  onChiudi: () => void;
  onConferma: (c: NuovoCambio) => Promise<void>;
}

export function DialogoCambio({ richiesta, principale, colleghi, sedi, onChiudi, onConferma }: Props) {
  // Chiave sul contenuto: lo stato interno riparte da zero a ogni apertura.
  const chiave = richiesta ? `${richiesta.tipo}-${richiesta.giorno.data}-${richiesta.tipo === 'cedi' ? richiesta.voce.indice : ''}` : 'chiuso';
  return (
    <Dialogo
      aperto={richiesta !== null}
      titolo={richiesta?.tipo === 'cedi' ? 'Cedi il turno' : 'Registra un turno ricevuto'}
      onChiudi={onChiudi}
    >
      {richiesta && (
        <ModuloCambio key={chiave} richiesta={richiesta} principale={principale} colleghi={colleghi} sedi={sedi} onChiudi={onChiudi} onConferma={onConferma} />
      )}
    </Dialogo>
  );
}

function ModuloCambio({ richiesta, principale, colleghi, sedi, onChiudi, onConferma }: Props & { richiesta: RichiestaCambio }) {
  const [collegaId, setCollegaId] = useState('');
  const [fascia, setFascia] = useState<Fascia>('M');
  const [sede, setSede] = useState('');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string>();

  const collega = colleghi.find((c) => c.id === collegaId);

  const conferma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegaId) {
      setErrore('Scegli il collega dall’elenco.');
      return;
    }
    const g = richiesta.giorno;
    const cambio: NuovoCambio =
      richiesta.tipo === 'cedi'
        ? { data: g.data, slot: richiesta.voce.indice === 1 ? 1 : 0, codice: richiesta.voce.codice, verso: 'ceduto', collegaId }
        : {
            data: g.data,
            slot: g.voci.filter((v) => v.stato !== 'ricevuto').length > 0 ? 1 : 0,
            codice: `${fascia}${sede}`,
            verso: 'ricevuto',
            collegaId,
          };
    setInvio(true);
    setErrore(undefined);
    try {
      await onConferma(cambio);
      onChiudi();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      setInvio(false);
    }
  };

  return (
    <form onSubmit={conferma} className="modulo">
      <p className="testo-tenue">{dataEstesa(richiesta.giorno.data)}</p>

      {richiesta.tipo === 'cedi' ? (
        <div className="riepilogo-turno">
          <span className="etichetta">{richiesta.voce.codice}</span>
          <span>{etichettaCodice(richiesta.voce.info, sedi).lunga}</span>
        </div>
      ) : (
        <>
          <fieldset className="campo campo-gruppo">
            <legend>Turno ricevuto</legend>
            <div className="segmenti segmenti-larghi" role="group" aria-label="Fascia">
              {(['M', 'P', 'N'] as const).map((f) => (
                <button key={f} type="button" aria-pressed={fascia === f} onClick={() => setFascia(f)}>
                  {NOME_FASCIA[f]} <span className="testo-tenue num">{ORARIO_FASCIA[f]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="campo">
            <span>Sede</span>
            <select className="select" value={sede} onChange={(e) => setSede(e.target.value)}>
              <option value="">Non indicata</option>
              {Object.entries(sedi).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {richiesta.tipo === 'cedi' && principale && richiesta.voce.info?.categoria === 'turno' && richiesta.voce.info.fascia && (
        <PossonoDarti
          data={richiesta.giorno.data}
          fascia={richiesta.voce.info.fascia}
          colleghi={colleghi}
          scelto={collegaId}
          onScegli={setCollegaId}
        />
      )}

      <label className="campo">
        <span>{richiesta.tipo === 'cedi' ? 'Collega che riceve il turno' : 'Collega che ti ha ceduto il turno'}</span>
        <select className="select" value={collegaId} onChange={(e) => setCollegaId(e.target.value)} required>
          <option value="">Scegli dall’elenco…</option>
          {colleghi.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <small>Il cambio è privato: lo vedono solo i tuoi account.</small>
      </label>

      {richiesta.tipo === 'cedi' && collega && (
        <RiquadroRichiesta
          cognome={collega.nome}
          turni={[`${richiesta.voce.codice} (${etichettaCodice(richiesta.voce.info, sedi).lunga.replace(/ \d{2}–\d{2}/, '').replaceAll(' · ', ', ')})`]}
          data={dataEstesa(richiesta.giorno.data)}
        />
      )}

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          {errore}
        </p>
      )}

      <div className="dialogo-piede dialogo-piede-interno">
        <button type="button" className="btn btn-secondario" onClick={onChiudi}>
          Annulla
        </button>
        <button type="submit" className="btn btn-primario" disabled={invio}>
          {invio ? 'Salvataggio…' : 'Conferma cambio'}
        </button>
      </div>
    </form>
  );
}

/** Messaggio pronto da inviare al collega (condividi o copia); il cambio si registra con "Conferma cambio". */
function RiquadroRichiesta({ cognome, turni, data }: { cognome: string; turni: string[]; data: string }) {
  const generato = testoRichiestaCambio({ cognome, turni, data });
  // Il testo segue il collega scelto, finché non viene modificato a mano.
  const [manuale, setManuale] = useState<string | null>(null);
  const testo = manuale ?? generato;
  const [copiato, setCopiato] = useState(false);
  const [fallita, setFallita] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copia = async () => {
    const ok = await copiaNegliAppunti(testo);
    setFallita(!ok);
    setCopiato(ok);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setCopiato(false);
      setFallita(false);
    }, 2500);
  };
  const condividi = async () => {
    try {
      await navigator.share({ text: testo });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      void copia();
    }
  };

  return (
    <section className="campo riquadro-richiesta" aria-label="Chiedi il cambio">
      <label className="campo">
        <span>Chiedi il cambio</span>
        <textarea
          className="textarea"
          rows={4}
          value={testo}
          onChange={(e) => setManuale(e.target.value)}
        />
      </label>
      <div className="indisp-azioni">
        {typeof navigator.share === 'function' && (
          <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => void condividi()}>
            <Icona nome="invia" /> Condividi
          </button>
        )}
        <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => void copia()}>
          <Icona nome="file" /> Copia testo
        </button>
      </div>
      <p className="nota indisp-conferma" role="status" aria-live="polite">
        {copiato && (
          <>
            <Icona nome="spunta" piccola /> Copiato
          </>
        )}
        {fallita && 'Copia non riuscita: seleziona il testo e copialo a mano.'}
      </p>
      <p className="nota">
        <Icona nome="info" piccola /> Quando il collega accetta, torna qui e premi Conferma cambio.
      </p>
    </section>
  );
}

type StatoQuadri = { stato: 'caricamento' } | { stato: 'errore' } | { stato: 'pronto'; quadri: Map<string, QuadroMese | null> };

/** Colleghi liberi (11 ore di riposo) per il turno ceduto, dal quadro pubblicato. Non bloccante. */
function PossonoDarti({
  data,
  fascia,
  colleghi,
  scelto,
  onScegli,
}: {
  data: DataISO;
  fascia: Fascia;
  colleghi: VoceElenco[];
  scelto: string;
  onScegli: (id: string) => void;
}) {
  const servizi = useServizi();
  const [stato, setStato] = useState<StatoQuadri>({ stato: 'caricamento' });
  const prima = aggiungiGiorni(data, -1);
  const dopo = aggiungiGiorni(data, 1);

  useEffect(() => {
    let attivo = true;
    const chiavi = [...new Set([data, prima, dopo].map((d) => d.slice(0, 7)))];
    Promise.all(chiavi.map((k) => caricaQuadro(servizi, k)))
      .then((qs) => attivo && setStato({ stato: 'pronto', quadri: new Map(chiavi.map((k, i) => [k, qs[i] ?? null])) }))
      .catch(() => attivo && setStato({ stato: 'errore' }));
    return () => {
      attivo = false;
    };
  }, [servizi, data, prima, dopo]);

  const disponibili = useMemo(() => {
    if (stato.stato !== 'pronto') return [];
    const giornoDi = (d: DataISO) => stato.quadri.get(d.slice(0, 7))?.giorni[String(scomponi(d).giorno)];
    const ids = new Set(
      colleghiDisponibili({
        data,
        fascia,
        giornoPrima: giornoDi(prima),
        giorno: giornoDi(data),
        giornoDopo: giornoDi(dopo),
        candidati: colleghi.map((c) => c.id),
      }),
    );
    return colleghi.filter((c) => ids.has(c.id));
  }, [stato, data, fascia, prima, dopo, colleghi]);

  let corpo;
  if (stato.stato === 'caricamento') {
    corpo = <div className="scheletro" style={{ height: 40 }} aria-busy="true" aria-label="Caricamento" />;
  } else if (stato.stato === 'errore') {
    corpo = <p className="testo-tenue">Al momento non riesco a mostrare i colleghi disponibili: scegli dall’elenco qui sotto.</p>;
  } else if (!stato.quadri.get(data.slice(0, 7))) {
    corpo = <p className="testo-tenue">Turni dei colleghi non ancora pubblicati</p>;
  } else if (disponibili.length === 0) {
    corpo = <p className="testo-tenue">Nessun collega libero con 11 ore di riposo</p>;
  } else {
    corpo = (
      <div className="chip-colleghi" role="group" aria-label="Possono darti il cambio">
        {disponibili.map((c) => (
          <button key={c.id} type="button" className="chip-collega" aria-pressed={scelto === c.id} onClick={() => onScegli(c.id)}>
            {c.nome}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="campo">
      <span>Possono darti il cambio</span>
      {corpo}
      <p className="nota">
        <Icona nome="info" piccola /> Secondo l’Excel pubblicato, con 11 ore di riposo prima e dopo: i cambi dei colleghi non sono inclusi.
      </p>
    </div>
  );
}
