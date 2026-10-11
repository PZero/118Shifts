import { describe, expect, it } from 'vitest';
import { fascePreviste, proiezioneMedico, proietta, trovaAncora, type MeseTurni } from './proiezione';

// Dati inventati.
const settembre: MeseTurni = { anno: 2026, mese: 9, giorni: { '1': ['M1'], '2': ['N1'] } }; // M senza P: non vale
const ottobre: MeseTurni = {
  anno: 2026,
  mese: 10,
  giorni: {
    '5': ['M2', 'P2'],
    '6': ['N3'],
    '20': ['M4', 'P4'],
    '21': ['F'], // senza N il giorno dopo: non vale
    '22': ['N4'],
    '31': ['M5', 'P5'],
  },
};
const novembre: MeseTurni = { anno: 2026, mese: 11, giorni: { '1': ['N5'], '10': ['P1'] } };

describe('trovaAncora', () => {
  it('ultimo giorno MP seguito da N', () => {
    expect(trovaAncora([settembre, ottobre])).toBe('2026-10-05');
  });
  it('anche a cavallo tra mesi', () => {
    expect(trovaAncora([settembre, ottobre, novembre])).toBe('2026-10-31');
  });
  it('passaggio di anno', () => {
    const dic: MeseTurni = { anno: 2026, mese: 12, giorni: { '31': ['P1', 'M1'] } };
    const gen: MeseTurni = { anno: 2027, mese: 1, giorni: { '1': ['N1'] } };
    expect(trovaAncora([dic, gen])).toBe('2026-12-31');
  });
  it('nessuna sequenza', () => {
    expect(trovaAncora([{ anno: 2026, mese: 1, giorni: { '1': ['P1'], '2': ['N1'], '5': ['M1', 'P1'] } }])).toBeNull();
  });
});

describe('fascePreviste e proietta', () => {
  it('ciclo MP, N, smonto, riposo, riposo', () => {
    const date = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];
    expect(date.map((d) => fascePreviste('2026-10-05', d))).toEqual([['M', 'P'], ['N'], [], [], [], ['M', 'P']]);
  });
  it('modulo con date prima dell\'ancora', () => {
    expect(fascePreviste('2026-10-05', '2026-10-04')).toEqual([]); // -1 -> smonto/riposo (k=4)
    expect(fascePreviste('2026-10-05', '2026-10-02')).toEqual([]); // -3 -> k=2 (smonto)
    expect(fascePreviste('2026-10-05', '2026-10-01')).toEqual(['N']); // -4 -> k=1
    expect(fascePreviste('2026-10-05', '2026-09-30')).toEqual(['M', 'P']); // -5 -> k=0
  });
  it('12 mesi dopo l\'ultimo mese, due fasce nel giorno MP', () => {
    const t = proietta('2026-10-05', { anno: 2026, mese: 10 });
    const date = Object.keys(t).sort();
    expect(date[0]!.startsWith('2026-11')).toBe(true);
    expect(date[date.length - 1]!.startsWith('2027-10')).toBe(true);
    expect(new Set(Object.values(t).map((f) => f.join('')))).toEqual(new Set(['MP', 'N']));
    expect(date).toHaveLength(146); // 365 giorni: 2 su 5 con turno
  });
  it('passaggio di anno', () => {
    const t = proietta('2026-12-31', { anno: 2026, mese: 12 }, 1);
    expect(t['2027-01-01']).toEqual(['N']);
    expect(t['2027-01-05']).toEqual(['M', 'P']);
  });
});

describe('proiezioneMedico', () => {
  it('automatica', () => {
    const r = proiezioneMedico({ mesi: [settembre, ottobre] });
    expect(r).toMatchObject({ ancora: '2026-10-05', origine: 'automatica' });
    expect(r.turni['2026-11-01']).toBeUndefined(); // +27 -> k=2 (smonto)
    expect(r.turni['2026-11-04']).toEqual(['M', 'P']); // +30
    expect(r.turni['2026-11-05']).toEqual(['N']);
  });
  it('manuale ha la precedenza, anche successiva all\'ultimo mese', () => {
    const r = proiezioneMedico({ mesi: [settembre, ottobre], cicloInizio: '2026-11-03', cicloManuale: true });
    expect(r.origine).toBe('manuale');
    expect(r.turni['2026-11-03']).toEqual(['M', 'P']);
    expect(r.turni['2026-11-04']).toEqual(['N']);
  });
  it('manuale precedente all\'ultimo mese', () => {
    const r = proiezioneMedico({ mesi: [ottobre], cicloInizio: '2026-09-01', cicloManuale: true });
    expect(r.turni['2026-11-01']).toEqual(['N']); // +61 -> k=1
    expect(r.turni['2026-11-05']).toEqual(['M', 'P']); // +65
  });
  it('ancora salvata se non c\'è sequenza reale', () => {
    const r = proiezioneMedico({ mesi: [{ anno: 2026, mese: 10, giorni: {} }], cicloInizio: '2026-10-01' });
    expect(r.origine).toBe('salvata');
  });
  it('nessuna ancora: nessuna proiezione', () => {
    expect(proiezioneMedico({ mesi: [{ anno: 2026, mese: 10, giorni: {} }] }).turni).toEqual({});
  });
});
