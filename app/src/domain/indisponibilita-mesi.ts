import { aggiungiMesi, chiaveMese, confrontaMesi, type AnnoMese } from './date';

/** Quanti mesi in avanti (dal mese corrente, incluso) accettano indisponibilità. */
export const MESI_MAX_INDISPONIBILITA = 12;

/**
 * Un mese accetta indisponibilità se: è successivo al mese corrente, è entro 12 mesi dal corrente
 * e per il medico non ci sono turni pubblicati per quel mese.
 * `chiaviMesiPubblicati`: chiavi `aaaa-mm` dei mesi con turni ufficiali già caricati (dato noto).
 * Regola speculare alle regole Firestore.
 */
export function meseAccettaIndisponibilita(mese: AnnoMese, meseCorrente: AnnoMese, chiaviMesiPubblicati: Iterable<string>): boolean {
  if (confrontaMesi(mese, meseCorrente) <= 0) return false;
  if (confrontaMesi(mese, aggiungiMesi(meseCorrente, MESI_MAX_INDISPONIBILITA)) > 0) return false;
  const k = chiaveMese(mese);
  for (const c of chiaviMesiPubblicati) if (c === k) return false;
  return true;
}
