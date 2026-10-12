import { describe, expect, it } from 'vitest';
import { elencoItaliano, testoRichiestaCambio } from './richiestaCambio';

describe('testoRichiestaCambio', () => {
  const data = 'mercoledì 14 ottobre 2026';
  it('un turno', () => {
    expect(testoRichiestaCambio({ cognome: 'Bianchi', turni: ['N6 (Notte, Sede 6)'], data })).toBe(
      'Ciao Bianchi, avrei bisogno di cambiare il turno N6 (Notte, Sede 6) di mercoledì 14 ottobre 2026. Saresti disponibile al cambio?',
    );
  });
  it('due turni', () => {
    expect(testoRichiestaCambio({ cognome: 'Bianchi', turni: ['M6 (Mattino, Sede 6)', 'P6 (Pomeriggio, Sede 6)'], data })).toBe(
      'Ciao Bianchi, avrei bisogno di cambiare i turni M6 (Mattino, Sede 6) e P6 (Pomeriggio, Sede 6) di mercoledì 14 ottobre 2026. Saresti disponibile al cambio?',
    );
  });
  it('tre turni', () => {
    expect(elencoItaliano(['A', 'B', 'C'])).toBe('A, B e C');
    expect(testoRichiestaCambio({ cognome: 'Verdi', turni: ['A', 'B', 'C'], data })).toContain('i turni A, B e C di');
  });
});
