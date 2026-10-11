// Messaggi di errore leggibili (codici Firebase e generici), senza dipendere dall'SDK.

/** Messaggio leggibile per gli errori di Firebase. */
export function messaggioErroreGenerico(e: unknown): string {
  const codice = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (codice) {
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Operazione non consentita per questo account.';
    case 'unavailable':
      return 'Servizio non raggiungibile: controlla la connessione.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Accesso annullato.';
    case 'auth/network-request-failed':
      return 'Connessione assente: riprova quando sei online.';
    case 'auth/unauthorized-domain':
      return 'Dominio non autorizzato per l’accesso (configurazione Firebase).';
    default:
      return e instanceof Error && e.message ? e.message : 'Si è verificato un errore imprevisto.';
  }
}
