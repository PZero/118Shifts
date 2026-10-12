// Colonna dei cognomi: ritaglio da dare al riconoscimento del testo (lo fa l'interfaccia)
// e abbinamento approssimato all'anagrafica.

import { abbinaNome, distanza, normalizzaNome, type Medico } from '../anagrafica';
import { bilineare, grigio } from './immagine';
import type { Griglia, ImmagineRGBA, Rettangolo } from './tipi';

export interface OpzioniNomi {
  /** Inizio della colonna nomi, in larghezze di colonna a sinistra della cella giorno 1 (default 3,7). */
  da?: number;
  /** Fine, idem (default 0,95). */
  a?: number;
  /** Margine verticale come frazione dell'altezza del medico (default 0,18). */
  margineY?: number;
}

/** Rettangolo (px dell'immagine) del cognome del medico `riga` (0-based). */
export function rettangoloNome(g: Griglia, riga: number, o: OpzioniNomi = {}): Rettangolo {
  const x0 = Math.max(0, g.x0 - (o.da ?? 3.7) * g.passoX);
  const x1 = g.x0 - (o.a ?? 0.95) * g.passoX;
  const m = (o.margineY ?? 0.18) * g.passoMedico;
  return { x: x0, y: g.y0 + g.passoMedico * riga + m, w: Math.max(1, x1 - x0), h: Math.max(1, g.passoMedico - 2 * m) };
}

/**
 * Ritaglio pronto per il riconoscimento del testo: scala di grigi con sfondo sottratto e
 * contrasto normalizzato (testo scuro su bianco), ingrandito `scala` volte.
 */
export function preparaRitaglioNome(img: ImmagineRGBA, r: Rettangolo, scala = 4): ImmagineRGBA {
  const { width: W, height: H } = img;
  const g = grigio(img);
  const w = Math.max(1, Math.round(r.w * scala));
  const h = Math.max(1, Math.round(r.h * scala));
  const campioni = new Float32Array(w * h);
  const ist = new Int32Array(256);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = bilineare(g, W, H, r.x + x / scala, r.y + y / scala);
      campioni[y * w + x] = v;
      ist[Math.min(255, Math.max(0, Math.round(v)))]!++;
    }
  }
  const perc = (p: number): number => {
    const t = Math.floor(p * (w * h - 1));
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += ist[i]!;
      if (acc > t) return i;
    }
    return 255;
  };
  const bg = perc(0.7);
  const lo = perc(0.01);
  const ref = Math.max(bg - lo, 60);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const inchiostro = Math.min(1, Math.max(0, (bg - campioni[i]!) / ref));
    const s = 255 - Math.round(255 * inchiostro);
    data[i * 4] = s;
    data[i * 4 + 1] = s;
    data[i * 4 + 2] = s;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

export type EsitoCognome =
  | { tipo: 'esatto'; medico: Medico }
  | { tipo: 'approssimato'; medico: Medico; distanza: number; margine: number }
  | { tipo: 'nessuno' };

export const DISTANZA_MAX = 2;
export const MARGINE_MIN = 1;

/**
 * Abbina il testo letto a un medico: prima il confronto esatto (nome o alias, come per l'Excel),
 * poi Levenshtein sui nomi normalizzati con distanza <= 2 e almeno 1 di scarto dal secondo medico.
 * Se il testo è ambiguo o lontano, nessun abbinamento (decide l'utente).
 */
export function abbinaCognome(testo: string, medici: readonly Medico[]): EsitoCognome {
  const chiave = normalizzaNome(testo);
  if (chiave.length < 3) return { tipo: 'nessuno' };
  const esatto = abbinaNome(testo, medici);
  if (esatto.tipo === 'nome' || esatto.tipo === 'alias') return { tipo: 'esatto', medico: esatto.medico };
  if (esatto.tipo === 'ambiguo') return { tipo: 'nessuno' };

  // Distanza minima per medico (nome e alias); una distanza pari o oltre metà della lunghezza non conta.
  const punteggi: { medico: Medico; d: number }[] = [];
  for (const m of medici) {
    let d = Infinity;
    for (const n of [m.nome, ...m.alias]) {
      const k = normalizzaNome(n);
      if (k === '') continue;
      const dd = distanza(chiave, k);
      if (dd < d && dd < Math.min(k.length, chiave.length) / 2) d = dd;
    }
    punteggi.push({ medico: m, d });
  }
  punteggi.sort((a, b) => a.d - b.d);
  const primo = punteggi[0];
  if (!primo || primo.d > DISTANZA_MAX) return { tipo: 'nessuno' };
  const secondo = punteggi[1]?.d ?? Infinity;
  const margine = secondo - primo.d;
  if (margine < MARGINE_MIN) return { tipo: 'nessuno' };
  return { tipo: 'approssimato', medico: primo.medico, distanza: primo.d, margine: Number.isFinite(margine) ? margine : 99 };
}
