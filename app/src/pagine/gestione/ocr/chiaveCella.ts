// Chiave di una cella del foglio letto: riga del medico, sotto-riga e giorno.
export function chiaveCella(riga: number, sotto: number, giorno: number): string {
  return `${riga}|${sotto}|${giorno}`;
}
