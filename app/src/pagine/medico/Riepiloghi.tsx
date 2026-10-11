import type { StatoGiorno, Stato } from '../../domain/festivita';
import { TIPI_REPERIBILITA } from '../../adattatori/reperibilita';
import { Icona } from '../../ui/Icona';
import { dataBreve } from '../../ui/etichette';
import type { MeseVista } from './vista';

const NOME_STATO: Record<Stato, string> = { libero: 'Libero', parziale: 'Parziale', lavorato: 'Lavorato' };
const TONO_STATO: Record<Stato, string> = { libero: 'etichetta-ok', parziale: 'etichetta-warn', lavorato: '' };

function dettaglioParziale(s: StatoGiorno): string | undefined {
  if (s.stato !== 'parziale') return undefined;
  return s.liberoDiGiorno ? 'libero di giorno' : 'libero di notte';
}

export function CardOre({ vista }: { vista: MeseVista }) {
  const stima = vista.tipo === 'previsione';
  const { M, P, N } = vista.conteggioFasce;
  return (
    <section className="card card-metrica" aria-labelledby="titolo-ore">
      <div className="card-corpo">
        <div className="metrica-testa">
          <h2 id="titolo-ore" className="card-titolo">
            Ore del mese
          </h2>
          {stima ? <span className="etichetta">Stima</span> : <span className="etichetta etichetta-cambio">Cambi inclusi</span>}
        </div>
        <p className="metrica-valore num">
          {vista.tipo === 'vuoto' ? '—' : vista.ore}
          <span className="metrica-unita">h</span>
        </p>
        <dl className="metrica-scomposizione num">
          <div><dt><span className="pallino pallino-M" />Mattino</dt><dd>{M}</dd></div>
          <div><dt><span className="pallino pallino-P" />Pomeriggio</dt><dd>{P}</dd></div>
          <div><dt><span className="pallino pallino-N" />Notte</dt><dd>{N}</dd></div>
        </dl>
        <p className="nota">Notte: 4 h sul giorno e 8 h sul successivo.</p>
      </div>
    </section>
  );
}

export function CardReperibilita({ vista }: { vista: MeseVista }) {
  return (
    <section className="card" aria-labelledby="titolo-rep">
      <div className="card-corpo">
        <h2 id="titolo-rep" className="card-titolo">
          Reperibilità <span className="testo-tenue">(giorni)</span>
        </h2>
        <dl className="tasselli">
          {TIPI_REPERIBILITA.map((t) => (
            <div key={t} className={`tassello ${vista.reperibilita[t] > 0 ? 'attivo' : ''}`}>
              <dt>{t}</dt>
              <dd className="num">{vista.tipo === 'reale' ? vista.reperibilita[t] : '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function RigaStato({ s, titolo }: { s: StatoGiorno; titolo?: string }) {
  const extra = dettaglioParziale(s);
  return (
    <li className="riga-stato">
      <span className="riga-stato-data">{titolo ?? dataBreve(s.data)}</span>
      {extra && <span className="testo-tenue riga-stato-extra">{extra}</span>}
      <span className={`etichetta ${TONO_STATO[s.stato]}`}>{NOME_STATO[s.stato]}</span>
    </li>
  );
}

/** Raggruppa sabato e domenica dello stesso weekend (ai bordi del mese può esserci un giorno solo). */
function weekendRaggruppati(giorni: StatoGiorno[]): StatoGiorno[][] {
  const gruppi = new Map<string, StatoGiorno[]>();
  for (const s of [...giorni].sort((a, b) => a.data.localeCompare(b.data))) {
    const d = new Date(`${s.data}T12:00:00Z`);
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 1); // domenica → chiave del sabato
    const chiave = d.toISOString().slice(0, 10);
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), s]);
  }
  return [...gruppi.values()];
}

function statoWeekend(g: StatoGiorno[]): Stato {
  if (g.every((s) => s.stato === 'libero')) return 'libero';
  if (g.every((s) => s.stato === 'lavorato')) return 'lavorato';
  return 'parziale';
}

export function CardWeekend({ vista }: { vista: MeseVista }) {
  const { sabati, domeniche, festivita, conteggi } = vista.weekend;
  const weekend = weekendRaggruppati([...sabati, ...domeniche]);
  const previsione = vista.tipo === 'previsione';
  return (
    <section className="card" aria-labelledby="titolo-weekend">
      <div className="card-corpo">
        <div className="metrica-testa">
          <h2 id="titolo-weekend" className="card-titolo">
            Weekend e festività
          </h2>
          {previsione && <span className="etichetta">Previsione</span>}
        </div>
        <div className="sintesi-weekend num">
          <div>
            <strong>{conteggi.sabati.liberi + conteggi.domeniche.liberi}</strong>
            <span>liberi</span>
          </div>
          <div>
            <strong>{conteggi.sabati.parziali + conteggi.domeniche.parziali}</strong>
            <span>parziali</span>
          </div>
          <div>
            <strong>{conteggi.sabati.lavorati + conteggi.domeniche.lavorati}</strong>
            <span>lavorati</span>
          </div>
        </div>
        <ul className="lista-weekend" role="list" aria-label="Weekend del mese">
          {weekend.map((g) => (
            <li key={g[0]?.data}className={`blocco-weekend blocco-weekend-${statoWeekend(g)}`}>
              <ul className="lista-stati" role="list">
                {g.map((s) => (
                  <RigaStato key={s.data} s={s} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {festivita.length > 0 && (
          <>
            <h3 className="sottotitolo">Festività</h3>
            <ul className="lista-stati" role="list" aria-label="Festività del mese">
              {festivita.map((f) => (
                <RigaStato key={f.data} s={f} titolo={`${dataBreve(f.data)} · ${f.nome}`} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

export function CardCambi({ vista, nomi }: { vista: MeseVista; nomi: Map<string, string> }) {
  if (vista.tipo === 'previsione') return null;
  return (
    <section className="card" aria-labelledby="titolo-cambi">
      <div className="card-corpo">
        <h2 id="titolo-cambi" className="card-titolo">
          Cambi del mese
        </h2>
        {vista.cambi.length === 0 ? (
          <p className="testo-tenue">Nessun cambio registrato.</p>
        ) : (
          <ul className="lista-stati" role="list">
            {vista.cambi.map((c) => (
              <li key={c.id} className="riga-stato">
                <span className="riga-stato-data">{dataBreve(c.data)}</span>
                <span className="riga-stato-extra">
                  <b>{c.codice}</b> {c.verso === 'ceduto' ? '→' : '←'} {nomi.get(c.collegaId) ?? 'collega'}
                </span>
                <span className={`etichetta ${c.verso === 'ricevuto' ? 'etichetta-cambio' : ''}`}>
                  {c.verso === 'ceduto' ? 'Ceduto' : 'Ricevuto'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {vista.cambiNonApplicati.length > 0 && (
          <p className="avviso avviso-warn">
            <Icona nome="attenzione" />
            <span>
              {vista.cambiNonApplicati.length === 1 ? 'Un turno ceduto non corrisponde' : `${vista.cambiNonApplicati.length} turni ceduti non corrispondono`} ai
              turni pubblicati (forse modificati da un nuovo caricamento). Verifica e annulla il cambio se non è più valido.
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

export function Legenda() {
  return (
    <details className="legenda">
      <summary>Legenda</summary>
      <ul role="list">
        <li><span className="chip chip-M"><b>M</b></span> Mattino 08–14</li>
        <li><span className="chip chip-P"><b>P</b></span> Pomeriggio 14–20</li>
        <li><span className="chip chip-N"><b>N</b></span> Notte 20–08</li>
        <li><span className="chip chip-M chip-previsione"><b>M</b></span> Previsione (indicativa)</li>
        <li><span className="chip chip-P chip-ceduto"><b>P</b></span> Turno ceduto</li>
        <li><span className="chip chip-N chip-ricevuto"><Icona nome="ricevuto" piccola /><b>N</b></span> Turno ricevuto</li>
        <li><span className="campione campione-sabato" /> Sabato</li>
        <li><span className="campione campione-festivo" /> Domenica e festività</li>
        <li><span className="chip chip-assenza"><b>Ferie</b></span> Assenze e altri codici</li>
        <li><span className="chip chip-reperibilita"><b>RM</b></span> Reperibilità</li>
      </ul>
      <p className="nota">Il numero dopo la lettera è la sede (es. M6 = Mattino, sede 6).</p>
    </details>
  );
}
