import { describe, expect, it } from 'vitest';
import { contaOre, descriviCodice, ETICHETTA_DA_CONTROLLARE, interpretaCodice, LEGENDA, pulisciCodice, SUFFISSI_TURNO } from './codici';

describe('pulisciCodice', () => {
  it('toglie spazi, spazi non separabili e spazi interni', () => {
    expect(pulisciCodice('  M6 ')).toBe('M6');
    expect(pulisciCodice('\u00A0p3\u00A0')).toBe('P3');
    expect(pulisciCodice('N1 att')).toBe('N1ATT');
    expect(pulisciCodice('\u200BQ')).toBe('Q');
  });
  it('mette in maiuscolo tranne la f di malattia', () => {
    expect(pulisciCodice('f')).toBe('f');
    expect(pulisciCodice(' f ')).toBe('f');
    expect(pulisciCodice('F')).toBe('F');
    expect(pulisciCodice('mc')).toBe('MC');
  });
  it('celle vuote e numeri', () => {
    expect(pulisciCodice(null)).toBe('');
    expect(pulisciCodice(' ')).toBe('');
    expect(pulisciCodice(274)).toBe('274');
  });
});

describe('interpretaCodice', () => {
  it('turni con sede', () => {
    expect(interpretaCodice('M6')).toEqual({ grezzo: 'M6', originale: 'M6', fascia: 'M', sede: 6, categoria: 'turno' });
    expect(interpretaCodice('N7')?.sede).toBe(7);
  });
  it('turni senza sede', () => {
    expect(interpretaCodice('P')).toMatchObject({ grezzo: 'P', fascia: 'P', categoria: 'turno' });
    expect(interpretaCodice('P')?.sede).toBeUndefined();
  });
  it('sede fuori da 1..7 non è un turno', () => {
    expect(interpretaCodice('M8')?.categoria).toBe('sconosciuto');
    expect(interpretaCodice('M0')?.categoria).toBe('sconosciuto');
  });
  it('suffisso C (centrale)', () => {
    expect(interpretaCodice('MC')).toMatchObject({ grezzo: 'MC', fascia: 'M', centrale: true, categoria: 'turno' });
    expect(interpretaCodice('nc')).toMatchObject({ grezzo: 'NC', centrale: true });
  });
  it('suffisso attivazione in tutte le varianti → forma canonica "att"', () => {
    for (const v of ['N1at', 'N1att', 'N1At', 'N1Att', 'N1 att', 'n1 AT']) {
      expect(interpretaCodice(v)).toMatchObject({ grezzo: 'N1att', fascia: 'N', sede: 1, attivazione: true });
    }
    expect(interpretaCodice('NC att')).toMatchObject({ grezzo: 'NCatt', centrale: true, attivazione: true });
    expect(interpretaCodice('PCat')?.grezzo).toBe('PCatt');
  });
  it('la forma canonica è stabile (re-interpretazione da Firestore)', () => {
    for (const v of ['NCatt', 'M6', 'f', 'F', 'RE', 'laurea']) {
      const c = interpretaCodice(v)!;
      expect(interpretaCodice(c.grezzo)?.grezzo).toBe(c.grezzo);
    }
  });
  it('assenze e altri codici', () => {
    expect(interpretaCodice('F')?.categoria).toBe('ferie');
    expect(interpretaCodice('f')?.categoria).toBe('malattia');
    expect(interpretaCodice('-')?.categoria).toBe('indisponibile');
    expect(interpretaCodice('C')?.categoria).toBe('corso');
    expect(interpretaCodice('Q')?.categoria).toBe('qualita');
    expect(interpretaCodice('MR')?.categoria).toBe('qualita');
    expect(interpretaCodice('Re')).toMatchObject({ grezzo: 'RE', categoria: 'reperibilita' });
    expect(interpretaCodice('Ex')).toMatchObject({ grezzo: 'EX', categoria: 'altro' });
  });
  it('codici sconosciuti conservati, mai scartati', () => {
    expect(interpretaCodice('PC16,30')).toEqual({ grezzo: 'PC16,30', originale: 'PC16,30', categoria: 'sconosciuto' });
    expect(interpretaCodice('laurea')).toMatchObject({ grezzo: 'LAUREA', originale: 'laurea', categoria: 'sconosciuto' });
  });
  it('null per celle vuote', () => {
    expect(interpretaCodice('')).toBeNull();
    expect(interpretaCodice('\u00A0')).toBeNull();
    expect(interpretaCodice(undefined)).toBeNull();
  });
});

describe('legenda: codici tbd e da controllare', () => {
  it('codici di significato ignoto hanno descrizione "tbd"', () => {
    for (const k of ['RE', 'E', 'EX', 'EU', 'A', 'G', 'SC', 'CD', 'REC']) {
      expect(LEGENDA[k]).toMatchObject({ descrizione: 'tbd', tbd: true });
    }
    expect(SUFFISSI_TURNO.C.tbd).toBe(true);
    expect(SUFFISSI_TURNO.att.tbd).toBe(true);
    expect(LEGENDA['F']!.tbd).toBeUndefined();
    expect(LEGENDA['RN']!.descrizione).toBe('Reperibilità Notte');
  });
  it('"e" minuscola equivale a E (tbd)', () => {
    expect(descriviCodice('e')).toEqual({ descrizione: 'tbd', tbd: true, daControllare: false });
  });
  it('descriviCodice: turni, suffissi, reperibilità, sconosciuti', () => {
    expect(descriviCodice('M6')).toEqual({ descrizione: 'Mattino, sede 6', tbd: false, daControllare: false });
    expect(descriviCodice('NC att')).toMatchObject({ tbd: true, daControllare: false });
    expect(descriviCodice('NC att').descrizione).toMatch(/^Notte, Suffisso C \(tbd\), Attivazione \(tbd\)$/);
    expect(descriviCodice('RN1')).toEqual({ descrizione: 'Reperibilità Notte, sede 1', tbd: false, daControllare: false });
    expect(descriviCodice('F').descrizione).toBe('Ferie');
    expect(descriviCodice('laurea')).toEqual({ descrizione: ETICHETTA_DA_CONTROLLARE, tbd: false, daControllare: true });
    expect(ETICHETTA_DA_CONTROLLARE).toBe('da controllare');
  });
  it('contaOre: solo M/P/N, anche con C e at/att', () => {
    for (const v of ['M', 'P3', 'N7', 'MC', 'PC', 'NC', 'N1att', 'PCat']) expect(contaOre(interpretaCodice(v))).toBe(true);
    for (const v of ['F', 'f', '-', 'C', 'Q', 'MR', 'PR', 'RM', 'RP', 'RN', 'RG', 'RN1att', 'RE', 'E', 'EX', 'EU', 'A', 'G', 'SC', 'CD', 'REC', 'laurea', 'PC16,30']) {
      expect(contaOre(interpretaCodice(v))).toBe(false);
    }
    expect(contaOre(null)).toBe(false);
  });
});
