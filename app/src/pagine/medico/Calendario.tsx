import type { Sedi } from '../../servizi/tipi';
import { GIORNI_BREVI, NOME_FASCIA, dataEstesa, etichettaCodice } from '../../ui/etichette';
import { SegnoCalendario } from './Indisponibilita';
import { descriviSegno, type SegnoIndisp } from './indisponibilitaVista';
import { ChipPrevisione, ChipTurno } from './ChipTurno';
import type { GiornoVista, MeseVista } from './vista';

interface Props {
  vista: MeseVista;
  sedi: Sedi;
  nomi: Map<string, string>;
  selezionato: string | null;
  onSeleziona: (data: string) => void;
  /** Indisponibilità da mostrare, per data (solo account principale). */
  segni?: Map<string, SegnoIndisp>;
  /** Modalità "Segna indisponibilità": i giorni del mese aprono il pannello. */
  inModifica?: boolean;
}

function etichettaGiorno(g: GiornoVista, sedi: Sedi, nomi: Map<string, string>, segno?: SegnoIndisp): string {
  const parti = [dataEstesa(g.data)];
  if (g.festa) parti.push(g.festa);
  if (g.previsione) parti.push(`previsto ${g.previsione.map((f) => NOME_FASCIA[f]).join(' e ')}`);
  for (const v of g.voci) {
    const e = etichettaCodice(v.info, sedi);
    if (v.stato === 'ceduto') parti.push(`${e.lunga}, ceduto a ${nomi.get(v.collegaId ?? '') ?? 'collega'}`);
    else if (v.stato === 'ricevuto') parti.push(`${e.lunga}, ricevuto da ${nomi.get(v.collegaId ?? '') ?? 'collega'}`);
    else parti.push(e.lunga);
  }
  if (g.voci.length === 0 && !g.previsione) parti.push('nessun turno');
  if (segno) parti.push(descriviSegno(segno));
  return parti.join(', ');
}

export function Calendario({ vista, sedi, nomi, selezionato, onSeleziona, segni, inModifica = false }: Props) {
  const tutti = [...vista.adiacenti.prima, ...vista.giorni, ...vista.adiacenti.dopo];

  // Navigazione da tastiera tra i giorni (frecce), come in una griglia.
  const muovi = (e: React.KeyboardEvent<HTMLButtonElement>, g: GiornoVista) => {
    const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!passo) return;
    const prossimo = g.fuori ? undefined : vista.giorni[g.giorno - 1 + passo];
    if (!prossimo) return;
    e.preventDefault();
    onSeleziona(prossimo.data);
    document.querySelector<HTMLButtonElement>(`[data-giorno="${prossimo.data}"]`)?.focus();
  };

  return (
    <div className={`cal cal-${vista.tipo} ${inModifica ? 'cal-modifica' : ''}`} role="group" aria-label="Calendario del mese">
      <div className="cal-intestazione" aria-hidden="true">
        {GIORNI_BREVI.map((n, i) => (
          <div key={n} className={`cal-intest ${i === 5 ? 'sab' : ''} ${i === 6 ? 'dom' : ''}`}>
            {n}
          </div>
        ))}
      </div>
      <div className="cal-griglia">
        {tutti.map((g) => {
          const segno = segni?.get(g.data);
          const classi = [
            'cal-giorno',
            g.sabato ? 'sabato' : '',
            g.domenica || g.festa ? 'festivo' : '',
            g.oggi ? 'oggi' : '',
            g.fuori ? 'cal-fuori' : '',
            g.data === selezionato ? 'selezionato' : '',
            segno ? (segno.conflitti.length > 0 ? 'con-indisp-conflitto' : 'con-indisp') : '',
          ].join(' ');
          return (
            <button
              key={g.data}
              type="button"
              className={classi}
              data-giorno={g.data}
              aria-pressed={g.data === selezionato}
              aria-current={g.oggi ? 'date' : undefined}
              aria-label={etichettaGiorno(g, sedi, nomi, segno)}
              tabIndex={!g.fuori && (g.data === selezionato || (!selezionato && g.giorno === 1)) ? 0 : -1}
              onClick={() => onSeleziona(g.data)}
              onKeyDown={(e) => muovi(e, g)}
            >
              <span className="cal-testa">
                <span className="cal-num num">{g.giorno}</span>
                {g.festa && (
                  <span className="cal-festa" title={g.festa}>
                    {g.festa}
                  </span>
                )}
                {g.cambi.length > 0 && <span className="cal-segno-cambio" title="Cambio turno" />}
              </span>
              <span className="cal-voci">
                {g.voci.map((v) => (
                  <ChipTurno key={`${v.indice}-${v.codice}`} voce={v} sedi={sedi} nomeCollega={nomi.get(v.collegaId ?? '')} esteso />
                ))}
                {g.previsione?.map((f) => <ChipPrevisione key={f} fascia={f} />)}
              </span>
              {segno && <SegnoCalendario segno={segno} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
