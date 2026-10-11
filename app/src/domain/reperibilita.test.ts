import { describe, expect, it } from 'vitest';
import { contaReperibilita, reperibilitaDaControllare } from './reperibilita';
import { interpretaCodice } from './codici';

describe('contaReperibilita', () => {
  it('conta i giorni per tipo, non le occorrenze', () => {
    const r = contaReperibilita({
      '1': ['RN'],
      '2': ['RN', 'RN'], // due righe stesso tipo: 1 giorno
      '3': ['RM', 'RP'],
      '4': ['RG'],
      '5': ['M6'],
    });
    expect(r).toEqual({ RM: 1, RP: 1, RN: 2, RG: 1 });
  });

  it('mese vuoto: tutti zero', () => {
    expect(contaReperibilita({})).toEqual({ RM: 0, RP: 0, RN: 0, RG: 0 });
  });

  it('varianti inequivocabili (sede, at/att, minuscole, spazi) contano per il tipo base', () => {
    const r = contaReperibilita({ '1': ['RN1'], '2': ['rn att'], '3': ['RG7At'], '4': ['\u00A0rm\u00A0'] });
    expect(r).toEqual({ RM: 1, RP: 0, RN: 2, RG: 1 });
  });

  it('RE non ha contatore; varianti ambigue non contano', () => {
    const r = contaReperibilita({ '1': ['RE'], '2': ['RN16'], '3': ['RMP'], '4': ['RNC'] });
    expect(r).toEqual({ RM: 0, RP: 0, RN: 0, RG: 0 });
  });

  it('ignora chiavi che non sono giorni', () => {
    expect(contaReperibilita({ '0': ['RN'], '32': ['RN'], x: ['RN'] }).RN).toBe(0);
  });
});

describe('reperibilitaDaControllare', () => {
  it('elenca le varianti ambigue, non RE né le forme valide', () => {
    expect(reperibilitaDaControllare({ '5': ['RNC'], '2': ['RN16', 'RN1'], '3': ['RE', 'laurea'] })).toEqual([
      { giorno: 2, codice: 'RN16' },
      { giorno: 5, codice: 'RNC' },
    ]);
  });
});

describe('interpretaCodice: reperibilità', () => {
  it('forma canonica stabile e categoria reperibilità', () => {
    expect(interpretaCodice('rn1 AT')).toMatchObject({ grezzo: 'RN1att', reperibilita: 'RN', sede: 1, attivazione: true, categoria: 'reperibilita' });
    expect(interpretaCodice('RN1att')?.grezzo).toBe('RN1att');
    expect(interpretaCodice('RE')).toMatchObject({ categoria: 'reperibilita' });
    expect(interpretaCodice('RE')?.reperibilita).toBeUndefined();
    expect(interpretaCodice('REC')?.categoria).toBe('altro');
    expect(interpretaCodice('MR')?.categoria).toBe('qualita');
  });
});
