// Applicazione dei cambi turno (cambi/{medicoId}/voci) ai turni di un medico.

import { pulisciCodice } from './codici';
import type { DataISO } from './date';

export interface Cambio {
  data: DataISO;
  /** Riga del giorno (0 = prima, 1 = seconda). Per i ricevuti è indicativa. */
  slot: 0 | 1;
  codice: string;
  verso: 'ceduto' | 'ricevuto';
  collegaId?: string;
}

export interface VoceTurno {
  codice: string;
  stato: 'normale' | 'ceduto' | 'ricevuto';
  /** Per ceduto: chi lo riceve; per ricevuto: chi lo cede. */
  collegaId?: string;
}

export interface EsitoCambi {
  giorni: Record<DataISO, VoceTurno[]>;
  /** Cambi "ceduto" che non trovano il turno corrispondente. */
  nonApplicati: Cambio[];
}

/**
 * Applica i cambi. Un turno ceduto resta in elenco con stato "ceduto" (la vista lo mostra
 * barrato; le ore non lo contano); un turno ricevuto si aggiunge con stato "ricevuto".
 * Il ceduto si abbina allo slot indicato se il codice coincide, altrimenti al primo
 * codice uguale dello stesso giorno; se non c'è, finisce in `nonApplicati`.
 */
export function applicaCambi(
  giorni: Readonly<Record<DataISO, readonly string[]>>,
  cambi: readonly Cambio[],
): EsitoCambi {
  const out: Record<DataISO, VoceTurno[]> = {};
  for (const [data, codici] of Object.entries(giorni)) {
    out[data] = codici.map((codice) => ({ codice, stato: 'normale' }));
  }
  const nonApplicati: Cambio[] = [];

  for (const c of cambi) {
    const codice = pulisciCodice(c.codice);
    const voci = (out[c.data] ??= []);
    if (c.verso === 'ricevuto') {
      const voce: VoceTurno = { codice, stato: 'ricevuto' };
      if (c.collegaId) voce.collegaId = c.collegaId;
      voci.push(voce);
      continue;
    }
    const libera = (v: VoceTurno | undefined) => v !== undefined && v.stato === 'normale' && pulisciCodice(v.codice) === codice;
    const i = libera(voci[c.slot]) ? c.slot : voci.findIndex(libera);
    if (i < 0) {
      nonApplicati.push(c);
      continue;
    }
    const voce: VoceTurno = { ...voci[i]!, stato: 'ceduto' };
    if (c.collegaId) voce.collegaId = c.collegaId;
    voci[i] = voce;
  }
  return { giorni: out, nonApplicati };
}

/** Codici effettivamente lavorati (esclusi i ceduti). */
export function codiciEffettivi(voci: readonly VoceTurno[] | undefined): string[] {
  return (voci ?? []).filter((v) => v.stato !== 'ceduto').map((v) => v.codice);
}
