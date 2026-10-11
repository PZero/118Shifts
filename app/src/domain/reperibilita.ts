// Contatori di reperibilità del mese (docs/REQUISITI.md, "Contatori reperibilità").
//
// Per ogni tipo RM, RP, RN, RG si conta il numero di GIORNI del mese in cui compare
// (non le ore: le reperibilità contano 0 ore). Un giorno conta una sola volta per tipo,
// anche se il codice compare su entrambe le righe del medico.
// Le varianti con sede e/o at/att (es. "RN1", "RNatt") contano per il tipo base: la
// grammatica è quella dei turni, quindi inequivocabile (vedi `interpretaCodice`).
// RE è reperibilità ma di significato tbd: nessun contatore.
// Altri codici che iniziano per RM/RP/RN/RG ma non sono interpretabili (es. "RN16", "RMP")
// sono "sconosciuto" e finiscono in `reperibilitaDaControllare` (e negli avvisi di import).
// I cambi turno non sono applicati qui (si scambiano turni M/P/N, non reperibilità).

import { interpretaCodice, TIPI_REPERIBILITA, type TipoReperibilita } from './codici';

export type { TipoReperibilita } from './codici';
export { TIPI_REPERIBILITA } from './codici';

/** Numero di giorni del mese con almeno una reperibilità di ciascun tipo. */
export type ContatoriReperibilita = Record<TipoReperibilita, number>;

/** Codici del mese per giorno: { "1": ["RN"], ... } (come in turni/{id}/mesi). */
export type GiorniMese = Readonly<Record<string, readonly string[]>>;

function giorniValidi(giorni: GiorniMese): [number, readonly string[]][] {
  return Object.entries(giorni)
    .map(([g, codici]) => [Number(g), codici] as [number, readonly string[]])
    .filter(([g]) => Number.isInteger(g) && g >= 1 && g <= 31);
}

export function contaReperibilita(giorni: GiorniMese): ContatoriReperibilita {
  const conteggi: ContatoriReperibilita = { RM: 0, RP: 0, RN: 0, RG: 0 };
  for (const [, codici] of giorniValidi(giorni)) {
    const tipi = new Set<TipoReperibilita>();
    for (const codice of codici) {
      const t = interpretaCodice(codice)?.reperibilita;
      if (t) tipi.add(t);
    }
    for (const t of tipi) conteggi[t]++;
  }
  return conteggi;
}

export interface ReperibilitaDaControllare {
  giorno: number;
  codice: string;
}

/**
 * Codici che sembrano reperibilità (iniziano per RM/RP/RN/RG) ma non sono interpretabili
 * in modo inequivocabile: non contano in `contaReperibilita`, vanno mostrati "da controllare".
 */
export function reperibilitaDaControllare(giorni: GiorniMese): ReperibilitaDaControllare[] {
  const out: ReperibilitaDaControllare[] = [];
  for (const [giorno, codici] of giorniValidi(giorni)) {
    for (const codice of codici) {
      const c = interpretaCodice(codice);
      if (c?.categoria === 'sconosciuto' && TIPI_REPERIBILITA.some((t) => c.grezzo.startsWith(t))) {
        out.push({ giorno, codice: c.grezzo });
      }
    }
  }
  return out.sort((a, b) => a.giorno - b.giorno);
}
