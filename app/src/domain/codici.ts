// Interpretazione dei codici delle celle dell'Excel dei turni.
// Vedi docs/REQUISITI.md (legenda codici) e docs/MODELLO-DATI.md (CodiceTurno).

export type Fascia = 'M' | 'P' | 'N';

export type Categoria =
  | 'turno'
  | 'ferie'
  | 'malattia'
  | 'indisponibile'
  | 'corso'
  | 'qualita'
  | 'reperibilita'
  | 'altro'
  | 'sconosciuto';

/** Tipi di reperibilità con contatore di giorni (RE escluso: significato tbd). */
export type TipoReperibilita = 'RM' | 'RP' | 'RN' | 'RG';
export const TIPI_REPERIBILITA: readonly TipoReperibilita[] = ['RM', 'RP', 'RN', 'RG'];

/** Descrizione dei codici di significato ancora ignoto. */
export const DESCRIZIONE_TBD = 'tbd';
/** Etichetta per la UI dei codici non riconosciuti (categoria "sconosciuto"). */
export const ETICHETTA_DA_CONTROLLARE = 'da controllare';

export interface CodiceTurno {
  /** Codice normalizzato (forma canonica), es. "M6", "NCatt", "F", "f", "RN1". È quello da salvare. */
  grezzo: string;
  /** Testo originale della cella (non salvato: serve per anteprima e avvisi). */
  originale: string;
  fascia?: Fascia;
  /** 1..7 */
  sede?: number;
  /** Suffisso C (significato tbd). */
  centrale?: boolean;
  /** Suffisso at/att (attivazione, significato esatto tbd). */
  attivazione?: boolean;
  /** Tipo base dei codici di reperibilità con contatore (RM, RP, RN, RG e varianti con sede/att). */
  reperibilita?: TipoReperibilita;
  categoria: Categoria;
}

export interface VoceLegenda {
  categoria: Exclude<Categoria, 'turno' | 'sconosciuto'>;
  descrizione: string;
  /** Significato ancora ignoto (descrizione "tbd"). */
  tbd?: boolean;
}

const TBD = { descrizione: DESCRIZIONE_TBD, tbd: true } as const;

/**
 * Codici noti diversi dai turni M/P/N. Le chiavi sono già normalizzate
 * (maiuscole, tranne "f" malattia; "e" minuscola diventa "E"). Nessuno di questi conta ore.
 */
export const LEGENDA: Readonly<Record<string, VoceLegenda>> = {
  F: { categoria: 'ferie', descrizione: 'Ferie' },
  f: { categoria: 'malattia', descrizione: 'Malattia / permessi' },
  '-': { categoria: 'indisponibile', descrizione: 'Indisponibilità giustificata' },
  C: { categoria: 'corso', descrizione: 'Corsi (formazione obbligatoria)' },
  Q: { categoria: 'qualita', descrizione: 'Qualità' },
  MR: { categoria: 'qualita', descrizione: 'Mattina riascolto' },
  PR: { categoria: 'qualita', descrizione: 'Pomeriggio riascolto' },
  RM: { categoria: 'reperibilita', descrizione: 'Reperibilità Mattina' },
  RP: { categoria: 'reperibilita', descrizione: 'Reperibilità Pomeriggio' },
  RN: { categoria: 'reperibilita', descrizione: 'Reperibilità Notte' },
  RG: { categoria: 'reperibilita', descrizione: 'Reperibilità Giorno (mattina + pomeriggio)' },
  RE: { categoria: 'reperibilita', ...TBD },
  E: { categoria: 'altro', ...TBD },
  EX: { categoria: 'altro', ...TBD },
  EU: { categoria: 'altro', ...TBD },
  A: { categoria: 'altro', ...TBD },
  G: { categoria: 'altro', ...TBD },
  SC: { categoria: 'altro', ...TBD },
  CD: { categoria: 'altro', ...TBD },
  REC: { categoria: 'altro', ...TBD },
};

/** Suffissi dei turni M/P/N (MC/PC/NC, at/att): contano ore come il turno base, significato tbd. */
export const SUFFISSI_TURNO: Readonly<Record<'C' | 'att', { descrizione: string; tbd: true }>> = {
  C: { descrizione: `Suffisso C (${DESCRIZIONE_TBD})`, tbd: true },
  att: { descrizione: `Attivazione (${DESCRIZIONE_TBD})`, tbd: true },
};

/** Spazi (anche non separabili) e caratteri invisibili da eliminare. */
const SPAZI = /[\s\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]+/g;

/**
 * Pulizia di un valore di cella: elimina tutti gli spazi (anche interni, "N1 att" → "N1att")
 * e mette in maiuscolo, tranne la "f" minuscola isolata (malattia), distinta da "F" (ferie).
 * Restituisce "" per celle vuote.
 */
export function pulisciCodice(valore: unknown): string {
  if (valore === null || valore === undefined) return '';
  const s = String(valore).replace(SPAZI, '');
  if (s === 'f') return 'f';
  return s.toUpperCase();
}

const TURNO = /^([MPN])([1-7])?(C)?(ATT?)?$/;
/**
 * Reperibilità con contatore: tipo base + eventuale sede 1–7 e/o suffisso at/att, stessa
 * grammatica dei turni (interpretazione inequivocabile). Altre varianti (es. "RN16", "RMP",
 * "RNC") restano "sconosciuto" = da controllare.
 */
const REPERIBILITA = /^R([MPNG])([1-7])?(ATT?)?$/;

/**
 * Interpreta un valore di cella. Restituisce `null` solo per celle vuote:
 * un codice non riconosciuto torna con categoria "sconosciuto" (mai scartato).
 */
export function interpretaCodice(valore: unknown): CodiceTurno | null {
  const originale = valore === null || valore === undefined ? '' : String(valore);
  const pulito = pulisciCodice(valore);
  if (pulito === '') return null;

  const m = TURNO.exec(pulito);
  if (m) {
    const fascia = m[1] as Fascia;
    const sede = m[2] ? Number(m[2]) : undefined;
    const centrale = m[3] === 'C';
    const attivazione = m[4] !== undefined;
    const grezzo = `${fascia}${sede ?? ''}${centrale ? 'C' : ''}${attivazione ? 'att' : ''}`;
    const codice: CodiceTurno = { grezzo, originale, fascia, categoria: 'turno' };
    if (sede !== undefined) codice.sede = sede;
    if (centrale) codice.centrale = true;
    if (attivazione) codice.attivazione = true;
    return codice;
  }

  const r = REPERIBILITA.exec(pulito);
  if (r) {
    const reperibilita = `R${r[1]}` as TipoReperibilita;
    const sede = r[2] ? Number(r[2]) : undefined;
    const attivazione = r[3] !== undefined;
    const grezzo = `${reperibilita}${sede ?? ''}${attivazione ? 'att' : ''}`;
    const codice: CodiceTurno = { grezzo, originale, reperibilita, categoria: 'reperibilita' };
    if (sede !== undefined) codice.sede = sede;
    if (attivazione) codice.attivazione = true;
    return codice;
  }

  const voce = LEGENDA[pulito];
  if (voce) return { grezzo: pulito, originale, categoria: voce.categoria };

  return { grezzo: pulito, originale, categoria: 'sconosciuto' };
}

/** Interpreta un codice già normalizzato (es. letto da Firestore). */
export function fasciaDi(codice: string): Fascia | undefined {
  const c = interpretaCodice(codice);
  return c?.categoria === 'turno' ? c.fascia : undefined;
}

/** true se il codice conta ore: solo i turni M/P/N (anche con suffisso C e at/att). */
export function contaOre(codice: CodiceTurno | null | undefined): boolean {
  return codice?.categoria === 'turno' && codice.fascia !== undefined;
}

const NOMI_FASCIA: Record<Fascia, string> = { M: 'Mattino', P: 'Pomeriggio', N: 'Notte' };

export interface DescrizioneCodice {
  descrizione: string;
  /** Significato (o parte di esso) ancora ignoto. */
  tbd: boolean;
  /** Codice non riconosciuto: la descrizione è ETICHETTA_DA_CONTROLLARE. */
  daControllare: boolean;
}

/** Descrizione leggibile di un codice (grezzo o già interpretato), per legenda e anteprima in UI. */
export function descriviCodice(valore: CodiceTurno | string): DescrizioneCodice {
  const c = typeof valore === 'string' ? interpretaCodice(valore) : valore;
  const daControllare = { descrizione: ETICHETTA_DA_CONTROLLARE, tbd: false, daControllare: true };
  if (!c || c.categoria === 'sconosciuto') return daControllare;
  const sede = c.sede !== undefined ? `, sede ${c.sede}` : '';
  const att = c.attivazione ? `, ${SUFFISSI_TURNO.att.descrizione}` : '';
  if (c.categoria === 'turno' && c.fascia) {
    const centrale = c.centrale ? `, ${SUFFISSI_TURNO.C.descrizione}` : '';
    return {
      descrizione: `${NOMI_FASCIA[c.fascia]}${sede}${centrale}${att}`,
      tbd: Boolean(c.centrale || c.attivazione),
      daControllare: false,
    };
  }
  if (c.reperibilita) {
    return {
      descrizione: `${LEGENDA[c.reperibilita]!.descrizione}${sede}${att}`,
      tbd: Boolean(c.attivazione),
      daControllare: false,
    };
  }
  const voce = LEGENDA[c.grezzo];
  if (!voce) return daControllare;
  return { descrizione: voce.descrizione, tbd: Boolean(voce.tbd), daControllare: false };
}
