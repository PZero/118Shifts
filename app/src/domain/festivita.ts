// Festività italiane, patrono di Genova, weekend e riepilogo mensile di weekend e festività.

import { interpretaCodice, type Fascia } from './codici';
import { applicaCambi, codiciEffettivi, type Cambio } from './cambi';
import { aggiungiGiorni, dataISO, giorniNelMese, giornoSettimana, scomponi, type DataISO } from './date';

export interface Festivita {
  data: DataISO;
  nome: string;
}

/** Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher). */
export function pasqua(anno: number): DataISO {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return dataISO(anno, mese, giorno);
}

/** San Francesco (4 ottobre) è di nuovo festa nazionale dal 2026 (legge del 2025). Confermato dall'utente. */
export const ANNO_INIZIO_SAN_FRANCESCO = 2026;

/** Festività dell'anno: nazionali italiane + 24 giugno, San Giovanni Battista (patrono di Genova). */
export function festivitaAnno(anno: number): Festivita[] {
  const fisse: [number, number, string][] = [
    [1, 1, 'Capodanno'],
    [1, 6, 'Epifania'],
    [4, 25, 'Festa della Liberazione'],
    [5, 1, 'Festa del Lavoro'],
    [6, 2, 'Festa della Repubblica'],
    [6, 24, 'San Giovanni Battista (patrono di Genova)'],
    [8, 15, 'Ferragosto'],
    [11, 1, 'Ognissanti'],
    [12, 8, 'Immacolata Concezione'],
    [12, 25, 'Natale'],
    [12, 26, 'Santo Stefano'],
  ];
  if (anno >= ANNO_INIZIO_SAN_FRANCESCO) fisse.push([10, 4, "San Francesco d'Assisi"]);
  const p = pasqua(anno);
  return [
    ...fisse.map(([m, g, nome]) => ({ data: dataISO(anno, m, g), nome })),
    { data: p, nome: 'Pasqua' },
    { data: aggiungiGiorni(p, 1), nome: "Lunedì dell'Angelo (Pasquetta)" },
  ].sort((a, b) => a.data.localeCompare(b.data));
}

export function festivitaDi(data: DataISO): Festivita | undefined {
  return festivitaAnno(scomponi(data).anno).find((f) => f.data === data);
}

export function isSabato(data: DataISO): boolean {
  return giornoSettimana(data) === 6;
}
export function isDomenica(data: DataISO): boolean {
  return giornoSettimana(data) === 0;
}
export function isWeekend(data: DataISO): boolean {
  return isSabato(data) || isDomenica(data);
}
/** Domenica o festività (per l'evidenziazione nel calendario). */
export function isFestivo(data: DataISO): boolean {
  return isDomenica(data) || festivitaDi(data) !== undefined;
}

// ---------------------------------------------------------------------------
// Riepilogo weekend e festività.
//
// REGOLA "libero / parziale / lavorato" per un giorno D (solo codici di categoria "turno",
// dopo i cambi):
// - parte di GIORNO (08–20) occupata se in D c'è un M o un P;
// - parte di NOTTE (20–08 di D+1) occupata se in D c'è un N;
// - "libero" = giorno e notte liberi; "parziale" = uno dei due libero
//   (es. solo N → libero di giorno; solo M/P → libero di notte); "lavorato" = entrambi occupati.
// - La notte iniziata il giorno prima (N in D-1, fino alle 08 di D) NON rende D parziale:
//   è segnalata a parte con `smonto: true`.
// Assenze e altri codici (F, f, -, C, reperibilità, …) non occupano: sono elencati in `altri`.
// ---------------------------------------------------------------------------

export type Stato = 'libero' | 'parziale' | 'lavorato';

export interface StatoGiorno {
  data: DataISO;
  stato: Stato;
  liberoDiGiorno: boolean;
  liberoDiNotte: boolean;
  /** Fasce lavorate nel giorno. */
  fasce: Fascia[];
  /** Notte lavorata il giorno prima (smonto alle 08). */
  smonto: boolean;
  /** Codici non di turno del giorno (assenze, reperibilità, …). */
  altri: string[];
}

export interface StatoFestivita extends StatoGiorno {
  nome: string;
}

export interface Conteggio {
  liberi: number;
  parziali: number;
  lavorati: number;
}

export interface RiepilogoWeekend {
  sabati: StatoGiorno[];
  domeniche: StatoGiorno[];
  festivita: StatoFestivita[];
  conteggi: { sabati: Conteggio; domeniche: Conteggio; festivita: Conteggio };
}

export interface InputRiepilogo {
  anno: number;
  mese: number;
  giorni: Readonly<Record<string, readonly string[]>>;
  /** Codici dell'ultimo giorno del mese precedente (per lo smonto del giorno 1). */
  ultimoGiornoPrecedente?: readonly string[];
  cambi?: readonly Cambio[];
}

export function statoGiorno(data: DataISO, codici: readonly string[], codiciGiornoPrima: readonly string[]): StatoGiorno {
  const fasce: Fascia[] = [];
  const altri: string[] = [];
  for (const codice of codici) {
    const c = interpretaCodice(codice);
    if (!c) continue;
    if (c.categoria === 'turno' && c.fascia) fasce.push(c.fascia);
    else altri.push(c.grezzo);
  }
  const liberoDiGiorno = !fasce.includes('M') && !fasce.includes('P');
  const liberoDiNotte = !fasce.includes('N');
  const smonto = codiciGiornoPrima.some((k) => interpretaCodice(k)?.fascia === 'N' && interpretaCodice(k)?.categoria === 'turno');
  const stato: Stato = liberoDiGiorno && liberoDiNotte ? 'libero' : liberoDiGiorno || liberoDiNotte ? 'parziale' : 'lavorato';
  return { data, stato, liberoDiGiorno, liberoDiNotte, fasce, smonto, altri };
}

function conta(elenco: readonly StatoGiorno[]): Conteggio {
  return {
    liberi: elenco.filter((s) => s.stato === 'libero').length,
    parziali: elenco.filter((s) => s.stato === 'parziale').length,
    lavorati: elenco.filter((s) => s.stato === 'lavorato').length,
  };
}

export function riepilogoWeekendFestivita(input: InputRiepilogo): RiepilogoWeekend {
  const { anno, mese } = input;
  const n = giorniNelMese(anno, mese);
  const vigilia = aggiungiGiorni(dataISO(anno, mese, 1), -1);

  const perData: Record<DataISO, readonly string[]> = {};
  if (input.ultimoGiornoPrecedente) perData[vigilia] = input.ultimoGiornoPrecedente;
  for (const [g, codici] of Object.entries(input.giorni)) perData[dataISO(anno, mese, Number(g))] = codici;
  const ultimo = dataISO(anno, mese, n);
  const cambi = (input.cambi ?? []).filter((c) => c.data >= vigilia && c.data <= ultimo);
  const { giorni: effettivi } = applicaCambi(perData, cambi);

  const sabati: StatoGiorno[] = [];
  const domeniche: StatoGiorno[] = [];
  const festivita: StatoFestivita[] = [];
  const nomiFeste = new Map(festivitaAnno(anno).map((f) => [f.data, f.nome]));

  for (let g = 1; g <= n; g++) {
    const data = dataISO(anno, mese, g);
    const s = statoGiorno(data, codiciEffettivi(effettivi[data]), codiciEffettivi(effettivi[aggiungiGiorni(data, -1)]));
    if (isSabato(data)) sabati.push(s);
    if (isDomenica(data)) domeniche.push(s);
    const nome = nomiFeste.get(data);
    if (nome) festivita.push({ ...s, nome });
  }

  return {
    sabati,
    domeniche,
    festivita,
    conteggi: { sabati: conta(sabati), domeniche: conta(domeniche), festivita: conta(festivita) },
  };
}
