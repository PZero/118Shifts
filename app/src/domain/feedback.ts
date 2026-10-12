// Logica pura di feedback e presentazione: limiti, validazioni, anteprime e ordinamento delle conversazioni.
// Limiti allineati alle regole Firestore (docs/MODELLO-DATI.md).

export const LIMITI_FEEDBACK = {
  argomento: 80,
  testo: 1000,
  anteprima: 120,
  presentazione: 200,
} as const;

/** Messaggio di errore, oppure `null` se il valore è valido. */
export function validaArgomento(valore: string): string | null {
  const t = valore.trim();
  if (t.length === 0) return 'Scrivi l’argomento della conversazione.';
  if (t.length > LIMITI_FEEDBACK.argomento) return `L’argomento può avere al massimo ${LIMITI_FEEDBACK.argomento} caratteri.`;
  return null;
}

export function validaTestoMessaggio(valore: string): string | null {
  const t = valore.trim();
  if (t.length === 0) return 'Scrivi il messaggio.';
  if (t.length > LIMITI_FEEDBACK.testo) return `Il messaggio può avere al massimo ${LIMITI_FEEDBACK.testo} caratteri.`;
  return null;
}

/** La presentazione può anche essere svuotata, ma non superare il limite. */
export function validaPresentazione(valore: string): string | null {
  if (valore.trim().length > LIMITI_FEEDBACK.presentazione) {
    return `La presentazione può avere al massimo ${LIMITI_FEEDBACK.presentazione} caratteri.`;
  }
  return null;
}

/** Anteprima di una riga (spazi compressi) di al massimo `LIMITI_FEEDBACK.anteprima` caratteri, "…" compreso. */
export function anteprima(testo: string): string {
  const t = testo.replace(/\s+/g, ' ').trim();
  const max = LIMITI_FEEDBACK.anteprima;
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export interface ConversazioneOrdinabile {
  nonLettoAdmin: boolean;
  nonLettoUtente: boolean;
  /** Assente = scrittura locale non ancora confermata: la più recente. */
  aggiornatoIl?: Date | undefined;
}

export function nonLetta(c: ConversazioneOrdinabile, comeAdmin: boolean): boolean {
  return comeAdmin ? c.nonLettoAdmin : c.nonLettoUtente;
}

export function contaNonLette(elenco: readonly ConversazioneOrdinabile[], comeAdmin: boolean): number {
  return elenco.filter((c) => nonLetta(c, comeAdmin)).length;
}

/** Non lette per prime, poi dalla più recente. Non modifica l'elenco ricevuto. */
export function ordinaConversazioni<T extends ConversazioneOrdinabile>(elenco: readonly T[], comeAdmin: boolean): T[] {
  const tempo = (c: T) => c.aggiornatoIl?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...elenco].sort((a, b) => {
    const na = nonLetta(a, comeAdmin) ? 1 : 0;
    const nb = nonLetta(b, comeAdmin) ? 1 : 0;
    return nb - na || tempo(b) - tempo(a);
  });
}
