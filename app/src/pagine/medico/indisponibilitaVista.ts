// Preferenza e modello di vista delle indisponibilità (nessun componente).

import type { Fascia } from '../../domain/codici';
import { dataISO } from '../../domain/date';
import { conflittiConTurni, type GiorniIndisponibili } from '../../domain/indisponibilita';
import type { MeseDoc } from '../../servizi/tipi';

export interface SegnoIndisp {
  fasce: Fascia[];
  conflitti: Fascia[];
}

export type IndispPerMese = Record<string, GiorniIndisponibili>;

const CHIAVE_PREF = 'gt.mostraIndisponibilita';

export function leggiPreferenzaMostra(): boolean {
  try {
    return localStorage.getItem(CHIAVE_PREF) !== '0';
  } catch {
    return true;
  }
}

export function salvaPreferenzaMostra(v: boolean): void {
  try {
    localStorage.setItem(CHIAVE_PREF, v ? '1' : '0');
  } catch {
    /* preferenza non persistita */
  }
}

/** Segni per data ISO, con i conflitti calcolati sui turni ufficiali dell'Excel (senza cambi). */
export function costruisciSegni(indisp: IndispPerMese, mesi: readonly MeseDoc[]): Map<string, SegnoIndisp> {
  const out = new Map<string, SegnoIndisp>();
  for (const [chiave, giorni] of Object.entries(indisp)) {
    const [anno, mese] = chiave.split('-').map(Number) as [number, number];
    const ufficiali = mesi.find((m) => m.chiave === chiave)?.giorni ?? {};
    const conflitti = conflittiConTurni(giorni, ufficiali);
    for (const [g, fasce] of Object.entries(giorni)) {
      out.set(dataISO(anno, mese, Number(g)), { fasce, conflitti: conflitti[g] ?? [] });
    }
  }
  return out;
}

export function descriviSegno(s: SegnoIndisp): string {
  const base = `indisponibile ${s.fasce.join(', ')}`;
  return s.conflitti.length > 0 ? `${base}, non rispettata per ${s.conflitti.join(', ')}` : base;
}

