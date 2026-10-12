// Immagine di prova per la demo (SOLO sviluppo): foglio turni disegnato su un canvas con nomi e codici
// inventati. Non deriva da nessuno screenshot reale.
import {
  apprendi,
  estraiCella,
  modelloVuoto,
  type Griglia,
  type ImmagineRGBA,
  type ModelloOcr,
} from '../../../domain/ocr';

const PX = 24;
const PM = 28;
const X0 = 110;
const Y0 = 56;
const CODICI = ['M1', 'P2', 'N3', 'M6', 'P4', 'F', 'Q', 'RN', 'C', 'M2', 'N1'];
/** Codici che il modello di prova non conosce: le celle corrispondenti risultano incerte. */
const NON_INSEGNATI = new Set(['RN', 'C', 'N1', 'M6']);
const COGNOMI = ['Rossi', 'Bianchi', 'Verdi', 'Neri', 'Gialli', 'Blu'];

export interface ProvaSintetica {
  canvas: HTMLCanvasElement;
  giorni: number;
  anno: number;
  mese: number;
  griglia: Griglia;
  /** codici[medico][sottoRiga][giorno-1] */
  codici: string[][][];
}

export function generaProva(anno: number, mese: number, giorni: number): ProvaSintetica {
  const righe = COGNOMI.length;
  const W = X0 + PX * (giorni + 2) + 16;
  const H = Y0 + PM * righe + 24;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1;
  const linea = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    ctx.stroke();
  };
  for (let k = -1; k <= giorni + 1; k++) linea(X0 + PX * k, Y0, X0 + PX * k, Y0 + PM * righe);
  for (let i = 0; i <= righe; i++) linea(10, Y0 + PM * i, X0 + PX * (giorni + 1), Y0 + PM * i);
  ctx.fillStyle = '#222222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 10px Arial, sans-serif';
  for (let d = 1; d <= giorni; d++) ctx.fillText(String(d), X0 + PX * (d - 0.5), Y0 - 14);
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px Arial, sans-serif';
  COGNOMI.forEach((c, r) => ctx.fillText(c, 18, Y0 + PM * r + PM / 2));
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px Arial, sans-serif';
  const codici: string[][][] = COGNOMI.map((_, r) =>
    [0, 1].map((s) =>
      Array.from({ length: giorni }, (_, d) => ((d + r) % 4 === 3 || (s === 1 && (d + 2 * r) % 3 !== 0) ? '' : CODICI[(d * 3 + r * 5 + s * 7) % CODICI.length]!)),
    ),
  );
  codici.forEach((sotto, r) =>
    sotto.forEach((gg, s) =>
      gg.forEach((c, d) => {
        if (c) ctx.fillText(c, X0 + PX * (d + 0.5), Y0 + PM * r + 14 * s + 7.5);
      }),
    ),
  );
  const griglia: Griglia = { x0: X0, y0: Y0, passoX: PX, passoMedico: PM, giorni, righe, affidabilita: 1 };
  return { canvas, giorni, anno, mese, griglia, codici };
}

/**
 * Modello iniziale per la demo, addestrato solo sulle prime due righe e senza alcuni codici:
 * parte delle celle risulterà incerta e permettono di provare la revisione.
 */
export function modelloProva(p: ProvaSintetica): ModelloOcr {
  const dati = p.canvas.getContext('2d')!.getImageData(0, 0, p.canvas.width, p.canvas.height);
  const img: ImmagineRGBA = { width: dati.width, height: dati.height, data: dati.data };
  let m = modelloVuoto();
  for (let r = 0; r < 2; r++) {
    p.codici[r]!.forEach((gg, s) =>
      gg.forEach((codice, d) => {
        if (!codice || NON_INSEGNATI.has(codice)) return;
        m = apprendi(m, estraiCella(img, p.griglia, r, s as 0 | 1, d + 1, { varianti: false }).vettore, codice);
      }),
    );
  }
  return m;
}
