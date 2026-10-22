// Contatori di utilizzo anonimi: nessun uid, nessun dato personale.
// Contratto: statistiche/{aaaa-mm}.eventi.{nome} = numero (increment). Lettura solo admin.

/** Eventi tracciati, con etichetta italiana e gruppo di appartenenza nella scheda "Utilizzo". */
export const EVENTI = {
  sessione: { etichetta: "Apertura dell'app", gruppo: 'azione' },
  cardOggiDomani: { etichetta: 'Card Oggi e domani', gruppo: 'card' },
  cardCollega: { etichetta: 'Card Cosa fa oggi un collega', gruppo: 'card' },
  cardChiTiDaIlCambio: { etichetta: 'Card Chi ti dà il cambio', gruppo: 'card' },
  cardChiConMe: { etichetta: 'Card Chi è di turno con me', gruppo: 'card' },
  cardLegenda: { etichetta: 'Legenda', gruppo: 'card' },
  cambioMese: { etichetta: 'Cambio mese nel calendario', gruppo: 'azione' },
  dettaglioGiorno: { etichetta: 'Dettaglio di un giorno', gruppo: 'azione' },
  chiediCambio: { etichetta: 'Cambio richiesto', gruppo: 'azione' },
  registraCambio: { etichetta: 'Cambio registrato', gruppo: 'azione' },
  annullaCambio: { etichetta: 'Cambio annullato', gruppo: 'azione' },
  condividiTesto: { etichetta: 'Testo condiviso o copiato', gruppo: 'azione' },
  condividiPng: { etichetta: 'Calendario condiviso come immagine', gruppo: 'azione' },
  salvaIndisponibilita: { etichetta: 'Indisponibilità salvate', gruppo: 'azione' },
  siriAttiva: { etichetta: 'Siri attivato', gruppo: 'azione' },
  siriDisattiva: { etichetta: 'Siri disattivato', gruppo: 'azione' },
  feedbackInviato: { etichetta: 'Feedback inviato', gruppo: 'azione' },
  caricaExcel: { etichetta: 'Excel caricato (gestione)', gruppo: 'azione' },
  caricaScreenshot: { etichetta: 'Screenshot caricato (gestione)', gruppo: 'azione' },
  approvaAccount: { etichetta: 'Account approvato', gruppo: 'azione' },
} as const satisfies Record<string, { etichetta: string; gruppo: 'card' | 'azione' }>;

export type NomeEvento = keyof typeof EVENTI;

export type ScriviEvento = (mese: string, evento: string) => Promise<void>;

const FORMA_NOME = /^[a-z][A-Za-z0-9_]{1,39}$/;
const contati = new Set<string>();
let scrivi: ScriviEvento | null = null;

/** Registra come scrivere i contatori (solo con Firebase reale; in demo resta vuoto: nulla viene scritto). */
export function impostaScrittura(fn: ScriviEvento | null): void {
  scrivi = fn;
}

export function meseCorrente(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Conta l'evento al massimo una volta per sessione. Fire-and-forget: errori ignorati. */
export function conta(evento: NomeEvento): void {
  try {
    if (!FORMA_NOME.test(evento) || contati.has(evento)) return;
    contati.add(evento);
    if (!scrivi) return;
    void scrivi(meseCorrente(), evento).catch(() => undefined);
  } catch {
    /* mai bloccare l'interfaccia */
  }
}
