import { describe, expect, it } from 'vitest';
import { anteprima, contaNonLette, LIMITI_FEEDBACK, ordinaConversazioni, validaArgomento, validaPresentazione, validaTestoMessaggio } from './feedback';

describe('validazioni', () => {
  it('argomento: obbligatorio, max 80', () => {
    expect(validaArgomento('   ')).not.toBeNull();
    expect(validaArgomento('Idea')).toBeNull();
    expect(validaArgomento('x'.repeat(80))).toBeNull();
    expect(validaArgomento('x'.repeat(81))).not.toBeNull();
  });
  it('messaggio: obbligatorio, max 1000', () => {
    expect(validaTestoMessaggio('')).not.toBeNull();
    expect(validaTestoMessaggio('x'.repeat(1000))).toBeNull();
    expect(validaTestoMessaggio('x'.repeat(1001))).not.toBeNull();
  });
  it('presentazione: può essere vuota, max 200', () => {
    expect(validaPresentazione('')).toBeNull();
    expect(validaPresentazione('x'.repeat(200))).toBeNull();
    expect(validaPresentazione('x'.repeat(201))).not.toBeNull();
  });
});

describe('anteprima', () => {
  it('comprime gli spazi e non supera il limite', () => {
    expect(anteprima('  ciao \n\n  mondo ')).toBe('ciao mondo');
    const a = anteprima('parola '.repeat(60));
    expect(a.length).toBeLessThanOrEqual(LIMITI_FEEDBACK.anteprima);
    expect(a.endsWith('…')).toBe(true);
  });
});

describe('ordinamento e conteggio', () => {
  const c = (id: string, ora: number | undefined, nonLettoAdmin: boolean, nonLettoUtente = false) => ({
    id,
    nonLettoAdmin,
    nonLettoUtente,
    aggiornatoIl: ora === undefined ? undefined : new Date(ora),
  });
  const elenco = [c('a', 3, false), c('b', 1, true), c('c', 2, true), c('d', undefined, false)];
  it('non lette prima, poi più recenti (locale non confermata = più recente)', () => {
    expect(ordinaConversazioni(elenco, true).map((x) => x.id)).toEqual(['c', 'b', 'd', 'a']);
  });
  it('non modifica l’elenco originale', () => {
    ordinaConversazioni(elenco, true);
    expect(elenco.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('conta per ruolo', () => {
    expect(contaNonLette(elenco, true)).toBe(2);
    expect(contaNonLette(elenco, false)).toBe(0);
  });
});
