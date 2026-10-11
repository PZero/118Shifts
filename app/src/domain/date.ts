// Utilità sulle date senza fuso orario: si lavora solo con anno/mese/giorno
// (calcoli in UTC), così i risultati non cambiano con l'ora legale o il fuso del dispositivo.

/** Data in formato "aaaa-mm-gg". */
export type DataISO = string;

export interface AnnoMese {
  anno: number;
  /** 1..12 */
  mese: number;
}

export function giorniNelMese(anno: number, mese: number): number {
  return new Date(Date.UTC(anno, mese, 0)).getUTCDate();
}

export function dataISO(anno: number, mese: number, giorno: number): DataISO {
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  const a = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const g = String(d.getUTCDate()).padStart(2, '0');
  return `${a}-${m}-${g}`;
}

export function scomponi(data: DataISO): { anno: number; mese: number; giorno: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) throw new Error(`Data non valida: ${data}`);
  return { anno: Number(m[1]), mese: Number(m[2]), giorno: Number(m[3]) };
}

function giornoAssoluto(data: DataISO): number {
  const { anno, mese, giorno } = scomponi(data);
  return Math.round(Date.UTC(anno, mese - 1, giorno) / 86_400_000);
}

export function aggiungiGiorni(data: DataISO, n: number): DataISO {
  const { anno, mese, giorno } = scomponi(data);
  return dataISO(anno, mese, giorno + n);
}

/** Giorni da `a` a `b` (positivo se b è dopo a). */
export function differenzaGiorni(a: DataISO, b: DataISO): number {
  return giornoAssoluto(b) - giornoAssoluto(a);
}

/** 0 = domenica … 6 = sabato. */
export function giornoSettimana(data: DataISO): number {
  const { anno, mese, giorno } = scomponi(data);
  return new Date(Date.UTC(anno, mese - 1, giorno)).getUTCDay();
}

export function aggiungiMesi(am: AnnoMese, n: number): AnnoMese {
  const indice = am.anno * 12 + (am.mese - 1) + n;
  return { anno: Math.floor(indice / 12), mese: (indice % 12) + 1 };
}

export function chiaveMese(am: AnnoMese): string {
  return `${am.anno}-${String(am.mese).padStart(2, '0')}`;
}

export function confrontaMesi(a: AnnoMese, b: AnnoMese): number {
  return a.anno * 12 + a.mese - (b.anno * 12 + b.mese);
}
