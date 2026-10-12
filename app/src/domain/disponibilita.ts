// Disponibilità dei colleghi a prendere un turno ceduto (riposo minimo di 11 ore).
// Logica pura: ore relative al giorno del turno ceduto (giorno prima = -24, stesso giorno = 0, dopo = +24).
import { interpretaCodice, type Fascia, type TipoReperibilita } from './codici';
import type { DataISO } from './date';
import type { GiornoQuadro } from './quadro';

export const RIPOSO_MINIMO_ORE = 11;

/** Intervallo [inizio, fine) in ore. */
const ORARI_FASCIA: Record<Fascia, readonly [number, number]> = { M: [8, 14], P: [14, 20], N: [20, 32] };
const ORARI_REPERIBILITA: Record<TipoReperibilita, readonly [number, number]> = {
  RM: [8, 14],
  RP: [14, 20],
  RN: [20, 32],
  RG: [8, 20],
};

function impegniDi(codici: readonly string[] | undefined, offset: number): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (const c of codici ?? []) {
    const i = interpretaCodice(c);
    if (!i) continue;
    let orari: readonly [number, number] | undefined;
    if (i.categoria === 'turno' && i.fascia) orari = ORARI_FASCIA[i.fascia];
    else if (i.categoria === 'reperibilita' && i.reperibilita) orari = ORARI_REPERIBILITA[i.reperibilita];
    if (orari) out.push([orari[0] + offset, orari[1] + offset]);
  }
  return out;
}

/**
 * Colleghi che possono prendere il turno `fascia` del giorno `data`, rispettando 11 ore di riposo
 * prima dell'inizio e dopo la fine. Le reperibilità contano come impegno; assenze e codici
 * sconosciuti sono ignorati. Restituisce i medicoId nell'ordine dei candidati.
 */
export function colleghiDisponibili(args: {
  data: DataISO;
  fascia: Fascia;
  giornoPrima: GiornoQuadro | undefined;
  giorno: GiornoQuadro | undefined;
  giornoDopo: GiornoQuadro | undefined;
  candidati: readonly string[];
}): string[] {
  const [inizio, fine] = ORARI_FASCIA[args.fascia];
  return args.candidati.filter((id) => {
    const impegni = [
      ...impegniDi(args.giornoPrima?.[id], -24),
      ...impegniDi(args.giorno?.[id], 0),
      ...impegniDi(args.giornoDopo?.[id], 24),
    ];
    return impegni.every(([a, b]) => b <= inizio - RIPOSO_MINIMO_ORE || a >= fine + RIPOSO_MINIMO_ORE);
  });
}
