// Classificazione di una cella per template matching (k-NN con coseno) a due fasi:
// 1) codice più simile tra tutti gli esempi (con tolleranza a piccole traslazioni);
// 2) se è un turno M/P/N con sede, spareggio tra le cifre con una mappa di pesi sui pixel
//    dove le cifre differiscono. Il codice finale deve rispettare la grammatica di codici.ts.

import { interpretaCodice } from '../codici';
import { CELLA_H, CELLA_N, CELLA_W } from './cella';
import type { CellaEstratta, Classificazione, ModelloOcr } from './tipi';

/** Soglie scelte sul prototipo: sotto, la lettura va fatta verificare. */
export const SIM_MIN = 0.9;
export const MARG_MIN = 0.02;

/** Candidati affinati nella seconda passata. */
const CLASSI_AFFINATE = 6;
const ESEMPI_PER_CLASSE = 5;
const ESEMPI_PER_CLASSE_CIFRE = 4;

const RW = CELLA_W / 2;
const RH = CELLA_H / 2;
const RN = RW * RH;

function dot(a: Float32Array, b: Float32Array, n = a.length): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

/** Riduce 2x2 (vettore a risoluzione dei pixel originali) e rinormalizza. */
function riduci(v: Float32Array): Float32Array {
  const r = new Float32Array(RN);
  let s = 0;
  for (let y = 0; y < RH; y++) {
    for (let x = 0; x < RW; x++) {
      const i = 2 * y * CELLA_W + 2 * x;
      const t = v[i]! + v[i + 1]! + v[i + CELLA_W]! + v[i + CELLA_W + 1]!;
      r[y * RW + x] = t;
      s += t * t;
    }
  }
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < RN; i++) r[i]! /= n;
  return r;
}

interface PesiLettera {
  indici: Int32Array;
  pesi: Float32Array;
  /** classe -> indici degli esempi */
  classi: Map<string, number[]>;
}

interface Derivati {
  ridotti: Float32Array[];
  classi: Map<string, number[]>;
  lettere: Map<string, PesiLettera | null>;
}

const cache = new WeakMap<ModelloOcr, Derivati>();

function derivati(m: ModelloOcr): Derivati {
  let d = cache.get(m);
  if (!d) {
    const classi = new Map<string, number[]>();
    m.esempi.forEach((e, i) => {
      const l = classi.get(e.c);
      if (l) l.push(i);
      else classi.set(e.c, [i]);
    });
    d = { ridotti: m.esempi.map((e) => riduci(e.v)), classi, lettere: new Map() };
    cache.set(m, d);
  }
  return d;
}

/** Mappa di pesi per le cifre di una lettera: varianza tra le medie di classe, soglia al 15% del massimo. */
function pesiLettera(m: ModelloOcr, d: Derivati, lettera: string): PesiLettera | null {
  if (d.lettere.has(lettera)) return d.lettere.get(lettera) ?? null;
  const re = new RegExp(`^${lettera}[1-7C]$`);
  const classi = new Map<string, number[]>();
  for (const [c, idx] of d.classi) if (re.test(c)) classi.set(c, idx);
  let risultato: PesiLettera | null = null;
  if (classi.size >= 2) {
    const medie: Float32Array[] = [];
    for (const idx of classi.values()) {
      const a = new Float32Array(CELLA_N);
      for (const i of idx) {
        const v = m.esempi[i]!.v;
        for (let k = 0; k < CELLA_N; k++) a[k]! += v[k]!;
      }
      for (let k = 0; k < CELLA_N; k++) a[k]! /= idx.length;
      medie.push(a);
    }
    const w = new Float32Array(CELLA_N);
    for (let k = 0; k < CELLA_N; k++) {
      let mu = 0;
      for (const a of medie) mu += a[k]!;
      mu /= medie.length;
      for (const a of medie) w[k]! += (a[k]! - mu) ** 2;
    }
    let max = 0;
    for (let k = 0; k < CELLA_N; k++) if (w[k]! > max) max = w[k]!;
    const indici: number[] = [];
    const pesi: number[] = [];
    if (max > 0) {
      for (let k = 0; k < CELLA_N; k++) {
        if (w[k]! / max > 0.15) {
          indici.push(k);
          pesi.push(w[k]! / max);
        }
      }
    }
    if (indici.length > 0) risultato = { indici: Int32Array.from(indici), pesi: Float32Array.from(pesi), classi };
  }
  d.lettere.set(lettera, risultato);
  return risultato;
}

function cosenoPesato(a: Float32Array, b: Float32Array, p: PesiLettera): number {
  let v = 0;
  let sa = 0;
  let sb = 0;
  const { indici, pesi } = p;
  for (let j = 0; j < indici.length; j++) {
    const k = indici[j]!;
    const w = pesi[j]!;
    const x = a[k]!;
    const y = b[k]!;
    v += w * x * y;
    sa += w * x * x;
    sb += w * y * y;
  }
  return v / (Math.sqrt(sa * sb) || 1);
}

function valido(codice: string): boolean {
  const c = interpretaCodice(codice);
  return c !== null && c.categoria !== 'sconosciuto';
}

const VUOTA: Classificazione = { codice: '', sim: 1, marg: 1, incerto: false };

/**
 * Classifica una cella. Accetta la cella estratta (con le varianti traslate, più accurata)
 * oppure il solo vettore normalizzato. Una cella vuota dà codice '' senza incertezza.
 */
export function classifica(cella: CellaEstratta | Float32Array, modello: ModelloOcr): Classificazione {
  const estratta: CellaEstratta = cella instanceof Float32Array
    ? { vettore: cella, varianti: [], inchiostro: Infinity, vuota: false }
    : cella;
  if (estratta.vuota) return VUOTA;
  if (modello.esempi.length === 0) return { codice: '', sim: 0, marg: 0, incerto: true };

  const d = derivati(modello);
  const varianti = estratta.varianti.length > 0 ? estratta.varianti : [estratta.vettore];
  // Passata grossolana: 9 traslazioni intere (se ci sono tutte e 25), risoluzione dimezzata.
  const grossolane =
    varianti.length === 25
      ? [0, 2, 4].flatMap((a) => [0, 2, 4].map((b) => riduci(varianti[a * 5 + b]!)))
      : varianti.map(riduci);

  const n = modello.esempi.length;
  const grosso = new Float32Array(n);
  const bestClasse = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const r = d.ridotti[i]!;
    let m = -1;
    for (const q of grossolane) {
      const s = dot(q, r, RN);
      if (s > m) m = s;
    }
    grosso[i] = m;
    const c = modello.esempi[i]!.c;
    if (m > (bestClasse.get(c) ?? -2)) bestClasse.set(c, m);
  }

  const migliori = (idx: number[], k: number): number[] => idx.slice().sort((a, b) => grosso[b]! - grosso[a]!).slice(0, k);

  // Passata fine: tutte le traslazioni, solo sui candidati.
  const candidate = [...bestClasse].sort((a, b) => b[1] - a[1]).slice(0, CLASSI_AFFINATE);
  const fine: [string, number][] = candidate.map(([c]) => {
    let m = -1;
    for (const i of migliori(d.classi.get(c)!, ESEMPI_PER_CLASSE)) {
      const v = modello.esempi[i]!.v;
      for (const q of varianti) {
        const s = dot(q, v);
        if (s > m) m = s;
      }
    }
    return [c, m];
  });
  fine.sort((a, b) => b[1] - a[1]);
  let codice = fine[0]![0];
  const sim = fine[0]![1];
  let marg = fine.length > 1 ? sim - fine[1]![1] : 1;
  let secondo = fine[1]?.[0];

  // Seconda fase: cifra di sede tra codici con la stessa lettera.
  const mm = /^([MPN])[1-7C]$/.exec(codice);
  if (mm) {
    const p = pesiLettera(modello, d, mm[1]!);
    if (p) {
      const r2: [string, number][] = [];
      for (const [c, idx] of p.classi) {
        let m = -1;
        for (const i of migliori(idx, ESEMPI_PER_CLASSE_CIFRE)) {
          const v = modello.esempi[i]!.v;
          for (const q of varianti) {
            const s = cosenoPesato(q, v, p);
            if (s > m) m = s;
          }
        }
        r2.push([c, m]);
      }
      r2.sort((a, b) => b[1] - a[1]);
      codice = r2[0]![0];
      marg = r2.length > 1 ? r2[0]![1] - r2[1]![1] : 1;
      secondo = r2[1]?.[0];
    }
  }

  const incerto = sim < SIM_MIN || marg < MARG_MIN || !valido(codice);
  return secondo === undefined ? { codice, sim, marg, incerto } : { codice, sim, marg, incerto, secondo };
}
