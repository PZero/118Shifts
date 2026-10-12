// Modello OCR: esempi etichettati (codice + vettore), apprendimento e formato Firestore
// (`ocrModello/corrente`). Il vettore è quantizzato a byte e codificato in base64.

import { interpretaCodice, pulisciCodice } from '../codici';
import { CELLA_H, CELLA_N, CELLA_W } from './cella';
import type { EsempioOcr, ModelloOcr } from './tipi';

export const VERSIONE_MODELLO = 1;
/** Tetto di esempi per codice: oltre, sostituisce i più vecchi. */
export const MAX_ESEMPI_PER_CODICE = 30;
/** Tetto assoluto di esempi. */
export const MAX_ESEMPI = 3000;
/**
 * Un vettore occupa ~1300 caratteri in base64: il documento Firestore (limite 1 MiB) ne regge ~700.
 * Il tetto reale è questo budget di caratteri, non MAX_ESEMPI.
 */
export const MAX_CARATTERI_MODELLO = 900_000;
/** Lunghezza massima della stringa `v` di un esempio. */
export const MAX_CARATTERI_VETTORE = 2000;

export interface ModelloSerializzato {
  versione: number;
  cellaW: number;
  cellaH: number;
  esempi: { c: string; v: string }[];
}

export function modelloVuoto(): ModelloOcr {
  return { versione: VERSIONE_MODELLO, cellaW: CELLA_W, cellaH: CELLA_H, esempi: [] };
}

/** Forma canonica del codice di un esempio (stessa grammatica di codici.ts). */
export function codiceCanonico(codice: string): string {
  return interpretaCodice(codice)?.grezzo ?? pulisciCodice(codice);
}

function normalizza(v: ArrayLike<number>): Float32Array {
  const out = new Float32Array(v.length);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
}

function caratteriBase64(byte: number): number {
  return Math.ceil(byte / 3) * 4;
}

const CARATTERI_PER_ESEMPIO = caratteriBase64(CELLA_N);

function costo(e: EsempioOcr): number {
  return CARATTERI_PER_ESEMPIO + e.c.length + 16;
}

/** Applica i tetti (per codice, totale, budget del documento) eliminando i più vecchi. */
function limita(esempi: EsempioOcr[]): EsempioOcr[] {
  const out = esempi.slice();
  const conta = new Map<string, number>();
  for (const e of out) conta.set(e.c, (conta.get(e.c) ?? 0) + 1);
  // per codice: via i più vecchi
  for (let i = 0; i < out.length; ) {
    const n = conta.get(out[i]!.c)!;
    if (n > MAX_ESEMPI_PER_CODICE) {
      conta.set(out[i]!.c, n - 1);
      out.splice(i, 1);
    } else i++;
  }
  let totale = out.reduce((s, e) => s + costo(e), 0);
  // totale: via il più vecchio del codice più rappresentato
  while (out.length > MAX_ESEMPI || totale > MAX_CARATTERI_MODELLO) {
    let codice = '';
    let max = 0;
    for (const [c, n] of conta) {
      if (n > max) {
        max = n;
        codice = c;
      }
    }
    const idx = out.findIndex((e) => e.c === codice);
    if (idx < 0) break;
    totale -= costo(out[idx]!);
    out.splice(idx, 1);
    conta.set(codice, max - 1);
  }
  return out;
}

/**
 * Aggiunge un esempio confermato dall'utente. Restituisce un nuovo modello (l'originale non cambia).
 * Un esempio praticamente identico a uno già presente non viene aggiunto.
 */
export function apprendi(modello: ModelloOcr, vettore: Float32Array, codice: string): ModelloOcr {
  const c = codiceCanonico(codice);
  if (c === '' || vettore.length !== CELLA_N) return modello;
  const v = normalizza(vettore);
  for (const e of modello.esempi) {
    if (e.c !== c) continue;
    let d = 0;
    for (let i = 0; i < CELLA_N; i++) d += e.v[i]! * v[i]!;
    if (d > 0.9995) return modello;
  }
  return { ...modello, esempi: limita([...modello.esempi, { c, v }]) };
}

function aBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x2000) s += String.fromCharCode(...b.subarray(i, i + 0x2000));
  return btoa(s);
}

function daBase64(s: string): Uint8Array {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

/** Quantizza a byte rispetto al massimo del vettore (conserva la risoluzione anche se i valori sono piccoli). */
function quantizza(v: Float32Array): string {
  let max = 0;
  for (let i = 0; i < v.length; i++) if (v[i]! > max) max = v[i]!;
  const q = new Uint8Array(v.length);
  if (max > 0) for (let i = 0; i < v.length; i++) q[i] = Math.max(0, Math.round((v[i]! / max) * 255));
  return aBase64(q);
}

export function serializzaModello(modello: ModelloOcr): ModelloSerializzato {
  return {
    versione: modello.versione,
    cellaW: modello.cellaW,
    cellaH: modello.cellaH,
    esempi: limita(modello.esempi).map((e) => ({ c: e.c, v: quantizza(e.v) })),
  };
}

/** Legge un documento Firestore. Restituisce null se il formato non è riconosciuto; scarta gli esempi non validi. */
export function deserializzaModello(dato: unknown): ModelloOcr | null {
  if (typeof dato !== 'object' || dato === null) return null;
  const d = dato as Partial<ModelloSerializzato>;
  if (d.versione !== VERSIONE_MODELLO || d.cellaW !== CELLA_W || d.cellaH !== CELLA_H || !Array.isArray(d.esempi)) {
    return null;
  }
  const esempi: EsempioOcr[] = [];
  for (const e of d.esempi) {
    if (typeof e?.c !== 'string' || typeof e.v !== 'string' || e.c === '' || e.v.length > MAX_CARATTERI_VETTORE) continue;
    try {
      const b = daBase64(e.v);
      if (b.length !== CELLA_N) continue;
      esempi.push({ c: e.c, v: normalizza(b) });
    } catch {
      // base64 non valido: esempio scartato
    }
  }
  return { versione: VERSIONE_MODELLO, cellaW: CELLA_W, cellaH: CELLA_H, esempi };
}
