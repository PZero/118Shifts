// Ricerca automatica della griglia (adattamento "a pettine" dei bordi) e correzione manuale.

import { grigio } from './immagine';
import type { Griglia, ImmagineRGBA, Punto } from './tipi';

export interface OpzioniGriglia {
  /** Numero di giorni del mese (colonne). */
  giorni: number;
  /** Numero di medici atteso: limita la griglia ai primi `righe` del blocco trovato. */
  righe?: number;
}

interface Pettine {
  /** Posizione della prima linea. */
  o: number;
  q: number;
  /** Numero di linee. */
  n: number;
  /** 0..1: contrasto tra linee e punti intermedi. */
  contrasto: number;
}

/** Valore del profilo con interpolazione lineare (0 fuori dai limiti). */
function val(p: Float32Array, x: number): number {
  const i = Math.floor(x);
  if (i < 0 || i >= p.length - 1) return 0;
  const t = x - i;
  return p[i]! * (1 - t) + p[i + 1]! * t;
}

/**
 * Profilo dei bordi verticali (colonne) o orizzontali (righe), con prominenza locale.
 * Somma i due salti adiacenti (senza che si annullino): una linea sottile dà un picco centrato su di essa.
 * Colonne: media sull'altezza. Righe: percentile basso sulla larghezza (a0..a1 = colonne dei giorni),
 * così il testo delle celle, che copre solo parte della larghezza, non produce falsi picchi.
 */
function profilo(g: Uint8Array, W: number, H: number, verticale: boolean, a0: number, a1: number): Float32Array {
  const lungo = verticale ? W : H;
  const grezzo = new Float32Array(lungo);
  const passo = Math.max(1, Math.floor((a1 - a0) / 600));
  if (verticale) {
    let conta = 0;
    for (let y = a0; y < a1; y += passo, conta++) {
      const riga = y * W;
      for (let x = 1; x < W - 1; x++) {
        grezzo[x]! += Math.abs(g[riga + x]! - g[riga + x - 1]!) + Math.abs(g[riga + x + 1]! - g[riga + x]!);
      }
    }
    for (let i = 0; i < lungo; i++) grezzo[i]! /= Math.max(1, conta);
  } else {
    const n = Math.max(1, Math.floor((a1 - a0) / passo));
    const e = new Float32Array(n);
    const k = Math.floor(0.3 * (n - 1));
    for (let y = 1; y < H - 1; y++) {
      for (let j = 0; j < n; j++) {
        const x = a0 + j * passo;
        e[j] = Math.abs(g[y * W + x]! - g[(y - 1) * W + x]!) + Math.abs(g[(y + 1) * W + x]! - g[y * W + x]!);
      }
      grezzo[y] = e.sort()[k]!;
    }
  }
  const out = new Float32Array(lungo);
  const r = 4;
  for (let i = r; i < lungo - r; i++) {
    const v = grezzo[i]! - 0.5 * (grezzo[i - r]! + grezzo[i + r]!);
    out[i] = v > 0 ? v : 0;
  }
  return out;
}

function contrastoPettine(p: Float32Array, o: number, q: number, n: number): number {
  let linee = 0;
  let meta = 0;
  for (let k = 0; k < n; k++) linee += val(p, o + q * k);
  for (let k = 0; k < n - 1; k++) meta += val(p, o + q * (k + 0.5));
  const l = linee / n;
  const m = n > 1 ? meta / (n - 1) : 0;
  return l > 0 ? Math.max(0, Math.min(1, 1 - m / l)) : 0;
}

function punteggioFisso(p: Float32Array, o: number, q: number, n: number): number {
  let s = 0;
  for (let k = 0; k < n; k++) s += val(p, o + q * k);
  return s;
}

/**
 * Cerca il pettine di passo q in [qMin, qMax]: la serie contigua di linee più forte
 * (somma di valore - soglia). Funziona anche se il numero di linee è ignoto.
 */
function cercaPettine(p: Float32Array, qMin: number, qMax: number, soglia: number): Pettine | null {
  const L = p.length;
  let migliore = { punti: -Infinity, o: 0, q: 0, k0: 0, n: 0 };
  for (let q = qMin; q <= qMax; q *= 1.0005) {
    for (let o = 0; o < q; o += 0.5) {
      let corsa = 0;
      let k0 = 0;
      for (let k = 0; o + q * k < L - 1; k++) {
        const v = val(p, o + q * k) - soglia;
        if (corsa <= 0) {
          corsa = v;
          k0 = k;
        } else corsa += v;
        if (corsa > migliore.punti) migliore = { punti: corsa, o, q, k0, n: k - k0 + 1 };
      }
    }
  }
  if (!isFinite(migliore.punti) || migliore.n < 2) return null;
  const r = rifinisci(p, migliore.o + migliore.q * migliore.k0, migliore.q, migliore.n);
  return { ...r, n: migliore.n };
}

/** Pettine con esattamente n linee (coarse-to-fine): robusto anche se alcune linee sono deboli. */
function cercaPettineFisso(p: Float32Array, qMin: number, qMax: number, n: number): { o: number; q: number } | null {
  const L = p.length;
  let migliore = { punti: -Infinity, o: 0, q: 0 };
  for (let q = qMin; q <= qMax; q *= 1.0025) {
    const oMax = L - 1 - q * (n - 1);
    for (let o = 0; o <= oMax; o += 1) {
      const s = punteggioFisso(p, o, q, n);
      if (s > migliore.punti) migliore = { punti: s, o, q };
    }
  }
  return isFinite(migliore.punti) ? migliore : null;
}

/** Valore massimo del profilo entro +-1,2 px da x. */
function picco(p: Float32Array, x: number): number {
  let m = 0;
  for (let d = -1.2; d <= 1.21; d += 0.4) m = Math.max(m, val(p, x + d));
  return m;
}

/** Quante linee in più (oltre le n note) continuano il pettine verso sinistra (dir=-1) o destra (dir=1). */
function estendi(p: Float32Array, o: number, q: number, n: number, dir: -1 | 1): number {
  let somma = 0;
  for (let k = 0; k < n; k++) somma += picco(p, o + q * k);
  const soglia = 0.4 * (somma / n);
  let extra = 0;
  for (;;) {
    const k = dir < 0 ? -(extra + 1) : n + extra;
    const x = o + q * k;
    if (x < 1 || x > p.length - 2 || picco(p, x) < soglia) return extra;
    extra++;
  }
}

/**
 * Retta posizione = o + q * k che meglio passa per i picchi locali delle n linee (minimi quadrati
 * pesati con scarto delle linee anomale): precisione sotto il pixel e immune alle linee deboli.
 */
function adattaRetta(p: Float32Array, o: number, q: number, n: number): { o: number; q: number } {
  let oo = o;
  let qq = q;
  for (let giro = 0; giro < 3; giro++) {
    const ks: number[] = [];
    const xs: number[] = [];
    const ws: number[] = [];
    for (let k = 0; k < n; k++) {
      const atteso = oo + qq * k;
      let bx = atteso;
      let bv = -1;
      for (let d = -2; d <= 2.001; d += 0.25) {
        const v = val(p, atteso + d);
        if (v > bv) {
          bv = v;
          bx = atteso + d;
        }
      }
      // baricentro locale attorno al picco
      let sw = 0;
      let sx = 0;
      for (let d = -1; d <= 1.001; d += 0.25) {
        const v = val(p, bx + d);
        sw += v;
        sx += v * (bx + d);
      }
      if (sw > 0) {
        ks.push(k);
        xs.push(sx / sw);
        ws.push(bv);
      }
    }
    if (ks.length < 3) break;
    const mediana = Array.from(ws).sort((a, b) => a - b)[Math.floor(ws.length / 2)]!;
    const usa = ks.map((_, i) => ws[i]! >= 0.4 * mediana);
    // minimi quadrati pesati sulle linee valide
    let S = 0;
    let Sk = 0;
    let Sx = 0;
    let Skk = 0;
    let Skx = 0;
    ks.forEach((k, i) => {
      if (!usa[i]) return;
      const w = ws[i]!;
      S += w;
      Sk += w * k;
      Sx += w * xs[i]!;
      Skk += w * k * k;
      Skx += w * k * xs[i]!;
    });
    const den = S * Skk - Sk * Sk;
    if (!(den > 0)) break;
    qq = (S * Skx - Sk * Sx) / den;
    oo = (Sx - qq * Sk) / S;
  }
  return { o: oo, q: qq };
}

/** Rifinitura locale di (o, q) con n linee fisse: ricerca fine del punteggio, poi adattamento ai picchi. */
function rifinisci(p: Float32Array, o: number, q: number, n: number): { o: number; q: number; contrasto: number } {
  let best = punteggioFisso(p, o, q, n);
  for (const [dq, dO] of [
    [0.006, 2],
    [0.001, 0.5],
  ] as const) {
    let bo = o;
    let bq = q;
    for (let a = -12; a <= 12; a++) {
      const qq = q * (1 + (dq * a) / 12);
      for (let b = -16; b <= 16; b++) {
        const oo = o + (dO * b) / 16;
        const s = punteggioFisso(p, oo, qq, n);
        if (s > best) {
          best = s;
          bo = oo;
          bq = qq;
        }
      }
    }
    o = bo;
    q = bq;
  }
  const r = adattaRetta(p, o, q, n);
  return { ...r, contrasto: contrastoPettine(p, r.o, r.q, n) };
}

/** Mediana dei k massimi locali più alti: stima della forza di una linea tipica (robusta ai bordi molto marcati). */
function forzaLinee(p: Float32Array, k: number): number {
  const m: number[] = [];
  for (let i = 1; i < p.length - 1; i++) if (p[i]! > p[i - 1]! && p[i]! >= p[i + 1]!) m.push(p[i]!);
  m.sort((a, b) => b - a);
  const top = m.slice(0, Math.max(1, k));
  return top[Math.floor(top.length / 2)] ?? 0;
}

interface BloccoMedici {
  /** Indice della prima linea di confine tra medici, nel pettine di passo q. */
  k0: number;
  conta: number;
  /** true se il passo q è quello di una sotto-riga (il medico occupa 2q). */
  doppio: boolean;
}

/**
 * Nella colonna dei nomi (celle unite sulle due sotto-righe) le linee orizzontali ci sono solo
 * tra un medico e l'altro. Date le linee del pettine (o, q), decide se q è il passo del medico o
 * di una sotto-riga (linee forti solo a indici alterni) e trova la serie più lunga di medici.
 */
function bloccoMedici(pn: Float32Array, o: number, q: number, nLinee: number): BloccoMedici | null {
  const v: number[] = [];
  for (let k = 0; k < nLinee; k++) v.push(val(pn, o + q * k));
  const top = Array.from(v).sort((a, b) => b - a).slice(0, 10);
  const soglia = 0.4 * (top.reduce((s, x) => s + x, 0) / Math.max(1, top.length));
  if (!(soglia > 0)) return null;
  let migliore: { punti: number; k0: number; k1: number; doppio: boolean } | null = null;
  // fase = -1: tutte le linee sono confini (q = passo del medico); 0/1: confini a indici alterni
  for (const fase of [-1, 0, 1]) {
    let corsa = 0;
    let k0 = 0;
    for (let k = 0; k < nLinee; k++) {
      const segno = fase < 0 || k % 2 === fase ? 1 : -1;
      const s = segno * (v[k]! - soglia);
      if (corsa <= 0) {
        corsa = s;
        k0 = k;
      } else corsa += s;
      if (corsa > 0 && (!migliore || corsa > migliore.punti)) migliore = { punti: corsa, k0, k1: k, doppio: fase >= 0 };
    }
  }
  if (!migliore) return null;
  // la serie parte e finisce su linee di confine (forti)
  let { k0, k1 } = migliore;
  while (k0 < k1 && v[k0]! < soglia) k0++;
  while (k1 > k0 && v[k1]! < soglia) k1--;
  const conta = migliore.doppio ? Math.floor((k1 - k0) / 2) : k1 - k0;
  return conta >= 1 ? { k0, conta, doppio: migliore.doppio } : null;
}

/**
 * Trova la griglia del foglio. Restituisce null se non trova nulla di plausibile.
 *
 * Colonne: la serie periodica di linee verticali; se è più lunga dei giorni (colonna del mese
 * precedente a sinistra, totali a destra) si assume che la prima colonna sia quella del mese precedente.
 * Righe: la serie di linee orizzontali, poi la colonna dei nomi (celle unite) dà la fase e il numero
 * di medici. Se `righe` è noto, si prendono i primi `righe` medici del blocco.
 * Il risultato può comunque includere righe in testa o in coda estranee ai medici: l'interfaccia deve
 * mostrare la griglia e permettere `grigliaDaPunti`.
 */
export function trovaGriglia(img: ImmagineRGBA, opzioni: OpzioniGriglia): Griglia | null {
  const { width: W, height: H } = img;
  const g = grigio(img);
  const giorni = opzioni.giorni;
  if (giorni < 2 || W < 50 || H < 50) return null;

  // Colonne: pettine di giorni+1 linee; poi si guarda quante colonne in più continuano a sinistra
  // (colonna del mese precedente) e a destra (totali): se ce n'è una a sinistra, il giorno 1 è la seconda.
  const px = profilo(g, W, H, true, Math.floor(H * 0.05), Math.floor(H * 0.95));
  const grezza = cercaPettineFisso(px, (W / giorni) * 0.25, (W / giorni) * 1.05, giorni + 1);
  if (!grezza) return null;
  const fine = rifinisci(px, grezza.o, grezza.q, giorni + 1);
  const sinistra = estendi(px, fine.o, fine.q, giorni + 1, -1);
  const inizio = sinistra >= 1 ? fine.o - fine.q * (sinistra - 1) : fine.o;
  const cg = rifinisci(px, inizio, fine.q, giorni + 1);
  const x0 = cg.o;

  // Righe.
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(W, Math.ceil(x0 + cg.q * giorni));
  const py = profilo(g, W, H, false, xa, xb);
  const riga = cercaPettine(py, cg.q * 0.3, cg.q * 2.2, Math.max(0.3 * forzaLinee(py, 12), 0.08 * Math.max(...py)));
  if (!riga) return null;
  let y0 = riga.o;
  let doppio = riga.q < 0.85 * cg.q; // riserva se la colonna dei nomi non aiuta
  let righe = Math.floor((riga.n - 1) / (doppio ? 2 : 1));
  const pn = profilo(g, W, H, false, Math.max(0, Math.floor(x0 - 3.7 * cg.q)), Math.max(1, Math.floor(x0 - cg.q)));
  const blocco = bloccoMedici(pn, riga.o, riga.q, riga.n);
  if (blocco) {
    y0 = riga.o + riga.q * blocco.k0;
    righe = blocco.conta;
    doppio = blocco.doppio;
  }
  if (opzioni.righe && opzioni.righe <= righe) righe = opzioni.righe;
  if (righe < 1) return null;

  return {
    x0,
    y0,
    passoX: cg.q,
    passoMedico: doppio ? riga.q * 2 : riga.q,
    giorni,
    righe,
    affidabilita: Math.min(cg.contrasto, riga.contrasto),
  };
}

/**
 * Griglia da correzione manuale: `a` = angolo alto-sinistra della cella giorno 1 della prima riga,
 * `b` = angolo basso-destra dell'ultima cella (ultimo giorno, seconda sotto-riga dell'ultimo medico).
 */
export function grigliaDaPunti(a: Punto, b: Punto, giorni: number, righe: number): Griglia {
  return {
    x0: a.x,
    y0: a.y,
    passoX: (b.x - a.x) / giorni,
    passoMedico: (b.y - a.y) / righe,
    giorni,
    righe,
    affidabilita: 1,
  };
}
