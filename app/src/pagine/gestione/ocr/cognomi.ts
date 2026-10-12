// Lettura dei cognomi con tesseract.js, solo nel browser. Il modulo si carica a richiesta (import dinamico)
// e i file (worker, core WASM, dati della lingua) sono serviti dallo stesso dominio da /ocr-tesseract/
// (copiati da scripts/copia-ocr.mjs): nessuna richiesta a CDN esterne, nessun dato esce dal dispositivo.
import type { ImmagineRGBA } from '../../../domain/ocr';

const BASE = '/ocr-tesseract/';
const LETTERE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '";

function aCanvas(img: ImmagineRGBA): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const copia = new Uint8ClampedArray(img.data);
  c.getContext('2d')!.putImageData(new ImageData(copia, img.width, img.height), 0, 0);
  return c;
}

/** Toglie i segni spuri (bordi di cella letti come "l" o "I" isolate) e gli spazi in eccesso. */
export function pulisciTesto(t: string): string {
  return t
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .join(' ')
    .trim();
}

/** Legge il testo di ogni ritaglio (riga singola). Una voce è '' se la lettura fallisce. */
export async function leggiCognomi(ritagli: ImmagineRGBA[], progresso: (fatti: number, totale: number) => void): Promise<string[]> {
  const { createWorker, PSM } = await import('tesseract.js');
  const origine = location.origin + BASE;
  const worker = await createWorker('eng', 1, {
    workerPath: origine + 'worker.min.js',
    corePath: origine + 'tesseract-core-lstm.wasm.js',
    langPath: origine,
    workerBlobURL: false,
    gzip: true,
    cacheMethod: 'none',
  });
  try {
    await worker.setParameters({ tessedit_char_whitelist: LETTERE, tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const out: string[] = [];
    for (let i = 0; i < ritagli.length; i++) {
      try {
        const r = await worker.recognize(aCanvas(ritagli[i]!));
        out.push(pulisciTesto(r.data.text));
      } catch {
        out.push('');
      }
      progresso(i + 1, ritagli.length);
    }
    return out;
  } finally {
    await worker.terminate();
  }
}
