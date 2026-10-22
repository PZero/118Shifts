import type { FrasiGiorno } from '../domain/frasiSiri';
import { describe, expect, it } from 'vitest';
import type { DataISO } from '../domain/date';
import { frasiUguali, generaChiave, intervalloFrasi, limitaFrasi, turniEffettivi } from './siri';

describe('servizio Siri (dati inventati)', () => {
  it('genera chiavi esadecimali lunghe e diverse', () => {
    const a = generaChiave();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(generaChiave()).not.toBe(a);
  });

  it('applica i cambi: il turno ceduto non compare tra i codici effettivi', () => {
    const t = turniEffettivi(
      [{ anno: 2026, mese: 10, giorni: { '5': ['M1'], '6': ['N1'] } }],
      [{ data: '2026-10-05', slot: 0, codice: 'M1', verso: 'ceduto', collegaId: 'x' }],
    );
    expect(t['2026-10-05']).toEqual([]);
    expect(t['2026-10-06']).toEqual(['N1']);
  });

  it('intervallo: da ieri a fine dati, max 100 giorni, fermandosi alla fine dell’ultimo mese pubblicato', () => {
    expect(intervalloFrasi('2026-10-10', [{ anno: 2026, mese: 12, giorni: {} }])).toEqual({ da: '2026-10-09', a: '2026-12-31' });
    expect(intervalloFrasi('2026-10-10', [{ anno: 2027, mese: 3, giorni: {} }])).toEqual({ da: '2026-10-09', a: '2027-01-16' });
    expect(intervalloFrasi('2026-10-10', [{ anno: 2026, mese: 10, giorni: {} }])).toEqual({ da: '2026-10-09', a: '2026-10-31' });
    expect(intervalloFrasi('2026-12-01', [{ anno: 2026, mese: 10, giorni: {} }])).toBeNull();
    expect(intervalloFrasi('2026-10-10', [])).toBeNull();
  });

  it('limita a 100 giorni e a 600 caratteri', () => {
    const frasi: Record<string, FrasiGiorno> = {};
    for (let i = 0; i < 120; i++) frasi[`2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`] = { testo: 'x'.repeat(700), primaDelle8: 'y'.repeat(650), dove: 'd', diTurno: 'd' };
    const out = limitaFrasi(frasi as Record<DataISO, FrasiGiorno>);
    expect(Object.keys(out)).toHaveLength(100);
    const prima = out[Object.keys(out)[0] as DataISO]!;
    expect(prima.testo).toHaveLength(600);
    expect(prima.primaDelle8).toHaveLength(600);
  });

  it('confronto delle frasi', () => {
    const a = { '2026-10-10': { testo: 'a', dove: 'd', diTurno: 't' } } as Record<DataISO, FrasiGiorno>;
    expect(frasiUguali(a, { '2026-10-10': { testo: 'a', dove: 'd', diTurno: 't' } } as typeof a)).toBe(true);
    expect(frasiUguali(a, { '2026-10-10': { testo: 'b', dove: 'd', diTurno: 't' } } as typeof a)).toBe(false);
    expect(frasiUguali(a, {} as typeof a)).toBe(false);
  });
});
