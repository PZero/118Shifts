// Utilità sull'immagine: scala di grigi (con cache) e campionamento bilineare.

import type { ImmagineRGBA } from './tipi';

const cacheGrigio = new WeakMap<Uint8ClampedArray, Uint8Array>();

/** Scala di grigi a 8 bit (luminanza), calcolata una volta per immagine. */
export function grigio(img: ImmagineRGBA): Uint8Array {
  const gia = cacheGrigio.get(img.data);
  if (gia) return gia;
  const n = img.width * img.height;
  const g = new Uint8Array(n);
  const d = img.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    g[i] = (d[j]! * 77 + d[j + 1]! * 150 + d[j + 2]! * 29) >> 8;
  }
  cacheGrigio.set(img.data, g);
  return g;
}

/** Valore bilineare con coordinate limitate ai bordi. */
export function bilineare(g: Uint8Array, W: number, H: number, x: number, y: number): number {
  if (x < 0) x = 0;
  else if (x > W - 1.001) x = W - 1.001;
  if (y < 0) y = 0;
  else if (y > H - 1.001) y = H - 1.001;
  const x0 = x | 0;
  const y0 = y | 0;
  const tx = x - x0;
  const ty = y - y0;
  const i = y0 * W + x0;
  return (
    (g[i]! * (1 - tx) + g[i + 1]! * tx) * (1 - ty) + (g[i + W]! * (1 - tx) + g[i + W + 1]! * tx) * ty
  );
}
