// Lettura dell'intero foglio e conversione nella stessa struttura dell'import Excel (FoglioMese).

import { interpretaCodice } from '../codici';
import { categoriaAvviso, type AvvisoImport, type FoglioMese, type MedicoFoglio, type RisultatoImport } from '../excel';
import { estraiCella, rettangoloCella } from './cella';
import { classifica } from './classifica';
import { rettangoloNome } from './nomi';
import type { Griglia, ImmagineRGBA, ModelloOcr, Rettangolo } from './tipi';

export interface CellaLetta {
  /** Indice del medico (0-based) e sotto-riga (0 = sopra, 1 = sotto). */
  riga: number;
  sottoRiga: 0 | 1;
  /** Giorno del mese (1..giorni). */
  giorno: number;
  /** Codice letto ('' = cella vuota). */
  codice: string;
  sim: number;
  marg: number;
  /** Da verificare: l'interfaccia mostra il ritaglio accanto al valore. */
  incerto: boolean;
  vuota: boolean;
  secondo?: string;
  /** Rettangolo della cella nell'immagine, per il ritaglio. */
  rect: Rettangolo;
  /** Vettore normalizzato: serve a `apprendi` quando l'utente conferma o corregge. */
  vettore: Float32Array;
}

export interface FoglioLetto {
  griglia: Griglia;
  righe: number;
  giorni: number;
  celle: CellaLetta[];
  /** Ritaglio del cognome di ogni medico. */
  nomi: { riga: number; rect: Rettangolo }[];
}

export interface OpzioniLettura {
  righe?: number;
  giorni?: number;
  /** Chiamata dopo ogni medico: (fatti, totale). */
  onProgresso?: (fatti: number, totale: number) => void;
}

/** Legge tutte le celle (2 sotto-righe per medico, un valore per giorno). */
export function leggiFoglio(
  img: ImmagineRGBA,
  griglia: Griglia,
  modello: ModelloOcr,
  opzioni: OpzioniLettura = {},
): FoglioLetto {
  const righe = opzioni.righe ?? griglia.righe;
  const giorni = opzioni.giorni ?? griglia.giorni;
  const celle: CellaLetta[] = [];
  const nomi: FoglioLetto['nomi'] = [];
  for (let r = 0; r < righe; r++) {
    nomi.push({ riga: r, rect: rettangoloNome(griglia, r) });
    for (const s of [0, 1] as const) {
      for (let giorno = 1; giorno <= giorni; giorno++) {
        const cella = estraiCella(img, griglia, r, s, giorno);
        const c = classifica(cella, modello);
        const lettura: CellaLetta = {
          riga: r,
          sottoRiga: s,
          giorno,
          codice: c.codice,
          sim: c.sim,
          marg: c.marg,
          incerto: c.incerto,
          vuota: cella.vuota,
          rect: rettangoloCella(griglia, r, s, giorno),
          vettore: cella.vettore,
        };
        if (c.secondo !== undefined) lettura.secondo = c.secondo;
        celle.push(lettura);
      }
    }
    opzioni.onProgresso?.(r + 1, righe);
  }
  return { griglia, righe, giorni, celle, nomi };
}

export interface OpzioniFoglioMese {
  /** Nome del medico per ogni riga (null/'' = riga non assegnata, ignorata). */
  nomi: readonly (string | null | undefined)[];
  anno: number;
  /** 1..12 */
  mese: number;
  /** Nome del foglio per avvisi e anteprima (default "OCR"). */
  nomeFoglio?: string;
}

/**
 * Trasforma la lettura nella struttura dell'import Excel: per medico e giorno, max 2 codici
 * normalizzati (sotto-riga 0 poi 1). Le celle ancora incerte e i codici sconosciuti producono
 * avvisi 'codice-da-controllare'; le righe con turni ma senza nome 'righe-senza-nome'.
 * Il campo `riga` (1-based) è il numero d'ordine della riga di lettura, non una riga Excel.
 */
export function aFoglioMese(letto: FoglioLetto, opzioni: OpzioniFoglioMese): RisultatoImport {
  const foglio = opzioni.nomeFoglio ?? 'OCR';
  const avvisi: AvvisoImport[] = [];
  const avvisa = (a: Omit<AvvisoImport, 'categoria' | 'foglio'>) =>
    avvisi.push({ ...a, foglio, categoria: categoriaAvviso(a.tipo) });

  const perRiga = new Map<number, CellaLetta[]>();
  for (const c of letto.celle) {
    const l = perRiga.get(c.riga);
    if (l) l.push(c);
    else perRiga.set(c.riga, [c]);
  }

  const medici: MedicoFoglio[] = [];
  for (let r = 0; r < letto.righe; r++) {
    const nome = (opzioni.nomi[r] ?? '').trim();
    const celle = (perRiga.get(r) ?? [])
      .filter((c) => c.codice !== '')
      .sort((a, b) => a.giorno - b.giorno || a.sottoRiga - b.sottoRiga);
    if (nome === '') {
      if (celle.length > 0) {
        avvisa({
          tipo: 'righe-senza-nome',
          riga: r * 2 + 1,
          messaggio: `Riga ${r + 1} del foglio letto: turni presenti ma senza nome del medico, ignorata.`,
        });
      }
      continue;
    }
    const medico: MedicoFoglio = { nome, riga: r * 2 + 1, giorni: {}, giornoPrecedente: [] };
    for (const c of celle) {
      const codice = interpretaCodice(c.codice);
      if (!codice) continue;
      const lista = (medico.giorni[String(c.giorno)] ??= []);
      if (lista.length >= 2) continue; // max 2 codici per giorno (le sotto-righe sono 2)
      lista.push(codice.grezzo);
      const sconosciuto = codice.categoria === 'sconosciuto';
      if (sconosciuto || c.incerto) {
        avvisa({
          tipo: 'codice-da-controllare',
          riga: r * 2 + 1 + c.sottoRiga,
          giorno: c.giorno,
          medico: nome,
          valore: c.codice,
          messaggio: `${nome}, giorno ${c.giorno}: codice "${c.codice}" ${sconosciuto ? 'da controllare' : 'letto con incertezza'}.`,
        });
      }
    }
    medici.push(medico);
  }

  const mese: FoglioMese = { foglio, anno: opzioni.anno, mese: opzioni.mese, giorniTrovati: letto.giorni, medici };
  return { mesi: [mese], avvisi };
}
