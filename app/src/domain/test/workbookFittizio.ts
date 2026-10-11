// Workbook FITTIZIO per i test: nomi e turni inventati, nessun dato reale.
// Riproduce le stranezze del formato reale: colonna B = ultimo giorno del mese precedente,
// colonna C a volte vuota, nomi uniti su 2 righe, colonne totali dopo i giorni,
// righe vuote tra i medici, legenda in fondo, spazi non separabili, maiuscole/minuscole.

import * as XLSX from 'xlsx';
import { dataISO, giorniNelMese, giornoSettimana } from '../date';

const ABBR = ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'];
const NOMI_MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];

export interface MedicoFittizio {
  /** null = blocco unito senza nome */
  nome: string | null;
  /** [giorno, riga 0|1, valore] ; giorno 0 = colonna del mese precedente */
  celle: [number, 0 | 1, string | number][];
}

export interface SpecFoglio {
  nomeFoglio: string;
  anno: number;
  mese: number;
  colonnaVuotaDopoB?: boolean;
  /** Sovrascrive A1 (default: nome del mese). */
  a1?: string;
  medici: MedicoFittizio[];
  /** Aggiunge in fondo, dopo righe vuote, una legenda (celle non unite). */
  legenda?: boolean;
}

export function creaFoglio(spec: SpecFoglio): XLSX.WorkSheet {
  const n = giorniNelMese(spec.anno, spec.mese);
  const precAnno = spec.mese === 1 ? spec.anno - 1 : spec.anno;
  const precMese = spec.mese === 1 ? 12 : spec.mese - 1;
  const precGiorno = giorniNelMese(precAnno, precMese);

  // Colonne: A=0 nome, B=1 mese precedente, [C vuota], poi i giorni, poi vuota + totali.
  const primaColGiorno = spec.colonnaVuotaDopoB ? 3 : 2;
  const colGiorno = (g: number) => (g === 0 ? 1 : primaColGiorno + g - 1);
  const colTotali = primaColGiorno + n + 1;

  const aoa: (string | number | null)[][] = [];
  const r1: (string | number | null)[] = [spec.a1 ?? NOMI_MESI[spec.mese - 1]!];
  const r2: (string | number | null)[] = [spec.anno];
  r1[1] = ABBR[giornoSettimana(dataISO(precAnno, precMese, precGiorno))]!;
  r2[1] = precGiorno;
  for (let g = 1; g <= n; g++) {
    r1[colGiorno(g)] = ABBR[giornoSettimana(dataISO(spec.anno, spec.mese, g))]!;
    r2[colGiorno(g)] = g;
  }
  r1[colTotali] = 'TOTALE ORE ';
  r1[colTotali + 1] = 'CORSI';
  r1[colTotali + 2] = 'ALTRO';
  aoa.push(r1, r2);

  const merges: XLSX.Range[] = [];
  for (const m of spec.medici) {
    const r = aoa.length;
    const righe: (string | number | null)[][] = [[m.nome], [null]];
    for (const [g, riga, v] of m.celle) righe[riga]![colGiorno(g)] = v;
    righe[0]![colTotali] = 150; // totale Excel: deve essere ignorato
    righe[0]![colTotali + 1] = 6;
    aoa.push(...righe);
    merges.push({ s: { r, c: 0 }, e: { r: r + 1, c: 0 } });
  }

  if (spec.legenda) {
    aoa.push([], [], [], []);
    aoa.push(['LEGENDA'], ['F = FERIE', null, 'F'], ['f = MALATTIA'], [null, null, 'M1', 'colore = gettone']);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  return ws;
}

/** Il workbook di riferimento usato dai test. */
export function workbookFittizio(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // OTTOBRE 2026: B = 30 settembre, giorni da C.
  XLSX.utils.book_append_sheet(
    wb,
    creaFoglio({
      nomeFoglio: 'OTTOBRE 26',
      anno: 2026,
      mese: 10,
      legenda: true,
      medici: [
        {
          nome: 'Rossi Mario',
          celle: [
            [0, 0, 'N2'], // notte del 30/9 → 8 h in ottobre
            [1, 0, 'P3'],
            [2, 0, 'M3'],
            [3, 0, 'N3'],
            [6, 0, 'MC'],
            [6, 1, 'PC'],
            [10, 0, 'F'],
            [31, 0, 'N1 att'], // notte del 31: 4 h in ottobre
          ],
        },
        {
          nome: 'Di Bello',
          celle: [
            [1, 0, 'f'],
            [2, 0, 'F '],
            [3, 0, '\u00A0m5\u00A0'],
            [4, 0, 'laurea'],
            [5, 0, 'PC16,30'],
            [7, 0, '-'],
            [8, 0, 'Q'],
            [9, 0, 274],
          ],
        },
        { nome: null, celle: [] },
        { nome: null, celle: [[12, 0, 'M4']] },
        {
          nome: 'Bianchi\u00A0 Anna ',
          celle: [
            [17, 0, 'P1'],
            [18, 0, 'M1'],
            [19, 0, 'N1'],
          ],
        },
        { nome: 'Verdi', celle: [] },
      ],
    }),
    'OTTOBRE 26',
  );

  // NOVEMBRE 2026: nome con spazi in più, colonna C vuota, nome duplicato, alias.
  XLSX.utils.book_append_sheet(
    wb,
    creaFoglio({
      nomeFoglio: ' NOVEMBRE  26 ',
      anno: 2026,
      mese: 11,
      colonnaVuotaDopoB: true,
      a1: 'NOVEMBRE ',
      legenda: true,
      medici: [
        { nome: 'Rossi  Mario', celle: [[0, 0, 'N1att'], [1, 0, 'Re'], [2, 1, 'NCAT']] },
        { nome: 'Dibello', celle: [[0, 0, 'Q'], [30, 0, 'P7']] }, // incoerente: in ottobre il 31 è vuoto
        { nome: 'Neri', celle: [[1, 0, 'M2']] },
        { nome: 'NERI', celle: [[2, 0, 'P2']] },
      ],
    }),
    ' NOVEMBRE  26 ',
  );

  // Foglio non riconosciuto.
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Riepilogo annuale'], ['qualcosa']]), 'Riepilogo');

  return wb;
}

/** Il workbook serializzato in .xlsx e riletto (come farebbe il browser). */
export function workbookFittizioXlsx(): Uint8Array {
  return new Uint8Array(XLSX.write(workbookFittizio(), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
