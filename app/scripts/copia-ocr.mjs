// Copia in public/ocr-tesseract/ i file di tesseract.js (worker, core WASM, dati della lingua)
// per servirli dallo stesso dominio dell'app: nessuna richiesta a CDN esterne durante la lettura
// dei nomi dagli screenshot. La cartella e' generata (esclusa da git) e fuori dal precache della PWA.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(radice, 'public', 'ocr-tesseract');
const file = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];
mkdirSync(dest, { recursive: true });
for (const [da, a] of file) {
  const src = join(radice, da);
  if (!existsSync(src)) {
    console.warn(`[ocr] file mancante: ${da} (esegui npm install)`);
    continue;
  }
  copyFileSync(src, join(dest, a));
}
