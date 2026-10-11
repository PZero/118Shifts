// Proiezione indicativa della turnazione: ciclo di 5 giorni MP (M e P nello stesso giorno),
// N, smonto, riposo, riposo. In uscita solo i giorni MP (due fasce) e N.
// L'ancora è il giorno MP di riferimento (`cicloInizio`).

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

/** Fasce previste per ciascun giorno del ciclo: MP, N, smonto, riposo, riposo. */
export const CICLO: readonly (readonly Fascia[])[] = [['M', 'P'], ['N'], [], [], []];

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
 * Ancora automatica: l'ultimo giorno reale che contiene sia una fascia M sia una fascia P,
 * seguito il giorno dopo da un giorno con una fascia N. Un giorno ha al massimo 2 codici.
 */
export function trovaAncora(mesi: readonly MeseTurni[]): DataISO | null {
  const fasce = fascePerData(mesi);
  const date = [...fasce.keys()].sort().reverse();
  for (const d of date) {
    const f = fasce.get(d);
    if (f?.has('M') && f.has('P') && fasce.get(aggiungiGiorni(d, 1))?.has('N')) return d;
  }
  return null;
}

/** Fasce previste dal ciclo in una data (vuoto = smonto o riposo). */
export function fascePreviste(ancora: DataISO, data: DataISO): Fascia[] {
  const k = ((differenzaGiorni(ancora, data) % 5) + 5) % 5;
  return [...(CICLO[k] ?? [])];
}

/** Proietta il ciclo per `numeroMesi` mesi dopo `ultimoMese` (escluso). Solo giorni MP e N. */
export function proietta(ancora: DataISO, ultimoMese: AnnoMese, numeroMesi = 12): Record<DataISO, Fascia[]> {
  const out: Record<DataISO, Fascia[]> = {};
  for (let i = 1; i <= numeroMesi; i++) {
    const { anno, mese } = aggiungiMesi(ultimoMese, i);
    for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
      const data = dataISO(anno, mese, g);
      const f = fascePreviste(ancora, data);
      if (f.length > 0) out[data] = f;
    }
  }
  return out;
}

export interface InputProiezione {
  mesi: readonly MeseTurni[];
  /** Da `medici/{id}.cicloInizio` ("aaaa-mm-gg", giorno MP). */
  cicloInizio?: string;
  /** Se vero, `cicloInizio` ha la precedenza sull'ancora automatica. */
  cicloManuale?: boolean;
  numeroMesi?: number;
}

export interface RisultatoProiezione {
  ancora: DataISO | null;
  origine: 'manuale' | 'automatica' | 'salvata' | null;
  turni: Record<DataISO, Fascia[]>;
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
