import { describe, expect, it } from 'vitest';
import { chiConMe, chiMiDaIlCambio, costruisciQuadro, turnoDiPartenza } from './quadro';

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

describe('chiMiDaIlCambio', () => {
  it('N che finisce alle 8: cambio M del giorno dopo sulla stessa sede', () => {
    const r = chiMiDaIlCambio({
      medicoId: 'io', fasciaPartenza: 'N',
      giorni: [{ io: ['N3'] }, { zeta: ['M3'], alfa: ['M3'], altro: ['M4'] }],
    });
    expect(r).toEqual({ sede: 3, cambio: { medicoId: 'alfa', codice: 'M3', fascia: 'M', sede: 3, giorniDopo: 1 } });
  });
  it('MP sulla stessa sede: il cambio è sulla N', () => {
    const r = chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'M', giorni: [{ io: ['M2', 'P2'], b: ['N2'] }] });
    expect(r?.cambio).toMatchObject({ medicoId: 'b', fascia: 'N', giorniDopo: 0 });
  });
  it('MP in sedi diverse: il cambio di M è il P di un altro', () => {
    const r = chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'M', giorni: [{ io: ['M2', 'P5'], b: ['P2'] }] });
    expect(r?.cambio).toMatchObject({ medicoId: 'b', fascia: 'P', sede: 2 });
  });
  it('nessuno sullo slot: cambio null', () => {
    const r = chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'M', giorni: [{ io: ['M2'], b: ['P3', 'RP'] }] });
    expect(r).toEqual({ sede: 2, cambio: null });
  });
  it('escludo me stesso', () => {
    const r = chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'M', giorni: [{ io: ['M2', 'P2'] }] });
    expect(r?.cambio).toBeNull();
  });
  it('turno senza sede o assente: null', () => {
    expect(chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'M', giorni: [{ io: ['M'] }] })).toBeNull();
    expect(chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'P', giorni: [{ io: ['M2'] }] })).toBeNull();
  });
  it('giorno successivo non disponibile: cambio null', () => {
    expect(chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'N', giorni: [{ io: ['N1'] }, undefined] })).toEqual({ sede: 1, cambio: null });
    expect(chiMiDaIlCambio({ medicoId: 'io', fasciaPartenza: 'N', giorni: [{ io: ['N1'] }] })?.cambio).toBeNull();
  });
});

describe('turnoDiPartenza', () => {
  it('giorno a calendario: primo turno del giorno', () => {
    expect(turnoDiPartenza({ mieiCodiciOggi: ['RG', 'P2', 'N2'] })).toEqual({ giorno: 'oggi', fascia: 'P' });
    expect(turnoDiPartenza({ mieiCodiciOggi: ['F'] })).toBeNull();
  });
  it('alle 6 dopo una notte: la notte di ieri', () => {
    expect(turnoDiPartenza({ mieiCodiciIeri: ['N1'], mieiCodiciOggi: ['M1'], ora: 6 })).toEqual({ giorno: 'ieri', fascia: 'N' });
  });
  it('alle 10 con MP: M (in corso)', () => {
    expect(turnoDiPartenza({ mieiCodiciOggi: ['P2', 'M2'], ora: 10 })).toEqual({ giorno: 'oggi', fascia: 'M' });
  });
  it('alle 21 con solo P: null', () => {
    expect(turnoDiPartenza({ mieiCodiciOggi: ['P2'], ora: 21 })).toBeNull();
  });
});
