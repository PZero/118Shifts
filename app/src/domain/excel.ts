// Parser dell'Excel dei turni (un foglio per mese). Vedi docs/REQUISITI.md, "Formato dell'Excel".
//
// SheetJS: si usa la build ufficiale dal CDN SheetJS (xlsx 0.20.3), non il pacchetto `xlsx`
// del registro npm, fermo alla 0.18.5 e affetto da vulnerabilità note
// (CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS), corrette solo nelle build del CDN.
//
// Scelte:
// - I giorni si trovano dai numeri della riga 2 (mai per posizione): si parte dalla colonna
//   che contiene 1 e si prosegue con 2, 3, … saltando le colonne vuote, fino all'ultimo giorno
//   del mese. Tutto ciò che segue (colonne totali AH+) è ignorato.
// - La colonna del mese precedente (B, il numero prima dell'1) NON viene attribuita al mese
//   precedente: la fonte di quel mese è il suo foglio. I codici sono restituiti a parte in
//   `giornoPrecedente`: servono come riserva per le ore della notte a cavallo (8 h nel mese
//   corrente) se il mese precedente non è caricato, e per un controllo di coerenza tra fogli.
// - Un medico = blocco di righe con la cella del nome unita in colonna A (di norma 2 righe).
//   La legenda in fondo non ha celle unite in A ed è quindi ignorata.

import * as XLSX from 'xlsx';
import { interpretaCodice } from './codici';
import { abbinaNome, normalizzaNome, pulisciNome, type Medico } from './anagrafica';
import { aggiungiMesi, chiaveMese, giorniNelMese, giornoSettimana, dataISO } from './date';

export interface MedicoFoglio {
  /** Nome come appare nell'Excel (spazi normalizzati). */
  nome: string;
  /** Riga Excel (1-based) della prima riga del medico. */
  riga: number;
  /** Codici normalizzati per giorno del mese: { "1": ["MC", "PC"], ... } (max 2). Giorni senza codici assenti. */
  giorni: Record<string, string[]>;
  /** Codici della colonna "ultimo giorno del mese precedente" (vedi nota in testa). */
  giornoPrecedente: string[];
}

export interface FoglioMese {
  foglio: string;
  anno: number;
  /** 1..12 */
  mese: number;
  /** Numero di colonne-giorno trovate (atteso: giorni del mese). */
  giorniTrovati: number;
  medici: MedicoFoglio[];
}

export type TipoAvviso =
  | 'codice-da-controllare'
  | 'righe-senza-nome'
  | 'incoerenza-mese-precedente'
  | 'nome-non-abbinato'
  | 'nome-ambiguo'
  | 'nome-duplicato'
  | 'foglio-non-riconosciuto'
  | 'mese-duplicato'
  | 'intestazione-incoerente'
  | 'giorni-anomali'
  | 'nome-non-unito'
  | 'troppe-righe'
  | 'senza-celle-unite';

/**
 * Gruppi di avvisi per l'anteprima di import in UI:
 * - codici: codici non riconosciuti ("da controllare"), con foglio, medico, giorno;
 * - senza-nome: righe con turni ma senza nome del medico;
 * - mese-precedente: colonna B incoerente con l'ultimo giorno del foglio precedente;
 * - anagrafica: nomi non abbinati (o ambigui) all'anagrafica, da `avvisiAbbinamento`;
 * - formato: tutto il resto (fogli, intestazioni, celle unite, duplicati).
 */
export type CategoriaAvviso = 'codici' | 'senza-nome' | 'mese-precedente' | 'anagrafica' | 'formato';

export const CATEGORIE_AVVISO: readonly CategoriaAvviso[] = ['codici', 'senza-nome', 'mese-precedente', 'anagrafica', 'formato'];

export function categoriaAvviso(tipo: TipoAvviso): CategoriaAvviso {
  switch (tipo) {
    case 'codice-da-controllare':
      return 'codici';
    case 'righe-senza-nome':
      return 'senza-nome';
    case 'incoerenza-mese-precedente':
      return 'mese-precedente';
    case 'nome-non-abbinato':
    case 'nome-ambiguo':
      return 'anagrafica';
    default:
      return 'formato';
  }
}

export interface AvvisoImport {
  tipo: TipoAvviso;
  /** Derivata da `tipo` (vedi `categoriaAvviso`), per raggruppare in UI. */
  categoria: CategoriaAvviso;
  messaggio: string;
  /** Nome del foglio così com'è nel file. */
  foglio: string;
  /** Riga Excel (1-based): la cella del codice, o la prima riga del medico. */
  riga?: number;
  /** Giorno del mese del foglio (1..31), per gli avvisi su una cella-giorno. */
  giorno?: number;
  /** Nome del medico come appare nell'Excel. */
  medico?: string;
  /** Indirizzo Excel, es. "D7" o "A9:A10". */
  cella?: string;
  /** Valore originale della cella (codici da controllare). */
  valore?: string;
  /** Nomi dell'anagrafica proposti (avvisi di abbinamento). */
  suggerimenti?: string[];
}

/** @deprecated usare AvvisoImport */
export type Avviso = AvvisoImport;

type NuovoAvviso = Omit<AvvisoImport, 'categoria'>;

function crea(a: NuovoAvviso): AvvisoImport {
  return { ...a, categoria: categoriaAvviso(a.tipo) };
}

/** Avvisi raggruppati per categoria (tutte le chiavi presenti, anche vuote), ordine originale. */
export function raggruppaAvvisi(avvisi: readonly AvvisoImport[]): Record<CategoriaAvviso, AvvisoImport[]> {
  const out = Object.fromEntries(CATEGORIE_AVVISO.map((c) => [c, [] as AvvisoImport[]])) as Record<CategoriaAvviso, AvvisoImport[]>;
  for (const a of avvisi) out[a.categoria].push(a);
  return out;
}

export interface RisultatoImport {
  mesi: FoglioMese[];
  avvisi: AvvisoImport[];
}

const MESI: Record<string, number> = {
  GENNAIO: 1, FEBBRAIO: 2, MARZO: 3, APRILE: 4, MAGGIO: 5, GIUGNO: 6,
  LUGLIO: 7, AGOSTO: 8, SETTEMBRE: 9, OTTOBRE: 10, NOVEMBRE: 11, DICEMBRE: 12,
};

/** Abbreviazioni della riga 1 → giorno della settimana (0 = domenica). */
const SETTIMANA: Record<string, number> = { DO: 0, LU: 1, MA: 2, ME: 3, GI: 4, VE: 5, SA: 6 };

function testo(v: unknown): string {
  return pulisciNome(v).toUpperCase();
}

function anno(v: number): number {
  return v < 100 ? 2000 + v : v;
}

/** "OTTOBRE 26", " ottobre  2026 " → { anno: 2026, mese: 10 } */
export function meseDaNomeFoglio(nome: string): { anno: number; mese: number } | null {
  const m = /^([A-Z]+)\s*(\d{2}|\d{4})$/.exec(testo(nome));
  if (!m) return null;
  const mese = MESI[m[1]!];
  if (!mese) return null;
  return { anno: anno(Number(m[2])), mese };
}

function cella(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
}

function valore(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return cella(ws, r, c)?.v;
}

function intero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\s*\d{1,4}\s*$/.test(v)) return Number(v);
  return null;
}

interface Colonne {
  /** colonna (0-based) per ogni giorno 1..n */
  giorni: { giorno: number; col: number }[];
  precedente: number | null;
}

function trovaColonne(ws: XLSX.WorkSheet, ultimaCol: number, maxGiorni: number): Colonne {
  const giorni: Colonne['giorni'] = [];
  let precedente: number | null = null;
  for (let c = 1; c <= ultimaCol; c++) {
    const n = intero(valore(ws, 1, c));
    if (giorni.length === 0) {
      if (n === 1) giorni.push({ giorno: 1, col: c });
      else if (n !== null && n >= 28 && n <= 31) precedente = c;
      continue;
    }
    if (n === null) continue; // colonna vuota in mezzo
    if (n === giorni.length + 1 && n <= maxGiorni) giorni.push({ giorno: n, col: c });
    else break;
    if (giorni.length === maxGiorni) break;
  }
  return { giorni, precedente };
}

interface Blocco {
  r0: number; // 0-based
  r1: number; // inclusa
}

function blocchiMedici(ws: XLSX.WorkSheet, ultimaRiga: number): { blocchi: Blocco[]; unite: boolean } {
  const unite = (ws['!merges'] ?? []).filter((m) => m.s.c === 0 && m.s.r >= 2 && m.e.r > m.s.r);
  if (unite.length > 0) {
    return { blocchi: unite.map((m) => ({ r0: m.s.r, r1: m.e.r })).sort((a, b) => a.r0 - b.r0), unite: true };
  }
  // Riserva: niente celle unite → nome in A seguito da una riga con A vuota.
  // Si scartano i testi che sembrano voci di legenda: un codice noto ("F", "f", "-", …)
  // o un testo con "=" o "/" (es. "Q/MR/PR").
  const blocchi: Blocco[] = [];
  for (let r = 2; r <= ultimaRiga; r++) {
    const a = pulisciNome(valore(ws, r, 0));
    if (a === '' || /[=/]/.test(a) || (interpretaCodice(a)?.categoria ?? 'sconosciuto') !== 'sconosciuto') continue;
    const r1 = r + 1 <= ultimaRiga && pulisciNome(valore(ws, r + 1, 0)) === '' ? r + 1 : r;
    blocchi.push({ r0: r, r1 });
    r = r1;
  }
  return { blocchi, unite: false };
}

function leggiFoglio(ws: XLSX.WorkSheet, nomeFoglio: string, avvisi: AvvisoImport[]): FoglioMese | null {
  const avvisa = (a: Omit<NuovoAvviso, 'foglio'>) => avvisi.push(crea({ foglio: nomeFoglio, ...a }));

  // Mese e anno: dal nome del foglio, con controllo su A1 (mese) e A2 (anno).
  const daNome = meseDaNomeFoglio(nomeFoglio);
  const meseA1 = MESI[testo(valore(ws, 0, 0))];
  const annoA2 = intero(valore(ws, 1, 0));
  const daCelle = meseA1 && annoA2 ? { mese: meseA1, anno: anno(annoA2) } : null;
  const am = daNome ?? daCelle;
  if (!am || !ws['!ref']) {
    avvisa({ tipo: 'foglio-non-riconosciuto', messaggio: `Foglio "${nomeFoglio}" ignorato: mese/anno non riconosciuti.` });
    return null;
  }
  if (daNome && daCelle && (daNome.mese !== daCelle.mese || daNome.anno !== daCelle.anno)) {
    avvisa({
      tipo: 'intestazione-incoerente',
      cella: 'A1:A2',
      messaggio: `Il nome del foglio indica ${chiaveMese(daNome)}, le celle A1/A2 ${chiaveMese(daCelle)}: usato il nome del foglio.`,
    });
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxGiorni = giorniNelMese(am.anno, am.mese);
  const { giorni: colonne, precedente } = trovaColonne(ws, range.e.c, maxGiorni);
  if (colonne.length !== maxGiorni) {
    avvisa({
      tipo: 'giorni-anomali',
      cella: 'riga 2',
      messaggio: `Trovati ${colonne.length} giorni su ${maxGiorni} nella riga 2.`,
    });
  }
  if (colonne.length === 0) return null;

  // Controllo dei giorni della settimana della riga 1 (rileva un anno sbagliato).
  const errati = colonne.filter(({ giorno, col }) => {
    const atteso = SETTIMANA[testo(valore(ws, 0, col)).slice(0, 2)];
    return atteso !== undefined && atteso !== giornoSettimana(dataISO(am.anno, am.mese, giorno));
  });
  if (errati.length > 0) {
    avvisa({
      tipo: 'intestazione-incoerente',
      cella: 'riga 1',
      messaggio: `${errati.length} giorni della settimana in riga 1 non corrispondono al calendario di ${chiaveMese(am)}.`,
    });
  }

  const { blocchi, unite } = blocchiMedici(ws, range.e.r);
  if (!unite) {
    avvisa({ tipo: 'senza-celle-unite', messaggio: 'Nessuna cella unita in colonna A: medici letti a coppie di righe.' });
  }

  /** `dove` = medico e giorno per gli avvisi; assente = nessun avviso (colonna mese precedente). */
  const codiciDi = (b: Blocco, col: number, dove?: { medico: string; giorno: number }): string[] => {
    const out: string[] = [];
    for (let r = b.r0; r <= b.r1; r++) {
      const v = cella(ws, r, col);
      const codice = interpretaCodice(v?.v);
      if (!codice) continue;
      const posizione = dove && { ...dove, riga: r + 1, cella: XLSX.utils.encode_cell({ r, c: col }), valore: codice.originale };
      if (r > b.r0 + 1) {
        if (posizione) avvisa({
          tipo: 'troppe-righe',
          ...posizione,
          messaggio: `${posizione.medico}, giorno ${posizione.giorno}: codice "${codice.originale}" oltre la seconda riga del medico, ignorato (max 2 codici per giorno).`,
        });
        continue;
      }
      if (posizione && codice.categoria === 'sconosciuto') {
        avvisa({
          tipo: 'codice-da-controllare',
          ...posizione,
          messaggio: `${posizione.medico}, giorno ${posizione.giorno}: codice "${codice.originale}" da controllare (conservato come "${codice.grezzo}").`,
        });
      }
      out.push(codice.grezzo);
    }
    return out;
  };

  const medici: MedicoFoglio[] = [];
  const visti = new Map<string, MedicoFoglio>();
  for (const b of blocchi) {
    const nome = pulisciNome(valore(ws, b.r0, 0));
    const intervallo = XLSX.utils.encode_range({ s: { r: b.r0, c: 0 }, e: { r: b.r1, c: 0 } });
    if (nome === '') {
      const conCodici = colonne.some(({ col }) => {
        for (let r = b.r0; r <= b.r1; r++) if (interpretaCodice(valore(ws, r, col))) return true;
        return false;
      });
      if (conCodici) {
        avvisa({
          tipo: 'righe-senza-nome',
          riga: b.r0 + 1,
          cella: intervallo,
          messaggio: `Righe ${b.r0 + 1}-${b.r1 + 1}: turni presenti ma senza nome del medico, ignorate.`,
        });
      }
      continue;
    }
    const medico: MedicoFoglio = { nome, riga: b.r0 + 1, giorni: {}, giornoPrecedente: [] };
    for (const { giorno, col } of colonne) {
      const codici = codiciDi(b, col, { medico: nome, giorno });
      if (codici.length > 0) medico.giorni[String(giorno)] = codici;
    }
    if (precedente !== null) medico.giornoPrecedente = codiciDi(b, precedente);
    if (!unite && Object.keys(medico.giorni).length === 0) continue; // riserva: probabilmente legenda

    const chiave = normalizzaNome(nome);
    const doppio = visti.get(chiave);
    if (doppio) {
      avvisa({
        tipo: 'nome-duplicato',
        riga: medico.riga,
        medico: nome,
        cella: intervallo,
        messaggio: `Nome ripetuto (righe ${doppio.riga} e ${medico.riga}): da verificare.`,
      });
    } else {
      visti.set(chiave, medico);
    }
    medici.push(medico);
  }

  // Nomi in colonna A fuori da celle unite, prima dell'ultimo medico: probabile errore di formato.
  if (unite && blocchi.length > 0) {
    const fine = blocchi[blocchi.length - 1]!.r1;
    const coperte = new Set(blocchi.flatMap((b) => Array.from({ length: b.r1 - b.r0 + 1 }, (_, i) => b.r0 + i)));
    for (let r = 2; r < fine; r++) {
      if (coperte.has(r)) continue;
      if (pulisciNome(valore(ws, r, 0)) !== '') {
        avvisa({
          tipo: 'nome-non-unito',
          riga: r + 1,
          cella: XLSX.utils.encode_cell({ r, c: 0 }),
          messaggio: 'Nome in colonna A senza cella unita su 2 righe: riga ignorata.',
        });
      } else if (colonne.some(({ col }) => interpretaCodice(valore(ws, r, col)))) {
        avvisa({
          tipo: 'righe-senza-nome',
          riga: r + 1,
          cella: XLSX.utils.encode_cell({ r, c: 0 }),
          messaggio: `Riga ${r + 1}: turni presenti ma senza nome del medico, ignorata.`,
        });
      }
    }
  }

  return { foglio: nomeFoglio, anno: am.anno, mese: am.mese, giorniTrovati: colonne.length, medici };
}

function stessiCodici(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

/** Legge un workbook SheetJS già aperto. */
export function leggiWorkbook(wb: XLSX.WorkBook): RisultatoImport {
  const avvisi: AvvisoImport[] = [];
  const mesi: FoglioMese[] = [];
  const perChiave = new Map<string, FoglioMese>();

  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws) continue;
    const foglio = leggiFoglio(ws, nome, avvisi);
    if (!foglio) continue;
    const k = chiaveMese(foglio);
    const gia = perChiave.get(k);
    if (gia) {
      avvisi.push(crea({
        tipo: 'mese-duplicato',
        foglio: nome,
        messaggio: `Mese ${k} già letto dal foglio "${gia.foglio}": questo foglio è ignorato.`,
      }));
      continue;
    }
    perChiave.set(k, foglio);
    mesi.push(foglio);
  }

  // Coerenza tra la colonna "mese precedente" e l'ultimo giorno del foglio precedente.
  for (const foglio of mesi) {
    const prec = perChiave.get(chiaveMese(aggiungiMesi(foglio, -1)));
    if (!prec) continue;
    const ultimo = String(giorniNelMese(prec.anno, prec.mese));
    const precPerNome = new Map(prec.medici.map((m) => [normalizzaNome(m.nome), m]));
    for (const m of foglio.medici) {
      const p = precPerNome.get(normalizzaNome(m.nome));
      if (!p) continue;
      if (!stessiCodici(m.giornoPrecedente, p.giorni[ultimo] ?? [])) {
        const qui = m.giornoPrecedente.join(' + ') || 'vuota';
        const la = (p.giorni[ultimo] ?? []).join(' + ') || 'vuoto';
        avvisi.push(crea({
          tipo: 'incoerenza-mese-precedente',
          foglio: foglio.foglio,
          riga: m.riga,
          medico: m.nome,
          messaggio: `${m.nome}: colonna B (${qui}) diversa dal giorno ${ultimo} del foglio "${prec.foglio}" (${la}); vale il foglio "${prec.foglio}".`,
        }));
      }
    }
  }

  mesi.sort((a, b) => a.anno * 12 + a.mese - (b.anno * 12 + b.mese));
  return { mesi, avvisi };
}

/** Legge il contenuto di un file .xlsx (es. da `File.arrayBuffer()`). */
export function leggiExcel(dati: ArrayBuffer | Uint8Array): RisultatoImport {
  const wb = XLSX.read(dati, { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false });
  return leggiWorkbook(wb);
}

/**
 * Abbinamento dei nomi dell'Excel all'anagrafica (logica in anagrafica.ts, `abbinaNome`):
 * un avviso per ogni nome distinto (per foglio) non abbinato in automatico o ambiguo.
 * Il parser non conosce l'anagrafica: la UI chiama questa funzione dopo `leggiExcel`
 * e unisce il risultato a `risultato.avvisi`.
 */
export function avvisiAbbinamento(risultato: RisultatoImport, medici: readonly Medico[]): AvvisoImport[] {
  const out: AvvisoImport[] = [];
  for (const foglio of risultato.mesi) {
    const visti = new Set<string>();
    for (const m of foglio.medici) {
      const chiave = normalizzaNome(m.nome);
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      const esito = abbinaNome(m.nome, medici);
      if (esito.tipo === 'nessuno') {
        const suggerimenti = esito.suggerimenti.map((x) => x.nome);
        out.push(crea({
          tipo: 'nome-non-abbinato',
          foglio: foglio.foglio,
          riga: m.riga,
          medico: m.nome,
          suggerimenti,
          messaggio: `"${m.nome}" non trovato in anagrafica${suggerimenti.length ? ` (forse: ${suggerimenti.join(', ')})` : ''}.`,
        }));
      } else if (esito.tipo === 'ambiguo') {
        const suggerimenti = esito.candidati.map((x) => x.nome);
        out.push(crea({
          tipo: 'nome-ambiguo',
          foglio: foglio.foglio,
          riga: m.riga,
          medico: m.nome,
          suggerimenti,
          messaggio: `"${m.nome}" corrisponde a più medici: ${suggerimenti.join(', ')}.`,
        }));
      }
    }
  }
  return out;
}
