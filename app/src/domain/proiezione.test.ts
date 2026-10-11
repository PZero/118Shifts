import { describe, expect, it } from 'vitest';
import { fasciaPrevista, proiezioneMedico, proietta, trovaAncora, type MeseTurni } from './proiezione';

const settembre: MeseTurni = { anno: 2026, mese: 9, giorni: { '1': ['P1'], '2': ['M1'], '3': ['N1'] } };
const ottobre: MeseTurni = {
  anno: 2026,
  mese: 10,
  giorni: {
    '5': ['P2'],
    '6': ['MC', 'PC'], // due codici: contiene M
    '7': ['N3att'],
    '20': ['P4'],
    '21': ['F'], // sequenza interrotta: non vale
    '22': ['N4'],
    '30': ['P5'],
    '31': ['M5'],
  },
};
const novembre: MeseTurni = { anno: 2026, mese: 11, giorni: { '1': ['N5'], '10': ['P1'] } };

describe('trovaAncora', () => {
  it('ultima sequenza P→M→N su giorni consecutivi', () => {
    expect(trovaAncora([settembre, ottobre])).toBe('2026-10-05');
  });
  it('anche a cavallo tra mesi', () => {
    expect(trovaAncora([settembre, ottobre, novembre])).toBe('2026-10-30');
  });
  it('nessuna sequenza', () => {
    expect(trovaAncora([{ anno: 2026, mese: 1, giorni: { '1': ['P1'], '3': ['M1'] } }])).toBeNull();
  });
});

describe('proietta', () => {
  it('ciclo P, M, N, smonto, festa', () => {
    expect(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => fasciaPrevista('2026-10-05', d))).toEqual([
      'P',
      'M',
      'N',
      null,
      null,
      'P',
    ]);
    expect(fasciaPrevista('2026-10-05', '2026-10-04')).toBeNull(); // date precedenti all'ancora
    expect(fasciaPrevista('2026-10-05', '2026-10-02')).toBe('N');
  });
  it('12 mesi dopo l\'ultimo mese, solo P/M/N', () => {
    const t = proietta('2026-10-05', { anno: 2026, mese: 10 });
    const date = Object.keys(t).sort();
    expect(date[0]!.startsWith('2026-11')).toBe(true);
    expect(date[date.length - 1]!.startsWith('2027-10')).toBe(true);
    expect(new Set(Object.values(t))).toEqual(new Set(['P', 'M', 'N']));
    // 365 giorni (nov 2026 – ott 2027): 3 su 5 lavorati = 219
    expect(date).toHaveLength(219);
  });
});

describe('proiezioneMedico', () => {
  it('automatica', () => {
    const r = proiezioneMedico({ mesi: [settembre, ottobre] });
    expect(r).toMatchObject({ ancora: '2026-10-05', origine: 'automatica' });
    expect(r.turni['2026-11-01']).toBe('N'); // 27 giorni dopo l'ancora: 27 mod 5 = 2 → N
  });
  it('manuale ha la precedenza', () => {
    const r = proiezioneMedico({ mesi: [settembre, ottobre], cicloInizio: '2026-11-03', cicloManuale: true });
    expect(r.origine).toBe('manuale');
    expect(r.turni['2026-11-03']).toBe('P');
  });
  it('ancora salvata se non c\'è sequenza reale', () => {
    const r = proiezioneMedico({ mesi: [{ anno: 2026, mese: 10, giorni: {} }], cicloInizio: '2026-10-01' });
    expect(r.origine).toBe('salvata');
  });
  it('nessuna ancora → nessuna proiezione', () => {
    expect(proiezioneMedico({ mesi: [{ anno: 2026, mese: 10, giorni: {} }] }).turni).toEqual({});
  });
});
