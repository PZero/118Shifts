import { describe, expect, it } from 'vitest';
import { colleghiDisponibili } from './disponibilita';
import type { Fascia } from './codici';

const DATA = '2026-03-10';
function disp(fascia: Fascia, prima?: string[], oggi?: string[], dopo?: string[]) {
  const q = (c?: string[]) => (c ? { X: c } : undefined);
  return colleghiDisponibili({
    data: DATA, fascia,
    giornoPrima: q(prima), giorno: q(oggi), giornoDopo: q(dopo),
    candidati: ['X'],
  }).length === 1;
}

describe('colleghiDisponibili', () => {
  it('cedo M: esclusi N notte prima, P/N e reperibilità stesso giorno', () => {
    expect(disp('M', ['N'])).toBe(false);
    expect(disp('M', undefined, ['P'])).toBe(false);
    expect(disp('M', undefined, ['N'])).toBe(false);
    expect(disp('M', undefined, ['RG'])).toBe(false);
    expect(disp('M', undefined, ['RP'])).toBe(false);
    expect(disp('M', undefined, ['RM'])).toBe(false);
    expect(disp('M', undefined, ['M3'])).toBe(false);
  });
  it('cedo M: ammessi P il giorno prima e M il giorno dopo', () => {
    expect(disp('M', ['P'])).toBe(true);
    expect(disp('M', undefined, undefined, ['M'])).toBe(true);
  });
  it('cedo P: escluso N notte prima, M/N stesso giorno; ammesso M giorno dopo', () => {
    expect(disp('P', ['N'])).toBe(false);
    expect(disp('P', undefined, ['M'])).toBe(false);
    expect(disp('P', undefined, ['N'])).toBe(false);
    expect(disp('P', undefined, undefined, ['M'])).toBe(true);
    expect(disp('P', ['M'])).toBe(true);
  });
  it('cedo N: esclusi M/P stesso giorno e M/P giorno dopo; ammessi N prima e N dopo', () => {
    expect(disp('N', undefined, ['M'])).toBe(false);
    expect(disp('N', undefined, ['P'])).toBe(false);
    expect(disp('N', undefined, undefined, ['M'])).toBe(false);
    expect(disp('N', undefined, undefined, ['P'])).toBe(false);
    expect(disp('N', ['N'])).toBe(true);
    expect(disp('N', undefined, undefined, ['N'])).toBe(true);
  });
  it('reperibilità come impegno', () => {
    expect(disp('N', undefined, undefined, ['RM'])).toBe(false);
    expect(disp('N', undefined, undefined, ['RG'])).toBe(false);
    expect(disp('N', ['RN'])).toBe(true);
    expect(disp('M', ['RN'])).toBe(false);
    expect(disp('M', ['RP'])).toBe(true);
    expect(disp('P', undefined, undefined, ['RM'])).toBe(true);
  });
  it('assenze, codici sconosciuti e assenza di codici non bloccano', () => {
    expect(disp('M', ['F'], ['ZZZ'], ['f'])).toBe(true);
    expect(disp('N', undefined, [])).toBe(true);
    expect(disp('P')).toBe(true);
  });
  it('rispetta l\'ordine dei candidati e filtra', () => {
    const r = colleghiDisponibili({
      data: DATA, fascia: 'M',
      giornoPrima: { b: ['N'], c: ['P'] },
      giorno: { a: ['P'] },
      giornoDopo: undefined,
      candidati: ['c', 'a', 'b', 'd'],
    });
    expect(r).toEqual(['c', 'd']);
  });
});

describe('colleghiDisponibili: assenze nel giorno del turno ceduto', () => {
  it.each([['F'], ['f'], ['C'], ['-']])('escluso con codice %s nel giorno', (c) => {
    expect(disp('M', undefined, [c])).toBe(false);
  });
  it('assenza il giorno prima o dopo non esclude', () => {
    expect(disp('M', ['F'])).toBe(true);
    expect(disp('M', undefined, undefined, ['f'])).toBe(true);
    expect(disp('P', ['C'], undefined, ['-'])).toBe(true);
  });
});
