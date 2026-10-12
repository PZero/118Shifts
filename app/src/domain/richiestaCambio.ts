// Testo del messaggio con cui il medico chiede il cambio a un collega (da copiare o condividere).

/** Elenca all'italiana: "A", "A e B", "A, B e C". */
export function elencoItaliano(voci: string[]): string {
  if (voci.length <= 1) return voci.join('');
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
}

export interface DatiRichiestaCambio {
  /** Nome del collega come appare nell'elenco (di norma il cognome). */
  cognome: string;
  /** Turni oggetto della cessione, già descritti (es. "N6 (Notte, Sede 6)": l'orario lo conoscono già). */
  turni: string[];
  /** Data già formattata (es. "mercoledì 14 ottobre 2026"). */
  data: string;
}

export function testoRichiestaCambio({ cognome, turni, data }: DatiRichiestaCambio): string {
  const uno = turni.length === 1;
  return `Ciao ${cognome}, avrei bisogno di cambiare ${uno ? 'il turno' : 'i turni'} ${elencoItaliano(turni)} di ${data}. Saresti disponibile al cambio?`;
}
