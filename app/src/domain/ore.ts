// Ore lavorate nel mese, calcolate dall'app (la colonna totale dell'Excel è ignorata).
//
// Regole (docs/REQUISITI.md): M 08–14 = 6 h; P 14–20 = 6 h; N 20–08 = 12 h, di cui 4 sul
// giorno D e 8 sul giorno D+1, anche a cavallo tra mesi. Contano solo i codici di categoria
// "turno" (anche con suffisso C o at/att: da confermare). I cambi sono applicati:
// il turno ceduto non conta, quello ricevuto sì.

import { contaOre, interpretaCodice } from './codici';
import { applicaCambi, codiciEffettivi, type Cambio } from './cambi';
import { aggiungiGiorni, dataISO, giorniNelMese, scomponi, type DataISO } from './date';

export const ORE_FASCIA = { M: 6, P: 6, N: 12 } as const;
export const ORE_NOTTE_GIORNO_D = 4;
export const ORE_NOTTE_GIORNO_SUCCESSIVO = 8;

export interface InputOre {
  anno: number;
  /** 1..12 */
  mese: number;
  /** Codici del mese per giorno: { "1": ["M6"], ... } (come in turni/{id}/mesi). */
  giorni: Readonly<Record<string, readonly string[]>>;
  /**
   * Codici dell'ultimo giorno del mese precedente (dal suo documento, o in mancanza dalla
   * colonna B dell'Excel): una notte lì porta 8 h nel mese corrente.
   */
  ultimoGiornoPrecedente?: readonly string[];
  cambi?: readonly Cambio[];
}

export interface RiepilogoOre {
  totale: number;
  /** Ore attribuite a ciascun giorno del mese ("1".."31"). */
  perGiorno: Record<string, number>;
  /** Cambi "ceduto" che non trovano il turno corrispondente. */
  cambiNonApplicati: Cambio[];
}

export function oreMese(input: InputOre): RiepilogoOre {
  const { anno, mese } = input;
  const n = giorniNelMese(anno, mese);
  const primo = dataISO(anno, mese, 1);
  const vigilia = aggiungiGiorni(primo, -1);

  const perData: Record<DataISO, readonly string[]> = {};
  if (input.ultimoGiornoPrecedente) perData[vigilia] = input.ultimoGiornoPrecedente;
  for (const [g, codici] of Object.entries(input.giorni)) {
    const giorno = Number(g);
    if (Number.isInteger(giorno) && giorno >= 1 && giorno <= n) perData[dataISO(anno, mese, giorno)] = codici;
  }

  const ultimo = dataISO(anno, mese, n);
  const cambi = (input.cambi ?? []).filter((c) => c.data >= vigilia && c.data <= ultimo);
  const { giorni: effettivi, nonApplicati } = applicaCambi(perData, cambi);

  const perGiorno: Record<string, number> = {};
  for (let g = 1; g <= n; g++) perGiorno[String(g)] = 0;
  const aggiungi = (data: DataISO, ore: number) => {
    const d = scomponi(data);
    if (d.anno === anno && d.mese === mese) perGiorno[String(d.giorno)]! += ore;
  };

  for (const [data, voci] of Object.entries(effettivi)) {
    for (const codice of codiciEffettivi(voci)) {
      const c = interpretaCodice(codice);
      if (!contaOre(c) || !c?.fascia) continue;
      if (c.fascia === 'N') {
        aggiungi(data, ORE_NOTTE_GIORNO_D);
        aggiungi(aggiungiGiorni(data, 1), ORE_NOTTE_GIORNO_SUCCESSIVO);
      } else {
        aggiungi(data, ORE_FASCIA[c.fascia]);
      }
    }
  }

  const totale = Object.values(perGiorno).reduce((a, b) => a + b, 0);
  return { totale, perGiorno, cambiNonApplicati: nonApplicati };
}
