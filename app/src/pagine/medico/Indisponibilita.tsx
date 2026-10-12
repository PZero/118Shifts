// Indisponibilità del medico: segni sul calendario, riepilogo del mese, pannello di modifica
// ed email pronta. Le regole di calcolo stanno in domain/indisponibilita.ts.

import { useEffect, useRef, useState } from 'react';
import { giorniNelMese } from '../../domain/date';
import {
  FASCE,
  alternaFascia,
  alternaTuttoIlGiorno,
  conflittiConTurni,
  linkMailto,
  oggettoEmail,
  riepilogoIndisponibilita,
  testoEmail,
  type GiorniIndisponibili,
} from '../../domain/indisponibilita';
import { descriviSegno, type SegnoIndisp } from './indisponibilitaVista';
import { copiaNegliAppunti } from '../../ui/appunti';
import { Dialogo } from '../../ui/Dialogo';
import { Icona } from '../../ui/Icona';
import { NOME_FASCIA, ORARIO_FASCIA, dataEstesa, nomeMese } from '../../ui/etichette';

export function SegnoCalendario({ segno }: { segno: SegnoIndisp }) {
  return (
    <span className={`cal-indisp ${segno.conflitti.length > 0 ? 'cal-indisp-conflitto' : ''}`} title={descriviSegno(segno)}>
      {segno.conflitti.length > 0 && <Icona nome="attenzione" piccola />}
      <span className="cal-indisp-lettere">
        {segno.fasce.map((f) => (
          <b key={f} className={segno.conflitti.includes(f) ? 'in-conflitto' : undefined}>
            {f}
          </b>
        ))}
      </span>
    </span>
  );
}

function testoRiepilogo(giorni: number, nonRispettate: number): string {
  const g = `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
  if (nonRispettate === 0) return `Indisponibilità: ${g}`;
  return `Indisponibilità: ${g}, ${nonRispettate} non ${nonRispettate === 1 ? 'rispettata' : 'rispettate'}`;
}

interface PropsCard {
  anno: number;
  mese: number;
  giorni: GiorniIndisponibili;
  ufficiali: Record<string, string[]>;
  /** Mese futuro (entro 12 mesi) senza turni pubblicati: modificabile e con email. */
  modificabile: boolean;
  modifica: boolean;
  onModifica: (v: boolean) => void;
  mostra: boolean;
  onMostra: (v: boolean) => void;
  nomeMedico: string;
  errore: string | null;
}

export function CardIndisponibilita({ anno, mese, giorni, ufficiali, modificabile, modifica, onModifica, mostra, onMostra, nomeMedico, errore }: PropsCard) {
  const [copiato, setCopiato] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const { giorni: n, nonRispettate } = riepilogoIndisponibilita(giorni, ufficiali);
  const elenco = Object.keys(giorni)
    .map(Number)
    .sort((a, b) => a - b);

  const testo = () => testoEmail({ anno, mese, giorni, nomeMedico });
  const copia = async () => {
    if (!(await copiaNegliAppunti(testo()))) return;
    setCopiato(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopiato(false), 2500);
  };
  const apriEmail = () => {
    window.location.href = linkMailto(oggettoEmail(anno, mese), testo());
  };

  return (
    <section className="card card-indisp" aria-labelledby="titolo-indisp">
      <div className="card-corpo">
        <div className="indisp-testa">
          <h2 id="titolo-indisp" className="card-titolo">
            Indisponibilità
          </h2>
          <label className="interruttore interruttore-compatto">
            <input type="checkbox" checked={mostra} onChange={(e) => onMostra(e.target.checked)} />
            <span>Mostra indisponibilità</span>
          </label>
        </div>

        {n > 0 && (
          <p className={`indisp-riepilogo ${nonRispettate > 0 ? 'indisp-riepilogo-warn' : ''}`}>
            {nonRispettate > 0 && <Icona nome="attenzione" piccola />} {testoRiepilogo(n, nonRispettate)}
          </p>
        )}

        {modificabile && (
          <div className="indisp-azioni">
            <button type="button" className={`btn btn-piccolo ${modifica ? 'btn-primario' : 'btn-secondario'}`} aria-pressed={modifica} onClick={() => onModifica(!modifica)}>
              <Icona nome={modifica ? 'spunta' : 'matita'} /> {modifica ? 'Fine' : 'Segna indisponibilità'}
            </button>
          </div>
        )}
        {modificabile && modifica && <p className="nota">Tocca un giorno del calendario per scegliere i turni in cui non sei disponibile.</p>}
        {errore && (
          <p className="avviso avviso-danger" role="alert">
            <Icona nome="attenzione" /> <span>{errore}</span>
          </p>
        )}

        {modificabile && (
          <div className="indisp-email">
            <h3 className="indisp-sottotitolo">Email per {nomeMese(anno, mese).toLowerCase()}</h3>
            {elenco.length === 0 ? (
              <p className="testo-tenue">Nessun giorno segnato.</p>
            ) : (
              <>
                <ul className="indisp-elenco" role="list">
                  {elenco.map((g) => (
                    <li key={g}>
                      <span className="num">{String(g).padStart(2, '0')}/{String(mese).padStart(2, '0')}</span>
                      <span>{(giorni[String(g)] ?? []).join(', ')}</span>
                    </li>
                  ))}
                </ul>
                <div className="indisp-azioni">
                  <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => void copia()}>
                    <Icona nome="file" /> Copia testo email
                  </button>
                  <button type="button" className="btn btn-secondario btn-piccolo" onClick={apriEmail}>
                    <Icona nome="invia" /> Apri email
                  </button>
                </div>
                <p className="nota indisp-conferma" role="status" aria-live="polite">
                  {copiato && (
                    <>
                      <Icona nome="spunta" piccola /> Testo copiato
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

interface PropsDialogo {
  /** Data ISO del giorno in modifica, o null se chiuso. */
  data: string | null;
  giorni: GiorniIndisponibili;
  ufficiali: Record<string, string[]>;
  onCambia: (nuovi: GiorniIndisponibili) => void;
  onChiudi: () => void;
}

export function DialogoIndisponibilita({ data, giorni, ufficiali, onCambia, onChiudi }: PropsDialogo) {
  // Il giorno resta in memoria durante la chiusura del dialogo per non svuotarne il contenuto.
  const [ultima, setUltima] = useState<string | null>(null);
  if (data && data !== ultima) setUltima(data);
  const d = data ?? ultima;
  const giorno = d ? Number(d.slice(8)) : 0;
  const fasce = giorni[String(giorno)] ?? [];
  const max = d ? giorniNelMese(Number(d.slice(0, 4)), Number(d.slice(5, 7))) : 0;
  const conflitti = conflittiConTurni(giorni, ufficiali)[String(giorno)] ?? [];

  return (
    <Dialogo
      aperto={data !== null}
      titolo={d && giorno <= max ? dataEstesa(d) : 'Indisponibilità'}
      descrizione="Segna i turni in cui non sei disponibile. Si salva alla chiusura."
      onChiudi={onChiudi}
      piede={
        <button type="button" className="btn btn-primario" onClick={onChiudi}>
          <Icona nome="spunta" /> Fatto
        </button>
      }
    >
      <div className="indisp-fasce">
        {FASCE.map((f) => {
          const attiva = fasce.includes(f);
          return (
            <button
              key={f}
              type="button"
              className={`indisp-fascia ${attiva ? 'attiva' : ''}`}
              aria-pressed={attiva}
              onClick={() => onCambia(alternaFascia(giorni, giorno, f))}
            >
              <b>{f}</b>
              <span>
                {NOME_FASCIA[f]} <small className="num">{ORARIO_FASCIA[f]}</small>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`btn btn-piccolo ${fasce.length === FASCE.length ? 'btn-primario' : 'btn-secondario'}`}
        style={{ marginTop: 12 }}
        aria-pressed={fasce.length === FASCE.length}
        onClick={() => onCambia(alternaTuttoIlGiorno(giorni, giorno))}
      >
        Tutto il giorno
      </button>
      {conflitti.length > 0 && (
        <p className="avviso avviso-warn" style={{ marginTop: 12 }}>
          <Icona nome="attenzione" /> <span>In questo giorno hai già un turno ufficiale ({conflitti.join(', ')}).</span>
        </p>
      )}
    </Dialogo>
  );
}
