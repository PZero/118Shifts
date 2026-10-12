// Indisponibilità mensili dichiarate dal medico (privato dell'account principale).
// Logica pura: normalizzazione, modifica, conflitti con i turni ufficiali, testo dell'email.

import { fasciaDi, type Fascia } from './codici';
import { giorniNelMese } from './date';

/** Giorno ("5") -> fasce in ordine M, P, N (liste mai vuote). */
export type GiorniIndisponibili = Record<string, Fascia[]>;

export const FASCE: readonly Fascia[] = ['M', 'P', 'N'];

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function ordina(fasce: Iterable<Fascia>): Fascia[] {
  const s = new Set(fasce);
  return FASCE.filter((f) => s.has(f));
}

/** Scarta valori non validi, ordina le fasce M,P,N ed elimina i giorni vuoti. */
export function normalizzaIndisponibilita(grezzo: unknown): GiorniIndisponibili {
  const out: GiorniIndisponibili = {};
  if (!grezzo || typeof grezzo !== 'object') return out;
  for (const [g, v] of Object.entries(grezzo as Record<string, unknown>)) {
    if (!/^\d{1,2}$/.test(g) || !Array.isArray(v)) continue;
    const fasce = ordina(v.filter((x): x is Fascia => x === 'M' || x === 'P' || x === 'N'));
    if (fasce.length > 0) out[String(Number(g))] = fasce;
  }
  return out;
}

function conGiorno(giorni: GiorniIndisponibili, giorno: number, fasce: Fascia[]): GiorniIndisponibili {
  const resto = { ...giorni };
  delete resto[String(giorno)];
  return fasce.length > 0 ? { ...resto, [String(giorno)]: fasce } : resto;
}

/** Attiva o disattiva una fascia in un giorno. */
export function alternaFascia(giorni: GiorniIndisponibili, giorno: number, fascia: Fascia): GiorniIndisponibili {
  const attuali = giorni[String(giorno)] ?? [];
  const nuove = attuali.includes(fascia) ? attuali.filter((f) => f !== fascia) : ordina([...attuali, fascia]);
  return conGiorno(giorni, giorno, nuove);
}

/** "Tutto il giorno": se le tre fasce sono già segnate le toglie, altrimenti le segna tutte. */
export function alternaTuttoIlGiorno(giorni: GiorniIndisponibili, giorno: number): GiorniIndisponibili {
  const completo = (giorni[String(giorno)] ?? []).length === FASCE.length;
  return conGiorno(giorni, giorno, completo ? [] : [...FASCE]);
}

export function uguali(a: GiorniIndisponibili, b: GiorniIndisponibili): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k]?.join('') === b[k]?.join(''));
}

/** Fasce di turno ufficiale (M/P/N) presenti nei codici di un giorno. */
function fasceUfficiali(codici: readonly string[] | undefined): Set<Fascia> {
  const s = new Set<Fascia>();
  for (const c of codici ?? []) {
    const f = fasciaDi(c);
    if (f) s.add(f);
  }
  return s;
}

/**
 * Per ogni giorno con indisponibilità, le fasce in cui l'Excel assegna un turno (cambi esclusi).
 * Solo i giorni con almeno un conflitto compaiono nel risultato.
 */
export function conflittiConTurni(giorni: GiorniIndisponibili, turniUfficiali: Record<string, string[]>): GiorniIndisponibili {
  const out: GiorniIndisponibili = {};
  for (const [g, fasce] of Object.entries(giorni)) {
    const uff = fasceUfficiali(turniUfficiali[g]);
    const c = fasce.filter((f) => uff.has(f));
    if (c.length > 0) out[g] = c;
  }
  return out;
}

export interface RiepilogoIndisponibilita {
  giorni: number;
  nonRispettate: number;
}

export function riepilogoIndisponibilita(giorni: GiorniIndisponibili, turniUfficiali: Record<string, string[]>): RiepilogoIndisponibilita {
  return { giorni: Object.keys(giorni).length, nonRispettate: Object.keys(conflittiConTurni(giorni, turniUfficiali)).length };
}

export function oggettoEmail(anno: number, mese: number): string {
  return `Indisponibilità ${MESI[mese - 1]} ${anno}`;
}

/** Testo dell'email con un elenco ordinato per giorno. */
export function testoEmail(args: { anno: number; mese: number; giorni: GiorniIndisponibili; nomeMedico: string }): string {
  const { anno, mese, giorni, nomeMedico } = args;
  const mm = String(mese).padStart(2, '0');
  const max = giorniNelMese(anno, mese);
  const righe = Object.keys(giorni)
    .map(Number)
    .filter((g) => g >= 1 && g <= max)
    .sort((a, b) => a - b)
    .map((g) => `* indisponibile per il giorno ${String(g).padStart(2, '0')}/${mm}/${anno} per i turni: ${(giorni[String(g)] ?? []).join(', ')}`);
  return [
    'Buongiorno,',
    `come da accordi invio le mie indisponibilità per il mese di ${MESI[mese - 1]} ${anno}:`,
    '',
    ...righe,
    '',
    'Cordiali saluti',
    `dr. ${nomeMedico}`,
  ].join('\n');
}

export function linkMailto(oggetto: string, corpo: string): string {
  return `mailto:?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
}
