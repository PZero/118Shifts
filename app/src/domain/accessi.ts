// Ultimo accesso degli account: test "è di oggi" e testo relativo (fuso Europe/Rome). Logica pura.

const FUSO = 'Europe/Rome';

/** Giorno di calendario "aaaa-mm-gg" della data nel fuso di Roma. */
export function giornoRoma(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function giorniTra(giorno: string, oggi: string): number {
  const a = Date.UTC(+giorno.slice(0, 4), +giorno.slice(5, 7) - 1, +giorno.slice(8, 10));
  const b = Date.UTC(+oggi.slice(0, 4), +oggi.slice(5, 7) - 1, +oggi.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Vero se l'ultimo accesso registrato è già di oggi (Europe/Rome). */
export function accessoDiOggi(ultimo: Date | undefined, adesso: Date = new Date()): boolean {
  return !!ultimo && giornoRoma(ultimo) === giornoRoma(adesso);
}

/** Il più recente tra le date presenti. */
export function accessoPiuRecente(date: (Date | undefined)[]): Date | undefined {
  let max: Date | undefined;
  for (const d of date) if (d && (!max || d > max)) max = d;
  return max;
}

/** "oggi", "ieri", "N giorni fa" (fino a 6), poi gg/mm/aaaa; "mai" se manca. */
export function testoUltimoAccesso(ultimo: Date | undefined, adesso: Date = new Date()): string {
  if (!ultimo) return 'mai';
  const g = giornoRoma(ultimo);
  const n = giorniTra(g, giornoRoma(adesso));
  if (n <= 0) return 'oggi';
  if (n === 1) return 'ieri';
  if (n <= 6) return `${n} giorni fa`;
  return `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}`;
}
