// Card in cima all'area medico: "Oggi e domani" (miei turni, cambi applicati) e
// "Chi è di turno con me" (colleghi dal quadro del mese, solo account principali).
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { chiConMe, type GruppoChiConMe } from '../../domain/quadro';
import { scomponi, type DataISO } from '../../domain/date';
import type { RisultatoProiezione } from '../../domain/proiezione';
import { useServizi } from '../../sessione/contesto';
import type { CambioDoc, MeseDoc, QuadroMese, Sedi } from '../../servizi/tipi';
import { Icona } from '../../ui/Icona';
import { NOME_FASCIA, ORARIO_FASCIA, dataEstesa, etichettaCodice, nomeSede } from '../../ui/etichette';
import { ChipTurno } from './ChipTurno';
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

type StatoQuadri = { stato: 'idle' | 'caricamento' } | { stato: 'errore' } | { stato: 'pronto'; quadri: Record<string, QuadroMese | null> };

export function CardChiConMe({ oggi, mesi, cambi, proiezione, sedi, nomi, medicoId }: PropsComuni & { medicoId: string }) {
  const servizi = useServizi();
  const [aperto, setAperto] = useState(false);
  const [caricati, setCaricati] = useState<StatoQuadri>({ stato: 'idle' });
  const [tentativo, setTentativo] = useState(0);
  const giorni = useMemo(() => giorniOggiDomani(oggi, mesi, cambi, proiezione), [oggi, mesi, cambi, proiezione]);
  const chiavi = useMemo(() => [...new Set(giorni.map((g) => g.data.slice(0, 7)))], [giorni]);

  // Il quadro si legge solo alla prima apertura (risparmio di letture).
  useEffect(() => {
    if (!aperto || caricati.stato === 'pronto') return;
    let attivo = true;
    setCaricati({ stato: 'caricamento' });
    Promise.all(chiavi.map(async (k) => [k, await servizi.quadro(k)] as const))
      .then((r) => attivo && setCaricati({ stato: 'pronto', quadri: Object.fromEntries(r) }))
      .catch(() => attivo && setCaricati({ stato: 'errore' }));
    return () => {
      attivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, servizi, chiavi, tentativo]);

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

  const corpoGiorno = (g: GiornoCard) => {
    if (!g.pubblicato) return <p className="testo-tenue">Turni non ancora pubblicati.</p>;
    if (caricati.stato !== 'pronto') return null;
    const quadro = caricati.quadri[g.data.slice(0, 7)];
    if (!quadro) return <p className="testo-tenue">Disponibile dal prossimo caricamento dei turni.</p>;
    const gruppi = chiConMe(quadro.giorni[String(Number(g.data.slice(8)))], medicoId, g.codici);
    if (gruppi.length === 0) return <p className="testo-tenue">Sei libero.</p>;
    return gruppi.map(gruppo);
  };

  return (
    <CardComprimibile
      titolo="Chi è di turno con me"
      sottotitolo={<span className="card-riassunto">Colleghi nei tuoi turni di oggi e domani</span>}
      aperto={aperto}
      onToggle={() => setAperto((a) => !a)}
    >
      {caricati.stato === 'errore' ? (
        <div className="avviso">
          <Icona nome="info" />
          <div>
            <span>Al momento non riesco a mostrare i colleghi. Riprova più tardi.</span>
            <button
              type="button"
              className="btn btn-secondario btn-piccolo"
              style={{ marginTop: 8 }}
              onClick={() => {
                setCaricati({ stato: 'idle' });
                setTentativo((t) => t + 1);
              }}
            >
              Riprova
            </button>
          </div>
        </div>
      ) : caricati.stato !== 'pronto' ? (
        <div className="scheletro" style={{ height: 64 }} aria-busy="true" aria-label="Caricamento" />
      ) : (
        <>
          {giorni.map((g) => (
            <div key={g.data} className="oggi-domani-giorno">
              <h3 className="sottotitolo">
                {g.etichetta} <span className="testo-tenue">· {dataEstesa(g.data)}</span>
              </h3>
              {corpoGiorno(g)}
            </div>
          ))}
          <p className="nota">
            <Icona nome="info" piccola /> Secondo l’Excel pubblicato: i cambi dei colleghi non sono inclusi.
          </p>
        </>
      )}
    </CardComprimibile>
  );
}
