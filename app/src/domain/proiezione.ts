// Proiezione indicativa della turnazione: ciclo di 5 giorni P, M, N, smonto, festa.
// In uscita solo i giorni P/M/N. L'ancora è il giorno P di riferimento (`cicloInizio`).

import { fasciaDi, type Fascia } from './codici';
import {
  aggiungiGiorni,
  aggiungiMesi,
  confrontaMesi,
  dataISO,
  differenzaGiorni,
  giorniNelMese,
  type AnnoMese,
  type DataISO,
} from './date';

export const CICLO: readonly (Fascia | null)[] = ['P', 'M', 'N', null, null]; // smonto, festa

export interface MeseTurni extends AnnoMese {
  /** { "1": ["M6", "P6"], ... } codici reali dell'Excel (senza cambi: il ciclo è quello pianificato). */
  giorni: Readonly<Record<string, readonly string[]>>;
}

function fascePerData(mesi: readonly MeseTurni[]): Map<DataISO, Set<Fascia>> {
  const out = new Map<DataISO, Set<Fascia>>();
  for (const m of mesi) {
    for (const [g, codici] of Object.entries(m.giorni)) {
      const fasce = new Set<Fascia>();
      for (const c of codici) {
        const f = fasciaDi(c);
        if (f) fasce.add(f);
      }
      if (fasce.size > 0) out.set(dataISO(m.anno, m.mese, Number(g)), fasce);
    }
  }
  return out;
}

/**
 * Ancora automatica: il giorno P dell'ultima sequenza reale P → M → N su tre giorni
 * consecutivi. Ogni giorno può avere 2 codici: basta che contenga la fascia richiesta.
 */
export function trovaAncora(mesi: readonly MeseTurni[]): DataISO | null {
  const fasce = fascePerData(mesi);
  const date = [...fasce.keys()].sort().reverse();
  for (const d of date) {
    if (
      fasce.get(d)?.has('P') &&
      fasce.get(aggiungiGiorni(d, 1))?.has('M') &&
      fasce.get(aggiungiGiorni(d, 2))?.has('N')
    ) {
      return d;
    }
  }
  return null;
}

/** Fascia prevista dal ciclo in una data (null = smonto o festa). */
export function fasciaPrevista(ancora: DataISO, data: DataISO): Fascia | null {
  const k = ((differenzaGiorni(ancora, data) % 5) + 5) % 5;
  return CICLO[k] ?? null;
}

/** Proietta il ciclo per `numeroMesi` mesi dopo `ultimoMese` (escluso). Solo giorni P/M/N. */
export function proietta(ancora: DataISO, ultimoMese: AnnoMese, numeroMesi = 12): Record<DataISO, Fascia> {
  const out: Record<DataISO, Fascia> = {};
  for (let i = 1; i <= numeroMesi; i++) {
    const { anno, mese } = aggiungiMesi(ultimoMese, i);
    for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
      const data = dataISO(anno, mese, g);
      const f = fasciaPrevista(ancora, data);
      if (f) out[data] = f;
    }
  }
  return out;
}

export interface InputProiezione {
  mesi: readonly MeseTurni[];
  /** Da `medici/{id}.cicloInizio` ("aaaa-mm-gg", giorno P). */
  cicloInizio?: string;
  /** Se vero, `cicloInizio` ha la precedenza sull'ancora automatica. */
  cicloManuale?: boolean;
  numeroMesi?: number;
}

export interface RisultatoProiezione {
  ancora: DataISO | null;
  origine: 'manuale' | 'automatica' | 'salvata' | null;
  turni: Record<DataISO, Fascia>;
}

export function proiezioneMedico(input: InputProiezione): RisultatoProiezione {
  const ultimo = input.mesi.reduce<AnnoMese | null>(
    (max, m) => (max === null || confrontaMesi(m, max) > 0 ? { anno: m.anno, mese: m.mese } : max),
    null,
  );
  const valida = input.cicloInizio && /^\d{4}-\d{2}-\d{2}$/.test(input.cicloInizio) ? input.cicloInizio : undefined;

  let ancora: DataISO | null = null;
  let origine: RisultatoProiezione['origine'] = null;
  if (input.cicloManuale && valida) {
    ancora = valida;
    origine = 'manuale';
  } else {
    ancora = trovaAncora(input.mesi);
    if (ancora) origine = 'automatica';
    else if (valida) {
      ancora = valida;
      origine = 'salvata';
    }
  }
  if (!ancora || !ultimo) return { ancora, origine, turni: {} };
  return { ancora, origine, turni: proietta(ancora, ultimo, input.numeroMesi ?? 12) };
}
