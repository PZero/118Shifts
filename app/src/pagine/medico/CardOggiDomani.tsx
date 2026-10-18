// Card in cima all'area medico: "Oggi e domani" (miei turni, cambi applicati) e
// "Chi è di turno con me" (colleghi dal quadro del mese, solo account principali).
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { chiConMe, chiMiDaIlCambio, turnoDiPartenza, type GruppoChiConMe } from '../../domain/quadro';
import { aggiungiGiorni, scomponi, type DataISO } from '../../domain/date';
import type { Fascia } from '../../domain/codici';
import type { RisultatoProiezione } from '../../domain/proiezione';
import { useServizi } from '../../sessione/contesto';
import type { CambioDoc, MeseDoc, QuadroMese, Sedi } from '../../servizi/tipi';
import { Icona } from '../../ui/Icona';
import { NOME_FASCIA, ORARIO_FASCIA, dataEstesa, etichettaCodice, nomeSede } from '../../ui/etichette';
import { ChipTurno } from './ChipTurno';
import { caricaQuadro } from './quadriCache';
import { costruisciMese, type GiornoVista } from './vista';

interface GiornoCard {
  etichetta: 'Oggi' | 'Domani';
  data: DataISO;
  /** Mese del giorno con turni pubblicati. */
  pubblicato: boolean;
  giorno: GiornoVista;
  /** Codici effettivi (cambi applicati, esclusi i ceduti). */
  codici: string[];
}

function giorniOggiDomani(
  oggi: DataISO,
  mesi: readonly MeseDoc[],
  cambi: readonly CambioDoc[],
  proiezione: RisultatoProiezione,
): GiornoCard[] {
  const { anno, mese, giorno } = scomponi(oggi);
  const dom = new Date(Date.UTC(anno, mese - 1, giorno + 1));
  const domani = `${dom.getUTCFullYear()}-${String(dom.getUTCMonth() + 1).padStart(2, '0')}-${String(dom.getUTCDate()).padStart(2, '0')}` as DataISO;
  return ([['Oggi', oggi], ['Domani', domani]] as const).map(([etichetta, data]) => {
    const s = scomponi(data);
    const vista = costruisciMese({ anno: s.anno, mese: s.mese }, mesi, cambi, proiezione, oggi, false);
    const gv = vista.giorni[s.giorno - 1]!;
    return {
      etichetta,
      data,
      pubblicato: vista.tipo === 'reale',
      giorno: gv,
      codici: gv.voci.filter((v) => v.stato !== 'ceduto').map((v) => v.codice),
    };
  });
}

/** Riassunto su una riga di un giorno. */
function riassunto(g: GiornoCard, sedi: Sedi): string {
  if (!g.pubblicato) return 'turni non ancora pubblicati';
  const parti = g.giorno.voci
    .filter((v) => v.stato !== 'ceduto')
    .map((v) => {
      if (v.info?.categoria === 'turno' && v.info.fascia) {
        const sede = nomeSede(sedi, v.info.sede);
        return sede ? `${NOME_FASCIA[v.info.fascia]} · ${sede}` : NOME_FASCIA[v.info.fascia];
      }
      return etichettaCodice(v.info, sedi).lunga;
    });
  return parti.length ? parti.join(' + ') : 'libero';
}

function CardComprimibile({ titolo, sottotitolo, aperto, onToggle, children }: { titolo: string; sottotitolo?: ReactNode; aperto: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <section className={`card card-comprimibile ${aperto ? 'aperta' : ''}`} aria-labelledby={`${id}-t`}>
      <h2 className="card-comprimibile-titolo" id={`${id}-t`}>
        <button type="button" className="card-comprimibile-testa" aria-expanded={aperto} aria-controls={`${id}-c`} onClick={onToggle}>
          <span className="card-comprimibile-testo">
            <span className="card-titolo">{titolo}</span>
            {sottotitolo && <span className="card-comprimibile-sotto">{sottotitolo}</span>}
          </span>
          <span className="card-comprimibile-freccia" aria-hidden="true">
            <Icona nome="giu" />
          </span>
        </button>
      </h2>
      <div id={`${id}-c`} className="card-corpo card-comprimibile-corpo" hidden={!aperto}>
        {children}
      </div>
    </section>
  );
}

interface PropsComuni {
  oggi: DataISO;
  mesi: readonly MeseDoc[];
  cambi: readonly CambioDoc[];
  proiezione: RisultatoProiezione;
  sedi: Sedi;
  nomi: Map<string, string>;
}

export function CardOggiDomani({ oggi, mesi, cambi, proiezione, sedi, nomi }: PropsComuni) {
  const [aperto, setAperto] = useState(false);
  const giorni = useMemo(() => giorniOggiDomani(oggi, mesi, cambi, proiezione), [oggi, mesi, cambi, proiezione]);
  const nome = (id?: string) => nomi.get(id ?? '') ?? 'collega non in elenco';
  return (
    <CardComprimibile
      titolo="Oggi e domani"
      aperto={aperto}
      onToggle={() => setAperto((a) => !a)}
      sottotitolo={
        <span className="card-riassunto">
          {giorni.map((g, i) => (
            <span key={g.data}>
              {i > 0 && ' — '}
              <b>{g.etichetta}:</b> {riassunto(g, sedi)}
            </span>
          ))}
        </span>
      }
    >
      {giorni.map((g) => (
        <div key={g.data} className="oggi-domani-giorno">
          <h3 className="sottotitolo">
            {g.etichetta} <span className="testo-tenue">· {dataEstesa(g.data)}</span>
          </h3>
          {!g.pubblicato ? (
            <p className="testo-tenue">Turni non ancora pubblicati.</p>
          ) : g.giorno.voci.length === 0 ? (
            <p className="testo-tenue">Nessun turno: sei libero.</p>
          ) : (
            <ul className="dettaglio-lista" role="list">
              {g.giorno.voci.map((v) => {
                const e = etichettaCodice(v.info, sedi);
                return (
                  <li key={`${v.indice}-${v.codice}`} className={`riga-voce riga-${v.stato}`}>
                    <ChipTurno voce={v} sedi={sedi} />
                    <div className="riga-voce-testo">
                      <strong className={v.stato === 'ceduto' ? 'barrato' : undefined}>{e.lunga}</strong>
                      {v.stato === 'ceduto' && (
                        <span className="testo-cambio">
                          <Icona nome="scambio" piccola /> Ceduto a <b>{nome(v.collegaId)}</b>
                        </span>
                      )}
                      {v.stato === 'ricevuto' && (
                        <span className="testo-cambio">
                          <Icona nome="ricevuto" piccola /> Ricevuto da <b>{nome(v.collegaId)}</b>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </CardComprimibile>
  );
}

interface PropsCollega {
  oggi: DataISO;
  sedi: Sedi;
  /** Colleghi attivi (escluso il medico stesso). */
  colleghi: readonly { id: string; nome: string }[];
}

/** "Cosa fa oggi un collega": turni di oggi di un collega scelto, dal quadro del mese. */
export function CardCollega({ oggi, sedi, colleghi }: PropsCollega) {
  const servizi = useServizi();
  const idSelect = useId();
  const [aperto, setAperto] = useState(false);
  const [scelto, setScelto] = useState('');
  const [stato, setStato] = useState<StatoQuadro>({ stato: 'idle' });
  const [tentativo, setTentativo] = useState(0);
  const chiave = oggi.slice(0, 7);
  const ordinati = useMemo(() => [...colleghi].sort((a, b) => a.nome.localeCompare(b.nome, 'it')), [colleghi]);
  const collega = ordinati.find((c) => c.id === scelto);

  useEffect(() => {
    if (!aperto) return;
    let attivo = true;
    caricaQuadro(servizi, chiave)
      .then((q) => attivo && setStato({ stato: 'pronto', quadro: q }))
      .catch(() => attivo && setStato({ stato: 'errore' }));
    return () => {
      attivo = false;
    };
  }, [aperto, chiave, servizi, tentativo]);

  const etichette =
    collega && stato.stato === 'pronto' && stato.quadro
      ? (stato.quadro.giorni[String(Number(oggi.slice(8)))]?.[collega.id] ?? []).map((c) => etichettaCodice(c, sedi).lunga).filter(Boolean)
      : null;

  const risultato = () => {
    if (!collega) return null;
    if (stato.stato === 'errore') {
      return (
        <div className="avviso">
          <Icona nome="info" />
          <div>
            <span>Al momento non riesco a mostrare i turni. Riprova più tardi.</span>
            <button
              type="button"
              className="btn btn-secondario btn-piccolo"
              style={{ marginTop: 8 }}
              onClick={() => {
                setStato({ stato: 'idle' });
                setTentativo((t) => t + 1);
              }}
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }
    if (stato.stato !== 'pronto') return <div className="scheletro" style={{ height: 48 }} aria-busy="true" aria-label="Caricamento" />;
    if (!stato.quadro) return <p className="testo-tenue">Turni dei colleghi non ancora pubblicati per questo mese</p>;
    return (
      <>
        {etichette && etichette.length > 0 ? (
          <ul className="chi-elenco" role="list" aria-live="polite">
            {etichette.map((e, i) => (
              <li key={i}>
                <b>{e}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="testo-tenue" aria-live="polite">Nessun turno oggi</p>
        )}
        <p className="nota">
          <Icona nome="info" piccola /> Secondo l’Excel pubblicato: i cambi dei colleghi non sono inclusi.
        </p>
      </>
    );
  };

  return (
    <CardComprimibile
      titolo="Cosa fa oggi un collega"
      sottotitolo={
        <span className="card-riassunto">
          {collega ? (
            <>
              <b>{collega.nome}:</b> {etichette ? (etichette.length ? etichette.join(' + ') : 'nessun turno oggi') : 'apri per vedere'}
            </>
          ) : (
            'Scegli un collega'
          )}
        </span>
      }
      aperto={aperto}
      onToggle={() => setAperto((a) => !a)}
    >
      <div className="campo">
        <label htmlFor={idSelect} className="testo-tenue">
          {dataEstesa(oggi)}
        </label>
        <select id={idSelect} className="select" value={scelto} onChange={(e) => setScelto(e.target.value)}>
          <option value="">Scegli un collega…</option>
          {ordinati.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>{risultato()}</div>
    </CardComprimibile>
  );
}

type StatoQuadro ={ stato: 'idle' | 'caricamento' | 'errore' } | { stato: 'pronto'; quadro: QuadroMese | null };

interface PropsChiConMe {
  oggi: DataISO;
  /** Giorno selezionato nel calendario (cambi applicati). */
  giorno: GiornoVista;
  /** Il mese del giorno ha turni pubblicati (non solo proiezione). */
  pubblicato: boolean;
  sedi: Sedi;
  nomi: Map<string, string>;
  medicoId: string;
}

interface PropsChiDaIlCambio {
  oggi: DataISO;
  /** Giorno della card "Chi è di turno con me" (selezionato o oggi). */
  giorno: GiornoVista;
  /** Giorno scelto a calendario: allora vale il primo turno del giorno, non l'ora attuale. */
  esplicito: boolean;
  pubblicato: boolean;
  mesi: readonly MeseDoc[];
  cambi: readonly CambioDoc[];
  proiezione: RisultatoProiezione;
  sedi: Sedi;
  nomi: Map<string, string>;
  medicoId: string;
}

const ORA_INIZIO: Record<Fascia, number> = { M: 8, P: 14, N: 20 };

function codiciEffettivi(g: GiornoVista | undefined): string[] {
  return (g?.voci ?? []).filter((v) => v.stato !== 'ceduto').map((v) => v.codice);
}

/** "Chi ti dà il cambio": chi sarà sulla mia sede dopo il mio turno (dal quadro; mesi adiacenti caricati se serve). */
export function CardChiDaIlCambio({ oggi, giorno, esplicito, pubblicato, mesi, cambi, proiezione, sedi, nomi, medicoId }: PropsChiDaIlCambio) {
  const servizi = useServizi();
  const [aperto, setAperto] = useState(false);
  const [quadri, setQuadri] = useState<{ chiavi: string; q: Map<string, QuadroMese | null> } | null>(null);

  const partenza = useMemo(() => {
    if (!pubblicato) return null;
    const ieriData = aggiungiGiorni(giorno.data, -1);
    const s = scomponi(ieriData);
    const vIeri = costruisciMese({ anno: s.anno, mese: s.mese }, mesi, cambi, proiezione, oggi, false);
    const mieiCodiciIeri = vIeri.tipo === 'reale' ? codiciEffettivi(vIeri.giorni[s.giorno - 1]) : [];
    const mieiCodiciOggi = codiciEffettivi(giorno);
    const d = new Date();
    const t = turnoDiPartenza({ mieiCodiciIeri, mieiCodiciOggi, ...(esplicito ? {} : { ora: d.getHours() + d.getMinutes() / 60 }) });
    if (!t) return null;
    const dataPartenza = t.giorno === 'ieri' ? ieriData : giorno.data;
    return { fascia: t.fascia, dataPartenza, mieiCodici: t.giorno === 'ieri' ? mieiCodiciIeri : mieiCodiciOggi };
  }, [pubblicato, giorno, esplicito, mesi, cambi, proiezione, oggi]);

  const date = useMemo(() => (partenza ? [0, 1, 2].map((n) => aggiungiGiorni(partenza.dataPartenza, n)) : []), [partenza]);
  const chiavi = useMemo(() => [...new Set(date.map((d) => d.slice(0, 7)))], [date]);
  const idChiavi = chiavi.join(',');

  useEffect(() => {
    if (chiavi.length === 0) return;
    let attivo = true;
    // Un mese non disponibile (non pubblicato o errore) diventa undefined: il dominio lo tratta come giorno sconosciuto.
    Promise.all(chiavi.map((k) => caricaQuadro(servizi, k).catch(() => null))).then(
      (r) => attivo && setQuadri({ chiavi: idChiavi, q: new Map(chiavi.map((k, i) => [k, r[i] ?? null])) }),
    );
    return () => {
      attivo = false;
    };
  }, [idChiavi, servizi]);

  const risultato = useMemo(() => {
    if (!partenza || !quadri || quadri.chiavi !== idChiavi) return null;
    const giorni = date.map((d, i) => {
      const g = quadri.q.get(d.slice(0, 7))?.giorni[String(Number(d.slice(8)))];
      // Il mio turno di partenza viene dai miei dati (cambi inclusi), non dall'Excel.
      return i === 0 ? { ...(g ?? {}), [medicoId]: partenza.mieiCodici } : g;
    });
    return chiMiDaIlCambio({ medicoId, giorni, fasciaPartenza: partenza.fascia });
  }, [partenza, quadri, idChiavi, date, medicoId]);

  if (!risultato) return null;
  const { sede, cambio } = risultato;
  const nomeSedeTesto = nomeSede(sedi, sede) ?? `Sede ${sede}`;
  const testo = cambio
    ? `${nomi.get(cambio.medicoId) ?? 'collega non in elenco'} · ${nomeSede(sedi, cambio.sede) ?? `Sede ${cambio.sede}`} · ${NOME_FASCIA[cambio.fascia]}${cambio.giorniDopo === 1 ? ' domani' : ''}, ore ${ORA_INIZIO[cambio.fascia]}`
    : `Nessun collega trovato in ${nomeSedeTesto}`;
  return (
    <CardComprimibile
      titolo="Chi ti dà il cambio"
      sottotitolo={<span className="card-riassunto">{testo}</span>}
      aperto={aperto}
      onToggle={() => setAperto((a) => !a)}
    >
      <ul className="chi-elenco" role="list">
        <li>{cambio ? <b>{testo}</b> : testo}</li>
      </ul>
      <p className="nota">
        <Icona nome="info" piccola /> Secondo l’Excel pubblicato: i cambi dei colleghi non sono inclusi.
      </p>
    </CardComprimibile>
  );
}

export function CardChiConMe({ oggi, giorno, pubblicato, sedi, nomi, medicoId }: PropsChiConMe) {
  const servizi = useServizi();
  const [aperto, setAperto] = useState(false);
  const [stato, setStato] = useState<StatoQuadro>({ stato: 'idle' });
  const [tentativo, setTentativo] = useState(0);
  const chiave = giorno.data.slice(0, 7);
  const codici = giorno.voci.filter((v) => v.stato !== 'ceduto').map((v) => v.codice);

  useEffect(() => {
    if (!aperto || !pubblicato) return;
    let attivo = true;
    setStato({ stato: 'caricamento' });
    caricaQuadro(servizi, chiave)
      .then((q) => attivo && setStato({ stato: 'pronto', quadro: q }))
      .catch(() => attivo && setStato({ stato: 'errore' }));
    return () => {
      attivo = false;
    };
  }, [aperto, pubblicato, chiave, servizi, tentativo]);

  const nome = (id: string) => nomi.get(id) ?? 'collega non in elenco';
  const gruppo = (g: GruppoChiConMe) => (
    <div key={g.fascia} className="chi-gruppo">
      <h4 className="chi-fascia">
        <span className={`pallino pallino-${g.fascia}`} /> {NOME_FASCIA[g.fascia]} <span className="testo-tenue num">{ORARIO_FASCIA[g.fascia]}</span>
      </h4>
      {g.inTurno.length === 0 && g.reperibili.length === 0 ? (
        <p className="testo-tenue">Nessun altro collega.</p>
      ) : (
        <ul className="chi-elenco" role="list">
          {g.inTurno.map((c) => (
            <li key={`t-${c.medicoId}`}>
              {c.sede !== undefined ? `${nomeSede(sedi, c.sede)} – ` : ''}
              <b>{nome(c.medicoId)}</b>
            </li>
          ))}
          {g.reperibili.map((c) => (
            <li key={`r-${c.medicoId}`}>
              <span className="etichetta">{c.tipo}</span> – <b>{nome(c.medicoId)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const corpo = () => {
    const nonDisp = <p className="testo-tenue">Turni dei colleghi non ancora pubblicati per questo mese</p>;
    if (!pubblicato) return nonDisp;
    if (stato.stato === 'errore') {
      return (
        <div className="avviso">
          <Icona nome="info" />
          <div>
            <span>Al momento non riesco a mostrare i colleghi. Riprova più tardi.</span>
            <button
              type="button"
              className="btn btn-secondario btn-piccolo"
              style={{ marginTop: 8 }}
              onClick={() => {
                setStato({ stato: 'idle' });
                setTentativo((t) => t + 1);
              }}
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }
    if (stato.stato !== 'pronto') return <div className="scheletro" style={{ height: 64 }} aria-busy="true" aria-label="Caricamento" />;
    if (!stato.quadro) return nonDisp;
    const gruppi = chiConMe(stato.quadro.giorni[String(Number(giorno.data.slice(8)))], medicoId, codici);
    return (
      <>
        {gruppi.length === 0 ? <p className="testo-tenue">Sei libero.</p> : gruppi.map(gruppo)}
        <p className="nota">
          <Icona nome="info" piccola /> Secondo l’Excel pubblicato: i cambi dei colleghi non sono inclusi.
        </p>
      </>
    );
  };

  return (
    <CardComprimibile
      titolo="Chi è di turno con me"
      sottotitolo={
        <span className="card-riassunto">
          {giorno.data === oggi ? 'Oggi · ' : ''}
          {dataEstesa(giorno.data)}
        </span>
      }
      aperto={aperto}
      onToggle={() => setAperto((a) => !a)}
    >
      {corpo()}
    </CardComprimibile>
  );
}
