import { describe, expect, it } from 'vitest';
import { chiConMe, costruisciQuadro } from './quadro';

const Q = {
  io: ['M6'],
  a: ['M2'],
  b: ['M5'],
  c: ['P3'],
  d: ['RM'],
  e: ['RG'],
  f: ['N1'],
  g: ['RN'],
  h: ['XYZ', 'F'],
};

describe('costruisciQuadro', () => {
  it('raggruppa per giorno e salta chi non ha codici', () => {
    const q = costruisciQuadro([
      { medicoId: 'a', giorni: { '1': ['M6'], '2': [] } },
      { medicoId: 'b', giorni: { '1': ['P6', 'RG'] } },
    ]);
    expect(q).toEqual({ '1': { a: ['M6'], b: ['P6', 'RG'] } });
  });
});

describe('chiConMe', () => {
  it('mattina semplice: colleghi M per sede + reperibili RM e RG, senza me', () => {
    const r = chiConMe(Q, 'io', ['M6']);
    expect(r).toEqual([
      {
        fascia: 'M',
        inTurno: [
          { medicoId: 'a', codice: 'M2', sede: 2 },
          { medicoId: 'b', codice: 'M5', sede: 5 },
        ],
        reperibili: [
          { medicoId: 'd', tipo: 'RM' },
          { medicoId: 'e', tipo: 'RG' },
        ],
      },
    ]);
  });
  it('MP: gruppi M e P', () => {
    const r = chiConMe(Q, 'io', ['M6', 'P6']);
    expect(r.map((g) => g.fascia)).toEqual(['M', 'P']);
    expect(r[1]).toEqual({ fascia: 'P', inTurno: [{ medicoId: 'c', codice: 'P3', sede: 3 }], reperibili: [{ medicoId: 'e', tipo: 'RG' }] });
  });
  it('notte: solo N e RN', () => {
    const r = chiConMe(Q, 'io', ['N2']);
    expect(r).toEqual([{ fascia: 'N', inTurno: [{ medicoId: 'f', codice: 'N1', sede: 1 }], reperibili: [{ medicoId: 'g', tipo: 'RN' }] }]);
  });
  it('solo reperibile RG: gruppi M e P', () => {
    expect(chiConMe(Q, 'io', ['RG']).map((g) => g.fascia)).toEqual(['M', 'P']);
    expect(chiConMe(Q, 'io', ['RM']).map((g) => g.fascia)).toEqual(['M']);
  });
  it('libero o codici non interpretabili: nessun gruppo', () => {
    expect(chiConMe(Q, 'io', [])).toEqual([]);
    expect(chiConMe(Q, 'io', ['F'])).toEqual([]);
    expect(chiConMe(Q, 'io', ['XYZ'])).toEqual([]);
  });
  it('codici sconosciuti dei colleghi ignorati; giorno assente senza errori', () => {
    const r = chiConMe(Q, 'io', ['M6']);
    expect(r[0]!.inTurno.some((x) => x.medicoId === 'h')).toBe(false);
    expect(chiConMe(undefined, 'io', ['M6'])).toEqual([{ fascia: 'M', inTurno: [], reperibili: [] }]);
  });
  it('esclude me stesso anche se compaio nel quadro come reperibile', () => {
    const r = chiConMe({ io: ['M6', 'RG'], a: ['M1'] }, 'io', ['M6']);
    expect(r[0]!.inTurno.map((x) => x.medicoId)).toEqual(['a']);
    expect(r[0]!.reperibili).toEqual([]);
  });
});
