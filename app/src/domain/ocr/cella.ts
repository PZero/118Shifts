// Estrazione del vettore di una cella: ritaglio campionato a 2x, sfondo sottratto, inchiostro normalizzato.
// Le misure del prototipo sono riferite a una colonna di 24,25 px e a una sotto-riga di 13,855 px:
// qui sono espresse come frazioni della cella, così la logica non dipende dalla risoluzione.

import { bilineare, grigio } from './immagine';
import type { CellaEstratta, Griglia, ImmagineRGBA, Rettangolo } from './tipi';

export const CELLA_W = 44;
export const CELLA_H = 22;
export const CELLA_N = CELLA_W * CELLA_H;
/** Sotto la quale (campioni "molto scuri" nell'area interna) la cella è vuota. */
export const SOGLIA_INCHIOSTRO = 20;

const RIF_X = 24.25;
const RIF_Y = 13.855;
/** Finestra campionata: 22 x 11 px di riferimento, a partire da (+1; +2) dalle linee misurate dalla ricerca della griglia. */
const FIN_X0 = 1 / RIF_X;
const FIN_Y0 = 2 / RIF_Y;
const FIN_W = 22 / RIF_X;
const FIN_H = 11 / RIF_Y;
/** Traslazioni di tolleranza, in pixel di riferimento. */
const TRASLAZIONI = [-1, -0.5, 0, 0.5, 1];
export const N_VARIANTI = TRASLAZIONI.length * TRASLAZIONI.length;
/** Indice della variante senza traslazione. */
export const VARIANTE_CENTRALE = 12;

/** Rettangolo (in pixel dell'immagine) di una cella; serve all'interfaccia per il ritaglio. */
export function rettangoloCella(g: Griglia, rigaMedico: number, sottoRiga: 0 | 1, giorno: number): Rettangolo {
  const h = g.passoMedico / 2;
  return {
    x: g.x0 + g.passoX * (giorno - 1),
    y: g.y0 + g.passoMedico * rigaMedico + h * sottoRiga,
    w: g.passoX,
    h,
  };
}

const istogramma = new Int32Array(256);

function percentileIst(n: number, p: number): number {
  const target = Math.floor(p * (n - 1));
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += istogramma[i]!;
    if (acc > target) return i;
  }
  return 255;
}

/** Campiona la finestra, calcola l'inchiostro, normalizza in place. Restituisce i campioni molto scuri. */
function inchiostroNormalizzato(grey: Float32Array, out: Float32Array): number {
  istogramma.fill(0);
  for (let i = 0; i < CELLA_N; i++) istogramma[Math.min(255, Math.max(0, Math.round(grey[i]!)))]!++;
  const bg = percentileIst(CELLA_N, 0.7);
  const lo = percentileIst(CELLA_N, 0.02);
  const ref = Math.max(bg - lo, 60);
  let grandi = 0;
  let somma = 0;
  for (let y = 0; y < CELLA_H; y++) {
    const bordoY = y < 1 || y >= CELLA_H - 1;
    const internoY = y >= 2 && y < CELLA_H - 2;
    for (let x = 0; x < CELLA_W; x++) {
      const i = y * CELLA_W + x;
      if (bordoY || x < 1 || x >= CELLA_W - 1) {
        out[i] = 0;
        continue;
      }
      const d = bg - grey[i]!;
      const v = d > 0 ? d / ref : 0;
      out[i] = v;
      somma += v * v;
      if (internoY && x >= 2 && x < CELLA_W - 2 && d > 45) grandi++;
    }
  }
  const norma = Math.sqrt(somma) || 1;
  for (let i = 0; i < CELLA_N; i++) out[i]! /= norma;
  return grandi;
}

function campiona(img: ImmagineRGBA, g: Uint8Array, ox: number, oy: number, px: number, py: number, out: Float32Array): void {
  const { width: W, height: H } = img;
  for (let y = 0; y < CELLA_H; y++) {
    const yy = oy + py * y;
    for (let x = 0; x < CELLA_W; x++) out[y * CELLA_W + x] = bilineare(g, W, H, ox + px * x, yy);
  }
}

export interface OpzioniCella {
  /** Calcola anche le varianti traslate (default true; saltate comunque per le celle vuote). */
  varianti?: boolean;
}

/** Estrae una cella: vettore normalizzato, varianti traslate, misura dell'inchiostro. */
export function estraiCella(
  img: ImmagineRGBA,
  g: Griglia,
  rigaMedico: number,
  sottoRiga: 0 | 1,
  giorno: number,
  opzioni: OpzioniCella = {},
): CellaEstratta {
  const grey = grigio(img);
  const r = rettangoloCella(g, rigaMedico, sottoRiga, giorno);
  const px = (r.w * FIN_W) / CELLA_W;
  const py = (r.h * FIN_H) / CELLA_H;
  const ox0 = r.x + r.w * FIN_X0;
  const oy0 = r.y + r.h * FIN_Y0;
  const tmp = new Float32Array(CELLA_N);
  const centrale = new Float32Array(CELLA_N);
  campiona(img, grey, ox0, oy0, px, py, tmp);
  const inchiostro = inchiostroNormalizzato(tmp, centrale);
  const vuota = inchiostro < SOGLIA_INCHIOSTRO;
  const varianti: Float32Array[] = [];
  if (!vuota && opzioni.varianti !== false) {
    const sx = r.w / RIF_X;
    const sy = r.h / RIF_Y;
    for (const dx of TRASLAZIONI) {
      for (const dy of TRASLAZIONI) {
        if (dx === 0 && dy === 0) {
          varianti.push(centrale);
          continue;
        }
        const v = new Float32Array(CELLA_N);
        campiona(img, grey, ox0 + dx * sx, oy0 + dy * sy, px, py, tmp);
        inchiostroNormalizzato(tmp, v);
        varianti.push(v);
      }
    }
  }
  return { vettore: centrale, varianti, inchiostro, vuota };
}
