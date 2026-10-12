import { describe, expect, it } from 'vitest';
import { meseAccettaIndisponibilita } from './indisponibilita-mesi';

// Dati inventati: oggi = ottobre 2026, novembre pubblicato.
const oggi = { anno: 2026, mese: 10 };
const pubblicati = ['2026-09', '2026-10', '2026-11'];

describe('meseAccettaIndisponibilita', () => {
  it('mese corrente e passati: no', () => {
    expect(meseAccettaIndisponibilita({ anno: 2026, mese: 10 }, oggi, [])).toBe(false);
    expect(meseAccettaIndisponibilita({ anno: 2026, mese: 9 }, oggi, [])).toBe(false);
  });
  it('mese con turni pubblicati: no', () => {
    expect(meseAccettaIndisponibilita({ anno: 2026, mese: 11 }, oggi, pubblicati)).toBe(false);
  });
  it('mese futuro senza turni: si', () => {
    expect(meseAccettaIndisponibilita({ anno: 2026, mese: 12 }, oggi, pubblicati)).toBe(true);
    expect(meseAccettaIndisponibilita({ anno: 2026, mese: 11 }, oggi, ['2026-10'])).toBe(true);
  });
  it('limite a +12 mesi, incluso', () => {
    expect(meseAccettaIndisponibilita({ anno: 2027, mese: 10 }, oggi, pubblicati)).toBe(true);
    expect(meseAccettaIndisponibilita({ anno: 2027, mese: 11 }, oggi, pubblicati)).toBe(false);
  });
});
