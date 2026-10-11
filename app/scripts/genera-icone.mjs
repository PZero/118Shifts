// Genera tutte le icone della PWA da un'unica sorgente: assets/icona.svg.
// Uso: npm run icone   (i file prodotti in public/ vanno nel repository)
//
// Varianti:
// - "standard": sfondo con angoli arrotondati (favicon, icone 192/512 "any");
// - "piena":    sfondo a tutto campo, simbolo ridotto nell'area sicura
//               (apple-touch-icon 180 senza trasparenza, maskable 512).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = await readFile(resolve(radice, 'assets/icona.svg'), 'utf8');
const pubblica = resolve(radice, 'public');
await mkdir(pubblica, { recursive: true });

/** Sfondo senza angoli arrotondati e simbolo scalato attorno al centro. */
function variantePiena(svg, scala) {
  const out = svg
    .replace(/(<rect id="sfondo"[^>]*?)\srx="\d+"/, '$1 rx="0"')
    .replace('<g id="simbolo">', `<g id="simbolo" transform="translate(256 256) scale(${scala}) translate(-256 -256)">`);
  if (out === svg) throw new Error('assets/icona.svg: id "sfondo"/"simbolo" non trovati');
  return out;
}

function png(svg, lato) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: lato } }).render().asPng();
}

/** File .ico con immagini PNG incorporate (formato supportato da tutti i browser attuali). */
function ico(immagini) {
  const testata = Buffer.alloc(6);
  testata.writeUInt16LE(0, 0);
  testata.writeUInt16LE(1, 2);
  testata.writeUInt16LE(immagini.length, 4);
  const voci = [];
  let offset = 6 + 16 * immagini.length;
  for (const { lato, dati } of immagini) {
    const v = Buffer.alloc(16);
    v.writeUInt8(lato >= 256 ? 0 : lato, 0);
    v.writeUInt8(lato >= 256 ? 0 : lato, 1);
    v.writeUInt16LE(1, 4); // piani
    v.writeUInt16LE(32, 6); // bit per pixel
    v.writeUInt32LE(dati.length, 8);
    v.writeUInt32LE(offset, 12);
    offset += dati.length;
    voci.push(v);
  }
  return Buffer.concat([testata, ...voci, ...immagini.map((i) => i.dati)]);
}

const piena = variantePiena(sorgente, 0.86);
const maskable = variantePiena(sorgente, 0.74);

const file = {
  'favicon.svg': Buffer.from(sorgente),
  'favicon.ico': ico([16, 32, 48].map((lato) => ({ lato, dati: png(sorgente, lato) }))),
  'icona-192.png': png(sorgente, 192),
  'icona-512.png': png(sorgente, 512),
  'icona-maskable-512.png': png(maskable, 512),
  'apple-touch-icon.png': png(piena, 180),
};

for (const [nome, dati] of Object.entries(file)) {
  await writeFile(resolve(pubblica, nome), dati);
  console.log(`public/${nome}  ${dati.length} byte`);
}
