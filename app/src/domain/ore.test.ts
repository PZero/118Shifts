import { describe, expect, it } from 'vitest';
import { oreMese } from './ore';
import { applicaCambi } from './cambi';

describe('oreMese', () => {
  it('M e P 6 ore, anche due turni nello stesso giorno', () => {
    const r = oreMese({ anno: 2026, mese: 10, giorni: { '5': ['M6'], '6': ['MC', 'PC'], '7': ['P'] } });
    expect(r.totale).toBe(24);
    expect(r.perGiorno['6']).toBe(12);
  });

  it('notte: 4 h sul giorno D e 8 h sul giorno D+1', () => {
    const r = oreMese({ anno: 2026, mese: 10, giorni: { '10': ['N3'] } });
    expect(r.perGiorno['10']).toBe(4);
    expect(r.perGiorno['11']).toBe(8);
    expect(r.totale).toBe(12);
  });

  it('notte dell\'ultimo giorno: solo 4 h nel mese', () => {
    expect(oreMese({ anno: 2026, mese: 10, giorni: { '31': ['N1att'] } }).totale).toBe(4);
  });

  it('notte dell\'ultimo giorno del mese precedente: 8 h nel mese corrente', () => {
    const r = oreMese({ anno: 2026, mese: 11, giorni: {}, ultimoGiornoPrecedente: ['N1att'] });
    expect(r.perGiorno['1']).toBe(8);
    expect(r.totale).toBe(8);
  });

  it('a cavallo d\'anno', () => {
    const r = oreMese({ anno: 2027, mese: 1, giorni: { '31': ['N'] }, ultimoGiornoPrecedente: ['N2'] });
    expect(r.totale).toBe(12);
  });

  it('solo la categoria "turno" conta', () => {
    const r = oreMese({ anno: 2026, mese: 10, giorni: { '1': ['F'], '2': ['f'], '3': ['Q'], '4': ['C'], '5': ['RN'], '6': ['LAUREA'], '7': ['-'] } });
    expect(r.totale).toBe(0);
  });

  it('ignora giorni fuori dal mese', () => {
    expect(oreMese({ anno: 2026, mese: 2, giorni: { '30': ['M1'], '0': ['M1'] } }).totale).toBe(0);
  });

  it('cambi: il ceduto non conta, il ricevuto sì', () => {
    const r = oreMese({
      anno: 2026,
      mese: 10,
      giorni: { '6': ['MC', 'PC'], '10': ['N3'] },
      cambi: [
        { data: '2026-10-06', slot: 1, codice: 'PC', verso: 'ceduto', collegaId: 'x' },
        { data: '2026-10-10', slot: 0, codice: 'N3', verso: 'ceduto', collegaId: 'x' },
        { data: '2026-10-20', slot: 0, codice: 'n5', verso: 'ricevuto', collegaId: 'y' },
        { data: '2026-11-03', slot: 0, codice: 'M1', verso: 'ricevuto', collegaId: 'y' }, // altro mese
      ],
    });
    expect(r.totale).toBe(6 + 12);
    expect(r.perGiorno['21']).toBe(8);
    expect(r.cambiNonApplicati).toEqual([]);
  });

  it('cambi sulla notte dell\'ultimo giorno del mese precedente', () => {
    const r = oreMese({
      anno: 2026,
      mese: 11,
      giorni: {},
      ultimoGiornoPrecedente: ['N1'],
      cambi: [{ data: '2026-10-31', slot: 0, codice: 'N1', verso: 'ceduto' }],
    });
    expect(r.totale).toBe(0);
  });

  it('ceduto senza turno corrispondente → segnalato, non applicato', () => {
    const r = oreMese({ anno: 2026, mese: 10, giorni: { '6': ['M1'] }, cambi: [{ data: '2026-10-06', slot: 0, codice: 'P1', verso: 'ceduto' }] });
    expect(r.totale).toBe(6);
    expect(r.cambiNonApplicati).toHaveLength(1);
  });
});

describe('applicaCambi', () => {
  it('abbina lo slot giusto o il primo codice uguale', () => {
    const r = applicaCambi({ '2026-10-06': ['MC', 'PC'] }, [{ data: '2026-10-06', slot: 0, codice: 'PC', verso: 'ceduto', collegaId: 'z' }]);
    expect(r.giorni['2026-10-06']).toEqual([
      { codice: 'MC', stato: 'normale' },
      { codice: 'PC', stato: 'ceduto', collegaId: 'z' },
    ]);
  });
  it('lo stesso turno non si cede due volte', () => {
    const c = { data: '2026-10-06', slot: 0 as const, codice: 'M1', verso: 'ceduto' as const };
    const r = applicaCambi({ '2026-10-06': ['M1'] }, [c, c]);
    expect(r.nonApplicati).toHaveLength(1);
  });
});

describe('oreMese: solo M/P/N contano ore', () => {
  it('corsi, qualità, reperibilità, ferie, malattia, tbd e sconosciuti contano 0', () => {
    const codici = ['F', 'f', '-', 'C', 'Q', 'MR', 'PR', 'RM', 'RP', 'RN', 'RG', 'RN1att', 'RE', 'E', 'EX', 'EU', 'A', 'G', 'SC', 'CD', 'REC', 'LAUREA'];
    const giorni = Object.fromEntries(codici.map((c, i) => [String(i + 1), [c]]));
    expect(oreMese({ anno: 2026, mese: 10, giorni, ultimoGiornoPrecedente: ['RN'] }).totale).toBe(0);
  });
  it('MC/PC/NC e at/att contano come M/P/N', () => {
    const r = oreMese({ anno: 2026, mese: 10, giorni: { '1': ['MC'], '2': ['PCatt'], '3': ['NC'], '5': ['N2att'] } });
    expect(r.totale).toBe(6 + 6 + 12 + 12);
  });
});
