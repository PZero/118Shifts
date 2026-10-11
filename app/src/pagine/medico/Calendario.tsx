import type { Sedi } from '../../servizi/tipi';
import { GIORNI_BREVI, NOME_FASCIA, dataEstesa, etichettaCodice } from '../../ui/etichette';
import { ChipPrevisione, ChipTurno } from './ChipTurno';
import type { GiornoVista, MeseVista } from './vista';

interface Props {
  vista: MeseVista;
  sedi: Sedi;
  nomi: Map<string, string>;
  selezionato: string | null;
  onSeleziona: (data: string) => void;
}

function etichettaGiorno(g: GiornoVista, sedi: Sedi, nomi: Map<string, string>): string {
  const parti = [dataEstesa(g.data)];
  if (g.festa) parti.push(g.festa);
  if (g.previsione) parti.push(`previsto ${NOME_FASCIA[g.previsione]}`);
  for (const v of g.voci) {
    const e = etichettaCodice(v.info, sedi);
    if (v.stato === 'ceduto') parti.push(`${e.lunga}, ceduto a ${nomi.get(v.collegaId ?? '') ?? 'collega'}`);
    else if (v.stato === 'ricevuto') parti.push(`${e.lunga}, ricevuto da ${nomi.get(v.collegaId ?? '') ?? 'collega'}`);
    else parti.push(e.lunga);
  }
  if (g.voci.length === 0 && !g.previsione) parti.push('nessun turno');
  return parti.join(', ');
}

export function Calendario({ vista, sedi, nomi, selezionato, onSeleziona }: Props) {
  const vuote = vista.giorni[0]?.colonna ?? 0;
  const coda = (7 - ((vuote + vista.giorni.length) % 7)) % 7;

  // Navigazione da tastiera tra i giorni (frecce), come in una griglia.
  const muovi = (e: React.KeyboardEvent<HTMLButtonElement>, g: GiornoVista) => {
    const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!passo) return;
    const prossimo = vista.giorni[g.giorno - 1 + passo];
    if (!prossimo) return;
    e.preventDefault();
    onSeleziona(prossimo.data);
    document.querySelector<HTMLButtonElement>(`[data-giorno="${prossimo.data}"]`)?.focus();
  };

  return (
    <div className={`cal cal-${vista.tipo}`} role="group" aria-label="Calendario del mese">
      <div className="cal-intestazione" aria-hidden="true">
        {GIORNI_BREVI.map((n, i) => (
          <div key={n} className={`cal-intest ${i === 5 ? 'sab' : ''} ${i === 6 ? 'dom' : ''}`}>
            {n}
          </div>
        ))}
      </div>
      <div className="cal-griglia">
        {Array.from({ length: vuote }, (_, i) => (
          <div key={`v${i}`} className="cal-giorno cal-fuori" aria-hidden="true" />
        ))}
        {vista.giorni.map((g) => {
          const classi = [
            'cal-giorno',
            g.sabato ? 'sabato' : '',
            g.domenica || g.festa ? 'festivo' : '',
            g.oggi ? 'oggi' : '',
            g.data === selezionato ? 'selezionato' : '',
          ].join(' ');
          return (
            <button
              key={g.data}
              type="button"
              className={classi}
              data-giorno={g.data}
              aria-pressed={g.data === selezionato}
              aria-current={g.oggi ? 'date' : undefined}
              aria-label={etichettaGiorno(g, sedi, nomi)}
              tabIndex={g.data === selezionato || (!selezionato && g.giorno === 1) ? 0 : -1}
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
                {g.previsione && <ChipPrevisione fascia={g.previsione} />}
              </span>
            </button>
          );
        })}
        {Array.from({ length: coda }, (_, i) => (
          <div key={`c${i}`} className="cal-giorno cal-fuori" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
