import { describe, expect, it } from 'vitest';
import { costruisciMese } from './vista';

const proiezione = { turni: {}, ancora: undefined } as never;
const vista = (anno: number, mese: number) => costruisciMese({ anno, mese }, [], [], proiezione, '2000-01-01');

describe('griglia con settimane complete', () => {
  it('mese che inizia di domenica: 6 giorni precedenti', () => {
    const v = vista(2025, 6); // 1 giugno 2025 = domenica, 30 = lunedi
    expect(v.adiacenti.prima.map((g) => g.data)).toEqual(['2025-05-26', '2025-05-27', '2025-05-28', '2025-05-29', '2025-05-30', '2025-05-31']);
    expect(v.adiacenti.dopo.length).toBe(6);
    expect(v.adiacenti.dopo[0]!.data).toBe('2025-07-01');
    expect(v.adiacenti.prima.every((g) => g.fuori)).toBe(true);
  });
  it('mese che finisce di lunedi: 6 giorni successivi', () => {
    expect(vista(2025, 6).adiacenti.dopo.at(-1)!.data).toBe('2025-07-06');
  });
  it('febbraio di 28 giorni che inizia di lunedi: nessuna cella adiacente', () => {
    const v = vista(2027, 2); // 1 febbraio 2027 = lunedi
    expect(v.adiacenti).toEqual({ prima: [], dopo: [] });
  });
  it('i conteggi riguardano solo i giorni del mese', () => {
    const v = vista(2025, 6);
    expect(v.giorni.length).toBe(30);
    expect(v.giorni.some((g) => g.fuori)).toBe(false);
  });
});
