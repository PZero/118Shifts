// ADATTATORE PROVVISORIO: il conteggio della reperibilità spetta al dominio
// (`app/src/domain/reperibilita.ts`, funzione `contaReperibilita`, in preparazione da parte di
// `dati-turni`). Finché non c'è, qui un conteggio minimo basato su `interpretaCodice`:
// numero di GIORNI del mese con almeno un codice di quel tipo. Da sostituire con il dominio.

import { interpretaCodice } from '../domain/codici';

export type TipoReperibilita = 'RM' | 'RP' | 'RN' | 'RG';
export type ContoReperibilita = Record<TipoReperibilita, number>;

export const TIPI_REPERIBILITA: readonly TipoReperibilita[] = ['RM', 'RP', 'RN', 'RG'];

export function contaReperibilitaMese(giorni: Readonly<Record<string, readonly string[]>>): ContoReperibilita {
  const conto: ContoReperibilita = { RM: 0, RP: 0, RN: 0, RG: 0 };
  for (const codici of Object.values(giorni)) {
    const tipi = new Set<TipoReperibilita>();
    for (const c of codici) {
      const k = interpretaCodice(c);
      if (k?.categoria === 'reperibilita' && (TIPI_REPERIBILITA as readonly string[]).includes(k.grezzo)) {
        tipi.add(k.grezzo as TipoReperibilita);
      }
    }
    for (const t of tipi) conto[t]++;
  }
  return conto;
}
