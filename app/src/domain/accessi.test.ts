import { describe, expect, it } from 'vitest';
import { accessoDiOggi, accessoPiuRecente, testoUltimoAccesso } from './accessi';

const adesso = new Date('2026-10-11T10:00:00Z');

describe('ultimo accesso', () => {
  it('riconosce oggi nel fuso di Roma (mezzanotte locale)', () => {
    expect(accessoDiOggi(new Date('2026-10-10T22:30:00Z'), adesso)).toBe(true); // 00:30 a Roma
    expect(accessoDiOggi(new Date('2026-10-10T21:30:00Z'), adesso)).toBe(false); // 23:30 di ieri
    expect(accessoDiOggi(undefined, adesso)).toBe(false);
  });
  it('formatta il testo relativo', () => {
    expect(testoUltimoAccesso(undefined, adesso)).toBe('mai');
    expect(testoUltimoAccesso(new Date('2026-10-11T08:00:00Z'), adesso)).toBe('oggi');
    expect(testoUltimoAccesso(new Date('2026-10-10T12:00:00Z'), adesso)).toBe('ieri');
    expect(testoUltimoAccesso(new Date('2026-10-05T12:00:00Z'), adesso)).toBe('6 giorni fa');
    expect(testoUltimoAccesso(new Date('2026-10-04T12:00:00Z'), adesso)).toBe('04/10/2026');
  });
  it('sceglie la data più recente', () => {
    const a = new Date('2026-10-01T00:00:00Z');
    const b = new Date('2026-10-05T00:00:00Z');
    expect(accessoPiuRecente([a, undefined, b])).toBe(b);
    expect(accessoPiuRecente([undefined])).toBeUndefined();
  });
});
